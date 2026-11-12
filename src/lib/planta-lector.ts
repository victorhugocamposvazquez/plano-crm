/**
 * Lector de plantas: convierte lo que trae un PDF vectorial (textos y trazos) en una `Planta` para «Plano en 3D».
 * Solo trabaja con planos que traen texto de verdad. Si los rótulos vienen dibujados como trazos, se avisa y no se sigue.
 * Qué sale de dónde:
 * - Recintos: rótulos con «S: … m²» (nombre encima, «h:» y «Tª:» debajo). El contorno se mide rellenando el hueco entre muros
 *   alrededor del rótulo; solo se da por medido si su superficie cuadra con la rotulada. Si no cuadra, queda como estimado.
 * - Escala: la que hace cuadrar las superficies rotuladas con los contornos medidos.
 * - Equipos: rótulos «EQUIPO BT01» con el modelo debajo, emparejados con el símbolo de color más cercano.
 * - Tuberías: trazos de color largos, agrupados por circuito; el diámetro lo pone el rótulo de tubería más cercano.
 * Todo lo leído es propuesta: el informe dice qué está medido, qué está estimado y qué se ha supuesto.
 */
import type { Caja, Circuito, ClaseEquipo, EquipoPlano, Planta, Punto, Recinto, Tramo, Uso } from "./planta3d";

export type TextoPlano = { t: string; x: number; y: number; w: number; h: number; vertical?: boolean };
export type TrazoPlano = { p: ArrayLike<number>; color: readonly [number, number, number]; grosor: number };
/** Coordenadas en puntos, con el origen arriba a la izquierda. `x`,`y` de un texto son el inicio de su línea base. */
export type PlanoLeido = { ancho: number; alto: number; textos: TextoPlano[]; trazos: TrazoPlano[] };
/** `medido`: el contorno sale de los muros y cuadra con la superficie. `aproximado`: sale de los muros pero se desvía. `estimado`: cuadrado de la superficie rotulada. */
export type AjusteRecinto = "medido" | "aproximado" | "estimado";
export type RecintoLeido = { id: string; nombre: string; ajuste: AjusteRecinto; desvio: number | null };
export type InformeLectura = { recintos: RecintoLeido[]; equipos: number; equiposSinSimbolo: string[]; metrosTuberia: number; avisos: string[] };
export type LecturaPlanta = { planta: Planta; informe: InformeLectura };

export class PlanoSinTexto extends Error {
  constructor() { super("Este plano viene sin texto: los rótulos están dibujados como trazos y Plano no puede leerlos. Por ahora solo se convierten planos con texto. Pide el PDF exportado desde el programa de dibujo (no impreso ni escaneado)."); this.name = "PlanoSinTexto"; }
}
export class PlanoSinRecintos extends Error {
  constructor(m = "El plano trae texto, pero no encuentro recintos rotulados con su superficie («S: … m²»). Sin eso no se puede levantar la planta.") { super(m); this.name = "PlanoSinRecintos"; }
}

type Bloque = { lineas: string[]; caja: Caja; h: number };
const numero = (s: string) => Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
const centro = (c: Caja): Punto => [(c[0] + c[2]) / 2, (c[1] + c[3]) / 2];
const distCaja = (c: Caja, [x, y]: Punto) => Math.hypot(Math.max(c[0] - x, 0, x - c[2]), Math.max(c[1] - y, 0, y - c[3]));
const distCajas = (a: Caja, b: Caja) => Math.hypot(Math.max(a[0] - b[2], 0, b[0] - a[2]), Math.max(a[1] - b[3], 0, b[1] - a[3]));
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "recinto";

