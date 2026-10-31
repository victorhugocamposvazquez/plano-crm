import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Actor, Workspace } from "@/lib/domain";
import { ApiError, databaseError } from "./http";

export function requireConfiguration() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) throw new ApiError(503,"Supabase todavía no está configurado. Completa las variables del entorno.");
}
export async function authenticated() {
  requireConfiguration();
  const supabase=await createClient();
  const { data: { user },error } = await supabase.auth.getUser();
  if (error || !user) throw new ApiError(401,"Inicia sesión para acceder a PLANO.");
  const { data: memberships,error: membershipError }=await supabase.from("organization_members").select("organization_id,display_name,role").eq("user_id",user.id);
  if (membershipError) databaseError(membershipError);
  if (!memberships?.length) throw new ApiError(403,"Tu cuenta no tiene acceso a una organización. Contacta con administración.");
  if (memberships.length!==1) throw new ApiError(409,"Tu cuenta tiene varios espacios. Falta configurar la selección de organización.");
  const member=memberships[0];
  return { supabase, organizationId: member.organization_id as string, actor: { id:user.id, name:member.display_name, role:member.role } as Actor };
}
export type AuthContext=Awaited<ReturnType<typeof authenticated>>;
export async function loadWorkspace({ supabase,organizationId }: AuthContext): Promise<Workspace> {
  const { data: org,error }=await supabase.from("organizations").select("id,name").eq("id",organizationId).single();
  if(error) databaseError(error);
  const tables={ projects:"projects",articles:"articles",budgets:"budgets",versions:"budget_versions",tasks:"tasks",purchases:"purchases",documents:"documents",messages:"messages",activities:"activities",certifications:"certifications",invoices:"invoices" } as const;
  const entries=await Promise.all(Object.entries(tables).map(async ([key,table])=>{
    const rows: unknown[]=[];
    for(let offset=0;offset<20000;offset+=500) {
      let query=supabase.from(table).select("*").eq("organization_id",organizationId);
      query=table==="activities" ? query.order("created_at",{ascending:false}).order("id") : query.order("id");
      const { data,error }=await query.range(offset,offset+(table==="activities"?199:499));
      // Tolera el hueco entre desplegar y aplicar la migración de facturas: el espacio carga igual.
      if(error && table==="invoices" && (error.code==="42P01" || error.code==="PGRST205")) return [key,[]];
      if(error) databaseError(error);
      rows.push(...(data || []));
      if(table==="activities" || (data?.length || 0)<500) return [key,rows];
    }
    throw new ApiError(503,"El espacio requiere paginación adicional. Contacta con soporte; no se han truncado los datos.");
  }));
  return { organization_id:organizationId,organization_name:org!.name,...Object.fromEntries(entries) } as Workspace;
}
