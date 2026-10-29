import { filledColors, type PdfExtraction, type PdfPage, type RGB } from "./captura/pdf-extraction";
import { proposeWallCandidates, type LegendRule } from "./captura/wall-candidates";
import { metersPerDrawingUnit, polylineLength } from "./captura/geometry";
import { createEstimateProposal } from "./captura/estimate";
import type { PdfReadReport } from "./captura/read-pdf";
import type { EstimateInput, Point } from "./captura/schema";
import { normalize } from "./search";
import { totals, type Article, type BudgetItem } from "./domain";

/**
 * «Presupuestar desde un plano»: la lógica del flujo guiado de la ficha, sin interfaz.
 * Un expediente trae varios planos de la misma vivienda (demolición, obra nueva, cotas, áreas, instalaciones):
 * cada uno dice para qué sirve, comparten escala solo tras confirmarla, y cada trabajo toma su
 * cantidad del plano que le corresponde. Todo número sale del motor de captura de Codex.
 */

export type Uso = "demolicion" | "obra_nueva" | "cotas" | "areas" | "instalaciones" | "otro";
export const usos: { id: Uso; label: string; hint: string; patron: RegExp; paredes?: Pared["estado"] }[] = [
  { id: "demolicion", label: "Demolición", hint: "Lo marcado de color se tira", patron: /demoli|derrib/i, paredes: "tira" },
  { id: "obra_nueva", label: "Obra nueva", hint: "Lo marcado de color es nuevo: tabiques, pladur", patron: /pladur|tabiq|obra nueva|reformad/i, paredes: "nueva" },
  { id: "cotas", label: "Cotas", hint: "Con las medidas escritas: el mejor para dar la escala", patron: /cota|medid/i },
  { id: "areas", label: "Áreas", hint: "Superficies de las estancias: suelos, techos, pintura", patron: /\bárea|\barea|superfic/i },
  { id: "instalaciones", label: "Instalaciones", hint: "Luz, clima, fontanería: puntos a contar", patron: /climat|ilumin|electr|fontan|instalac/i },
  { id: "otro", label: "Otro", hint: "Estado actual, distribución u otra vista", patron: /./ }
];
export const usoSugerido = (nombre: string): Uso => usos.find(u => u.patron.test(nombre))?.id ?? "otro";
export const nombreUso = (uso: Uso) => usos.find(u => u.id === uso)?.label ?? uso;

export type Medida = { start: Point | null; end: Point | null; metros: string };
export type PlanoCargado = { id: string; nombre: string; documentId: string | null; extraction: PdfExtraction; page: number; uso: Uso; medida: Medida | null; ignorados: string[]; escalaConfirmada?: string; lectura?: PdfReadReport };
export type TrabajoId = "demoler" | "levantar" | "acabar";
export type Paso = 1 | 2 | 3 | 4 | 5;
export type Borrador = {
  version: 2; projectId: string; budgetId: string | null; paso: Paso;
  planos: PlanoCargado[];
  /** La medida de referencia; otros planos la usan solo con confirmación vigente. */
  medida: Medida & { planoId: string | null };
  noParedes: string[];
  altura: string; huecos: string; huecosDemolicion?: string;
  trabajos: Record<TrabajoId, { activo: boolean; articleId: string | null }>;
  ids: { manual: string; altura: string; huecos: string; sources: Record<string, string>; calibrations: Record<string, string>; paredes: Record<string, string>; intents: Record<string, string>; items: Record<string, string> };
};