/** Junta los trozos de texto en líneas y las líneas en bloques (un rótulo). El texto vertical se agrupa girado. */
export function bloquesDeTexto(textos: TextoPlano[]): Bloque[] {
  const salida: Bloque[] = [];
  for (const vertical of [false, true]) {
    // En el marco girado, `x` corre a lo largo del texto y `y` es la línea base.
    const items = textos.filter(t => t.t.trim() && Boolean(t.vertical) === vertical).map(t => vertical ? { ...t, x: -t.y, y: t.x } : t).sort((a, b) => a.y - b.y || a.x - b.x);
    const lineas: { t: string; x0: number; x1: number; y: number; h: number }[] = [];
    for (const it of items) {
      const l = lineas.findLast(l => Math.abs(l.y - it.y) < 0.5 * it.h && it.x - l.x1 < 2 * it.h && it.x > l.x0);
      if (l) { l.t += (it.x - l.x1 > 0.25 * it.h ? " " : "") + it.t.trim(); l.x1 = Math.max(l.x1, it.x + it.w); }
      else lineas.push({ t: it.t.trim(), x0: it.x, x1: it.x + it.w, y: it.y, h: it.h });
    }
    const bloques: { lineas: typeof lineas; x0: number; x1: number; y1: number; h: number }[] = [];
    for (const l of lineas.sort((a, b) => a.y - b.y)) {
      const b = bloques.find(b => l.y - b.y1 > 0 && l.y - b.y1 < 1.9 * Math.max(l.h, b.h) && l.x0 < b.x1 + l.h && l.x1 > b.x0 - l.h);
      if (b) { b.lineas.push(l); b.x0 = Math.min(b.x0, l.x0); b.x1 = Math.max(b.x1, l.x1); b.y1 = l.y; }
      else bloques.push({ lineas: [l], x0: l.x0, x1: l.x1, y1: l.y, h: l.h });
    }
    for (const b of bloques) {
      const y0 = b.lineas[0].y - b.lineas[0].h, caja: Caja = vertical ? [y0, -b.x1, b.y1, -b.x0] : [b.x0, y0, b.x1, b.y1];
      salida.push({ lineas: b.lineas.map(l => l.t), caja, h: b.h });
    }
  }
  return salida;
}

type RotuloRecinto = { nombre: string; superficie: number; alto: number | null; temp?: [number, number]; caja: Caja };
type RotuloEquipo = { id: string; modelo: string; caja: Caja };
type RotuloTubo = { lineas: { c: Circuito; d: string }[]; caja: Caja };
const circuitoDe = (codigo: string): Circuito | null => {
  const c = codigo.toUpperCase().replace(/[\s_.-]/g, "");
  if (/ABT|ASPBT/.test(c)) return "aspiracion-bt";
  if (/AMT|ASPMT/.test(c)) return "aspiracion-mt";
  if (/GC|GASCAL/.test(c)) return "gas-caliente";
  if (/L$|LIQ/.test(c)) return "liquido";
  return null;
};
export function rotulos(bloques: Bloque[]) {
  const recintos: RotuloRecinto[] = [], equipos: RotuloEquipo[] = [], tubos: RotuloTubo[] = [];
  let escala: number | null = null;
  for (const b of bloques) {
    const iS = b.lineas.findIndex(l => /^S\s*[:=]\s*[\d.,]+\s*m/i.test(l));
    if (iS >= 0) {
      const superficie = numero(b.lineas[iS].match(/[\d.,]+/)![0]);
      const h = b.lineas.map(l => l.match(/^h\s*[:=]\s*([\d.,]+)\s*m/i)).find(Boolean);
      const t = b.lineas.map(l => l.match(/^T[ªaº]?\s*[:=]\s*([+-−]?\s*\d+)\s*°?\s*C?(?:\s*[/a]\s*([+-−]?\s*\d+))?/i)).find(Boolean);
      const grados = (s: string) => Number(s.replace("−", "-").replace(/\s/g, ""));
      if (superficie > 0) recintos.push({ nombre: b.lineas.slice(0, iS).join(" ") || "Recinto", superficie, alto: h ? numero(h[1]) : null, temp: t ? [grados(t[1]), grados(t[2] ?? t[1])] : undefined, caja: b.caja });
      continue;
    }
    const iE = b.lineas.findIndex(l => /^EQUIPO\s+\S+/i.test(l));
    if (iE >= 0) { equipos.push({ id: b.lineas[iE].replace(/^EQUIPO\s+/i, "").trim().toUpperCase(), modelo: (b.lineas[iE + 1] ?? "").trim(), caja: b.caja }); continue; }
    const lineas = b.lineas.map(l => l.match(/^(.*?)\s*=\s*Ø\s*([\d\s/]+)/)).filter(Boolean).map(m => ({ c: circuitoDe(m![1]), d: m![2].trim().replace(/\s+/g, " ") })).filter((l): l is { c: Circuito; d: string } => Boolean(l.c && l.d));
    if (lineas.length) { tubos.push({ lineas, caja: b.caja }); continue; }
    const e = b.lineas.map(l => l.match(/(?:^|\s)E(?:scala)?\s*[:=]?\s*1\s*[:/]\s*(\d{2,4})\b/i)).find(Boolean);
    if (e) escala = Number(e[1]) * 0.0254 / 72;
  }
  return { recintos, equipos, tubos, escala };
}

