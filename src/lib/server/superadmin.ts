import "server-only";
import { z } from "zod";
import { authenticated } from "@/lib/server/workspace";
import { ApiError } from "@/lib/server/http";

/** La administración de una empresa no concede administración del producto. */
export function isSuperadminUser(userId: string, configuredIds: string | undefined): boolean {
  const ids = (configuredIds ?? "").split(",").map(id => id.trim());
  // Una configuración incompleta o incorrecta deniega todo el acceso.
  if (!ids.length || ids.some(id => !z.uuid().safeParse(id).success)) return false;
  return z.uuid().safeParse(userId).success && ids.some(id => id.toLowerCase() === userId.toLowerCase());
}

export async function requireSuperadmin() {
  const configuredIds = process.env.PLANO_SUPERADMIN_USER_IDS;
  if (!configuredIds || !configuredIds.split(",").every(id => z.uuid().safeParse(id.trim()).success)) {
    throw new ApiError(403, "Esta sección está reservada a la supervisión de PLANO.");
  }
  // getUser valida la sesión en Supabase; no se aceptan roles ni IDs del navegador.
  // Conservamos además el contexto de organización del resto de la aplicación.
  const context = await authenticated();
  if (!isSuperadminUser(context.actor.id, configuredIds)) {
    throw new ApiError(403, "Esta sección está reservada a la supervisión de PLANO.");
  }
  return context;
}
