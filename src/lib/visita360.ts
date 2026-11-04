import { normalizar } from "./busqueda";
import { money, type Article, type BudgetItem } from "./domain";
import { partidaDesdeArticulo } from "./presupuesto";

/**
 * Visita 360: una foto esférica de la estancia donde se toca o se dice qué va en cada sitio.
 * Las fotos son de ejemplo (Poly Haven, CC0) hasta que la cámara 360 de GARAL suba las suyas.
 * Nada de aquí mide: la cantidad la dice la persona o se toma una por defecto marcada como aproximada.
 */
export type Panorama = { id: string; nombre: string; url: string; nota: string };
export const panoramas: Panorama[] = [
  { id: "old_room", nombre: "Salón antiguo", url: "/visual/360/old_room.jpg", nota: "Foto 360 de ejemplo · Poly Haven, CC0" },
  { id: "small_empty_house", nombre: "Casa vacía", url: "/visual/360/small_empty_house.jpg", nota: "Foto 360 de ejemplo · Poly Haven, CC0" }
];

export type Colocacion = { id: string; article_id: string; quantity: number; yaw: number; pitch: number; origen: "voz" | "toque"; aproximada: boolean };
export type Orden =
  | { tipo: "añadir"; article: Article; quantity: number; aproximada: boolean }
  | { tipo: "quitar"; article: Article }
  | { tipo: "total" }
  | { tipo: "incorporar" }
  | { tipo: "deshacer" }
  | { tipo: "cambiar"; panorama: Panorama };

export const claveVisita = (projectId: string) => `plano.visita360.${projectId}`;

/** Cómo se ve un material en la marca: una foto de la textura (CC0) o un color. La textura de suelo, para la vista previa en la foto. */
export function muestra(article: Pick<Article, "chapter" | "name">): { imagen?: string; color: string; suelo?: string } {
  const t = normalizar(`${article.chapter} ${article.name}`);
  if (/pavimento|tarima|parquet|suelo|carpinter|madera|armario|puerta/.test(t)) return { imagen: "/visual/360/muestras/madera.jpg", color: "#a77b4f", suelo: /pavimento|tarima|parquet|suelo/.test(t) ? "/visual/materiales/laminate_floor_02_diff_1k.jpg" : undefined };
  if (/fontaner|bano|azulejo|alicatado|marmol|baldosa/.test(t)) return { imagen: "/visual/360/muestras/marmol.jpg", color: "#d8d6d0", suelo: /baldosa|marmol/.test(t) ? "/visual/materiales/marble_tiles_diff_1k.jpg" : undefined };
  if (/pintura|pintar/.test(t)) return { color: "#efe6d6" };
  if (/albanil|tabique|yeso|pladur/.test(t)) return { color: "#d9d4cc" };
  if (/demolic|derribo|retirada/.test(t)) return { color: "#b4532a" };
  if (/electric|luz|enchufe/.test(t)) return { color: "#f2c14e" };
  return { color: "#8a9199" };
}

/** Sin cantidad dicha, una por defecto marcada como aproximada; la persona la corrige en el ticket. */
export function cantidadPorDefecto(unit: string): number {
  return unit === "m²" ? 10 : unit === "ml" ? 4 : 1;
}

