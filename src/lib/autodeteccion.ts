/**
 * Detección automática de superficies en una foto 360 equirectangular, sin modelos externos.
 * Parte de puntos que casi seguro son de la superficie (el suelo por debajo del horizonte, el techo por encima,
 * las paredes a la altura de los ojos), toma su color dominante y crece por píxeles de color parecido,
 * parando en los bordes marcados. Devuelve una máscara del tamaño de la imagen analizada y su superficie en m².
 * Las medidas suponen la cámara a `altura` metros del suelo: son aproximadas.
 */
export type Imagen = { data: Uint8ClampedArray | Uint8Array; w: number; h: number };
export type TipoAuto = "suelo" | "techo" | "pared";
export type Mascara = { bits: Uint8Array; w: number; h: number };

// ---- color: sRGB → Lab, para comparar colores como los ve una persona
function lab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), Y = f(R * 0.2126 + G * 0.7152 + B * 0.0722), Z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

/** Imagen en Lab, suavizada para que juntas, vetas y ruido no corten las superficies. */
export function prepararLab(img: Imagen, pasadas = 2): Float32Array {
  const { w, h } = img, n = w * h;
  let L = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const [l, a, b] = lab(img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]); L[i * 3] = l; L[i * 3 + 1] = a; L[i * 3 + 2] = b; }
  for (let p = 0; p < pasadas; p++) {
    const S = new Float32Array(n * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s0 = 0, s1 = 0, s2 = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -1; dx <= 1; dx++) { const xx = (x + dx + w) % w, j = (yy * w + xx) * 3; s0 += L[j]; s1 += L[j + 1]; s2 += L[j + 2]; k++; } }
      const i = (y * w + x) * 3; S[i] = s0 / k; S[i + 1] = s1 / k; S[i + 2] = s2 / k;
    }
    L = S;
  }
  return L;
}

const dist = (L: Float32Array, i: number, j: number) => { const a = i * 3, b = j * 3; return Math.hypot(L[a] - L[b], (L[a + 1] - L[b + 1]) * 1.2, (L[a + 2] - L[b + 2]) * 1.2); };
const distColor = (L: Float32Array, i: number, c: [number, number, number]) => { const a = i * 3; return Math.hypot(L[a] - c[0], (L[a + 1] - c[1]) * 1.2, (L[a + 2] - c[2]) * 1.2); };

/** Inclinación (pitch) de la fila `y`: +π/2 arriba, −π/2 abajo. */
export const pitchFila = (y: number, h: number) => Math.PI / 2 - ((y + 0.5) / h) * Math.PI;
/** Píxel de la imagen al que apunta una dirección (la misma correspondencia que el visor). */
export function pixelDe(d: { yaw: number; pitch: number }, w: number, h: number): number {
  const x = Math.cos(d.pitch) * Math.sin(d.yaw), y = Math.sin(d.pitch), z = Math.cos(d.pitch) * Math.cos(d.yaw);
  let u = Math.atan2(z, x) / (2 * Math.PI); u -= Math.floor(u);
  const fila = Math.min(h - 1, Math.max(0, Math.floor((Math.acos(Math.max(-1, Math.min(1, y))) / Math.PI) * h)));
  return fila * w + Math.min(w - 1, Math.floor(u * w));
}

/** Límites de inclinación en los que puede estar cada superficie. */
const rango: Record<TipoAuto, [number, number]> = { suelo: [-Math.PI / 2, -0.03], techo: [0.03, Math.PI / 2], pared: [-1.1, 1.2] };

/**
 * Crece una región desde las semillas: entra un píxel si se parece al color medio de la región (tolerancia `tol`)
 * y no hay un borde marcado con su vecino (`borde`). La imagen da la vuelta en horizontal.
 */
