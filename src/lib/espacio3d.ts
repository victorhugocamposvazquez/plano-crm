/**
 * Propuesta en 3D: el espacio navegable de ejemplo (local o nave, de `lib/visual`) vestido con los artículos del catálogo.
 * Se cambia suelo, paredes (con su color) y mobiliario diciéndolo, escribiéndolo o tocando la escena.
 * Las cantidades salen de las medidas del espacio (las de ejemplo hasta que se digan las de verdad), nunca de la geometría dibujada.
 * Si el artículo se guarda en la nave, se dice cuánto queda libre y cuánto faltaría pedir.
 * Aquí solo lo puro: qué artículo va en cada elemento, cómo se ve, cuánto cuesta, qué hay en almacén y qué significa cada orden.
 */
import type { Article, BudgetItem, Purchase } from "./domain";
import type { SpatialScene, VisualAsset } from "./visual/schema";
import { normalizar } from "./busqueda";
import { buscarArticulo } from "./visita360";
import { interpretarMedidas, type Medidas } from "./medidas";
import { partidaDesdeArticulo } from "./presupuesto";
import { cantidadStock, estadoStock } from "./stock";

export type Elemento = "suelo" | "paredes" | "mueble";
export const elementos: Elemento[] = ["suelo", "paredes", "mueble"];
export const nombreElemento: Record<Elemento, string> = { suelo: "Suelo", paredes: "Paredes", mueble: "Mobiliario" };

export type TipoEspacio = "local" | "nave";
export type Dimensiones = { largo: number; ancho: number; alto: number };
export type Eleccion = { article_id: string; color?: string; unidades?: number };
export type Estado3d = { tipo: TipoEspacio; dims: Dimensiones } & Partial<Record<Elemento, Eleccion>>;

export const espacios: Record<TipoEspacio, { nombre: string; dims: Dimensiones }> = {
  local: { nombre: "Local", dims: { largo: 4, ancho: 3, alto: 2.8 } },
  nave: { nombre: "Nave", dims: { largo: 12, ancho: 8, alto: 5 } }
};
export const estadoInicial = (tipo: TipoEspacio = "local"): Estado3d => ({ tipo, dims: { ...espacios[tipo].dims } });

// ── Colores ────────────────────────────────────────────────────────────────
export type Color = { nombre: string; rgb: [number, number, number]; claves: string[] };
export const colores: Color[] = [
  { nombre: "blanco", rgb: [240, 238, 232], claves: ["blanco", "blanca"] },
  { nombre: "blanco roto", rgb: [234, 227, 212], claves: ["blanco roto", "hueso", "marfil"] },
  { nombre: "beige", rgb: [222, 206, 178], claves: ["beige", "crema", "arena"] },
  { nombre: "gris perla", rgb: [202, 203, 200], claves: ["gris perla", "gris claro", "perla"] },
  { nombre: "gris", rgb: [160, 163, 163], claves: ["gris"] },
  { nombre: "antracita", rgb: [84, 88, 92], claves: ["antracita", "gris oscuro", "grafito"] },
  { nombre: "verde salvia", rgb: [164, 181, 153], claves: ["verde salvia", "salvia", "verde"] },
  { nombre: "azul", rgb: [150, 174, 196], claves: ["azul", "celeste"] },
  { nombre: "azul marino", rgb: [52, 68, 96], claves: ["azul marino", "marino"] },
  { nombre: "terracota", rgb: [188, 112, 82], claves: ["terracota", "teja"] },
  { nombre: "amarillo", rgb: [226, 192, 104], claves: ["amarillo", "amarilla", "mostaza"] },
  { nombre: "rosa", rgb: [226, 192, 186], claves: ["rosa"] },
  { nombre: "negro", rgb: [46, 46, 46], claves: ["negro", "negra"] },
  { nombre: "roble", rgb: [186, 149, 102], claves: ["roble", "madera clara"] },
  { nombre: "nogal", rgb: [103, 75, 53], claves: ["nogal", "madera oscura", "wengue"] }
];
/** Los que se ofrecen al tocar cada elemento (por voz vale cualquiera). */
export const coloresDe: Record<"paredes" | "mueble", string[]> = {
  paredes: ["blanco", "blanco roto", "beige", "gris perla", "antracita", "verde salvia", "azul", "terracota"],
  mueble: ["blanco", "antracita", "roble", "nogal", "verde salvia", "azul marino"]
};
const claves = colores.flatMap(c => c.claves.map(k => ({ k, c }))).sort((a, b) => b.k.length - a.k.length);
export const color = (nombre?: string) => colores.find(c => c.nombre === nombre);
/** El color dicho en la frase, si lo hay: «de verde», «gris perla», «en nogal». */
export function colorDicho(texto: string): Color | undefined {
  const t = normalizar(texto);
  return claves.find(({ k }) => new RegExp(`\\b${k}\\b`).test(t))?.c;
}