const palabrasNumero: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, medio: 0.5, media: 0.5
};
const sinonimos: Record<string, string[]> = {
  parquet: ["tarima"], suelo: ["tarima", "pavimento"], suelos: ["tarima", "pavimento"], pavimento: ["tarima"], laminado: ["tarima"], laminada: ["tarima"],
  pintar: ["pintura"], pintado: ["pintura"], pintamos: ["pintura"], pintura: ["pintura"],
  enchufe: ["luz", "punto"], enchufes: ["luz", "punto"], luces: ["luz", "punto"], lampara: ["luz", "punto"], lamparas: ["luz", "punto"], interruptor: ["luz", "punto"], foco: ["luz", "punto"], focos: ["luz", "punto"],
  pladur: ["tabique", "yeso"], tabiques: ["tabique"], separacion: ["tabique"],
  derribar: ["demolicion"], derriba: ["demolicion"], tirar: ["demolicion"], tira: ["demolicion"], demoler: ["demolicion"], demuele: ["demolicion"], derribo: ["demolicion"], escombro: ["demolicion"],
  bano: ["fontaneria"], tuberia: ["fontaneria"], tuberias: ["fontaneria"], grifo: ["fontaneria"], ducha: ["fontaneria"], fontanero: ["fontaneria"],
  armarios: ["armario"], empotrado: ["armario"], empotrados: ["armario"], puertas: ["puerta"], portas: ["puerta"]
};
const vacias = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "en", "por", "para", "con", "y", "a", "al", "aqui", "ahi", "alli", "esto", "eso", "este", "esta", "ese", "esa", "me", "que", "lo", "le", "mas", "otro", "otra", "nuevo", "nueva", "toda", "todo", "todas", "todos", "quiero", "necesito", "pon", "ponme", "poner", "anade", "anadir", "anademe", "mete", "meter", "incluye", "incluir", "quita", "quitar", "elimina", "borra", "saca", "sacar", "instalar", "instala", "colocar", "coloca", "hacer", "haz", "cambiar", "cambia", "metro", "metros", "cuadrado", "cuadrados", "lineal", "lineales", "unidad", "unidades", "m2", "ml", "ud", "uds", "euros", "cuanto", "va", "es"]);

const esAñadir = /^(anade|anadir|anademe|pon|ponme|poner|mete|meter|quiero|necesito|incluye|incluir|instala|instalar|coloca|colocar|hay que|vamos a|ponemos|anadimos|metemos|tirar|tira|tiramos|derribar|derriba|derribamos|demoler|demuele|demolemos|pintar|pinta|pintamos|cambiar|cambia|cambiamos|con|y)\b/;
const esQuitar = /^(quita|quitar|quitame|elimina|eliminar|borra|borrar|saca|sacar|fuera)\b/;

function leerCantidad(texto: string): { cantidad: number | null; resto: string } {
  const digitos = texto.match(/(\d+(?:[.,]\d+)?)/);
  if (digitos) {
    let n = parseFloat(digitos[1].replace(",", "."));
    if (/\b(y medio|y media)\b/.test(texto)) n += 0.5;
    return { cantidad: n, resto: texto.replace(digitos[0], " ").replace(/\b(y medio|y media)\b/, " ") };
  }
  const palabras = texto.split(/\s+/);
  let total = 0, encontrado = false;
  const restantes: string[] = [];
  for (let i = 0; i < palabras.length; i++) {
    const p = palabras[i];
    if (p in palabrasNumero && !(p === "un" || p === "una" || p === "uno") ) { total += palabrasNumero[p]; encontrado = true; continue; }
    if ((p === "un" || p === "una" || p === "uno") && !encontrado) { total += 1; encontrado = true; continue; }
    if (p.startsWith("veinti") && p.slice(6) in palabrasNumero) { total += 20 + palabrasNumero[p.slice(6)]; encontrado = true; continue; }
    if (p === "y" && encontrado && i + 1 < palabras.length && palabras[i + 1] in palabrasNumero) continue;
    restantes.push(p);
  }
  return { cantidad: encontrado ? total : null, resto: restantes.join(" ") };
}

const palabrasDe = (texto: string) => normalizar(texto).replace(/[^a-z0-9ñ\s]/g, " ").split(/\s+/).filter(Boolean);