const usoDe = (temp?: [number, number]): Uso => !temp ? "servicio" : temp[1] <= -10 ? "congelado" : temp[1] <= 8 ? "refrigerado" : temp[1] <= 15 ? "atemperado" : "ambiente";
const croma = (c: readonly number[]) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
/** Circuito por color del trazo, según la costumbre de estos planos. Es una suposición y el informe lo dice. */
function circuitoDeColor([r, g, b]: readonly number[]): Circuito | null {
  if (croma([r, g, b]) < 0.3) return null;
  if (g >= r && g > b) return "liquido";
  if (b > 0.5 && r > 0.5) return "aspiracion-mt";
  if (b > r) return "aspiracion-bt";
  return "gas-caliente";
}

// ── Contornos: relleno del hueco entre muros ───────────────────────────────
function simplificar(ps: Punto[], eps: number): Punto[] {
  const dp = (a: number, b: number, guarda: boolean[]) => {
    let peor = 0, k = -1; const [ax, ay] = ps[a], [bx, by] = ps[b], l = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - ps[i][1]) - (ax - ps[i][0]) * (by - ay)) / l; if (d > peor) { peor = d; k = i; } }
    if (peor > eps) { guarda[k] = true; dp(a, k, guarda); dp(k, b, guarda); }
  };
  // Polígono cerrado: se parte por los dos vértices más alejados.
  let lejos = 0; for (let i = 1; i < ps.length; i++) if (Math.hypot(ps[i][0] - ps[0][0], ps[i][1] - ps[0][1]) > Math.hypot(ps[lejos][0] - ps[0][0], ps[lejos][1] - ps[0][1])) lejos = i;
  const guarda = ps.map(() => false); guarda[0] = guarda[lejos] = true;
  ps = [...ps, ps[0]]; guarda.push(true);
  dp(0, lejos, guarda); dp(lejos, ps.length - 1, guarda);
  return ps.filter((_, i) => guarda[i]).slice(0, -1);
}
function areaPuntos(ps: Punto[]) { let s = 0; for (let i = 0; i < ps.length; i++) { const [x0, y0] = ps[i], [x1, y1] = ps[(i + 1) % ps.length]; s += x0 * y1 - x1 * y0; } return Math.abs(s) / 2; }

type Hueco = { area: number; contorno: Punto[]; region: number };
/**
 * Rellena el hueco entre muros alrededor de cada rótulo de recinto. Qué trazos son muro no se sabe de antemano
 * (cotas, mobiliario y tramas comparten grises), así que se prueba quitando estilos de trazo y se queda la combinación
 * que más recintos hace cuadrar con su superficie rotulada.
 */