// ── Catálogo ───────────────────────────────────────────────────────────────
const texto = (a: Pick<Article, "chapter" | "name">) => normalizar(`${a.chapter} ${a.name}`);
/** Dónde va un artículo del catálogo en el espacio 3D, o null si no se representa aquí. */
export function elementoDe(a: Pick<Article, "chapter" | "name" | "unit">): Elemento | null {
  const t = texto(a);
  if (/yeso|placa|pladur|tabique|cemento cola/.test(t)) return null;
  if (a.unit === "m²" && /pavimento|tarima|parquet|suelo|porcelanico|baldosa|gres|resina|microcemento|vinilico/.test(t) && !/pared|alicatad|azulejo|techo/.test(t)) return "suelo";
  if (a.unit === "m²" && /pintura|pintar|revestimiento|alicatad|azulejo|estuco|papel pintado/.test(t)) return "paredes";
  if (a.unit === "ud" && /mueble|armario|estanter|aparador|mostrador|taquilla|banco de trabajo/.test(t)) return "mueble";
  return null;
}
export const candidatos = (articles: Article[], e: Elemento) => articles.filter(a => elementoDe(a) === e);

const ASSET = { organization_id: "00000000-0000-4000-8000-000000000000", revision: "plano-catalogo", representation: "generic_demo" as const };
/** Lo que hay antes de cambiar nada: suelo y paredes sin acabado nuevo, sin muebles. */
export const existente: Record<"suelo" | "paredes", VisualAsset> = {
  suelo: { ...ASSET, id: "existente:suelo", article_id: "existente", kind: "paint", color: [168, 164, 156] },
  paredes: { ...ASSET, id: "existente:paredes", article_id: "existente", kind: "paint", color: [222, 218, 208] }
};

/** Cómo se ve un artículo en la escena: textura genérica según el nombre, color dicho o el del nombre, y tamaño del mueble. */
export function aspecto(a: Pick<Article, "id" | "chapter" | "name">, e: Elemento, tipo: TipoEspacio, nombreColor?: string): VisualAsset {
  const t = texto(a), c = color(nombreColor) ?? colorDicho(a.name);
  const id = `${e}:${a.id}:${c?.nombre ?? ""}`;
  if (e === "suelo") {
    if (/porcelan|baldosa|gres|piedra|marmol/.test(t)) return { ...ASSET, id, article_id: a.id, kind: "stone", color: c?.rgb ?? [188, 184, 174] };
    if (/resina|microcemento|continuo|epoxi/.test(t)) return { ...ASSET, id, article_id: a.id, kind: "resin", color: c?.rgb ?? [152, 160, 165] };
    return { ...ASSET, id, article_id: a.id, kind: "wood", color: c?.rgb ?? [184, 153, 112] };
  }
  if (e === "paredes") {
    if (/alicatad|azulejo/.test(t)) return { ...ASSET, id, article_id: a.id, kind: "stone", color: c?.rgb ?? [224, 222, 216] };
    if (/revestimiento|mineral|estuco|microcemento/.test(t)) return { ...ASSET, id, article_id: a.id, kind: "mineral", color: c?.rgb ?? [186, 192, 182] };
    return { ...ASSET, id, article_id: a.id, kind: "paint", color: c?.rgb ?? [240, 238, 232] };
  }
  if (/estanter/.test(t)) return { ...ASSET, id, article_id: a.id, kind: "rack", color: c?.rgb ?? [77, 97, 111], dimensions_m: tipo === "nave" ? [2.4, 3, 1] : [1.2, 2.1, 0.45] };
  if (/armario/.test(t)) return { ...ASSET, id, article_id: a.id, kind: "cabinet", color: c?.rgb ?? [186, 149, 102], dimensions_m: [1.2, 2.2, 0.6] };
  const ancho = /\b80\b/.test(t) ? 0.8 : 1.2;
  return { ...ASSET, id, article_id: a.id, kind: "cabinet", color: c?.rgb ?? [186, 149, 102], dimensions_m: [ancho, 0.85, 0.5] };
}