export const uuid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`);
export const numero = (s: string) => { const n = Number(String(s).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const redondear = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const medidaVacia = (): Medida => ({ start: null, end: null, metros: "" });

export function borradorNuevo(projectId: string, budgetId: string | null): Borrador {
  return {
    version: 2, projectId, budgetId, paso: 1, planos: [], medida: { ...medidaVacia(), planoId: null }, noParedes: [], altura: "2,60", huecos: "0", huecosDemolicion: "0",
    trabajos: { demoler: { activo: true, articleId: null }, levantar: { activo: true, articleId: null }, acabar: { activo: false, articleId: null } },
    ids: { manual: uuid(), altura: uuid(), huecos: uuid(), sources: {}, calibrations: {}, paredes: {}, intents: {}, items: {} }
  };
}
export const claveBorrador = (projectId: string) => `plano.borrador.${projectId}`;
export function cargarBorrador(projectId: string): Borrador | null {
  try { const raw = localStorage.getItem(claveBorrador(projectId)); if (!raw) return null; const b = JSON.parse(raw) as Borrador; if (b.version !== 2 || b.projectId !== projectId) return null;
    // Borradores anteriores descontaban el mismo valor en ambos trabajos: pedir revisión explícita.
    if (b.huecosDemolicion === undefined) return { ...b, paso: Math.min(b.paso, 4) as Paso, huecosDemolicion: b.huecos };
    return b; } catch { return null; }
}
export function guardarBorrador(b: Borrador) { try { localStorage.setItem(claveBorrador(b.projectId), JSON.stringify(b)); return true; } catch { return false; } }
export function borrarBorrador(projectId: string) { try { localStorage.removeItem(claveBorrador(projectId)); } catch { /* sin almacenamiento */ } }

/** Añade un plano leído; el uso se sugiere por el nombre y se puede cambiar. */
export function añadirPlano(b: Borrador, plano: { nombre: string; extraction: PdfExtraction; documentId?: string | null; lectura?: PdfReadReport }): Borrador {
  if (b.planos.some(p => p.extraction.sha256 === plano.extraction.sha256 && p.page === plano.extraction.pages[0].page)) return b;
  const nuevo: PlanoCargado = { id: uuid(), nombre: plano.nombre, documentId: plano.documentId ?? null, extraction: plano.extraction, page: plano.extraction.pages[0].page, uso: usoSugerido(plano.nombre), medida: null, ignorados: [], ...(plano.lectura ? { lectura: plano.lectura } : {}) };
  return { ...b, planos: [...b.planos, nuevo] };
}
export function quitarPlano(b: Borrador, planoId: string): Borrador {
  const medida = b.medida.planoId === planoId ? { ...medidaVacia(), planoId: null } : b.medida;
  return { ...b, planos: b.planos.filter(p => p.id !== planoId), medida, noParedes: b.noParedes.filter(id => !id.startsWith(`${planoId}:`)) };
}
export const paginaDe = (p: PlanoCargado): PdfPage => p.extraction.pages.find(x => x.page === p.page) ?? p.extraction.pages[0];
/** Coincidencia del tamaño de papel: sirve para sugerir, nunca prueba la escala ni el origen. */
export const mismaHoja = (a: PlanoCargado, c: PlanoCargado) => Math.abs(paginaDe(a).width - paginaDe(c).width) < 0.5 && Math.abs(paginaDe(a).height - paginaDe(c).height) < 0.5;
/** El plano donde conviene medir: el de cotas si lo hay, si no el primero. */
export const planoParaMedir = (b: Borrador): PlanoCargado | null => b.planos.find(p => p.uso === "cotas") ?? b.planos[0] ?? null;

const escalaMedida = (m: Medida | null): number | null => { if (!m?.start || !m.end) return null; const k = numero(m.metros); if (k <= 0) return null; try { return metersPerDrawingUnit(m.start, m.end, k); } catch { return null; } };
/** La confirmación queda ligada a páginas, archivos y medida; cualquier cambio la invalida. */
function firmaEscala(b: Borrador, p: PlanoCargado): string | null {
  const base = b.planos.find(x => x.id === b.medida.planoId);
  if (!base || !escalaMedida(b.medida)) return null;
  return JSON.stringify([base.id, base.extraction.sha256, base.page, b.medida.start, b.medida.end, numero(b.medida.metros), p.extraction.sha256, p.page]);
}
export function confirmarEscalaCompartida(b: Borrador, planoId: string, confirmar = true): Borrador {
  const p = b.planos.find(x => x.id === planoId);
  if (!p || p.id === b.medida.planoId) return b;
  const firma = firmaEscala(b, p);
  if (confirmar && !firma) throw new Error("Mide primero el plano de referencia.");
  return { ...b, planos: b.planos.map(x => x.id === planoId ? { ...x, ...(confirmar ? { medida: null } : {}), escalaConfirmada: confirmar ? firma! : undefined } : x) };
}
export function comparteEscala(b: Borrador, p: PlanoCargado): boolean {
  return Boolean(p.escalaConfirmada && p.escalaConfirmada === firmaEscala(b, p));
}
export function cambiarPagina(b: Borrador, planoId: string, page: number): Borrador {
  const p = b.planos.find(x => x.id === planoId);
  if (!p || p.page === page || !p.extraction.pages.some(x => x.page === page)) return b;
  return { ...b, medida: b.medida.planoId === planoId ? { ...medidaVacia(), planoId: null } : b.medida,
    planos: b.planos.map(x => x.id === planoId ? { ...x, page, medida: null, escalaConfirmada: undefined } : x) };
}
/** Una hoja igual de grande puede llevar el dibujo a 1:50 o a 1:100. No se hereda por tamaño. */
export function medidaDe(b: Borrador, p: PlanoCargado): Medida | null {
  if (escalaMedida(p.medida)) return p.medida;
  if (escalaMedida(b.medida) && (b.medida.planoId === p.id || comparteEscala(b, p))) return b.medida;
  return null;
}
export const escalaDe = (b: Borrador, p: PlanoCargado) => escalaMedida(medidaDe(b, p));
export const escala = (b: Borrador) => escalaMedida(b.medida);
/** Planos que aportan paredes y todavía no tienen escala: habrá que medirlos aparte. */
export const planosSinEscala = (b: Borrador) => b.planos.filter(p => usos.find(u => u.id === p.uso)?.paredes && !escalaDe(b, p));

/** Nombre llano de un color para hablar de él. */
export function nombreColor([r, g, bl]: RGB): string {
  const max = Math.max(r, g, bl), min = Math.min(r, g, bl);
  if (max - min < 28) return max > 225 ? "blanco" : max < 60 ? "negro" : "gris";
  const h = (() => { const d = max - min; let x = max === r ? (g - bl) / d + (g < bl ? 6 : 0) : max === g ? (bl - r) / d + 2 : (r - g) / d + 4; x *= 60; return x; })();
  if (h < 15 || h >= 345) return "rojo";
  if (h < 40) return "naranja";
  if (h < 70) return "amarillo";
  if (h < 160) return "verde";
  if (h < 200) return "turquesa";
  if (h < 260) return "azul";
  if (h < 300) return "morado";
  return "rosa";
}
const neutro = (c: RGB) => ["blanco", "negro", "gris"].includes(nombreColor(c));
/** Colores de relleno de un plano; los neutros no cuentan como pared salvo que se marquen. */
export function colores(page: PdfPage) {
  return filledColors(page).filter(c => nombreColor(c.color) !== "blanco").slice(0, 8).map(c => ({ ...c, nombre: nombreColor(c.color), neutro: neutro(c.color) }));
}
export const cuentaComoPared = (p: PlanoCargado, c: { key: string; neutro: boolean }) => (p.ignorados.includes(c.key) ? c.neutro : !c.neutro);

/** Vértice de trazo más cercano al punto tocado (esquinas incluidas), para que la medida caiga sobre el dibujo y no al lado. */
export function puntoCercano(page: PdfPage, p: Point, tolerancia: number): Point {
  let mejor: Point = p, d0 = tolerancia;
  for (const path of page.paths) for (const q of path.points) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < d0) { d0 = d; mejor = q; } }
  return [redondear(mejor[0]), redondear(mejor[1])];
}

export type Pared = { id: string; planoId: string; plano: string; nombre: string; estado: "tira" | "nueva"; longitud: number; centerline: [Point, Point]; color: RGB; descartada: boolean; pathIds: string[] };
/** Paredes propuestas por el motor: lo coloreado del plano de demolición se tira, lo del de obra nueva es nuevo. */
export function paredes(b: Borrador): Pared[] {
  const out: Pared[] = [];
  for (const p of b.planos) {
    const estado = usos.find(u => u.id === p.uso)?.paredes; if (!estado) continue;
    const page = paginaDe(p);
    const reglas: LegendRule[] = colores(page).map(c => ({ color: c.color as [number, number, number], action: cuentaComoPared(p, c) ? (estado === "tira" ? "demolish" : "build") : "ignore" }));
    if (!reglas.some(r => r.action !== "ignore")) continue;
    let candidatos; try { candidatos = proposeWallCandidates(page, reglas).candidates; } catch { continue; }
    const k = escalaDe(b, p);
    for (const c of candidatos.sort((x, y) => polylineLength(y.centerline) - polylineLength(x.centerline))) {
      const id = `${p.id}:${c.id}`;
      out.push({ id, planoId: p.id, plano: p.nombre, nombre: "", estado, longitud: k ? polylineLength(c.centerline) * k : 0, centerline: c.centerline, color: c.color, descartada: b.noParedes.includes(id), pathIds: c.source_path_ids });
    }
  }
  out.sort((a, c) => a.estado.localeCompare(c.estado) || c.longitud - a.longitud);
  return out.map((w, i) => ({ ...w, nombre: `Pared ${i + 1}` }));
}
export function resumenParedes(ps: Pared[]) {
  const vivas = ps.filter(p => !p.descartada);
  const suma = (estado: Pared["estado"]) => { const l = vivas.filter(p => p.estado === estado); return { n: l.length, metros: redondear(l.reduce((s, p) => s + p.longitud, 0), 2) }; };
  return { tira: suma("tira"), nueva: suma("nueva"), descartadas: ps.length - vivas.length };
}

export type Trabajo = { id: TrabajoId; titulo: string; detalle: string; aplicaA: Pared["estado"]; caras: 1 | 2; patron: RegExp; excluye?: RegExp };
export const trabajos: Trabajo[] = [
  { id: "demoler", titulo: "Demoler las paredes que se tiran", detalle: "Superficie de las paredes del plano de demolición, por la altura.", aplicaA: "tira", caras: 1, patron: /demoli|derrib/i },
  { id: "levantar", titulo: "Levantar las paredes nuevas", detalle: "Superficie de las paredes del plano de obra nueva, por la altura.", aplicaA: "nueva", caras: 1, patron: /tabique|yeso|pladur|ladrillo|cartón/i, excluye: /demoli|derrib|retirad/i },
  { id: "acabar", titulo: "Pintar las paredes nuevas", detalle: "Las dos caras de cada pared nueva. Suelos, techos y lo existente saldrán del plano de áreas cuando el motor lo lea.", aplicaA: "nueva", caras: 2, patron: /pintur|pintar|acabado/i }
];
export const articulosMedibles = (articles: Article[]) => articles.filter(a => a.unit === "m²" || a.unit === "ml");
export function sugerirArticulo(articles: Article[], t: Trabajo): Article | null {
  const medibles = articulosMedibles(articles).filter(a => t.patron.test(a.name) && !(t.excluye && t.excluye.test(a.name)));
  return medibles.find(a => a.unit === "m²") ?? medibles[0] ?? null;
}
export function cantidadTrabajo(t: Trabajo, ps: Pared[], altura: number, huecos: number, unit: string) {
  const largo = ps.filter(p => !p.descartada && p.estado === t.aplicaA).reduce((s, p) => s + p.longitud, 0);
  if (unit === "ml") return redondear(largo * t.caras, 3);
  return redondear(Math.max(0, (largo * altura - huecos) * t.caras), 3);
}

export const huecosTrabajo = (b: Borrador, t: Trabajo) => numero(t.aplicaA === "tira" ? b.huecosDemolicion ?? b.huecos : b.huecos);

/** Completa los UUID que el motor necesita (fuente y escala por plano, medición por pared, intención, partida). */
export function asegurarIds(b: Borrador, ps: Pared[]): Borrador {
  const ids = { ...b.ids, sources: { ...b.ids.sources }, calibrations: { ...b.ids.calibrations }, paredes: { ...b.ids.paredes }, intents: { ...b.ids.intents }, items: { ...b.ids.items } };
  let cambiado = false;
  for (const p of b.planos) { if (!ids.sources[p.id]) { ids.sources[p.id] = uuid(); cambiado = true; } if (!ids.calibrations[p.id]) { ids.calibrations[p.id] = uuid(); cambiado = true; } }
  for (const w of ps) { if (!ids.paredes[w.id]) { ids.paredes[w.id] = uuid(); cambiado = true; } for (const t of trabajos) for (const cara of [1, 2]) { const k = `${t.id}:${w.id}:${cara}`; if (!ids.intents[k]) { ids.intents[k] = uuid(); cambiado = true; } } }
  for (const t of trabajos) if (!ids.items[t.id]) { ids.items[t.id] = uuid(); cambiado = true; }
  return cambiado ? { ...b, ids } : b;
}

/** Una intención por trabajo: suma longitudes, descuenta huecos una vez y aplica las caras al neto. */
export function entradaMotor(b: Borrador, ps: Pared[], articles: Article[]): EstimateInput | null {
  const altura = numero(b.altura);
  const vivas = ps.filter(w => !w.descartada && b.ids.paredes[w.id]);
  const planosUsados = b.planos.filter(p => vivas.some(w => w.planoId === p.id) && medidaDe(b, p));
  if (!planosUsados.length || planosSinEscala(b).length || altura <= 0 || numero(b.huecos) < 0 || numero(b.huecosDemolicion ?? b.huecos) < 0) return null;
  const sources: EstimateInput["sources"] = [
    ...planosUsados.map(p => ({ id: b.ids.sources[p.id], kind: "pdf" as const, label: p.nombre, sha256: p.extraction.sha256, phase: (p.uso === "demolicion" ? "demolition" : p.uso === "obra_nueva" ? "proposed" : "unspecified") as "demolition" | "proposed" | "unspecified", legend: "", ...(p.documentId && /^[0-9a-f-]{36}$/i.test(p.documentId) ? { document_id: p.documentId } : {}) })),
    { id: b.ids.manual, kind: "manual", label: "Datos indicados en la ficha", phase: "unspecified", legend: "" }
  ];
  const calibrations: EstimateInput["calibrations"] = planosUsados.map(p => { const m = medidaDe(b, p)!; const base = b.planos.find(x => x.id === b.medida.planoId); return { id: b.ids.calibrations[p.id], source_id: b.ids.sources[p.id], page: paginaDe(p).page, start: m.start!, end: m.end!, distance_m: numero(m.metros), reference: comparteEscala(b, p) ? `Misma escala confirmada que ${base!.nombre}, página ${base!.page} · SHA256 ${base!.extraction.sha256}` : "Medida indicada sobre este plano" }; });
  const usables = vivas.filter(w => planosUsados.some(p => p.id === w.planoId));
  const measurements: EstimateInput["measurements"] = [
    ...usables.map(w => ({ id: b.ids.paredes[w.id], source_id: b.ids.sources[w.planoId], label: `${w.nombre} · ${w.plano}`, kind: "plan_length" as const, page: paginaDe(b.planos.find(p => p.id === w.planoId)!).page, calibration_id: b.ids.calibrations[w.planoId], points: w.centerline, derived_from_path_ids: w.pathIds })),
    { id: b.ids.altura, source_id: b.ids.manual, label: "Altura de las paredes", kind: "quantity", value: altura, unit: "ml", method: "manual", reference: "Altura indicada en la ficha" }
  ];
  const intents: EstimateInput["intents"] = [];
  for (const t of trabajos) {
    const cfg = b.trabajos[t.id]; if (!cfg.activo) continue;
    const article = articles.find(a => a.id === cfg.articleId);
    const suyas = usables.filter(w => w.estado === t.aplicaA);
    if (!suyas.length) continue;
    const huecos = huecosTrabajo(b, t), openingId = b.ids.intents[`${t.id}:${suyas[0].id}:1`];
    if (huecos > 0 && article?.unit !== "ml") measurements.push({ id: openingId, source_id: b.ids.manual, label: `Huecos · ${t.titulo}`, kind: "quantity", value: huecos, unit: "m²", method: "manual", reference: `Huecos indicados para paredes ${t.aplicaA === "tira" ? "de demolición" : "nuevas"}; superficie de una cara` });
    const lengthIds = suyas.map(w => b.ids.paredes[w.id]);
    // En ml, cada cara conserva el vínculo al mismo trazo y se cobra como longitud de trabajo.
    if (article?.unit === "ml" && t.caras > 1) {
      for (const w of suyas) measurements.push({ id: b.ids.intents[`${t.id}:${w.id}:2`], source_id: b.ids.sources[w.planoId], label: `${w.nombre} · segunda cara`, kind: "plan_length", page: paginaDe(b.planos.find(p => p.id === w.planoId)!).page, calibration_id: b.ids.calibrations[w.planoId], points: w.centerline, derived_from_path_ids: w.pathIds });
      lengthIds.push(...suyas.map(w => b.ids.intents[`${t.id}:${w.id}:2`]));
    }
    intents.push({ id: b.ids.items[t.id], label: t.titulo, article_id: article?.id ?? null,
      formula: article?.unit === "ml" ? { kind: "sum", measurement_ids: lengthIds } : { kind: "wall_area", length_ids: lengthIds, height_id: b.ids.altura, opening_ids: huecos > 0 ? [openingId] : [], faces: t.caras },
      inclusion: "included", adjustment_percent: 0, adjustment_reason: "" });
  }
  if (!intents.length) return null;
  return { schema_version: 1, project_id: b.projectId, scope: "Partidas propuestas desde los planos", sources, calibrations, measurements, intents };
}

export type LineaPropuesta = { trabajo: Trabajo; article: Article | null; item: BudgetItem | null; cantidad: number; paredes: number; planos: string[]; pendientes: string[]; avisos: string[] };
export type Propuesta = { lineas: LineaPropuesta[]; items: BudgetItem[]; base: number; pendientes: number };

/** Cada trabajo pasa completo por el motor; la previsualización y el guardado usan las mismas partidas. */
export function propuesta(b: Borrador, ps: Pared[], articles: Article[], organizationId: string): Propuesta | { error: string } {
  if (planosSinEscala(b).length) return { error: "Falta medir o confirmar la escala de algún plano. Vuelve al paso de la medida." };
  if (numero(b.altura) <= 0 || ![b.altura, b.huecos, b.huecosDemolicion ?? b.huecos].every(v => /^\s*\d+(?:[.,]\d+)?\s*$/.test(v)))
    return { error: "Revisa la altura y los huecos: introduce medidas válidas, sin valores negativos." };
  const entrada = entradaMotor(b, ps, articles);
  if (!entrada) return { error: "Faltan la medida de los planos o algún trabajo marcado." };
  let resultado: ReturnType<typeof createEstimateProposal>;
  try { resultado = createEstimateProposal(entrada, { organization_id: organizationId, articles }); }
  catch (e) { return { error: e instanceof Error ? e.message : "El motor no ha podido calcular la propuesta." }; }
  const lineas: LineaPropuesta[] = [];
  for (const t of trabajos) {
    const linea = resultado.lines.find(l => l.id === b.ids.items[t.id]);
    if (!linea) continue;
    const suyas = ps.filter(w => !w.descartada && w.estado === t.aplicaA);
    lineas.push({ trabajo: t, article: articles.find(a => a.id === b.trabajos[t.id].articleId) ?? null,
      item: linea.item, cantidad: linea.item?.quantity ?? 0, paredes: suyas.length, planos: [...new Set(suyas.map(w => w.plano))],
      pendientes: linea.issues.map(i => i.message), avisos: linea.warnings.filter(w => !/pendiente de revisión humana/.test(w)) });
  }
  const items = lineas.flatMap(l => l.item ? [l.item] : []);
  return { lineas, items, base: totals(items).base, pendientes: lineas.filter(l => !l.item).length };
}

export type Coincidencia = { nuevo: BudgetItem; existente: BudgetItem };
export function coincidencias(existentes: BudgetItem[], nuevos: BudgetItem[]): Coincidencia[] {
  const out: Coincidencia[] = [], usados = new Set<string>();
  for (const nuevo of nuevos) {
    const ex = existentes.find(e => !usados.has(e.id) && (e.id === nuevo.id || normalize(e.description) === normalize(nuevo.description)));
    if (ex) { out.push({ nuevo, existente: ex }); usados.add(ex.id); }
  }
  return out;
}
export type Decision = "sustituir" | "añadir";
export function fusionar(existentes: BudgetItem[], nuevos: BudgetItem[], decisiones: Record<string, Decision>, pares: Coincidencia[]): BudgetItem[] {
  const resultado = existentes.map(e => ({ ...e }));
  const añadidos: BudgetItem[] = [];
  for (const nuevo of nuevos) {
    const par = pares.find(p => p.nuevo.id === nuevo.id);
    if (par && decisiones[nuevo.id] === "sustituir") {
      const i = resultado.findIndex(e => e.id === par.existente.id);
      if (i >= 0) { resultado[i] = { ...nuevo, id: resultado[i].id }; continue; }
    }
    añadidos.push(nuevo);
  }
  return [...resultado, ...añadidos];
}
