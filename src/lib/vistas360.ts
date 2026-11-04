/**
 * Vistas planas de una foto 360 equirectangular, como las haría una cámara normal, y el camino de vuelta.
 * Los modelos de segmentación (SAM) trabajan con fotos planas: la panorámica se corta en vistas que se solapan,
 * se segmenta cada una y las máscaras se devuelven a la panorámica.
 * Usa la misma correspondencia que el visor: píxel (x, y) → u = x/W, θ = y/H·π, dirección (cos 2πu·sen θ, cos θ, sen 2πu·sen θ).
 */
export type Vista = { yaw: number; pitch: number; fov: number; n: number };
type V3 = [number, number, number];

const grados = Math.PI / 180;
/** Seis vistas que cubren toda la esfera con solape: cuatro alrededor, una al suelo y otra al techo. */
export const vistasCubo = (n = 1024): Vista[] => [
  ...[0, 1, 2, 3].map(k => ({ yaw: (k * Math.PI) / 2, pitch: 0, fov: 104 * grados, n })),
  { yaw: 0, pitch: -Math.PI / 2, fov: 116 * grados, n },
  { yaw: 0, pitch: Math.PI / 2, fov: 116 * grados, n }
];

const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cruz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Ejes de la cámara de una vista: hacia delante, a la derecha y arriba. */
export function ejes(v: Vista): { f: V3; r: V3; u: V3; t: number } {
  const f: V3 = [Math.cos(v.pitch) * Math.sin(v.yaw), Math.sin(v.pitch), Math.cos(v.pitch) * Math.cos(v.yaw)];
  // Mirando al suelo o al techo, la referencia «arriba» pasa a ser el eje z.
  const ref: V3 = Math.abs(f[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0];
  const r = norm(cruz(ref, f)), u = cruz(f, r);
  return { f, r, u, t: Math.tan(v.fov / 2) };
}

/** Dirección del píxel (x, y) de una panorámica de w × h. */
export function direccionPanoramica(x: number, y: number, w: number, h: number): V3 {
  const phi = (x / w) * 2 * Math.PI, th = (y / h) * Math.PI;
  return [Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th)];
}
/** Píxel (con decimales) de la panorámica al que apunta una dirección. */
export function enPanoramica(d: V3, w: number, h: number): [number, number] {
  let u = Math.atan2(d[2], d[0]) / (2 * Math.PI); u -= Math.floor(u);
  return [u * w, (Math.acos(Math.max(-1, Math.min(1, d[1]))) / Math.PI) * h];
}
/** Dirección del píxel (i, j) de una vista. */
export function direccionVista(v: Vista, i: number, j: number, e = ejes(v)): V3 {
  const x = ((2 * (i + 0.5)) / v.n - 1) * e.t, y = (1 - (2 * (j + 0.5)) / v.n) * e.t;
  return norm([e.f[0] + x * e.r[0] + y * e.u[0], e.f[1] + x * e.r[1] + y * e.u[1], e.f[2] + x * e.r[2] + y * e.u[2]]);
}
/** Píxel (con decimales) de la vista al que apunta una dirección, o null si queda fuera de ella. */
export function enVista(v: Vista, d: V3, e = ejes(v)): [number, number] | null {
  const z = d[0] * e.f[0] + d[1] * e.f[1] + d[2] * e.f[2];
  if (z <= 1e-6) return null;
  const x = (d[0] * e.r[0] + d[1] * e.r[1] + d[2] * e.r[2]) / z / e.t, y = (d[0] * e.u[0] + d[1] * e.u[1] + d[2] * e.u[2]) / z / e.t;
  if (x < -1 || x > 1 || y < -1 || y > 1) return null;
  return [((x + 1) / 2) * v.n - 0.5, ((1 - y) / 2) * v.n - 0.5];
}

/** Pinta una vista (RGBA, n × n) a partir de la panorámica, con interpolación bilineal. */
export function pintarVista(img: { data: Uint8ClampedArray | Uint8Array; w: number; h: number }, v: Vista): Uint8ClampedArray {
  const { data, w, h } = img, n = v.n, out = new Uint8ClampedArray(n * n * 4), e = ejes(v);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const [px, py] = enPanoramica(direccionVista(v, i, j, e), w, h);
    const x0 = Math.floor(px - 0.5), y0 = Math.max(0, Math.min(h - 1, Math.floor(py - 0.5))), y1 = Math.min(h - 1, y0 + 1);
    const fx = px - 0.5 - x0, fy = Math.max(0, Math.min(1, py - 0.5 - y0));
    const xa = ((x0 % w) + w) % w, xb = (xa + 1) % w, o = (j * n + i) * 4;
    for (let c = 0; c < 3; c++) {
      const a = data[(y0 * w + xa) * 4 + c], b = data[(y0 * w + xb) * 4 + c], cc = data[(y1 * w + xa) * 4 + c], d = data[(y1 * w + xb) * 4 + c];
      out[o + c] = (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy;
    }
    out[o + 3] = 255;
  }
  return out;
}

/**
 * Lleva a la panorámica (w × h) un mapa de la vista de tamaño m × m (por ejemplo los logits 256 × 256 de SAM):
 * para cada píxel de la panorámica que cae dentro de la vista, `alPixel(i, valor, peso)`, con el peso mayor en el centro de la vista.
 */
export function devolver(v: Vista, mapa: Float32Array, m: number, w: number, h: number, alPixel: (i: number, valor: number, peso: number) => void) {
  const e = ejes(v), escala = m / v.n;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = direccionPanoramica(x + 0.5, y + 0.5, w, h), p = enVista(v, d, e);
    if (!p) continue;
    const gx = Math.max(0, Math.min(m - 1.001, (p[0] + 0.5) * escala - 0.5)), gy = Math.max(0, Math.min(m - 1.001, (p[1] + 0.5) * escala - 0.5));
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const val = (mapa[y0 * m + x0] * (1 - fx) + mapa[y0 * m + x0 + 1] * fx) * (1 - fy) + (mapa[(y0 + 1) * m + x0] * (1 - fx) + mapa[(y0 + 1) * m + x0 + 1] * fx) * fy;
    const z = d[0] * e.f[0] + d[1] * e.f[1] + d[2] * e.f[2];
    alPixel(y * w + x, val, z * z);
  }
}
