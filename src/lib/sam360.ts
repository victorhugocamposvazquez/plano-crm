/**
 * SAM sobre una foto 360. La detección por color (`autodeteccion.ts`) dice más o menos dónde está el suelo, la pared y el techo;
 * SAM, guiado con puntos seguros de cada superficie, dibuja el borde exacto en seis vistas planas, y las vistas se juntan.
 * Un toque en la foto se le pasa a SAM tal cual: recorta lo tocado («esta pared», «esta alfombra»).
 */
import type { Sam, Embedding } from "./sam";
import { devolver, direccionPanoramica, direccionVista, ejes, enPanoramica, enVista, pintarVista, vistasCubo, type Vista } from "./vistas360";
import { pitchFila, type TipoAuto } from "./autodeteccion";

export type Analisis360 = { vistas: { vista: Vista; emb: Embedding }[]; seg: Uint8Array; w: number; h: number };
const tipos: TipoAuto[] = ["suelo", "pared", "techo"];
const N = 1024;

/** Codifica las seis vistas de la panorámica. `alProgreso(hechas, total)` para enseñar el avance. */
export async function codificarPanoramica(sam: Sam, img: { data: Uint8ClampedArray | Uint8Array; w: number; h: number }, alProgreso?: (hechas: number, total: number) => void) {
  const vistas: { vista: Vista; emb: Embedding }[] = [], lista = vistasCubo(N);
  for (const [k, vista] of lista.entries()) {
    alProgreso?.(k, lista.length);
    await new Promise(r => setTimeout(r, 0)); // deja pintar el avance
    vistas.push({ vista, emb: await sam.codificar(pintarVista(img, vista), N) });
  }
  alProgreso?.(lista.length, lista.length);
  return vistas;
}

/**
 * Segmentación de la panorámica afinada con SAM. En cada vista, SAM recorta un segmento por cada punto de una rejilla;
 * cada segmento toma la etiqueta que la segmentación por color da a la mayoría de sus píxeles (suelo, pared o techo) o ninguna
 * si no hay mayoría clara (un mueble, una ventana). Así los bordes son los de SAM y el significado, el del color.
 * Las vistas se juntan pesando más el centro de cada una. Devuelve etiquetas como `segmentar` (1 suelo, 2 pared, 3 techo, 0 nada).
 */
export async function afinarConSam(sam: Sam, vistas: { vista: Vista; emb: Embedding }[], seg: Uint8Array, w: number, h: number, alProgreso?: (hechas: number, total: number) => void, lado = 8): Promise<Uint8Array> {
  const n = w * h, votos = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const puntos: [number, number][] = [];
  for (let j = 0; j < lado; j++) for (let i = 0; i < lado; i++) puntos.push([((i + 0.5) / lado) * N, ((j + 0.5) / lado) * N]);
  for (const [k, { vista, emb }] of vistas.entries()) {
    alProgreso?.(k, vistas.length);
    const segmentos = await sam.recortarCada(emb, puntos, N), m = segmentos[0]?.m ?? 256, e = ejes(vista);
    // Etiqueta por color de cada celda de la rejilla del recorte (m × m).
    const color = new Uint8Array(m * m);
    for (let gy = 0; gy < m; gy++) for (let gx = 0; gx < m; gx++) {
      const [x, y] = enPanoramica(direccionVista(vista, ((gx + 0.5) / m) * N - 0.5, ((gy + 0.5) / m) * N - 0.5, e), w, h);
      color[gy * m + gx] = seg[Math.min(h - 1, Math.floor(y)) * w + (Math.floor(x) % w)];
    }
    // Cada segmento vota su etiqueta en sus celdas; los segmentos pequeños cuentan más en su sitio (son más precisos).
    const voto = [new Float32Array(m * m), new Float32Array(m * m), new Float32Array(m * m), new Float32Array(m * m)];
    for (const s of segmentos) {
      if (s.calidad < 0.6) continue;
      const cuenta = [0, 0, 0, 0]; let area = 0;
      for (let i = 0; i < s.bits.length; i++) if (s.bits[i]) { cuenta[color[i]]++; area++; }
      if (area < 20) continue;
      let t = 0; for (let k = 1; k <= 3; k++) if (cuenta[k] > cuenta[t]) t = k;
      if (cuenta[t] < area * 0.6) t = 0;
      const peso = s.calidad / Math.sqrt(area);
      for (let i = 0; i < s.bits.length; i++) if (s.bits[i]) voto[t][i] += peso;
    }
    // Las celdas que ningún segmento cubre se quedan con la etiqueta por color.
    const etiqueta = new Float32Array(m * m);
    for (let i = 0; i < m * m; i++) { let t = color[i], mejor = 0; for (let k = 0; k <= 3; k++) if (voto[k][i] > mejor) { mejor = voto[k][i]; t = k; } etiqueta[i] = t; }
    // A la panorámica: cada vista vota la etiqueta de su celda más cercana.
    devolverCelda(vista, etiqueta, m, w, h, (i, t, p) => { votos[t][i] += p; });
  }
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = pitchFila((i / w) | 0, h);
    let mejor = 0, valor = votos[0][i];
    for (let k = 1; k <= 3; k++) {
      // El suelo no está por encima del horizonte ni el techo por debajo.
      if ((k === 1 && p > -0.03) || (k === 3 && p < 0.03)) continue;
      if (votos[k][i] > valor) { valor = votos[k][i]; mejor = k; }
    }
    out[i] = mejor;
  }
  return suavizar(out, w, h);
}

