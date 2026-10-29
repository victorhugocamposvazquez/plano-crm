import { requireSuperadmin } from "@/lib/server/superadmin";
import { ApiError, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Solo descubre si debe mostrarse el acceso; nunca devuelve configuración o identidad. */
export async function GET() {
  try {
    await requireSuperadmin();
    return json({ allowed: true });
  } catch (error) {
    if (error instanceof ApiError) return json({ allowed: false }, error.status);
    return json({ allowed: false }, 503);
  }
}