export function crecer(L: Float32Array, w: number, h: number, semillas: number[], tipo: TipoAuto, tol = 14, borde = 5.5, base?: Uint8Array): Uint8Array {
  const m = base ? base.slice() : new Uint8Array(w * h);
  const [pMin, pMax] = rango[tipo];
  const cola = new Int32Array(w * h); let ini = 0, fin = 0;
  let s0 = 0, s1 = 0, s2 = 0, k = 0;
  for (const s of semillas) { if (m[s]) continue; m[s] = 1; cola[fin++] = s; s0 += L[s * 3]; s1 += L[s * 3 + 1]; s2 += L[s * 3 + 2]; k++; }
  if (!k) return m;
  while (ini < fin) {
    const i = cola[ini++], x = i % w, y = (i / w) | 0;
    const media: [number, number, number] = [s0 / k, s1 / k, s2 / k];
    const vecinos = [y * w + ((x + 1) % w), y * w + ((x - 1 + w) % w), y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of vecinos) {
      if (j < 0 || m[j]) continue;
      const p = pitchFila((j / w) | 0, h); if (p < pMin || p > pMax) continue;
      if (dist(L, i, j) > borde || distColor(L, j, media) > tol) continue;
      m[j] = 1; cola[fin++] = j; s0 += L[j * 3]; s1 += L[j * 3 + 1]; s2 += L[j * 3 + 2]; k++;
    }
  }
  return m;
}

