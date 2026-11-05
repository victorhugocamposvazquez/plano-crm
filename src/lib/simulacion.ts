/**
 * Simulación de una vista con IA (Gemini, edición de imagen): se le manda la vista que se está mirando en la visita 360
 * y los materiales del catálogo puestos en esa estancia, y devuelve una foto realista con ellos.
 * Es orientativa: no mide ni compromete; el presupuesto sale siempre del catálogo y de las medidas.
 * Aquí solo lo puro (texto de la petición, cuerpo y lectura de la respuesta), para probarlo sin clave.
 */
import { z } from "zod";

export const MODELO_POR_DEFECTO = "gemini-nano-banana-2.1";
export const URL_INTERACTIONS = "https://generativelanguage.googleapis.com/v1beta/interactions";
/** Revisión de la API que usan los ejemplos oficiales de edición de imagen. */
export const API_REVISION = "2026-05-20";

const dataUrl = (max: number) => z.string().max(max).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Imagen no válida");
export const pedidoSimulacion = z.object({
  imagen: dataUrl(1_500_000),
  estancia: z.string().trim().max(80).optional(),
  materiales: z.array(z.object({ nombre: z.string().trim().min(1).max(200), superficie: z.enum(["suelo", "pared", "techo", "otro"]) })).min(1).max(6),
  referencias: z.array(z.object({ nombre: z.string().trim().min(1).max(200), imagen: dataUrl(350_000) })).max(3).optional()
});
export type PedidoSimulacion = z.infer<typeof pedidoSimulacion>;

const donde: Record<PedidoSimulacion["materiales"][number]["superficie"], string> = {
  suelo: "the floor", pared: "the walls", techo: "the ceiling", otro: "where it naturally belongs in this room"
};

/** Lo que se le pide a Gemini. En inglés, que es como mejor sigue instrucciones de edición; los materiales van con su nombre del catálogo. */
export function textoSimulacion(p: Pick<PedidoSimulacion, "materiales" | "referencias" | "estancia">): string {
  const lineas = p.materiales.map(m => {
    const ref = p.referencias?.findIndex(r => r.nombre === m.nombre) ?? -1;
    return `- Apply "${m.nombre}" to ${donde[m.superficie]}${ref >= 0 ? ` (reference image ${ref + 2} shows the material)` : ""}.`;
  });
  return [
    `Edit image 1, a photo of ${p.estancia ? `the ${p.estancia}` : "a room"} that is going to be renovated.`,
    "Keep exactly the same camera position, perspective, framing, room geometry, windows, doors, furniture and lighting.",
    "Only change these finishes, realistically, following the real shapes, edges and shadows of the room:",
    ...lineas,
    "Do not add, remove or move any object. Do not add text, labels or watermarks. Photorealistic result."
  ].join("\n");
}

const partir = (u: string) => { const m = u.match(/^data:(image\/[a-z]+);base64,(.*)$/); return m ? { mime_type: m[1], data: m[2] } : null; };

/** Cuerpo de la petición a la API Interactions: texto, la vista (imagen 1) y las referencias de material. */
export function cuerpoInteractions(p: PedidoSimulacion, modelo = MODELO_POR_DEFECTO) {
  const imagenes = [p.imagen, ...(p.referencias ?? []).map(r => r.imagen)].map(partir).filter((x): x is { mime_type: string; data: string } => Boolean(x));
  return {
    model: modelo,
    input: [{ type: "text", text: textoSimulacion(p) }, ...imagenes.map(i => ({ type: "image", ...i }))],
    response_format: { type: "image", mime_type: "image/jpeg", image_size: "1K" }
  };
}

/**
 * La imagen de la respuesta, venga como venga: bloques `{ type: "image", data, mime_type }` dentro de `steps[].content`
 * (API Interactions) o `inlineData` / `inline_data` en `candidates[].content.parts` (generateContent). Se toma la última.
 */
export function imagenDeRespuesta(json: unknown): { mime: string; data: string } | null {
  let hallada: { mime: string; data: string } | null = null;
  const visitar = (v: unknown, enEntrada: boolean) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) { v.forEach(x => visitar(x, enEntrada)); return; }
    const o = v as Record<string, unknown>;
    // Lo que se mandó (la vista original) viene en los pasos de entrada: no es la respuesta.
    const entrada = enEntrada || o.type === "user_input";
    if (!entrada && o.type === "image" && typeof o.data === "string" && o.data.length > 100) hallada = { mime: typeof o.mime_type === "string" ? o.mime_type : "image/jpeg", data: o.data };
    const inline = (o.inlineData ?? o.inline_data) as Record<string, unknown> | undefined;
    if (!entrada && inline && typeof inline.data === "string" && inline.data.length > 100) hallada = { mime: String(inline.mimeType ?? inline.mime_type ?? "image/jpeg"), data: inline.data };
    for (const [k, x] of Object.entries(o)) if (k !== "data") visitar(x, entrada);
  };
  visitar(json, false);
  return hallada;
}

/** Mensaje para la persona según lo que conteste Google. */
export function mensajeError(status: number): string {
  if (status === 400) return "Gemini no ha aceptado la petición. Prueba con otra vista o menos materiales.";
  if (status === 401 || status === 403) return "La clave de Gemini no es válida o no tiene facturación activada.";
  if (status === 404) return "Ese modelo de Gemini no está disponible. Revisa GEMINI_MODELO_IMAGEN.";
  if (status === 429) return "Se ha alcanzado el límite de Gemini. Espera un poco y vuelve a intentarlo.";
  return "Gemini no ha podido hacer la simulación ahora. Inténtalo de nuevo en un momento.";
}