async function huecos(plano: PlanoLeido, semillas: Punto[], superficies: number[], respiro: () => Promise<void>): Promise<{ hueco: (Hueco | null)[]; escala: number; votos: number }> {
  const paso = Math.max(plano.ancho, plano.alto) / 1800, W = Math.ceil(plano.ancho / paso) + 2, H = Math.ceil(plano.alto / paso) + 2;
  const porEstilo = new Map<string, number[]>();
  for (const t of plano.trazos) {
    if (croma(t.color) > 0.12 || t.color[0] > 0.95) continue;
    const key = String(Math.round(t.color[0] * 12)); let celdas = porEstilo.get(key); if (!celdas) porEstilo.set(key, celdas = []);
    for (let i = 2; i < t.p.length; i += 2) {
      const x0 = t.p[i - 2] / paso, y0 = t.p[i - 1] / paso, x1 = t.p[i] / paso, y1 = t.p[i + 1] / paso, n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2));
      for (let k = 0; k <= n; k++) { const x = Math.floor(x0 + (x1 - x0) * k / n), y = Math.floor(y0 + (y1 - y0) * k / n); if (x >= 0 && y >= 0 && x < W && y < H) celdas.push(y * W + x); }
    }
  }
  const malla = new Uint8Array(W * H), marca = new Int32Array(W * H);
  type Region = { celdas: number; borde: boolean; caja: [number, number, number, number]; semillas: number };
  function rellenar(activos: Set<string>) {
    malla.fill(0); marca.fill(0);
    for (const [key, celdas] of porEstilo) if (activos.has(key)) for (const c of celdas) malla[c] = 1;
    const regiones = new Map<number, Region>(), de: number[] = [];
    semillas.forEach((s, n) => {
      let x = Math.floor(s[0] / paso), y = Math.floor(s[1] / paso), i = y * W + x;
      // Si el centro del rótulo cae sobre un trazo, se busca la celda libre más cercana.
      for (let r = 1; r < 8 && malla[i]; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (!malla[(y + dy) * W + x + dx]) { x += dx; y += dy; i = y * W + x; break; }
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || malla[i]) { de.push(0); return; }
      if (marca[i]) { regiones.get(marca[i])!.semillas++; de.push(marca[i]); return; }
      const id = n + 1, pila = [i], reg: Region = { celdas: 0, borde: false, caja: [x, y, x, y], semillas: 1 }; marca[i] = id;
      while (pila.length) {
        const c = pila.pop()!, cx = c % W, cy = (c - cx) / W; reg.celdas++;
        if (cx < reg.caja[0]) reg.caja[0] = cx; if (cx > reg.caja[2]) reg.caja[2] = cx; if (cy < reg.caja[1]) reg.caja[1] = cy; if (cy > reg.caja[3]) reg.caja[3] = cy;
        if (cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1) { reg.borde = true; continue; }
        for (const v of [c - 1, c + 1, c - W, c + W]) if (!malla[v] && !marca[v]) { marca[v] = id; pila.push(v); }
      }
      regiones.set(id, reg); de.push(id);
    });
    return { regiones, de };
  }
  const valida = (r?: Region, compartida = false) => r && !r.borde && (compartida || r.semillas === 1) ? r : null;
  function acuerdo(areas: number[]) {
    const k = areas.map((a, i) => a > 0 ? Math.sqrt(superficies[i] / a) : 0); let escala = 0, votos = 0;
    // La escala del grupo sale de sumar superficies y áreas: así mandan los recintos grandes, que se miden mejor.
    for (const c of k) if (c) { const de = k.map((v, i) => v && Math.abs(v / c - 1) < 0.03 ? i : -1).filter(i => i >= 0); if (de.length > votos) { votos = de.length; escala = Math.sqrt(de.reduce((s, i) => s + superficies[i], 0) / de.reduce((s, i) => s + areas[i], 0)); } }
    return { escala, votos };
  }
  const puntuar = (activos: Set<string>) => { const { regiones, de } = rellenar(activos); return acuerdo(de.map(id => (valida(regiones.get(id))?.celdas ?? 0) * paso * paso)).votos; };
  const activos = new Set(porEstilo.keys()); let mejor = puntuar(activos);
  for (let cambia = true; cambia;) {
    cambia = false;
    for (const key of porEstilo.keys()) {
      if (!activos.has(key)) continue;
      const prueba = new Set(activos); prueba.delete(key);
      await respiro();
      const p = puntuar(prueba);
      if (p > mejor) { mejor = p; activos.delete(key); cambia = true; }
    }
  }
  const { regiones, de } = rellenar(activos), V = W + 1;
  const hueco = de.map(id => {
    const reg = valida(regiones.get(id), true); if (!reg) return null;
    // Aristas del borde con el interior a un lado; el lazo mayor es el contorno exterior.
    const sig = new Map<number, number[]>(), dentro = (px: number, py: number) => marca[py * W + px] === id;
    const arista = (a: number, b: number) => { const l = sig.get(a); if (l) l.push(b); else sig.set(a, [b]); };
    for (let py = reg.caja[1]; py <= reg.caja[3]; py++) for (let px = reg.caja[0]; px <= reg.caja[2]; px++) {
      if (!dentro(px, py)) continue;
      if (!dentro(px, py - 1)) arista(py * V + px, py * V + px + 1);
      if (!dentro(px + 1, py)) arista(py * V + px + 1, (py + 1) * V + px + 1);
      if (!dentro(px, py + 1)) arista((py + 1) * V + px + 1, (py + 1) * V + px);
      if (!dentro(px - 1, py)) arista((py + 1) * V + px, py * V + px);
    }
    let contorno: Punto[] = [], mayor = 0;
    for (const inicio of [...sig.keys()]) {
      const lazo: Punto[] = []; let v = inicio;
      while (sig.get(v)?.length) { const b = sig.get(v)!.pop()!; lazo.push([(v % V) * paso, Math.floor(v / V) * paso]); v = b; if (v === inicio) break; }
      if (lazo.length > 3) { const a = areaPuntos(lazo); if (a > mayor) { mayor = a; contorno = lazo; } }
    }
    // Cada muro ocupa su celda entera: de media se pierde media celda por lado, y se devuelve al medir.
    const perimetro = contorno.length;
    contorno = simplificar(contorno, paso * 1.6);
    return contorno.length >= 3 ? { area: areaPuntos(contorno) + perimetro * paso * paso / 2, contorno, region: id } : null;
  });
  const sola = (h: Hueco | null) => h && hueco.filter(o => o?.region === h.region).length === 1 ? h.area : 0;
  return { hueco, ...acuerdo(hueco.map(sola)) };
}