/** Lo que se ve ahora en cada elemento. */
export function aspectos(estado: Estado3d, articles: Article[]): Record<Elemento, VisualAsset | null> {
  const de = (e: Elemento) => { const el = estado[e], a = el && articles.find(x => x.id === el.article_id); return a ? aspecto(a, e, estado.tipo, el.color) : null; };
  return { suelo: de("suelo") ?? existente.suelo, paredes: de("paredes") ?? existente.paredes, mueble: de("mueble") };
}

// ── Escena ─────────────────────────────────────────────────────────────────
const MAX_UNIDADES = 8;
/** Cuántas piezas caben a lo largo de la pared del fondo. */
export function unidadesQueCaben(estado: Estado3d, mueble: VisualAsset | null): number {
  const ancho = mueble?.dimensions_m?.[0] ?? 1;
  return Math.max(1, Math.min(MAX_UNIDADES, Math.floor((estado.dims.largo - 0.4) / (ancho + 0.4))));
}

/** La escena que dibuja el visor de `lib/visual`: el espacio con sus medidas, una columna en la nave y los muebles en la pared del fondo. */
export function escena3d(estado: Estado3d, mueble: VisualAsset | null): SpatialScene {
  const { largo: w, ancho: d, alto: h } = estado.dims, nave = estado.tipo === "nave";
  const objetos: SpatialScene["objects"] = [];
  if (mueble?.dimensions_m && estado.mueble) {
    const [fw, , fd] = mueble.dimensions_m, n = Math.min(estado.mueble.unidades ?? 1, unidadesQueCaben(estado, mueble)), hueco = 0.4;
    const total = n * fw + (n - 1) * hueco;
    for (let i = 0; i < n; i++) objetos.push({ id: `mueble-${i}`, slot_id: "mueble", kind: "furnishing", position_m: [-total / 2 + fw / 2 + i * (fw + hueco), 0, -d / 2 + fd / 2 + 0.08] });
  }
  if (nave) objetos.push({ id: "columna", slot_id: null, kind: "existing_column", position_m: [-w / 3, 0, d / 6] });
  return {
    id: `espacio-${estado.tipo}`, organization_id: ASSET.organization_id, project_id: ASSET.organization_id, label: espacios[estado.tipo].nombre,
    space_kind: nave ? "industrial" : "retail",
    source: { kind: "synthetic", reference: "Espacio de ejemplo con las medidas dichas." },
    dimensions_m: { width: w, depth: d, height: h },
    measurements: [],
    slots: [
      { id: "suelo", label: "Suelo", category: "floor", measurement_id: "suelo", allowed_asset_ids: [] },
      { id: "paredes", label: "Paredes", category: "wall", measurement_id: "paredes", allowed_asset_ids: [] },
      { id: "mueble", label: "Mobiliario", category: "furnishing", measurement_id: "mueble", allowed_asset_ids: [] }
    ],
    objects: objetos,
    nonvisual_items: []
  };
}

// ── Cantidades y partidas ──────────────────────────────────────────────────
const r2 = (n: number) => Math.round(n * 100) / 100;
/** El hueco de ventana que dibuja el visor en el local (1,5 × 2 m) se descuenta de las paredes; la nave no tiene huecos dibujados. */
export const huecos = (estado: Estado3d) => estado.tipo === "local" && estado.dims.ancho > 1.5 && estado.dims.alto > 2.5 ? 3 : 0;
export function cantidades(estado: Estado3d): Record<Elemento, number> {
  const { largo, ancho, alto } = estado.dims;
  return { suelo: r2(largo * ancho), paredes: r2(Math.max(0, 2 * (largo + ancho) * alto - huecos(estado))), mueble: estado.mueble?.unidades ?? 1 };
}

export type Partida3d = BudgetItem & { elemento: Elemento };
/** Una partida por elemento cambiado, con el precio del catálogo y la cantidad de las medidas. */
export function partidas3d(estado: Estado3d, articles: Article[]): Partida3d[] {
  const q = cantidades(estado);
  return elementos.flatMap(e => {
    const el = estado[e], a = el && articles.find(x => x.id === el.article_id);
    if (!a) return [];
    const item = partidaDesdeArticulo(a, q[e]);
    return [{ ...item, id: `${e}-${a.id}`, description: el.color ? `${a.name}, color ${el.color}` : a.name, elemento: e }];
  });
}