/**
 * Filtro de mayoría: cada píxel toma la etiqueta más repetida en su entorno (2r+1 × 2r+1). Quita los dientes que dejan
 * las celdas sueltas en los bordes entre superficies. Con sumas acumuladas: cuesta lo mismo sea cual sea el radio.
 */
export function suavizar(seg: Uint8Array, w: number, h: number, r = 3): Uint8Array {
  const n = w * h, cuentas = [0, 1, 2, 3].map(() => new Float32Array(n));
  for (let k = 0; k < 4; k++) {
    const c = cuentas[k], fila = new Float32Array(n);
    // En horizontal la imagen da la vuelta; en vertical se corta en los bordes.
    for (let y = 0; y < h; y++) {
      let suma = 0; for (let dx = -r; dx <= r; dx++) suma += seg[y * w + ((dx + w) % w)] === k ? 1 : 0;
      for (let x = 0; x < w; x++) { fila[y * w + x] = suma; suma += (seg[y * w + ((x + r + 1) % w)] === k ? 1 : 0) - (seg[y * w + ((x - r + w) % w)] === k ? 1 : 0); }
    }
    for (let x = 0; x < w; x++) {
      let suma = 0; for (let dy = 0; dy <= r && dy < h; dy++) suma += fila[dy * w + x];
      for (let y = 0; y < h; y++) { c[y * w + x] = suma; if (y + r + 1 < h) suma += fila[(y + r + 1) * w + x]; if (y - r >= 0) suma -= fila[(y - r) * w + x]; }
    }
  }
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) { let t = seg[i], mejor = cuentas[t][i]; for (let k = 0; k < 4; k++) if (cuentas[k][i] > mejor) { mejor = cuentas[k][i]; t = k; } out[i] = t; }
  return out;
}

/** Como `devolver`, pero sin interpolar: cada píxel de la panorámica toma el valor de la celda de la vista en la que cae. */
function devolverCelda(v: Vista, mapa: Float32Array, m: number, w: number, h: number, alPixel: (i: number, valor: number, peso: number) => void) {
  const e = ejes(v), escala = m / v.n;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = direccionPanoramica(x + 0.5, y + 0.5, w, h), p = enVista(v, d, e);
    if (!p) continue;
    const gx = Math.min(m - 1, Math.max(0, Math.floor((p[0] + 0.5) * escala))), gy = Math.min(m - 1, Math.max(0, Math.floor((p[1] + 0.5) * escala)));
    const z = d[0] * e.f[0] + d[1] * e.f[1] + d[2] * e.f[2];
    alPixel(y * w + x, mapa[gy * m + gx], z * z * z);
  }
}

/** Lo que recorta SAM alrededor de un punto tocado, en la vista que mejor lo ve. Limitado a donde puede estar ese tipo de superficie. */
export async function recortarToque(sam: Sam, vistas: { vista: Vista; emb: Embedding }[], pixel: number, w: number, h: number, tipo: TipoAuto): Promise<Uint8Array> {
  const d = direccionPanoramica((pixel % w) + 0.5, Math.floor(pixel / w) + 0.5, w, h);
  let elegida = vistas[0], mejor = -2;
  for (const v of vistas) { const f = [Math.cos(v.vista.pitch) * Math.sin(v.vista.yaw), Math.sin(v.vista.pitch), Math.cos(v.vista.pitch) * Math.cos(v.vista.yaw)]; const c = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]; if (c > mejor) { mejor = c; elegida = v; } }
  const p = enVista(elegida.vista, d); const out = new Uint8Array(w * h);
  if (!p) return out;
  const r = await sam.recortar(elegida.emb, [p], [1], N);
  devolver(elegida.vista, r.logits, r.m, w, h, (i, v) => { if (v > 0) out[i] = 1; });
  for (let i = 0; i < out.length; i++) {
    if (!out[i]) continue;
    const pitch = pitchFila((i / w) | 0, h);
    if ((tipo === "suelo" && pitch > -0.03) || (tipo === "techo" && pitch < 0.03)) out[i] = 0;
  }
  return suavizar(out, w, h, 2);
}

export { tipos as tiposSam };

/** Parte conectada de una etiqueta que contiene el píxel (el suelo entero de la estancia, si se toca el suelo). La imagen da la vuelta en horizontal. */
export function componente(seg: Uint8Array, w: number, h: number, pixel: number, t: number): Uint8Array {
  const out = new Uint8Array(w * h); if (seg[pixel] !== t) return out;
  const pila = [pixel]; out[pixel] = 1;
  while (pila.length) {
    const i = pila.pop()!, x = i % w, y = (i / w) | 0;
    for (const j of [y * w + ((x + 1) % w), y * w + ((x - 1 + w) % w), y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && !out[j] && seg[j] === t) { out[j] = 1; pila.push(j); }
  }
  return out;
}
