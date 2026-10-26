import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function json(data: unknown, status=200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie, Origin" } });
}
export async function endpoint(handler: () => Promise<Response>) {
  try { return await handler(); }
  catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError) return json({ error: "Revisa los campos de la solicitud.", fields: error.issues.map(i => ({ path: i.path.join("."), message: i.message })) }, 400);
    console.error("[plano] Fallo inesperado en una ruta de servidor", error instanceof Error ? error.name : "Unknown");
    return json({ error: "No se ha podido completar la operación. Inténtalo de nuevo." }, 500);
  }
}
export async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new ApiError(403,"Origen de la solicitud no permitido.");
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError(415,"Se requiere una solicitud JSON.");
  // Leer el stream con límite también protege frente a peticiones sin Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400,"Faltan los datos de la solicitud.");
  const chunks: Uint8Array[] = []; let size=0;
  try {
    while (true) { const { done,value } = await reader.read(); if (done) break; size += value.byteLength; if (size>2*1024*1024) { await reader.cancel(); throw new ApiError(413,"La solicitud es demasiado grande."); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset=0; for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.byteLength; }
  let parsed: unknown; try { parsed=JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ApiError(400,"El JSON de la solicitud no es válido."); }
  return schema.parse(parsed);
}
export function databaseError(error: { code?: string; message?: string }): never {
  const errors: Record<string,[number,string]> = {
    "42501": [403,"Tu perfil no tiene permiso para esta acción."],
    "P0002": [404,"El registro no existe o no pertenece a tu organización."],
    "40001": [409,"Otra persona ha actualizado el borrador. Recarga antes de continuar."],
    "23505": [409,"Ya existe ese registro o hay una revisión en preparación."],
    "23503": [400,"Los registros seleccionados no pertenecen al mismo proyecto."],
    "23514": [400,"Los valores no cumplen las reglas del proyecto. Revisa cantidades, estados e importes."],
    "22023": [400,"La operación no es válida para el estado actual. Revisa la revisión, las partidas y los importes."],
    "22P02": [400,"Alguno de los valores tiene un formato incorrecto."]
  };
  const mapped=errors[error.code || ""];
  if (mapped) throw new ApiError(...mapped);
  console.error("[plano] Error de base de datos", error.code || "unknown");
  throw new ApiError(503,"No se ha podido acceder a los datos. Comprueba la configuración y las migraciones.");
}