// ── Almacén ────────────────────────────────────────────────────────────────
export type Disponibilidad = { libre: number; necesita: number; falta: number; estado: "cubre" | "corto" | "agotado"; ubicacion: string; unit: string };
/** Lo que hay libre en la nave de un artículo de almacén frente a lo que pide la propuesta; null si no se guarda en almacén. */
export function disponibilidad(article: Article, necesita: number, purchases: Purchase[]): Disponibilidad | null {
  if (!article.stocked) return null;
  const libre = Math.max(0, estadoStock(article, purchases).libre), falta = Math.max(0, Math.round((necesita - libre) * 1000) / 1000);
  return { libre, necesita, falta, estado: falta === 0 ? "cubre" : libre <= 0 ? "agotado" : "corto", ubicacion: article.stock_location ?? "", unit: article.unit };
}
const hayLibre = (n: number, unit: string) => n === 1 ? `queda ${cantidadStock(n, unit)} libre` : `quedan ${cantidadStock(n, unit)} libres`;
const enDonde = (ubicacion: string) => ubicacion ? ` (${ubicacion})` : "";
/** En palabras, para la pantalla y la voz. */
export function describirDisponibilidad(d: Disponibilidad): string {
  if (d.estado === "cubre") return `En almacén ${hayLibre(d.libre, d.unit)}: basta para ${cantidadStock(d.necesita, d.unit)}${enDonde(d.ubicacion)}.`;
  if (d.estado === "agotado") return `No queda libre en almacén: hay que pedir ${cantidadStock(d.necesita, d.unit)}.`;
  return `En almacén ${hayLibre(d.libre, d.unit)}: ${d.falta === 1 ? "falta" : "faltan"} ${cantidadStock(d.falta, d.unit)} por pedir.`;
}
/** Solo lo que hay libre, para preguntar por un artículo que no está en la propuesta. */
export const describirLibre = (d: Disponibilidad) => d.libre > 0 ? `en almacén ${hayLibre(d.libre, d.unit)}${enDonde(d.ubicacion)}.` : "no queda libre en almacén.";
/** «Porcelánico…: en almacén…»: tras dos puntos, en minúscula. */
export const conNombre = (nombre: string, texto: string) => `${nombre}: ${texto.charAt(0).toLocaleLowerCase()}${texto.slice(1)}`;
/** La disponibilidad de cada partida elegida que sale de un artículo de almacén. */
export function stockDePropuesta(estado: Estado3d, articles: Article[], purchases: Purchase[]): { elemento: Elemento; article: Article; d: Disponibilidad }[] {
  const q = cantidades(estado);
  return elementos.flatMap(e => {
    const el = estado[e], a = el && articles.find(x => x.id === el.article_id), d = a && disponibilidad(a, q[e], purchases);
    return a && d ? [{ elemento: e, article: a, d }] : [];
  });
}

/** Lo pedido en Materiales para este proyecto y artículo que aún no ha llegado (previsto o pedido). */
export function enCamino(projectId: string, articleId: string, purchases: Purchase[]): number {
  return Math.round(purchases.filter(p => p.project_id === projectId && p.article_id === articleId && (p.status === "planned" || p.status === "ordered"))
    .reduce((s, p) => s + Math.max(0, p.quantity - p.received_quantity), 0) * 1000) / 1000;
}
/** El último proveedor al que se pidió este artículo, para no tener que escribirlo. */
export function proveedorHabitual(articleId: string, purchases: Purchase[]): string {
  return [...purchases].reverse().find(p => p.article_id === articleId && p.supplier.trim())?.supplier ?? "";
}
export type PorPedir = { elemento: Elemento; article: Article; falta: number; pedido: number; queda: number };
/** Lo que no cubre el almacén, menos lo que ya está pedido para esta obra: lo que queda por pedir. */
export function porPedir(estado: Estado3d, articles: Article[], purchases: Purchase[], projectId: string): PorPedir[] {
  return stockDePropuesta(estado, articles, purchases).filter(x => x.d.falta > 0).map(x => {
    const pedido = enCamino(projectId, x.article.id, purchases);
    return { elemento: x.elemento, article: x.article, falta: x.d.falta, pedido, queda: Math.max(0, Math.round((x.d.falta - pedido) * 1000) / 1000) };
  });
}

