import { filledColors, colorKey, type PdfExtraction, type PdfPage, type RGB } from "./captura/pdf-extraction";
import { proposeWallCandidates, type LegendRule } from "./captura/wall-candidates";
import { metersPerDrawingUnit, polylineLength } from "./captura/geometry";
import { createEstimateProposal, type ProposalLine } from "./captura/estimate";
import type { EstimateInput, Point } from "./captura/schema";
import { normalize } from "./search";
import type { Article, BudgetItem } from "./domain";

/**
 * «Presupuestar desde un plano»: la lógica del flujo guiado de la ficha, sin interfaz.
 * Apoya cada número en el motor de captura de Codex (candidatos a pared, escala, propuesta con precios
 * del catálogo) y traduce sus conceptos a palabras de obra: medida, pared que se tira o nueva, trabajo, partida.
 * El borrador vive en localStorage hasta que el dominio lo persista (ver docs/PREGUNTAS.md).
 */

export type Significado = "tira" | "nueva" | "nada";
export type TrabajoId = "demoler" | "levantar" | "acabar";
export type Paso = 1 | 2 | 3 | 4 | 5;
export type Borrador = {
  version: 1; projectId: string; budgetId: string | null; paso: Paso;
  documentId: string | null; nombre: string; extraction: PdfExtraction | null; page: number;
  medida: { start: Point | null; end: Point | null; metros: string };
  /** Qué significa cada color de relleno del plano, por clave «r,g,b». */
  leyenda: Record<string, Significado>;
  /** Candidatos que la persona ha dicho que no son paredes. */
  noParedes: string[];
  altura: string; huecos: string;
  trabajos: Record<TrabajoId, { activo: boolean; articleId: string | null }>;
  /** Identificadores estables para el motor, que exige UUID en fuentes, mediciones e intenciones. */
  ids: { source: string; manual: string; calibration: string; altura: string; huecos: string; paredes: Record<string, string>; intents: Record<string, string>; items: Record<string, string> };
};

