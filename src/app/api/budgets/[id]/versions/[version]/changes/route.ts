import { z } from "zod";
import type { BudgetItemEdit } from "@/lib/domain";
import { authenticated } from "@/lib/server/workspace";
import { ApiError, endpoint, json, databaseError } from "@/lib/server/http";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  return endpoint(async () => {
    const ids = z.object({ id: z.uuid(), version: z.uuid() }).parse(await params);
    const revision = z.coerce.number().int().min(0).max(2147483647).parse(new URL(request.url).searchParams.get("revision") ?? 2147483647);
    const context = await authenticated();
    const { data: version, error } = await context.supabase.from("budget_versions").select("id")
      .eq("id", ids.version).eq("budget_id", ids.id).eq("organization_id", context.organizationId).maybeSingle();
    if (error) databaseError(error);
    if (!version) throw new ApiError(404, "Versión no encontrada en este presupuesto.");
    const edits: BudgetItemEdit[] = [];
    for (let offset = 0; offset < 20000; offset += 500) {
      const { data, error: readError } = await context.supabase.rpc("budget_item_change_dates", { p_version_id: ids.version, p_draft_revision: revision })
        .order("item_id").range(offset, offset + 499);
      if (readError) {
        if (["42883", "PGRST202"].includes(readError.code)) return json({ available: false, edits: [] });
        databaseError(readError);
      }
      edits.push(...(data ?? []));
      if ((data?.length ?? 0) < 500) return json({ available: true, edits });
    }
    throw new ApiError(503, "El registro necesita paginación adicional. No se han truncado las fechas.");
  });
}