// ── Órdenes ────────────────────────────────────────────────────────────────
export type Vista = "overview" | "inside" | "focus";
export type Movimiento = "left" | "right" | "closer" | "farther";
export type Orden3d =
  | { tipo: "poner"; elemento: Elemento; article: Article; color?: string; unidades?: number }
  | { tipo: "color"; elemento: "paredes" | "mueble"; color: string }
  | { tipo: "unidades"; unidades: number }
  | { tipo: "quitar"; elemento: Elemento }
  | { tipo: "medidas"; medidas: Medidas }
  | { tipo: "espacio"; espacio: TipoEspacio }
  | { tipo: "vista"; vista: Vista; elemento?: Elemento }
  | { tipo: "mover"; mover: Movimiento }
  | { tipo: "stock"; article?: Article }
  | { tipo: "pedir" }
  | { tipo: "total" } | { tipo: "incorporar" } | { tipo: "deshacer" };

const palabrasElemento: Record<Elemento, RegExp> = {
  suelo: /\b(suelo|suelos|piso|pavimento|tarima|parquet|porcelanico|baldosa|baldosas|resina|microcemento)\b/,
  paredes: /\b(pared|paredes|pinta|pintar|pintura|pintamos|pintado|muro|muros|revestimiento|alicatado|azulejo|azulejos)\b/,
  mueble: /\b(mueble|muebles|armario|armarios|estanteria|estanterias|aparador|mobiliario|estante|estantes)\b/
};
/** Palabras que dicen dónde, pero no qué artículo: se quitan al buscar en el catálogo para que no desempaten mal. */
const genericas = /\b(suelo|suelos|piso|pavimento|pared|paredes|muro|muros|mueble|muebles|mobiliario|todo|toda|nuevo|nueva)\b/g;
const numeros: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8 };
function unidadesDichas(t: string): number | undefined {
  const m = t.match(/\b(\d+|una?|uno|dos|tres|cuatro|cinco|seis|siete|ocho)\b/);
  if (!m) return undefined;
  const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : numeros[m[1]];
  return n >= 1 && n <= MAX_UNIDADES ? n : undefined;
}
export const elementoDicho = (t: string) => elementos.find(e => palabrasElemento[e].test(t));