// ── Trazos de color: símbolos de equipo y tuberías ─────────────────────────
function cajaDe(p: ArrayLike<number>): Caja { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (let i = 0; i < p.length; i += 2) { a = Math.min(a, p[i]); c = Math.max(c, p[i]); b = Math.min(b, p[i + 1]); d = Math.max(d, p[i + 1]); } return [a, b, c, d]; }
/** Grupos de trazos que se tocan (a menos de `margen`). Devuelve la caja de cada grupo. */
function grupos(cajas: Caja[], margen: number): Caja[] {
  const padre = cajas.map((_, i) => i), raiz = (i: number): number => padre[i] === i ? i : (padre[i] = raiz(padre[i]));
  const celda = 6, rejilla = new Map<number, number[]>();
  cajas.forEach((c, i) => {
    for (let gx = Math.floor((c[0] - margen) / celda); gx <= Math.floor((c[2] + margen) / celda); gx++) for (let gy = Math.floor((c[1] - margen) / celda); gy <= Math.floor((c[3] + margen) / celda); gy++) {
      const k = gx * 100003 + gy, l = rejilla.get(k);
      if (!l) { rejilla.set(k, [i]); continue; }
      for (const j of l) if (raiz(i) !== raiz(j) && distCajas(c, cajas[j]) <= margen) padre[raiz(i)] = raiz(j);
      l.push(i);
    }
  });
  const res = new Map<number, Caja>();
  cajas.forEach((c, i) => { const r = raiz(i), g = res.get(r); if (g) { g[0] = Math.min(g[0], c[0]); g[1] = Math.min(g[1], c[1]); g[2] = Math.max(g[2], c[2]); g[3] = Math.max(g[3], c[3]); } else res.set(r, [...c] as Caja); });
  return [...res.values()];
}
type Corrida = { horizontal: boolean; eje: number; a: number; b: number; n: number };
/** Corridas rectas de un circuito: los bordes paralelos y pegados son un mismo haz; `n` es cuántos tubos lleva. */
function corridas(trazos: TrazoPlano[], minimo: number): Corrida[] {
  const H = new Map<number, [number, number][]>(), V = new Map<number, [number, number][]>();
  const mete = (m: Map<number, [number, number][]>, k: number, a: number, b: number) => { const l = m.get(k); if (l) l.push([Math.min(a, b), Math.max(a, b)]); else m.set(k, [[Math.min(a, b), Math.max(a, b)]]); };
  for (const t of trazos) for (let i = 2; i < t.p.length; i += 2) {
    const x0 = t.p[i - 2], y0 = t.p[i - 1], x1 = t.p[i], y1 = t.p[i + 1], l = Math.hypot(x1 - x0, y1 - y0);
    if (l < 0.01) continue;
    if (Math.abs(y1 - y0) < 0.05 * l) mete(H, Math.round((y0 + y1) * 5), x0, x1); else if (Math.abs(x1 - x0) < 0.05 * l) mete(V, Math.round((x0 + x1) * 5), y0, y1);
  }
  const salida: Corrida[] = [];
  for (const [mapa, horizontal] of [[H, true], [V, false]] as const) {
    const bordes: { eje: number; a: number; b: number }[] = [];
    for (const [k, iv] of mapa) {
      iv.sort((p, q) => p[0] - q[0]); let [a, b] = iv[0];
      for (const [c, d] of iv.slice(1)) { if (c <= b + 0.3) b = Math.max(b, d); else { if (b - a >= minimo) bordes.push({ eje: k / 10, a, b }); a = c; b = d; } }
      if (b - a >= minimo) bordes.push({ eje: k / 10, a, b });
    }
    bordes.sort((p, q) => p.eje - q.eje);
    const haces: { ejes: number[]; a: number; b: number }[] = [];
    for (const e of bordes) {
      const h = haces.find(h => e.eje - h.ejes.at(-1)! < 0.9 && e.a < h.b - 0.5 * Math.min(e.b - e.a, h.b - h.a) && e.b > h.a + 0.5 * Math.min(e.b - e.a, h.b - h.a));
      if (h) { h.ejes.push(e.eje); h.a = Math.min(h.a, e.a); h.b = Math.max(h.b, e.b); } else haces.push({ ejes: [e.eje], a: e.a, b: e.b });
    }
    for (const h of haces) salida.push({ horizontal, eje: h.ejes.reduce((s, v) => s + v, 0) / h.ejes.length, a: h.a, b: h.b, n: Math.max(1, Math.round(h.ejes.length / 2)) });
  }
  return salida;
}

