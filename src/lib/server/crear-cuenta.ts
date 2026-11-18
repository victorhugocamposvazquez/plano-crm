import "server-only";
import { createClient } from "@supabase/supabase-js";
import { altaCuenta, type AltaCuenta } from "@/lib/cuentas";
import { authenticated, loadWorkspace } from "./workspace";
import { ApiError } from "./http";

/** Crea la cuenta de acceso y la añade al equipo con el puesto y el permiso elegidos. Sin correo de invitación. */
export async function crearCuenta(input: AltaCuenta) {
  const datos = altaCuenta.parse(input);
  const context = await authenticated();
  if (context.actor.role !== "admin") throw new ApiError(403, "Solo administración puede crear cuentas.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new ApiError(503, "Falta en el servidor la clave para crear cuentas. No se ha creado nadie.");
  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email: datos.email,
    password: datos.password,
    email_confirm: true,
    user_metadata: { name: datos.name }
  });
  if (error || !data.user) {
    const texto = error?.message ?? "";
    if (/already|registered|exists/i.test(texto)) throw new ApiError(409, "Ya hay una cuenta con ese correo.");
    throw new ApiError(400, "No se ha podido crear la cuenta. Revisa el correo y que la contraseña tenga al menos 8 caracteres.");
  }
  const { error: alta } = await admin.from("organization_members").insert({
    organization_id: context.organizationId,
    user_id: data.user.id,
    display_name: datos.name,
    position: datos.position,
    role: datos.role
  });
  if (alta) {
    await admin.auth.admin.deleteUser(data.user.id);
    if (alta.code === "23505") throw new ApiError(409, "Esa persona ya pertenece a un equipo.");
    throw new ApiError(400, "No se ha podido añadir la cuenta al equipo. No ha quedado nadie a medias.");
  }
  await admin.from("activities").insert({
    organization_id: context.organizationId,
    project_id: null,
    text: `Cuenta creada: ${datos.name}`,
    actor_name: context.actor.name,
    actor_id: context.actor.id,
    command_type: "member.invite"
  });
  return loadWorkspace(context);
}