/** El artículo del catálogo que mejor casa con lo dicho: coincidencia por raíz de palabra, con sinónimos de obra. */
export function buscarArticulo(texto: string, articles: Article[]): Article | null {
  const base = palabrasDe(texto).filter(p => p.length >= 3 && !vacias.has(p));
  const consulta = new Set<string>();
  for (const p of base) { consulta.add(p); for (const s of sinonimos[p] ?? []) consulta.add(s); }
  if (!consulta.size) return null;
  let mejor: { article: Article; puntos: number } | null = null;
  for (const article of articles) {
    const nombre = palabrasDe(article.name).filter(p => p.length >= 3 && !vacias.has(p));
    let puntos = 0;
    for (const q of consulta) { const raiz = q.slice(0, 4); if (nombre.some(a => a.startsWith(raiz) || q.startsWith(a.slice(0, 4)))) puntos += 1; }
    if (puntos > 0 && (!mejor || puntos > mejor.puntos || (puntos === mejor.puntos && article.name.length < mejor.article.name.length))) mejor = { article, puntos };
  }
  return mejor?.article ?? null;
}

/** Interpreta una frase dicha en obra. Devuelve null si no se entiende; nunca inventa un artículo. */
export function interpretarOrden(texto: string, articles: Article[]): Orden | null {
  const t = normalizar(texto).replace(/[¿?¡!.,;]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (/\b(cuanto va|cuanto es|cuanto cuesta|cuanto llevamos|que llevamos|total|dime el total)\b/.test(t)) return { tipo: "total" };
  if (/\b(incorpora|incorporar|al presupuesto|pasalo|pasarlo|guardalo|guardar)\b/.test(t)) return { tipo: "incorporar" };
  if (/\b(deshaz|deshacer|anula|atras|lo ultimo no)\b/.test(t)) return { tipo: "deshacer" };
  const cambio = t.match(/\b(cambia|cambiar|pasa|ver|ensename|otra)\b.*\b(estancia|foto|habitacion|salon|casa)\b/);
  if (cambio) { const p = panoramas.find(x => t.includes(normalizar(x.nombre).split(" ")[0])) ?? null; if (p) return { tipo: "cambiar", panorama: p }; }
  if (esQuitar.test(t)) { const article = buscarArticulo(t, articles); return article ? { tipo: "quitar", article } : null; }
  const { cantidad, resto } = leerCantidad(t);
  const article = buscarArticulo(resto, articles);
  if (!article) return null;
  if (!esAñadir.test(t) && cantidad === null) return null;
  return { tipo: "añadir", article, quantity: cantidad ?? cantidadPorDefecto(article.unit), aproximada: cantidad === null };
}

/** Las partidas del ticket: una por artículo, con las cantidades sumadas. */
export function partidasDe(colocaciones: Colocacion[], articles: Article[]): BudgetItem[] {
  const porArticulo = new Map<string, number>();
  for (const c of colocaciones) porArticulo.set(c.article_id, (porArticulo.get(c.article_id) ?? 0) + c.quantity);
  const items: BudgetItem[] = [];
  for (const [id, quantity] of porArticulo) { const article = articles.find(a => a.id === id); if (article) items.push(partidaDesdeArticulo(article, Math.round(quantity * 1000) / 1000)); }
  return items;
}

const cantidadTexto = (n: number, unit: string) => `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n)} ${unit === "m²" ? "metros cuadrados" : unit === "ml" ? "metros" : unit === "ud" ? (n === 1 ? "unidad" : "unidades") : unit}`;

/** Lo que Plano contesta en voz alta y en pantalla. */
export function describirOrden(orden: Orden, total?: number): string {
  switch (orden.tipo) {
    case "añadir": return `${orden.article.name}: ${cantidadTexto(orden.quantity, orden.article.unit)}${orden.aproximada ? ", cantidad aproximada" : ""}, ${money(orden.article.unit_price * orden.quantity)} sin IVA`;
    case "quitar": return `Quitado: ${orden.article.name}`;
    case "total": return total === undefined ? "Todavía no hay nada" : `Van ${money(total)} con IVA`;
    case "incorporar": return "Pasando al presupuesto";
    case "deshacer": return "Deshecho lo último";
    case "cambiar": return `Ahora ves ${orden.panorama.nombre.toLocaleLowerCase()}`;
  }
}
