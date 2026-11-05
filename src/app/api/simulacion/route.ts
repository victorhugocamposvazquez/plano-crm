import { authenticated } from "@/lib/server/workspace";
import { ApiError, body, endpoint, json } from "@/lib/server/http";
import { API_REVISION, MODELO_POR_DEFECTO, URL_INTERACTIONS, cuerpoInteractions, imagenDeRespuesta, mensajeError, pedidoSimulacion } from "@/lib/simulacion";

export const maxDuration = 60;

/** Límite por persona y hora en este servidor: la simulación cuesta dinero por imagen. */
const LIMITE_HORA = 20;
const usos = new Map<string, number[]>();
function contar(quien: string) {
  const ahora = Date.now(), recientes = (usos.get(quien) ?? []).filter(t => ahora - t < 3_600_000);
  if (recientes.length >= LIMITE_HORA) throw new ApiError(429, `Has hecho ${LIMITE_HORA} simulaciones en la última hora. Espera un poco.`);
  recientes.push(ahora); usos.set(quien, recientes);
}

/**
 * Simula una vista con Gemini (edición de imagen, de pago por imagen). La clave vive solo en el servidor (GEMINI_API_KEY).
 * Con Supabase configurado exige sesión; sin Supabase (demostración) solo se atiende en local.
 */
export async function POST(request: Request) { return endpoint(async () => {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new ApiError(503, "La simulación no está activada: falta la clave de Gemini (GEMINI_API_KEY) en el servidor.");
  let quien = "demo";
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) quien = (await authenticated()).actor.id;
  else if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(request.url).hostname)) throw new ApiError(403, "La simulación necesita iniciar sesión.");
  const pedido = await body(request, pedidoSimulacion);
  contar(quien);
  const respuesta = await fetch(URL_INTERACTIONS, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": clave, "Api-Revision": API_REVISION },
    body: JSON.stringify(cuerpoInteractions(pedido, process.env.GEMINI_MODELO_IMAGEN || MODELO_POR_DEFECTO)),
    signal: AbortSignal.timeout(55_000)
  }).catch(() => null);
  if (!respuesta) throw new ApiError(504, "Gemini ha tardado demasiado. Inténtalo de nuevo.");
  if (!respuesta.ok) { console.error("[plano] Gemini respondió", respuesta.status); throw new ApiError(respuesta.status === 429 ? 429 : 502, mensajeError(respuesta.status)); }
  const imagen = imagenDeRespuesta(await respuesta.json().catch(() => null));
  if (!imagen) throw new ApiError(502, "Gemini no ha devuelto ninguna imagen. Prueba con otra vista.");
  return json({ imagen: `data:${imagen.mime};base64,${imagen.data}` });
}); }