export const uuid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`);
export const numero = (s: string) => { const n = Number(String(s).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const redondear = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

export function borradorNuevo(projectId: string, budgetId: string | null): Borrador {
  return {
    version: 1, projectId, budgetId, paso: 1, documentId: null, nombre: "", extraction: null, page: 1,
    medida: { start: null, end: null, metros: "" }, leyenda: {}, noParedes: [], altura: "2,60", huecos: "0",
    trabajos: { demoler: { activo: true, articleId: null }, levantar: { activo: true, articleId: null }, acabar: { activo: false, articleId: null } },
    ids: { source: uuid(), manual: uuid(), calibration: uuid(), altura: uuid(), huecos: uuid(), paredes: {}, intents: {}, items: {} }
  };
}

export const claveBorrador = (projectId: string) => `plano.borrador.${projectId}`;
export function cargarBorrador(projectId: string): Borrador | null {
  try { const raw = localStorage.getItem(claveBorrador(projectId)); if (!raw) return null; const b = JSON.parse(raw) as Borrador; return b.version === 1 && b.projectId === projectId ? b : null; } catch { return null; }
}
export function guardarBorrador(b: Borrador) { try { localStorage.setItem(claveBorrador(b.projectId), JSON.stringify(b)); return true; } catch { return false; } }
export function borrarBorrador(projectId: string) { try { localStorage.removeItem(claveBorrador(projectId)); } catch { /* sin almacenamiento */ } }

export function paginaActual(b: Borrador): PdfPage | null {
  return b.extraction?.pages.find(p => p.page === b.page) ?? b.extraction?.pages[0] ?? null;
}

/** Nombre llano de un color para preguntar «¿qué significa el rojo?». */
export function nombreColor([r, g, b]: RGB): string {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min < 28) return max > 225 ? "blanco" : max < 60 ? "negro" : "gris";
  const h = (() => { const d = max - min; let x = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; x *= 60; return x; })();
  if (h < 15 || h >= 345) return "rojo";
  if (h < 40) return "naranja";
  if (h < 70) return "amarillo";
  if (h < 160) return "verde";
  if (h < 200) return "turquesa";
  if (h < 260) return "azul";
  if (h < 300) return "morado";
  return "rosa";
}
export function colores(page: PdfPage) {
  return filledColors(page).filter(c => nombreColor(c.color) !== "blanco").slice(0, 8).map(c => ({ ...c, nombre: nombreColor(c.color) }));
}

export function escala(b: Borrador): number | null {
  const { start, end, metros } = b.medida; const m = numero(metros);
  if (!start || !end || m <= 0) return null;
  try { return metersPerDrawingUnit(start, end, m); } catch { return null; }
}

/** Vértice de trazo más cercano al punto tocado (esquinas incluidas), para que la medida caiga sobre el dibujo y no al lado. */
export function puntoCercano(page: PdfPage, p: Point, tolerancia: number): Point {
  let mejor: Point = p, d0 = tolerancia;
  for (const path of page.paths) for (const q of path.points) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < d0) { d0 = d; mejor = q; } }
  return [redondear(mejor[0]), redondear(mejor[1])];
}

export type Pared = { id: string; nombre: string; estado: "tira" | "nueva"; longitud: number; centerline: [Point, Point]; color: RGB; descartada: boolean; pathIds: string[] };
export function reglas(leyenda: Borrador["leyenda"]): LegendRule[] {
  return Object.entries(leyenda).filter(([, s]) => s !== undefined).map(([key, s]) => ({ color: key.split(",").map(Number) as [number, number, number], action: s === "tira" ? "demolish" : s === "nueva" ? "build" : "ignore" }));
}
/** Paredes propuestas por el motor para la leyenda elegida, con su longitud en metros si ya hay escala. */
export function paredes(b: Borrador): Pared[] {
  const page = paginaActual(b); if (!page) return [];
  const r = reglas(b.leyenda); if (!r.some(x => x.action !== "ignore")) return [];
  let candidatos; try { candidatos = proposeWallCandidates(page, r).candidates; } catch { return []; }
  const k = escala(b);
  return candidatos
    .sort((a, c) => a.action.localeCompare(c.action) || polylineLength(c.centerline) - polylineLength(a.centerline))
    .map((c, i) => ({ id: c.id, nombre: `Pared ${i + 1}`, estado: c.action === "demolish" ? "tira" : "nueva", longitud: k ? redondear(polylineLength(c.centerline) * k, 2) : 0, centerline: c.centerline, color: c.color, descartada: b.noParedes.includes(c.id), pathIds: c.source_path_ids }));
}
export function resumenParedes(ps: Pared[]) {
  const vivas = ps.filter(p => !p.descartada);
  const suma = (estado: Pared["estado"]) => { const l = vivas.filter(p => p.estado === estado); return { n: l.length, metros: redondear(l.reduce((s, p) => s + p.longitud, 0), 2) }; };
  return { tira: suma("tira"), nueva: suma("nueva"), descartadas: ps.length - vivas.length };
}

export type Trabajo = { id: TrabajoId; titulo: string; detalle: string; aplicaA: Pared["estado"]; caras: 1 | 2; patron: RegExp; excluye?: RegExp };
export const trabajos: Trabajo[] = [
  { id: "demoler", titulo: "Demoler las paredes que se tiran", detalle: "Superficie de las paredes marcadas «se tira», por la altura.", aplicaA: "tira", caras: 1, patron: /demoli|derrib/i },
  { id: "levantar", titulo: "Levantar las paredes nuevas", detalle: "Superficie de las paredes marcadas «nueva», por la altura.", aplicaA: "nueva", caras: 1, patron: /tabique|yeso|pladur|ladrillo|cartón/i, excluye: /demoli|derrib|retirad/i },
  { id: "acabar", titulo: "Pintar las paredes nuevas", detalle: "Las dos caras de cada pared nueva. Las paredes que se quedan no salen del plano: añádelas a mano.", aplicaA: "nueva", caras: 2, patron: /pintur|pintar|acabado/i }
];
/** Artículos del catálogo que pueden medirse desde el plano: por superficie o por metro lineal. */
export const articulosMedibles = (articles: Article[]) => articles.filter(a => a.unit === "m²" || a.unit === "ml");
export function sugerirArticulo(articles: Article[], t: Trabajo): Article | null {
  const medibles = articulosMedibles(articles).filter(a => t.patron.test(a.name) && !(t.excluye && t.excluye.test(a.name)));
  return medibles.find(a => a.unit === "m²") ?? medibles[0] ?? null;
}
/** Cantidad que saldrá del plano para un trabajo, en la unidad del artículo elegido. */
export function cantidadTrabajo(t: Trabajo, ps: Pared[], altura: number, huecos: number, unit: string) {
  const largo = ps.filter(p => !p.descartada && p.estado === t.aplicaA).reduce((s, p) => s + p.longitud, 0);
  if (unit === "ml") return redondear(largo * t.caras, 2);
  return redondear(Math.max(0, largo * altura * t.caras - (t.caras === 1 ? huecos : 0)), 2);
}

/** Completa los UUID que el motor necesita para cada pared, intención y partida, sin cambiar los ya asignados. */
export function asegurarIds(b: Borrador, ps: Pared[]): Borrador {
  const ids = { ...b.ids, paredes: { ...b.ids.paredes }, intents: { ...b.ids.intents }, items: { ...b.ids.items } };
  let cambiado = false;
  for (const p of ps) { if (!ids.paredes[p.id]) { ids.paredes[p.id] = uuid(); cambiado = true; } for (const t of trabajos) for (const cara of [1, 2]) { const k = `${t.id}:${p.id}:${cara}`; if (!ids.intents[k]) { ids.intents[k] = uuid(); cambiado = true; } } }
  for (const t of trabajos) if (!ids.items[t.id]) { ids.items[t.id] = uuid(); cambiado = true; }
  return cambiado ? { ...b, ids } : b;
}

/** La entrada del motor de Codex: fuente, escala, una medición por pared y una intención por pared y trabajo. */
export function entradaMotor(b: Borrador, ps: Pared[], articles: Article[]): EstimateInput | null {
  const page = paginaActual(b); const { start, end } = b.medida; const m = numero(b.medida.metros);
  if (!page || !b.extraction || !start || !end || m <= 0) return null;
  const altura = numero(b.altura), huecos = numero(b.huecos);
  const vivas = ps.filter(p => !p.descartada && b.ids.paredes[p.id]);
  const sources: EstimateInput["sources"] = [
    { id: b.ids.source, kind: "pdf", label: b.nombre || "Plano", sha256: b.extraction.sha256, phase: "unspecified", legend: "", ...(b.documentId && /^[0-9a-f-]{36}$/i.test(b.documentId) ? { document_id: b.documentId } : {}) },
    { id: b.ids.manual, kind: "manual", label: "Datos indicados en la ficha", phase: "unspecified", legend: "" }
  ];
  const measurements: EstimateInput["measurements"] = [
    ...vivas.map(p => ({ id: b.ids.paredes[p.id], source_id: b.ids.source, label: p.nombre, kind: "plan_length" as const, page: page.page, calibration_id: b.ids.calibration, points: p.centerline, derived_from_path_ids: p.pathIds })),
    { id: b.ids.altura, source_id: b.ids.manual, label: "Altura de las paredes", kind: "quantity", value: Math.max(altura, 0.01), unit: "ml", method: "manual", reference: "Altura indicada en la ficha" },
    ...(huecos > 0 ? [{ id: b.ids.huecos, source_id: b.ids.manual, label: "Huecos descontados", kind: "quantity" as const, value: huecos, unit: "m²" as const, method: "manual" as const, reference: "Puertas y ventanas indicadas en la ficha" }] : [])
  ];
  const intents: EstimateInput["intents"] = [];
  for (const t of trabajos) {
    const cfg = b.trabajos[t.id]; if (!cfg.activo) continue;
    const article = articles.find(a => a.id === cfg.articleId);
    const suyas = vivas.filter(p => p.estado === t.aplicaA);
    const masLarga = suyas.slice().sort((a, c) => c.longitud - a.longitud)[0];
    for (const p of suyas) for (let cara = 1; cara <= t.caras; cara++) {
      const descuento = huecos > 0 && t.caras === 1 && p.id === masLarga?.id ? [b.ids.huecos] : [];
      intents.push({
        id: b.ids.intents[`${t.id}:${p.id}:${cara}`], label: `${t.titulo} · ${p.nombre}${t.caras > 1 ? ` · cara ${cara}` : ""}`, article_id: article?.id ?? null,
        formula: article?.unit === "ml" ? { kind: "sum", measurement_ids: [b.ids.paredes[p.id]] } : { kind: "wall_area", length_id: b.ids.paredes[p.id], height_id: b.ids.altura, opening_ids: descuento },
        inclusion: "included", adjustment_percent: 0, adjustment_reason: ""
      });
    }
  }
  if (!intents.length) return null;
  return { schema_version: 1, project_id: b.projectId, scope: "Partidas propuestas desde el plano", sources, calibrations: [{ id: b.ids.calibration, source_id: b.ids.source, page: page.page, start, end, distance_m: m, reference: "Medida indicada sobre el plano" }], measurements, intents };
}

export type LineaPropuesta = { trabajo: Trabajo; article: Article | null; item: BudgetItem | null; cantidad: number; paredes: number; pendientes: string[]; avisos: string[] };
export type Propuesta = { lineas: LineaPropuesta[]; items: BudgetItem[]; base: number; pendientes: number };

/** Pasa la entrada por el motor y agrupa sus líneas (una por pared) en una partida por trabajo. */
export function propuesta(b: Borrador, ps: Pared[], articles: Article[], organizationId: string): Propuesta | { error: string } {
  const entrada = entradaMotor(b, ps, articles);
  if (!entrada) return { error: "Faltan la medida del plano o algún trabajo marcado." };
  let resultado: ReturnType<typeof createEstimateProposal>;
  try { resultado = createEstimateProposal(entrada, { organization_id: organizationId, articles }); }
  catch (e) { return { error: e instanceof Error ? e.message : "El motor no ha podido calcular la propuesta." }; }
  const porIntent = new Map<string, string>(Object.entries(b.ids.intents).map(([k, id]) => [id, k.split(":")[0]]));
  const lineas: LineaPropuesta[] = [];
  for (const t of trabajos) {
    if (!b.trabajos[t.id].activo) continue;
    const suyas: ProposalLine[] = resultado.lines.filter(l => porIntent.get(l.id) === t.id);
    if (!suyas.length) continue;
    const article = articles.find(a => a.id === b.trabajos[t.id].articleId) ?? null;
    const calculadas = suyas.filter(l => l.item);
    const cantidad = redondear(calculadas.reduce((s, l) => s + (l.item?.quantity ?? 0), 0));
    const pendientes = [...new Set(suyas.flatMap(l => l.issues.map(i => i.message)))];
    const avisos = [...new Set(suyas.flatMap(l => l.warnings))].filter(w => !/pendiente de revisión humana/.test(w));
    const base = calculadas[0]?.item ?? null;
    const item = base && cantidad > 0 ? { ...base, id: b.ids.items[t.id], quantity: cantidad } : null;
    lineas.push({ trabajo: t, article, item, cantidad, paredes: new Set(suyas.map(l => l.label.replace(/ · cara \d$/, ""))).size, pendientes, avisos });
  }
  const items = lineas.flatMap(l => (l.item ? [l.item] : []));
  return { lineas, items, base: resultado.priced_subtotal.base, pendientes: lineas.filter(l => !l.item).length };
}

export type Coincidencia = { nuevo: BudgetItem; existente: BudgetItem };
/** Partidas que ya estaban en la revisión y se parecen a las propuestas: misma descripción o mismo artículo. */
export function coincidencias(existentes: BudgetItem[], nuevos: BudgetItem[]): Coincidencia[] {
  const out: Coincidencia[] = [];
  for (const nuevo of nuevos) {
    const ex = existentes.find(e => normalize(e.description) === normalize(nuevo.description) || (e.chapter === nuevo.chapter && e.unit === nuevo.unit && e.unit_price === nuevo.unit_price));
    if (ex) out.push({ nuevo, existente: ex });
  }
  return out;
}
export type Decision = "sustituir" | "añadir";
/** Mezcla respetando lo que había: sustituir cambia cantidad y precio en la partida existente; añadir la pone detrás. */
export function fusionar(existentes: BudgetItem[], nuevos: BudgetItem[], decisiones: Record<string, Decision>, pares: Coincidencia[]): BudgetItem[] {
  const resultado = existentes.map(e => ({ ...e }));
  const añadidos: BudgetItem[] = [];
  for (const nuevo of nuevos) {
    const par = pares.find(p => p.nuevo.id === nuevo.id);
    if (par && (decisiones[nuevo.id] ?? "sustituir") === "sustituir") {
      const i = resultado.findIndex(e => e.id === par.existente.id);
      if (i >= 0) { resultado[i] = { ...resultado[i], quantity: nuevo.quantity, unit: nuevo.unit, unit_price: nuevo.unit_price, vat_rate: nuevo.vat_rate }; continue; }
    }
    añadidos.push(nuevo);
  }
  return [...resultado, ...añadidos];
}
