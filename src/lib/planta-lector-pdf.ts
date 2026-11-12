import { PlanoSinTexto, type PlanoLeido, type TextoPlano, type TrazoPlano } from "./planta-lector";

type PdfModule = Pick<typeof import("pdfjs-dist"), "getDocument" | "OPS" | "AnnotationMode">;
type Matriz = [number, number, number, number, number, number];
const por = (a: Matriz, b: Matriz): Matriz => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const hex = (raw: unknown): [number, number, number] | null => typeof raw === "string" && /^#[0-9a-f]{6}$/i.test(raw) ? [1, 3, 5].map(i => parseInt(raw.slice(i, i + 2), 16) / 255) as [number, number, number] : null;

/**
 * Textos y trazos rectos de la primera hoja de un PDF, en puntos con el origen arriba a la izquierda.
 * Va aparte de la lectura rápida de «Desde un plano»: una planta de instalación trae cientos de miles de trazos y aquí no se validan uno a uno,
 * solo se recogen los que se pintan como línea. Los rellenos (tramas, letras dibujadas) no hacen falta. Nada sale del navegador.
 */
export async function leerPdfPlanta(data: Uint8Array, pdfjs: PdfModule, alAvanzar?: (fase: "abrir" | "texto" | "trazos") => void): Promise<PlanoLeido> {
  if (data.byteLength === 0 || data.byteLength > 50 * 1024 * 1024) throw new Error("El PDF debe tener contenido y ocupar como máximo 50 MB.");
  if (!new TextDecoder().decode(data.subarray(0, 1024)).includes("%PDF-")) throw new Error("El archivo no contiene un PDF válido.");
  alAvanzar?.("abrir");
  const tarea = pdfjs.getDocument({ data, stopAtErrors: false, disableFontFace: true, useWasm: false, enableXfa: false });
  let protegido = false; tarea.onPassword = () => { protegido = true; void tarea.destroy(); };
  try {
    const doc = await tarea.promise, pagina = await doc.getPage(1), vista = pagina.getViewport({ scale: 1 }), base = vista.transform as Matriz;
    alAvanzar?.("texto");
    const contenido = await pagina.getTextContent();
    const textos: TextoPlano[] = [];
    for (const it of contenido.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const m = por(base, it.transform as Matriz), h = Math.hypot(m[2], m[3]);
      textos.push({ t: it.str, x: m[4], y: m[5], w: it.width, h, vertical: Math.abs(m[1]) > Math.abs(m[0]) });
    }
    // Sin texto no se sigue: se avisa antes de gastar tiempo en los trazos.
    if (!textos.length) throw new PlanoSinTexto();
    alAvanzar?.("trazos");
    const lista = await pagina.getOperatorList({ intent: "display", annotationMode: pdfjs.AnnotationMode.DISABLE }), ops = pdfjs.OPS;
    if (lista.fnArray.length > 6_000_000) throw new Error("Este plano tiene demasiados trazos para leerlo en el navegador. Sube solo la hoja de la planta.");
    const pinta = new Set<number>([ops.stroke, ops.closeStroke, ops.fillStroke, ops.eoFillStroke, ops.closeFillStroke, ops.closeEOFillStroke]);
    let estado = { m: base, color: [0, 0, 0] as [number, number, number] | null, grosor: 1 };
    const pila: typeof estado[] = [], trazos: TrazoPlano[] = [];
    for (let i = 0; i < lista.fnArray.length; i++) {
      const fn = lista.fnArray[i], args = (lista.argsArray[i] ?? []) as unknown[];
      if (fn === ops.save) pila.push({ ...estado });
      else if (fn === ops.restore) estado = pila.pop() ?? estado;
      else if (fn === ops.transform) estado.m = por(estado.m, Array.from(args as ArrayLike<number>) as Matriz);
      else if (fn === ops.setStrokeRGBColor) estado.color = hex(args[0]);
      else if (fn === ops.setStrokeColorN || fn === ops.setStrokeTransparent) estado.color = null;
      else if (fn === ops.setLineWidth) estado.grosor = Number(args[0]);
      else if (fn === ops.paintFormXObjectBegin) { pila.push({ ...estado }); if (args[0]) estado.m = por(estado.m, Array.from(args[0] as ArrayLike<number>) as Matriz); }
      else if (fn === ops.paintFormXObjectEnd) estado = pila.pop() ?? estado;
      else if (fn === ops.constructPath && pinta.has(Number(args[0])) && estado.color) {
        const d = (args[1] as [ArrayLike<number> | null])?.[0]; if (!d) continue;
        const m = estado.m, grosor = estado.grosor * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
        let actual: number[] = [], curva = false;
        const cierra = () => { if (actual.length >= 4 && !curva) trazos.push({ p: Float32Array.from(actual), color: estado.color!, grosor }); actual = []; curva = false; };
        for (let k = 0; k < d.length;) {
          const op = d[k++];
          if (op === 0) { cierra(); actual.push(m[0] * d[k] + m[2] * d[k + 1] + m[4], m[1] * d[k] + m[3] * d[k + 1] + m[5]); k += 2; }
          else if (op === 1) { actual.push(m[0] * d[k] + m[2] * d[k + 1] + m[4], m[1] * d[k] + m[3] * d[k + 1] + m[5]); k += 2; }
          else if (op === 2) { curva = true; k += 6; }
          else if (op === 3) { curva = true; k += 4; }
          else if (op === 4) { if (actual.length >= 4) actual.push(actual[0], actual[1]); }
          else break;
        }
        cierra();
      }
    }
    pagina.cleanup();
    return { ancho: vista.width, alto: vista.height, textos, trazos };
  } catch (error) {
    if (protegido) throw new Error("El PDF está protegido. Sube una copia sin contraseña para leer el plano.");
    throw error;
  } finally { await tarea.destroy(); }
}

/** PDF.js se carga solo al elegir un plano. */
export async function leerArchivoPlanta(file: File, alAvanzar?: Parameters<typeof leerPdfPlanta>[2]): Promise<PlanoLeido> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  return leerPdfPlanta(new Uint8Array(await file.arrayBuffer()), pdfjs, alAvanzar);
}