const nombreCorto: Record<Circuito, string> = { "aspiracion-bt": "Aspiración de baja", "aspiracion-mt": "Aspiración de media", liquido: "Líquido", "gas-caliente": "Gas caliente" };
const claseDeModelo = (modelo: string, uso?: Uso): ClaseEquipo => /DC/i.test(modelo.replace(/^TEWS/i, "")) ? (uso === "atemperado" || uso === "ambiente" ? "muelle" : "plafon") : uso === "congelado" || !uso ? "cubico" : uso === "refrigerado" ? "plafon" : "muelle";
function contiene(contorno: Punto[], [x, y]: Punto) {
  let d = false;
  for (let i = 0, j = contorno.length - 1; i < contorno.length; j = i++) { const [xi, yi] = contorno[i], [xj, yj] = contorno[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d; }
  return d;
}

/** `respiro` deja pintar a la pantalla entre pasos largos (la animación de conversión sigue viva mientras se lee). */
export async function leerPlanta(plano: PlanoLeido, nombre = "Plano subido", respiro: () => Promise<void> = async () => {}): Promise<LecturaPlanta> {
  if (!plano.textos.some(t => t.t.trim())) throw new PlanoSinTexto();
  const r = rotulos(bloquesDeTexto(plano.textos));
  if (!r.recintos.length) throw new PlanoSinRecintos();
  const avisos: string[] = [];

  // Escala: la que más recintos pone de acuerdo entre su superficie rotulada y su hueco medido.
  const medidos = await huecos(plano, r.recintos.map(x => centro(x.caja)), r.recintos.map(x => x.superficie), respiro), hueco = medidos.hueco;
  await respiro();
  let escala = medidos.escala, votos = medidos.votos;
  if (r.escala && (votos < 2 || Math.abs(r.escala / escala - 1) > 0.05)) { if (votos >= 2) avisos.push("La escala rotulada no cuadra con las superficies; se usa la que sale de las superficies."); else { escala = r.escala; votos = 2; } }
  if (votos < 2) throw new PlanoSinRecintos("No he podido deducir la escala: las superficies rotuladas no cuadran con los recintos que dibujan los muros. Este plano necesita revisión a mano.");

  const usados = new Set<string>(), recintos: Recinto[] = [], leidos: RecintoLeido[] = [];
  r.recintos.forEach((x, i) => {
    let id = slug(x.nombre); for (let n = 2; usados.has(id); n++) id = `${slug(x.nombre)}-${n}`; usados.add(id);
    // Un hueco compartido por varios rótulos (un vestíbulo abierto a un pasillo) se da al recinto mayor si la suma de superficies cuadra.
    const juntos = hueco[i] ? r.recintos.map((o, j) => hueco[j]?.region === hueco[i]!.region ? j : -1).filter(j => j >= 0) : [];
    const suma = juntos.reduce((t, j) => t + r.recintos[j].superficie, 0), mayor = juntos.every(j => r.recintos[j].superficie <= x.superficie);
    const h = hueco[i] && (juntos.length === 1 || mayor && Math.abs(hueco[i]!.area * escala ** 2 / suma - 1) < 0.08) ? hueco[i] : null;
    const desvio = h ? h.area * escala ** 2 / (juntos.length > 1 ? suma : x.superficie) - 1 : null;
    const ajuste: AjusteRecinto = desvio === null || Math.abs(desvio) >= 0.2 ? "estimado" : Math.abs(desvio) < 0.06 && juntos.length === 1 ? "medido" : "aproximado";
    let contorno = h?.contorno ?? [];
    if (ajuste === "estimado") { const [cx, cy] = centro(x.caja), l = Math.sqrt(x.superficie) / escala / 2; contorno = [[cx - l, cy - l], [cx + l, cy - l], [cx + l, cy + l], [cx - l, cy + l]]; }
    if (x.alto === null) avisos.push(`«${x.nombre}» no trae altura: se pone 3 m.`);
    recintos.push({ id, nombre: x.nombre, contorno: contorno.map(([px, py]) => [Math.round(px * 10) / 10, Math.round(py * 10) / 10]), superficie: x.superficie, alto: x.alto ?? 3, temp: x.temp, uso: usoDe(x.temp) });
    leidos.push({ id, nombre: x.nombre, ajuste, desvio: desvio === null ? null : Math.round(desvio * 1000) / 10 });
  });
  const estimados = leidos.filter(l => l.ajuste === "estimado"), aproximados = leidos.filter(l => l.ajuste === "aproximado");
  if (estimados.length) avisos.push(`${estimados.length} de ${leidos.length} recintos no cierran con sus muros o no cuadran con su superficie: se dibujan como un cuadrado de la superficie rotulada, en el sitio del rótulo.`);
  if (aproximados.length) avisos.push(`${aproximados.length} recintos tienen el contorno de sus muros, pero su superficie medida se desvía de la rotulada. Manda la rotulada.`);
  const recintoEn = (p: Punto) => recintos.find((x, i) => leidos[i].ajuste !== "estimado" && contiene(x.contorno, p)) ?? recintos.find(x => contiene(x.contorno, p));
  await respiro();

  // Equipos: el estilo de trazo de color cuyos grupos compactos casan con más rótulos de equipo.
  // Solo cuenta el color que cae sobre la planta: la leyenda del plano repite símbolos y líneas fuera de ella.
  const todos = recintos.filter((_, i) => leidos[i].ajuste !== "estimado").flatMap(x => x.contorno), holgura = lado0(3, escala);
  const marco: Caja = [Math.min(...todos.map(p => p[0])) - holgura, Math.min(...todos.map(p => p[1])) - holgura, Math.max(...todos.map(p => p[0])) + holgura, Math.max(...todos.map(p => p[1])) + holgura];
  const color = plano.trazos.filter(t => croma(t.color) >= 0.3 && t.p[0] >= marco[0] && t.p[0] <= marco[2] && t.p[1] >= marco[1] && t.p[1] <= marco[3]);
  const estilos = new Map<string, TrazoPlano[]>();
  for (const t of color) { const key = `${t.color.map(v => Math.round(v * 20)).join(",")}/${t.grosor.toFixed(2)}`; const l = estilos.get(key); if (l) l.push(t); else estilos.set(key, [t]); }
  const lado = (m: number) => m / escala;
  let simbolos: Caja[] = [], estiloEquipo = "", casan = 0;
  if (r.equipos.length) for (const [key, ts] of estilos) {
    const cs = grupos(ts.map(t => cajaDe(t.p)), 1).filter(c => Math.min(c[2] - c[0], c[3] - c[1]) >= lado(0.5) && Math.max(c[2] - c[0], c[3] - c[1]) <= lado(6));
    const n = r.equipos.filter(e => cs.some(c => distCaja(c, centro(e.caja)) < lado(5))).length;
    if (n > casan || n === casan && n > 0 && cs.length < simbolos.length) { casan = n; simbolos = cs; estiloEquipo = key; }
  }
  const pares = r.equipos.flatMap((e, i) => simbolos.map((c, j) => ({ i, j, d: distCajas(c, e.caja) }))).filter(p => p.d < lado(6)).sort((a, b) => a.d - b.d);
  const cajaEquipo = new Map<number, Caja>(), cogidos = new Set<number>();
  for (const p of pares) if (!cajaEquipo.has(p.i) && !cogidos.has(p.j)) { cajaEquipo.set(p.i, simbolos[p.j]); cogidos.add(p.j); }
  const equipos: EquipoPlano[] = [], sinSimbolo: string[] = [];
  r.equipos.forEach((e, i) => {
    let caja = cajaEquipo.get(i);
    if (!caja) { sinSimbolo.push(e.id); const [cx, cy] = centro(e.caja); caja = [cx - lado(1.5), cy - lado(0.6), cx + lado(1.5), cy + lado(0.6)]; }
    const rec = recintoEn(centro(caja)) ?? recintos.reduce((m, x) => Math.hypot(...resta(centro(cajaDe(x.contorno.flat())), centro(caja!))) < Math.hypot(...resta(centro(cajaDe(m.contorno.flat())), centro(caja!))) ? x : m);
    equipos.push({ id: e.id, recinto: rec.id, modelo: e.modelo, clase: claseDeModelo(e.modelo, rec.uso), caja: caja.map(v => Math.round(v * 10) / 10) as Caja });
  });
  if (sinSimbolo.length) avisos.push(`Sin símbolo en el plano para ${sinSimbolo.join(", ")}: se colocan donde está su rótulo.`);

  // Tuberías: por circuito, troceadas para que cada trozo tome el diámetro del rótulo más cercano que nombra ese circuito.
  const tramos: Tramo[] = []; let metros = 0, sinRotulo = 0, sinDiametro = 0;
  const porCircuito = new Map<Circuito, TrazoPlano[]>();
  for (const [key, ts] of estilos) { if (key === estiloEquipo) continue; const c = circuitoDeColor(ts[0].color); if (c) porCircuito.set(c, [...(porCircuito.get(c) ?? []), ...ts]); }
  for (const [c, ts] of porCircuito) {
    const con = r.tubos.filter(t => t.lineas.some(l => l.c === c));
    for (const co of corridas(ts, lado(0.3))) {
      const trozos = Math.max(1, Math.ceil((co.b - co.a) / lado(1.5))), punto = (v: number): Punto => co.horizontal ? [v, co.eje] : [co.eje, v];
      let desde = co.a, previo: string | undefined;
      for (let i = 0; i <= trozos; i++) {
        const a = co.a + (co.b - co.a) * i / trozos, medio = punto(Math.min(co.b, a + (co.b - co.a) / trozos / 2));
        const cerca = i < trozos ? con.reduce<{ d: number; t: RotuloTubo | null }>((m, t) => { const d = distCaja(t.caja, medio); return d < m.d ? { d, t } : m; }, { d: Infinity, t: null }) : null;
        const lejos = Boolean(cerca && cerca.d > lado(12)), d = i < trozos ? `${cerca?.t?.lineas.find(l => l.c === c)?.d ?? ""}${lejos ? "?" : ""}` : undefined;
        if (i > 0 && d !== previo) {
          const largo = (a - desde) * escala * co.n, sinCerca = previo!.endsWith("?"), diametro = previo!.replace("?", ""); metros += largo;
          if (diametro) {
            if (sinCerca) sinRotulo += largo;
            tramos.push({ id: `t${tramos.length + 1}`, nombre: `${nombreCorto[c]} Ø${diametro}"`, puntos: [punto(desde), punto(a)].map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as Punto), lineas: [{ c, d: diametro, ...(co.n > 1 ? { n: co.n } : {}) }], ...(sinCerca ? { duda: `${nombreCorto[c]}: ${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(largo)} m sin rótulo de diámetro cerca; se toma el del rótulo más próximo (Ø${diametro}").` } : {}) });
          } else sinDiametro += largo;
          desde = a;
        }
        previo = d;
      }
    }
  }
  if (tramos.length) avisos.push("El circuito de cada tubería sale del color del trazo (azul aspiración de baja, rosa aspiración de media, verde líquido, rojo gas caliente) y su diámetro del rótulo más cercano. Repásalo antes de pedir material.");
  const m1 = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(n);
  if (sinRotulo > 0.5) avisos.push(`${m1(sinRotulo)} m de tubería no tienen un rótulo de diámetro cerca: llevan el del rótulo más próximo y quedan por confirmar.`);
  if (sinDiametro > 0.5) avisos.push(`${m1(sinDiametro)} m de tubería quedan fuera de la medición: ningún rótulo del plano da diámetro para su circuito.`);

  return {
    planta: { id: slug(nombre), nombre, origen: "Leído del PDF por Plano. Propuesta pendiente de revisión.", escala: Math.round(escala * 1e5) / 1e5, recintos, equipos, tramos },
    informe: { recintos: leidos, equipos: equipos.length, equiposSinSimbolo: sinSimbolo, metrosTuberia: Math.round((metros - sinDiametro) * 10) / 10, avisos }
  };
}
const resta = (a: Punto, b: Punto): Punto => [a[0] - b[0], a[1] - b[1]];
const lado0 = (m: number, escala: number) => m / escala;