/** Cierra agujeros pequeños: lo que no es región y no llega al «fuera» (la fila de referencia) por debajo de `maxFraccion` del total. */
export function rellenar(m: Uint8Array, w: number, h: number, filaFuera: number, maxFraccion = 1): Uint8Array {
  const fuera = new Uint8Array(w * h), cola = new Int32Array(w * h); let ini = 0, fin = 0;
  for (let x = 0; x < w; x++) { const i = filaFuera * w + x; if (!m[i]) { fuera[i] = 1; cola[fin++] = i; } }
  while (ini < fin) {
    const i = cola[ini++], x = i % w, y = (i / w) | 0;
    for (const j of [y * w + ((x + 1) % w), y * w + ((x - 1 + w) % w), y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && !m[j] && !fuera[j]) { fuera[j] = 1; cola[fin++] = j; }
  }
  // Los huecos encerrados se rellenan si son pequeños (enchufes, juntas, cenefas); los grandes (ventanas) se respetan.
  const r = m.slice(), visto = new Uint8Array(w * h), limite = maxFraccion * w * h;
  for (let s = 0; s < w * h; s++) {
    if (m[s] || fuera[s] || visto[s]) continue;
    const comp: number[] = [s]; visto[s] = 1;
    for (let c = 0; c < comp.length; c++) {
      const i = comp[c], x = i % w, y = (i / w) | 0;
      for (const j of [y * w + ((x + 1) % w), y * w + ((x - 1 + w) % w), y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && !m[j] && !fuera[j] && !visto[j]) { visto[j] = 1; comp.push(j); }
    }
    if (comp.length <= limite) for (const i of comp) r[i] = 1;
  }
  return r;
}

/** Semillas de partida: en franjas donde casi seguro está la superficie, los píxeles del color más repetido. */
export function semillas(L: Float32Array, w: number, h: number, tipo: TipoAuto): number[] {
  const franja: [number, number] = tipo === "suelo" ? [-1.25, -0.6] : tipo === "techo" ? [0.75, 1.3] : [-0.05, 0.3];
  const muestras: number[] = [];
  for (let y = 0; y < h; y += 2) { const p = pitchFila(y, h); if (p < franja[0] || p > franja[1]) continue; for (let x = 0; x < w; x += 4) muestras.push(y * w + x); }
  if (!muestras.length) return [];
  // Color dominante: el que tiene más muestras parecidas a menos de 10 (sobre una submuestra para ir rápido).
  const candidatos = muestras.filter((_, i) => i % 7 === 0);
  let mejor = candidatos[0], votos = -1;
  for (const c of candidatos) { let v = 0; for (const s of candidatos) if (dist(L, c, s) < 10) v++; if (v > votos) { votos = v; mejor = c; } }
  return muestras.filter(s => dist(L, s, mejor) < 10);
}

/** Montículo binario de mínimos para el crecimiento por prioridad. */
class Monticulo {
  coste = new Float32Array(1 << 16); dato = new Int32Array(1 << 16); n = 0;
  push(c: number, d: number) {
    if (this.n === this.coste.length) { const c2 = new Float32Array(this.n * 2), d2 = new Int32Array(this.n * 2); c2.set(this.coste); d2.set(this.dato); this.coste = c2; this.dato = d2; }
    let i = this.n++; while (i > 0) { const p = (i - 1) >> 1; if (this.coste[p] <= c) break; this.coste[i] = this.coste[p]; this.dato[i] = this.dato[p]; i = p; }
    this.coste[i] = c; this.dato[i] = d;
  }
  pop(): number {
    const top = this.dato[0], c = this.coste[--this.n], d = this.dato[this.n]; let i = 0;
    for (;;) { let k = 2 * i + 1; if (k >= this.n) break; if (k + 1 < this.n && this.coste[k + 1] < this.coste[k]) k++; if (this.coste[k] >= c) break; this.coste[i] = this.coste[k]; this.dato[i] = this.dato[k]; i = k; }
    this.coste[i] = c; this.dato[i] = d; return top;
  }
}
export const tipos: TipoAuto[] = ["suelo", "pared", "techo"];

/**
 * Encuentro suelo-pared y techo-pared, columna a columna. En una habitación cada uno es una línea continua alrededor
 * (rodapié, moldura): se busca el borde horizontal más fuerte que además cambie poco de una columna a la siguiente
 * (programación dinámica). Devuelve la fila del encuentro en cada columna.
 */
export function estimarLimites(L: Float32Array, w: number, h: number): { suelo: Int16Array; techo: Int16Array } {
  // Fuerza del borde horizontal en cada píxel: diferencia vertical a ±2 filas, media de 3 columnas.
  const E = new Float32Array(w * h);
  for (let y = 2; y < h - 2; y++) for (let x = 0; x < w; x++) {
    let e = 0;
    for (let dx = -1; dx <= 1; dx++) { const xx = (x + dx + w) % w; e += dist(L, (y - 2) * w + xx, (y + 2) * w + xx); }
    E[y * w + x] = e / 3;
  }
  const ordenados = Array.from(E).filter(v => v > 0).sort((a, b) => a - b), p95 = ordenados[Math.floor(ordenados.length * 0.95)] || 1;
  const fila = (p: number) => Math.round(((Math.PI / 2 - p) / Math.PI) * h - 0.5);
  const camino = (yA: number, yB: number) => {
    const filas = yB - yA + 1, salto = Math.max(2, Math.round(h / 128)), coste = new Float32Array(w * filas), desde = new Int16Array(w * filas);
    for (let r = 0; r < filas; r++) coste[r] = -Math.min(1, E[(yA + r) * w] / p95);
    for (let x = 1; x < w; x++) for (let r = 0; r < filas; r++) {
      let mejor = Infinity, de = r;
      for (let d = -salto; d <= salto; d++) { const q = r + d; if (q < 0 || q >= filas) continue; const c = coste[(x - 1) * filas + q] + 0.08 * Math.abs(d); if (c < mejor) { mejor = c; de = q; } }
      coste[x * filas + r] = mejor - Math.min(1, E[(yA + r) * w + x] / p95); desde[x * filas + r] = de;
    }
    let r = 0; for (let q = 1; q < filas; q++) if (coste[(w - 1) * filas + q] < coste[(w - 1) * filas + r]) r = q;
    const res = new Int16Array(w);
    for (let x = w - 1; x >= 0; x--) { res[x] = yA + r; r = desde[x * filas + r]; }
    return res;
  };
  return { suelo: camino(fila(-0.1), fila(-1.15)), techo: camino(fila(1.15), fila(0.1)) };
}

/**
 * Segmenta la foto en suelo (1), pared (2) y techo (3) creciendo las tres a la vez desde sus semillas:
 * cada vez se añade el píxel más barato de todos (parecido al color medio de su región, sin borde marcado),
 * así las fronteras caen en los bordes fuertes (rodapié, moldura) y una superficie no invade otra de color parecido.
 */
export function segmentar(L: Float32Array, w: number, h: number, tolerancia = 20): Uint8Array {
  const n = w * h, etiqueta = new Uint8Array(n), heap = new Monticulo();
  // El suelo no sube del rodapié ni el techo baja de la moldura; la pared vive entre los dos (con 2 filas de holgura).
  const limites = estimarLimites(L, w, h), holgura = 2;
  const permitido = (t: number, j: number) => { const x = j % w, y = (j / w) | 0; return t === 1 ? y >= limites.suelo[x] - holgura : t === 3 ? y <= limites.techo[x] + holgura : y > limites.techo[x] - holgura && y < limites.suelo[x] + holgura; };
  const suma = [0, 0, 0, 0].map(() => [0, 0, 0, 0]);
  const meter = (i: number, t: number) => { etiqueta[i] = t; const s = suma[t]; s[0] += L[i * 3]; s[1] += L[i * 3 + 1]; s[2] += L[i * 3 + 2]; s[3]++; };
  const coste = (t: number, de: number, a: number) => { const s = suma[t]; return distColor(L, a, [s[0] / s[3], s[1] / s[3], s[2] / s[3]]) + 1.6 * dist(L, de, a); };
  const vecinos = (i: number) => { const x = i % w, y = (i / w) | 0; return [y * w + ((x + 1) % w), y * w + ((x - 1 + w) % w), y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]; };
  const empujar = (i: number, t: number) => { for (const j of vecinos(i)) { if (j < 0 || etiqueta[j]) continue; const p = pitchFila((j / w) | 0, h), [a, b] = rango[tipos[t - 1]]; if (p < a || p > b || !permitido(t, j)) continue; heap.push(coste(t, i, j), j * 4 + t); } };
  tipos.forEach((tipo, k) => { for (const sd of semillas(L, w, h, tipo)) if (!etiqueta[sd] && permitido(k + 1, sd)) meter(sd, k + 1); });
  for (let i = 0; i < n; i++) if (etiqueta[i]) empujar(i, etiqueta[i]);
  while (heap.n) {
    const c = heap.coste[0], d = heap.pop(), i = d >> 2, t = d & 3;
    if (etiqueta[i]) continue;
    if (c > tolerancia) continue;
    meter(i, t); empujar(i, t);
  }
  return etiqueta;
}

/** Detecta una superficie entera de la foto; si ya se segmentó, se reutiliza. */
export function detectar(L: Float32Array, w: number, h: number, tipo: TipoAuto, etiquetas?: Uint8Array): Uint8Array {
  const seg = etiquetas ?? segmentar(L, w, h), t = tipos.indexOf(tipo) + 1;
  const m = new Uint8Array(w * h); for (let i = 0; i < m.length; i++) if (seg[i] === t) m[i] = 1;
  if (tipo === "suelo") return rellenar(m, w, h, Math.floor(h / 2), 0.04);
  if (tipo === "techo") return rellenar(m, w, h, Math.floor(h / 2), 0.04);
  return rellenar(m, w, h, h - 1, 0.002);
}

/** Toque en la foto: si el punto ya está en la máscara quita esa zona; si no, la añade creciendo desde ahí. */
export function retocar(L: Float32Array, mascara: Mascara, pixel: number, tipo: TipoAuto): Uint8Array {
  const { bits, w, h } = mascara;
  if (!bits[pixel]) return crecer(L, w, h, [pixel], tipo, 16, 6, bits);
  // Quitar: la parte de la máscara de color parecido al punto tocado y conectada a él.
  const fuera = crecer(L, w, h, [pixel], "pared" === tipo ? "pared" : tipo, 12, 5);
  const r = bits.slice(); for (let i = 0; i < r.length; i++) if (fuera[i]) r[i] = 0;
  return r;
}

/**
 * Superficie en m² de la máscara. Suelo y techo: cada píxel se proyecta al plano horizontal (dA = dΩ·d²/|sen p|³).
 * Paredes: cada columna toma la distancia horizontal de su encuentro con el suelo (`suelo`) o 2,5 m si no la hay.
 */
export function areaMascara(m: Mascara, tipo: TipoAuto, altura = 1.5, alturaTecho = 2.6, suelo?: Mascara): number {
  const { bits, w, h } = m, dLon = (2 * Math.PI) / w, dLat = Math.PI / h;
  let area = 0;
  const distanciaColumna = new Float32Array(w).fill(2.5);
  if (tipo === "pared" && suelo) {
    for (let x = 0; x < w; x++) for (let y = Math.floor(h / 2); y < h; y++) if (suelo.bits[y * w + x]) { const p = pitchFila(y, h); distanciaColumna[x] = Math.min(8, altura / Math.tan(-p)); break; }
  }
  // Ancho real de cada columna de pared: tiene en cuenta que la pared puede ir sesgada respecto a la cámara.
  const anchoColumna = new Float32Array(w);
  for (let x = 0; x < w; x++) { const D = distanciaColumna[x], D2 = distanciaColumna[(x + 1) % w]; anchoColumna[x] = Math.min(Math.hypot(D * dLon, D2 - D), D * dLon * 6); }
  for (let y = 0; y < h; y++) {
    const p = pitchFila(y, h), cos = Math.cos(p), sen = Math.sin(p);
    for (let x = 0; x < w; x++) {
      if (!bits[y * w + x]) continue;
      const dOmega = dLon * dLat * cos;
      if (tipo === "suelo" && sen < -0.05) area += Math.min(dOmega * altura ** 2 / Math.abs(sen) ** 3, 0.5);
      else if (tipo === "techo" && sen > 0.05) area += Math.min(dOmega * (alturaTecho - altura) ** 2 / sen ** 3, 0.5);
      else if (tipo === "pared") { const D = distanciaColumna[x]; area += anchoColumna[x] * D * dLat / (cos * cos); }
    }
  }
  return Math.round(area * 2) / 2;
}

// ---- guardar la máscara de forma compacta (tramos alternos 0/1) para el almacenamiento del navegador
export function comprimir(bits: Uint8Array): string {
  const tramos: number[] = []; let actual = 0, n = 0;
  for (let i = 0; i < bits.length; i++) { const b = bits[i] ? 1 : 0; if (b === actual) n++; else { tramos.push(n); actual = b; n = 1; } }
  tramos.push(n);
  return tramos.map(t => t.toString(36)).join(".");
}
export function descomprimir(texto: string, total: number): Uint8Array {
  const bits = new Uint8Array(total); let i = 0, actual = 0;
  for (const t of texto.split(".")) { const n = parseInt(t, 36) || 0; if (actual) bits.fill(1, i, Math.min(total, i + n)); i += n; actual ^= 1; }
  return bits;
}

/** Altura del techo sobre el suelo, estimada con los dos encuentros: en cada columna, distancia a la pared por el rodapié y altura por la moldura. */
export function alturaTechoEstimada(limites: { suelo: Int16Array; techo: Int16Array }, w: number, h: number, altura = 1.5): number {
  const valores: number[] = [];
  for (let x = 0; x < w; x += 4) {
    const pS = pitchFila(limites.suelo[x], h), pT = pitchFila(limites.techo[x], h);
    if (pS > -0.08 || pT < 0.08) continue;
    const D = altura / Math.tan(-pS); if (D > 8) continue;
    valores.push(altura + D * Math.tan(pT));
  }
  if (valores.length < 10) return 2.6;
  valores.sort((a, b) => a - b);
  return Math.min(6, Math.max(2.2, valores[Math.floor(valores.length / 2)]));
}

/** Distancia horizontal a la pared en cada columna (por el rodapié) y recorrido acumulado, para pegar texturas en las paredes. */
export function columnasPared(limites: { suelo: Int16Array }, w: number, h: number, altura = 1.5): Float32Array {
  const D = new Float32Array(w);
  for (let x = 0; x < w; x++) { const p = pitchFila(limites.suelo[x], h); D[x] = p < -0.05 ? Math.min(8, altura / Math.tan(-p)) : 8; }
  const datos = new Float32Array(w * 4), dLon = (2 * Math.PI) / w; let acumulado = 0;
  for (let x = 0; x < w; x++) { datos[x * 4] = D[x]; datos[x * 4 + 1] = acumulado; acumulado += Math.hypot(D[x] * dLon, D[(x + 1) % w] - D[x]); }
  return datos;
}

/** Dirección media de una máscara: ahí va su marca. */
export function centroMascara(m: Mascara): { yaw: number; pitch: number } {
  const { bits, w, h } = m; let sx = 0, sy = 0, sz = 0, k = 0;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    if (!bits[y * w + x]) continue;
    const u = (x + 0.5) / w, th = ((y + 0.5) / h) * Math.PI, phi = u * 2 * Math.PI;
    sx += Math.cos(phi) * Math.sin(th); sy += Math.cos(th); sz += Math.sin(phi) * Math.sin(th); k++;
  }
  if (!k) return { yaw: 0, pitch: -0.5 };
  return { yaw: Math.atan2(sx, sz), pitch: Math.atan2(sy, Math.hypot(sx, sz)) };
}

/** Región de una superficie alrededor de un punto tocado («esta pared», «este trozo de suelo»). */
export function regionDesde(L: Float32Array, w: number, h: number, pixel: number, tipo: TipoAuto, etiquetas?: Uint8Array): Uint8Array {
  const t = tipos.indexOf(tipo) + 1;
  // Si el punto cae en esa superficie detectada, la región es su parte conectada de color parecido; si no, crece desde el punto.
  if (etiquetas && etiquetas[pixel] === t) {
    const base = new Uint8Array(w * h); for (let i = 0; i < base.length; i++) if (etiquetas[i] !== t) base[i] = 1;
    const r = crecer(L, w, h, [pixel], tipo, 16, 6, base);
    for (let i = 0; i < r.length; i++) if (base[i]) r[i] = 0;
    return tipo === "pared" ? rellenar(r, w, h, h - 1, 0.002) : rellenar(r, w, h, Math.floor(h / 2), 0.04);
  }
  return crecer(L, w, h, [pixel], tipo, 16, 6);
}

/**
 * Ciñe el suelo (o el techo) a su línea de encuentro con las paredes: rellena las columnas sueltas en las que la zona se queda
 * corta, que en la foto se ven como dientes junto al rodapié. Los tramos largos sin zona (un mueble, una encimera) no se tocan.
 */
export function ceñir(bits: Uint8Array, w: number, h: number, limites: { suelo: Int16Array; techo: Int16Array }, tipo: TipoAuto, maxDiente = 28, ventana = 8): Uint8Array {
  if (tipo === "pared") return bits;
  const out = bits.slice(), suelo = tipo === "suelo", hueco = new Int16Array(w).fill(-1);
  for (let x = 0; x < w; x++) {
    const linea = suelo ? limites.suelo[x] : limites.techo[x], paso = suelo ? 1 : -1;
    let y = linea, g = 0;
    while (y >= 0 && y < h && !bits[y * w + x] && g <= maxDiente) { y += paso; g++; }
    if (y >= 0 && y < h && bits[y * w + x]) hueco[x] = g;
  }
  const vecinos: number[] = [];
  for (let x = 0; x < w; x++) {
    const g = hueco[x]; if (g <= 0) continue;
    vecinos.length = 0;
    for (let k = -ventana; k <= ventana; k++) { const v = hueco[(x + k + w) % w]; vecinos.push(v < 0 ? 99 : v); }
    vecinos.sort((a, b) => a - b);
    if (vecinos[ventana] > 3) continue; // alrededor tampoco llega: es un mueble, no un diente
    const linea = suelo ? limites.suelo[x] : limites.techo[x], paso = suelo ? 1 : -1;
    for (let i = 0, y = linea; i < g; i++, y += paso) out[y * w + x] = 1;
  }
  return out;
}
