/**
 * SAM 2.1 (Segment Anything 2, de Meta, licencia Apache 2.0) ejecutado en el navegador con transformers.js.
 * El modelo pequeño («hiera tiny») se descarga una vez de Hugging Face y el navegador lo guarda en caché.
 * Con WebGPU va en la tarjeta gráfica; si no la hay, en el procesador (más lento).
 * SAM no sabe qué es un suelo: recorta lo que se le señala con puntos. Quién le señala es `sam360.ts`.
 */
export type Embedding = Record<string, unknown>;
export type Recorte = { logits: Float32Array; m: number; calidad: number };
export type Sam = {
  dispositivo: "webgpu" | "wasm" | "cpu";
  codificar(rgba: Uint8ClampedArray, n: number): Promise<Embedding>;
  /** Puntos en píxeles de la vista (n × n) y etiquetas: 1 dentro, 0 fuera. Devuelve el mejor de los tres recortes (logits m × m). */
  recortar(emb: Embedding, puntos: [number, number][], etiquetas: number[], n: number): Promise<Recorte>;
  /**
   * Un recorte por cada punto suelto, todos en una llamada (como el modo automático de SAM). De los tres niveles que propone
   * SAM para cada punto se queda el más grande de los buenos: en una superficie interesa el suelo entero, no una baldosa.
   */
  recortarCada(emb: Embedding, puntos: [number, number][], n: number): Promise<{ bits: Uint8Array; m: number; calidad: number }[]>;
};

export const MODELO_SAM = "onnx-community/sam2.1-hiera-tiny-ONNX";
const MEDIA = [0.485, 0.456, 0.406], DESV = [0.229, 0.224, 0.225];

let cargando: Promise<Sam> | null = null;

/** Carga SAM una sola vez por página. `alProgreso` recibe la fracción descargada (0 a 1). */
export function cargarSam(alProgreso?: (fraccion: number) => void): Promise<Sam> {
  cargando ??= crear(alProgreso).catch(e => { cargando = null; throw e; });
  return cargando;
}

async function crear(alProgreso?: (fraccion: number) => void): Promise<Sam> {
  const tf = await import("@huggingface/transformers");
  const enNavegador = typeof window !== "undefined";
  let dispositivo: Sam["dispositivo"] = enNavegador ? "wasm" : "cpu", f16 = false;
  if (enNavegador) {
    try {
      const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
      const adaptador = gpu ? await gpu.requestAdapter() : null;
      if (adaptador) { dispositivo = "webgpu"; f16 = adaptador.features.has("shader-f16"); }
    } catch { /* sin WebGPU */ }
    // Sin WebGPU, que el procesador trabaje en un hilo aparte para no congelar la pantalla.
    try { const wasm = (tf.env.backends.onnx as { wasm?: { proxy?: boolean } }).wasm; if (wasm && dispositivo === "wasm") wasm.proxy = true; } catch { /* sin hilo aparte */ }
  }
  const dtype = dispositivo === "webgpu" ? (f16 ? "fp16" : "fp32") : "quantized";
  const archivos = new Map<string, [number, number]>();
  const modelo = await tf.Sam2Model.from_pretrained(MODELO_SAM, {
    device: dispositivo, dtype,
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== "progress" || !p.file || !p.total) return;
      archivos.set(p.file, [p.loaded ?? 0, p.total]);
      let a = 0, b = 0; for (const [x, y] of archivos.values()) { a += x; b += y; }
      alProgreso?.(b ? a / b : 0);
    }
  } as Parameters<typeof tf.Sam2Model.from_pretrained>[1]);

  type T = { type: string; data: ArrayLike<number>; dims: number[]; to(t: string): T };
  // Con el modelo en fp16 las salidas vienen en medio flotante: se pasan a float32.
  const a32 = (t: T) => (t.type === "float16" ? t.to("float32") : t);
  async function decodificar(entradas: Record<string, unknown>) {
    const salida = await (modelo as unknown as (x: Record<string, unknown>) => Promise<{ pred_masks: T; iou_scores: T }>)(entradas);
    return { masks: a32(salida.pred_masks), iou: Array.from(a32(salida.iou_scores).data) };
  }

  return {
    dispositivo,
    async codificar(rgba, n) {
      const px = new Float32Array(3 * n * n), plano = n * n;
      for (let i = 0; i < plano; i++) for (let c = 0; c < 3; c++) px[c * plano + i] = (rgba[i * 4 + c] / 255 - MEDIA[c]) / DESV[c];
      const pixel_values = new tf.Tensor("float32", px, [1, 3, n, n]);
      return await (modelo as unknown as { get_image_embeddings(x: { pixel_values: unknown }): Promise<Embedding> }).get_image_embeddings({ pixel_values });
    },
    async recortar(emb, puntos, etiquetas, n) {
      const escala = 1024 / n;
      const input_points = new tf.Tensor("float32", Float32Array.from(puntos.flatMap(([x, y]) => [x * escala, y * escala])), [1, 1, puntos.length, 2]);
      const input_labels = new tf.Tensor("int64", BigInt64Array.from(etiquetas.map(e => BigInt(e))), [1, 1, etiquetas.length]);
      const { masks, iou } = await decodificar({ ...emb, input_points, input_labels });
      const mejor = iou.indexOf(Math.max(...iou)), m = masks.dims[masks.dims.length - 1], tam = m * m;
      const logits = Float32Array.from(Array.prototype.slice.call(masks.data, mejor * tam, (mejor + 1) * tam) as number[]);
      return { logits, m, calidad: iou[mejor] };
    },
    async recortarCada(emb, puntos, n) {
      const escala = 1024 / n, salida: { bits: Uint8Array; m: number; calidad: number }[] = [];
      // El modelo exportado admite un punto por llamada: van uno a uno (cada uno tarda milisegundos, el trabajo pesado ya está codificado).
      for (const [x, y] of puntos) {
        const input_points = new tf.Tensor("float32", Float32Array.from([x * escala, y * escala]), [1, 1, 1, 2]);
        const input_labels = new tf.Tensor("int64", BigInt64Array.from([1n]), [1, 1, 1]);
        const { masks, iou: notas } = await decodificar({ ...emb, input_points, input_labels });
        const m = masks.dims[masks.dims.length - 1], tam = m * m, datos = masks.data, tope = Math.max(...notas);
        let elegido = 0, area = -1;
        for (let q = 0; q < notas.length; q++) {
          if (notas[q] < tope - 0.08) continue;
          let a = 0; for (let i = q * tam; i < (q + 1) * tam; i++) if (datos[i] > 0) a++;
          if (a > area) { area = a; elegido = q; }
        }
        const bits = new Uint8Array(tam);
        for (let i = 0; i < tam; i++) if (datos[elegido * tam + i] > 0) bits[i] = 1;
        salida.push({ bits, m, calidad: notas[elegido] });
      }
      return salida;
    }
  };
}