/** Interpreta una frase para el espacio 3D. Devuelve null si no se entiende; nunca inventa un artículo que no esté en el catálogo. */
export function interpretar3d(frase: string, articles: Article[]): Orden3d | null {
  const t = normalizar(frase).replace(/[¿?¡!]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (/\b(cuanto va|cuanto es|cuanto cuesta|cuanto sale|cuanto llevamos|que llevamos|total|dime el total)\b/.test(t)) return { tipo: "total" };
  // «¿Hay stock?», «¿cuánto queda de porcelánico?», «¿qué tenemos en el almacén?». «Vamos al almacén» es cambiar de espacio.
  if (/^(pide|pidelo|pidela|pidelos|pedir|pedimos|haz el pedido|haz los pedidos|encarga|encargalo|encargamos)\b|\b(pide lo que falta|pedir lo que falta|haz el pedido)\b/.test(t)) return { tipo: "pedir" };
  if (/\b(stock|existencias|queda|quedan|que tenemos|tenemos en|hay en (el )?almacen|en (el )?almacen|disponible|disponibles)\b/.test(t) && !/^(vamos|ve|ir|pasa|pasamos|llevame|cambia)\b/.test(t)) {
    const lista = elementos.flatMap(e => candidatos(articles, e));
    const article = buscarArticulo(t.replace(/\b(stock|existencias|queda|quedan|tenemos|almacen|nave|disponibles?|hay|cuanto|cuantos|cuantas)\b/g, " ").replace(genericas, " "), lista) ?? undefined;
    return article ? { tipo: "stock", article } : { tipo: "stock" };
  }
  if (/\b(incorpora|incorporar|al presupuesto|pasalo|pasarlo|guardalo)\b/.test(t)) return { tipo: "incorporar" };
  if (/\b(deshaz|deshacer|anula|lo ultimo no)\b/.test(t)) return { tipo: "deshacer" };
  const med = interpretarMedidas(frase, []);
  if (med) return { tipo: "medidas", medidas: med.medidas };

  const elemento = elementoDicho(t);
  if (/\b(nave|almacen)\b/.test(t) && !elemento) return { tipo: "espacio", espacio: "nave" };
  if (/\b(local|tienda|oficina)\b/.test(t) && !elemento) return { tipo: "espacio", espacio: "local" };
  if (/\b(gira|girar|gira a|mira a|mira hacia)\b.*\bizquierda\b/.test(t)) return { tipo: "mover", mover: "left" };
  if (/\b(gira|girar|gira a|mira a|mira hacia)\b.*\bderecha\b/.test(t)) return { tipo: "mover", mover: "right" };
  if (/\b(acercate|acerca|acercar|mas cerca|zoom)\b/.test(t)) return { tipo: "mover", mover: "closer" };
  if (/\b(alejate|aleja|alejar|mas lejos)\b/.test(t)) return { tipo: "mover", mover: "farther" };
  if (/\b(entra|entrar|entramos|dentro|interior|metete)\b/.test(t)) return { tipo: "vista", vista: "inside" };
  if (/\b(vista general|desde fuera|desde arriba|general|sal|salir|fuera)\b/.test(t) && !/^(quita|quitar|saca|sacar|fuera)\b/.test(t)) return { tipo: "vista", vista: "overview" };
  if (/^(ensename|muestrame|mira|ver|enfoca)\b/.test(t) && elemento) return { tipo: "vista", vista: "focus", elemento };
  if (/^(quita|quitar|quitame|elimina|borra|saca|sacar|fuera)\b/.test(t) && elemento) return { tipo: "quitar", elemento };

  const c = colorDicho(t);
  const unidades = elemento === "mueble" || /\b(muebles|armarios|estanterias)\b/.test(t) ? unidadesDichas(t) : undefined;
  const sinColor = c ? c.claves.reduce((s, k) => s.replace(new RegExp(`\\b${k}\\b`, "g"), " "), t) : t;
  const especifico = sinColor.replace(genericas, " ");
  const lista = elemento ? candidatos(articles, elemento) : elementos.flatMap(e => candidatos(articles, e));
  // Con un color dicho y nada concreto («las paredes en gris»), cambia el color de lo que ya hay en lugar de elegir otro artículo.
  const hallado = buscarArticulo(especifico, lista) ?? (c ? null : buscarArticulo(sinColor, lista));
  if (hallado) {
    const e = elementoDe(hallado)!;
    return { tipo: "poner", elemento: e, article: hallado, ...(c && e !== "suelo" ? { color: c.nombre } : {}), ...(e === "mueble" && unidades ? { unidades } : {}) };
  }
  if (c && elemento !== "suelo") return { tipo: "color", elemento: elemento === "mueble" ? "mueble" : "paredes", color: c.nombre };
  if (elemento === "mueble" && unidades) return { tipo: "unidades", unidades };
  if (elemento && lista.length) return { tipo: "poner", elemento, article: lista[0] };
  return null;
}

/** Aplica una orden que cambia lo elegido. Las de cámara, total e incorporar no tocan el estado. */
export function aplicar3d(estado: Estado3d, orden: Orden3d, articles: Article[]): Estado3d {
  switch (orden.tipo) {
    case "poner": {
      const antes = estado[orden.elemento];
      const color = orden.color ?? (antes && antes.article_id !== orden.article.id ? undefined : antes?.color);
      return { ...estado, [orden.elemento]: { article_id: orden.article.id, ...(color ? { color } : {}), ...(orden.elemento === "mueble" ? { unidades: orden.unidades ?? antes?.unidades ?? 1 } : {}) } };
    }
    case "color": {
      const antes = estado[orden.elemento] ?? (candidatos(articles, orden.elemento)[0] ? { article_id: candidatos(articles, orden.elemento)[0].id, ...(orden.elemento === "mueble" ? { unidades: 1 } : {}) } : undefined);
      return antes ? { ...estado, [orden.elemento]: { ...antes, color: orden.color } } : estado;
    }
    case "unidades": {
      const antes = estado.mueble ?? (candidatos(articles, "mueble")[0] ? { article_id: candidatos(articles, "mueble")[0].id } : undefined);
      return antes ? { ...estado, mueble: { ...antes, unidades: orden.unidades } } : estado;
    }
    case "quitar": { const { [orden.elemento]: _quitado, ...resto } = estado; return resto as Estado3d; }
    case "medidas": {
      const m = orden.medidas, d = estado.dims;
      const ok = (n: number | undefined, max: number) => n !== undefined && n > 0.5 && n <= max ? n : undefined;
      return { ...estado, dims: { largo: ok(m.largo, 200) ?? d.largo, ancho: ok(m.ancho, 200) ?? d.ancho, alto: ok(m.alto, 30) ?? d.alto } };
    }
    case "espacio": return orden.espacio === estado.tipo ? estado : { ...estado, tipo: orden.espacio, dims: { ...espacios[orden.espacio].dims } };
    default: return estado;
  }
}

const cifra = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);
export const describirDims = (d: Dimensiones) => `${cifra(d.largo)} × ${cifra(d.ancho)} m · ${cifra(d.alto)} m de alto`;
