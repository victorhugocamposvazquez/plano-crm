/**
 * Plano en 3D: una planta entera (recintos con su altura y temperatura, equipos y trazado de tuberías) sobre la que se presupuesta
 * una instalación con los artículos del catálogo, diciéndolo, escribiéndolo o tocando la escena.
 * Aquí solo lo puro: geometría a escala, medición de tubería por diámetro, qué artículo corresponde a cada cosa, partidas y órdenes.
 * Nada se inventa: sin artículo en el catálogo la partida sale sin precio, y lo que viene del plano es propuesta hasta que alguien la valide.
 */
import type { Article, BudgetItem } from "./domain";
import { normalizar } from "./busqueda";

export type Circuito = "aspiracion-bt" | "aspiracion-mt" | "liquido" | "gas-caliente";
export type Uso = "congelado" | "refrigerado" | "atemperado" | "ambiente" | "servicio";
export type ClaseEquipo = "cubico" | "plafon" | "muelle";
export type Punto = [number, number];
export type Caja = [number, number, number, number];
export type Recinto = { id: string; nombre: string; contorno: Punto[]; superficie: number; alto: number; temp?: [number, number]; uso: Uso };
export type EquipoPlano = { id: string; recinto: string; modelo: string; clase: ClaseEquipo; caja: Caja };
export type Linea = { c: Circuito; d: string; n?: number };
export type Tramo = { id: string; nombre: string; puntos: Punto[]; lineas: readonly Linea[]; equipo?: string; duda?: string };
/** Coordenadas en puntos del plano; `escala` son metros por punto. */
export type Planta = { id: string; nombre: string; origen: string; escala: number; recintos: Recinto[]; equipos: EquipoPlano[]; tramos: Tramo[] };

export type EquipoPuesto = EquipoPlano & { delPlano: boolean };
export type EstadoPlanta = { equipos: EquipoPuesto[]; tuberia: boolean; central: boolean };
export const estadoVacio = (): EstadoPlanta => ({ equipos: [], tuberia: false, central: false });
export const estaVacio = (e: EstadoPlanta) => !e.equipos.length && !e.tuberia && !e.central;

export const nombreCircuito: Record<Circuito, string> = { "aspiracion-bt": "aspiración de baja", "aspiracion-mt": "aspiración de media", liquido: "líquido", "gas-caliente": "gas caliente" };
export const nombreClase: Record<ClaseEquipo, string> = { cubico: "Evaporador cúbico de cámara", plafon: "Evaporador de plafón de pasillo", muelle: "Evaporador cúbico de muelle" };
export const nombreUso: Record<Uso, string> = { congelado: "Congelado", refrigerado: "Refrigerado", atemperado: "Atemperado", ambiente: "Ambiente", servicio: "Sin climatizar" };
/** Colores de la escena (contenido, no interfaz): el uso térmico de cada recinto y los circuitos como en el plano. */
export type RGB = readonly [number, number, number];
export const coloresUso: Record<Uso, RGB> = { congelado: [96, 154, 214], refrigerado: [92, 184, 190], atemperado: [150, 192, 120], ambiente: [205, 186, 150], servicio: [172, 172, 168] };
export const coloresCircuito: Record<Circuito, RGB> = { "aspiracion-bt": [40, 70, 230], "aspiracion-mt": [236, 120, 236], liquido: [20, 190, 40], "gas-caliente": [228, 40, 40] };
const ORDEN_CIRCUITO: Circuito[] = ["aspiracion-bt", "liquido", "aspiracion-mt", "gas-caliente"];
export const CAPITULO = "Refrigeración";
const MAX_UNIDADES = 12;

const cifra = (n: number, d = 2) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: d }).format(n);
const lista = (xs: string[]) => xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`;
const redondear = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

// ── Geometría ──────────────────────────────────────────────────────────────
export function areaContorno(planta: Planta, r: Recinto): number {
  let s = 0;
  for (let i = 0; i < r.contorno.length; i++) { const [x0, y0] = r.contorno[i], [x1, y1] = r.contorno[(i + 1) % r.contorno.length]; s += x0 * y1 - x1 * y0; }
  return Math.abs(s) / 2 * planta.escala ** 2;
}
export const volumen = (r: Recinto) => r.superficie * r.alto;
export function temperatura(r: Recinto): string {
  if (!r.temp) return "";
  const g = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;
  return r.temp[0] === r.temp[1] ? `${g(r.temp[0])} °C` : `${g(r.temp[0])} a ${g(r.temp[1])} °C`;
}
export const describirRecinto = (r: Recinto) => [`${cifra(r.superficie)} m²`, `${cifra(r.alto)} m de alto`, `${cifra(volumen(r), 0)} m³`, temperatura(r)].filter(Boolean).join(" · ");
const longitud = (planta: Planta, puntos: Punto[]) => puntos.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - puntos[i][0], p[1] - puntos[i][1]), 0) * planta.escala;
function dentro(contorno: Punto[], [x, y]: Punto): boolean {
  let d = false;
  for (let i = 0, j = contorno.length - 1; i < contorno.length; j = i++) {
    const [xi, yi] = contorno[i], [xj, yj] = contorno[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d;
  }
  return d;
}

// ── Medición de tubería ────────────────────────────────────────────────────
const valorDiametro = (d: string) => d.split(" ").reduce((s, p) => { const [a, b] = p.split("/").map(Number); return s + (b ? a / b : a); }, 0);
export type MedicionTuberia = { total: number; porCircuito: Record<Circuito, number>; porDiametro: { d: string; metros: number; circuitos: Partial<Record<Circuito, number>> }[]; dudas: string[] };
/**
 * Metros de tubería en planta, por circuito y por diámetro. Los ramales solo cuentan si su equipo está puesto; sin `puestos`, cuenta todo el plano.
 * No incluye bajadas a los equipos ni la subida a la central: el plano de planta no las da.
 */
export function medicionTuberia(planta: Planta, puestos?: Set<string>): MedicionTuberia {
  const porCircuito: Record<Circuito, number> = { "aspiracion-bt": 0, "aspiracion-mt": 0, liquido: 0, "gas-caliente": 0 };
  const diametros = new Map<string, { metros: number; circuitos: Partial<Record<Circuito, number>> }>(), dudas: string[] = [];
  for (const t of planta.tramos) {
    if (t.equipo && puestos && !puestos.has(t.equipo)) continue;
    const m = longitud(planta, t.puntos);
    if (t.duda) dudas.push(`${t.nombre}: ${t.duda}`);
    for (const l of t.lineas) {
      const metros = m * (l.n ?? 1), x = diametros.get(l.d) ?? { metros: 0, circuitos: {} };
      x.metros += metros; x.circuitos[l.c] = (x.circuitos[l.c] ?? 0) + metros; diametros.set(l.d, x); porCircuito[l.c] += metros;
    }
  }
  const porDiametro = [...diametros].map(([d, x]) => ({ d, ...x })).sort((a, b) => valorDiametro(a.d) - valorDiametro(b.d));
  return { total: porDiametro.reduce((s, x) => s + x.metros, 0), porCircuito, porDiametro, dudas };
}

// ── Catálogo ───────────────────────────────────────────────────────────────
const esRefrigeracion = (a: Article) => /refriger|frigor|frio/.test(normalizar(a.chapter));
/** Referencia del fabricante en el nombre del artículo: letras y cifras seguidas, como TEWSDC45 o TEWSSC80-2. */
export const modeloDe = (a: Pick<Article, "name">) => a.name.match(/\b([A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]*(?:-\d+)?)\b/)?.[1] ?? null;
export const claseDe = (a: Pick<Article, "name">): ClaseEquipo => { const n = normalizar(a.name); return /plafon/.test(n) ? "plafon" : /muelle/.test(n) ? "muelle" : "cubico"; };
export const evaporadores = (articles: Article[]) => articles.filter(a => a.unit === "ud" && esRefrigeracion(a) && /evaporador/.test(normalizar(a.name)) && modeloDe(a));
export const articuloDeModelo = (articles: Article[], modelo: string) => evaporadores(articles).find(a => modeloDe(a) === modelo) ?? null;
export const articuloTuberia = (articles: Article[], d: string) => articles.find(a => a.unit === "ml" && esRefrigeracion(a) && /tuberia|tubo/.test(normalizar(a.name)) && a.name.match(/(\d+ )?\d+\/\d+/)?.[0] === d) ?? null;
export const articuloCentral = (articles: Article[]) => articles.find(a => a.unit === "ud" && esRefrigeracion(a) && /central/.test(normalizar(a.name))) ?? null;

// ── Partidas ───────────────────────────────────────────────────────────────
export type Grupo = "evaporadores" | "tuberia" | "central";
export type PartidaPlanta = BudgetItem & { grupo: Grupo; detalle: string; sinArticulo: boolean; sinPrecio: boolean };
export const nombreGrupo: Record<Grupo, string> = { evaporadores: "Evaporadores", tuberia: "Tubería", central: "Central" };
function partida(id: string, grupo: Grupo, a: Article | null, descripcion: string, cantidad: number, unit: "ud" | "ml", detalle: string): PartidaPlanta {
  return { id, grupo, detalle, chapter: a?.chapter ?? CAPITULO, description: a?.name ?? descripcion, quantity: cantidad, unit, unit_price: a?.unit_price ?? 0, adjustment_percent: 0, vat_rate: a?.vat_rate ?? 21, inclusion: "included", sinArticulo: !a, sinPrecio: !a || a.unit_price === 0 };
}
/** Una partida por modelo de evaporador, una por diámetro de tubería y la central. La cantidad sale del plano; el precio, del catálogo. */
export function partidasPlanta(planta: Planta, estado: EstadoPlanta, articles: Article[]): PartidaPlanta[] {
  const out: PartidaPlanta[] = [], nombre = (id: string) => planta.recintos.find(r => r.id === id)?.nombre ?? id;
  for (const modelo of [...new Set(estado.equipos.map(e => e.modelo))]) {
    const suyos = estado.equipos.filter(e => e.modelo === modelo), donde = [...new Set(suyos.map(e => e.recinto))];
    out.push(partida(`evap-${modelo}`, "evaporadores", articuloDeModelo(articles, modelo), `Evaporador ${modelo}`, suyos.length, "ud", `${lista(suyos.map(e => e.id))} · ${lista(donde.map(nombre))}`));
  }
  if (estado.tuberia) for (const x of medicionTuberia(planta, new Set(estado.equipos.map(e => e.id))).porDiametro) {
    const detalle = (Object.entries(x.circuitos) as [Circuito, number][]).map(([c, m]) => `${nombreCircuito[c]} ${cifra(m, 1)} m`).join(" · ");
    out.push(partida(`tubo-${x.d}`, "tuberia", articuloTuberia(articles, x.d), `Tubería frigorífica CO2 Ø ${x.d}"`, redondear(x.metros, 1), "ml", detalle));
  }
  if (estado.central) out.push(partida("central", "central", articuloCentral(articles), "Central frigorífica de CO2", 1, "ud", "Una única central para baja y media, según el plano"));
  return out;
}

// ── Órdenes ────────────────────────────────────────────────────────────────
export type Movimiento = "left" | "right" | "closer" | "farther";
export type OrdenPlanta =
  | { tipo: "plano" } | { tipo: "vaciar" }
  | { tipo: "poner"; recinto: string; modelo: string; clase: ClaseEquipo; unidades: number }
  | { tipo: "quitar"; ids: string[] }
  | { tipo: "cambiar"; id: string; modelo: string; clase: ClaseEquipo }
  | { tipo: "tuberia"; poner: boolean } | { tipo: "central"; poner: boolean }
  | { tipo: "metros"; circuito?: Circuito }
  | { tipo: "recinto"; recinto: string }
  | { tipo: "vista"; recinto?: string }
  | { tipo: "mover"; mover: Movimiento }
  | { tipo: "total" } | { tipo: "incorporar" } | { tipo: "deshacer" }
  | { tipo: "aviso"; mensaje: string };

const numeros: Record<string, string> = { un: "1", una: "1", uno: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5", seis: "6", siete: "7", ocho: "8", nueve: "9", diez: "10", once: "11", doce: "12" };
const limpiar = (frase: string) => normalizar(frase).replace(/[¿?¡!.,;:]/g, " ").split(/\s+/).map(p => numeros[p] ?? p).join(" ").trim();
const opcionales = new Set(["de", "y", "zona", "camaras"]);
/** Recinto nombrado en la frase: «cámara 3», «pasillo uno», «muelles», «almacén». El número tiene que ir pegado al nombre. */
export function recintoDicho(texto: string, planta: Planta): Recinto | undefined {
  const t = limpiar(texto), palabras = new Set(t.split(" "));
  let mejor: { r: Recinto; puntos: number } | undefined;
  for (const r of planta.recintos) {
    const tokens = limpiar(r.nombre).split(" ").map(p => /^\d+$/.test(p) ? String(Number(p)) : p), primero = tokens[0], num = tokens.find(p => /^\d+$/.test(p));
    const raiz = primero.replace(/s$/, "");
    const ok = t.match(num ? new RegExp(`\\b${raiz}s?(?: (?:de|camaras?|numero|la|las))* 0*${num}\\b`) : new RegExp(`\\b${raiz}s?\\b`));
    if (!ok) continue;
    // Gana la mención más larga: «pasillo de cámaras 2» es el pasillo, no la cámara 2.
    const puntos = ok[0].length * 10 + tokens.filter(p => p !== primero && !opcionales.has(p) && palabras.has(p)).length * 2 + (planta.equipos.some(e => e.recinto === r.id) ? 1 : 0);
    if (!mejor || puntos > mejor.puntos) mejor = { r, puntos };
  }
  if (mejor) return mejor.r;
  // «baterías», «comedor», «ascensor»: una palabra larga que solo lleva un recinto.
  const propias = planta.recintos.flatMap(r => limpiar(r.nombre).split(" ").filter(p => p.length >= 5).map(p => [p, r] as const));
  const hallada = propias.filter(([p]) => palabras.has(p) && propias.filter(([q]) => q === p).length === 1);
  return hallada.length === 1 ? hallada[0][1] : undefined;
}
const equiposDichos = (t: string) => [...t.matchAll(/\b(bt|mt) ?0?(\d{1,2})\b/g)].map(m => `${m[1].toUpperCase()}${m[2].padStart(2, "0")}`);
function modeloDicho(t: string, articles: Article[]): Article | undefined {
  const junto = t.replace(/[\s-]/g, "");
  return evaporadores(articles).filter(a => junto.includes(modeloDe(a)!.toLowerCase().replace(/-/g, ""))).sort((a, b) => modeloDe(b)!.length - modeloDe(a)!.length)[0];
}
function circuitoDicho(t: string): Circuito | undefined {
  if (/\b(gas caliente|desescarche)\b/.test(t)) return "gas-caliente";
  if (/\bliquido\b/.test(t)) return "liquido";
  if (/\b(baja|bt|congelado)\b/.test(t)) return "aspiracion-bt";
  if (/\b(media|mt)\b/.test(t)) return "aspiracion-mt";
  return undefined;
}
const clasePorUso = (r: Recinto): ClaseEquipo => r.uso === "congelado" ? "cubico" : r.uso === "refrigerado" ? "plafon" : "muelle";

/** Interpreta una frase dicha o escrita. Devuelve null si no se entiende y un aviso si se entiende pero no se puede hacer. */
export function interpretarPlanta(frase: string, planta: Planta, estado: EstadoPlanta, articles: Article[]): OrdenPlanta | null {
  const t = limpiar(frase);
  if (!t) return null;
  if (/\b(cuanto va|cuanto es|cuanto cuesta|cuanto sale|cuanto llevamos|que llevamos|total)\b/.test(t)) return { tipo: "total" };
  if (/\b(incorpora|incorporar|al presupuesto|pasalo|pasarlo|guardalo)\b/.test(t)) return { tipo: "incorporar" };
  if (/\b(deshaz|deshacer|anula|lo ultimo no)\b/.test(t)) return { tipo: "deshacer" };
  if (/\b(gira|girar|mira)\b.*\bizquierda\b/.test(t)) return { tipo: "mover", mover: "left" };
  if (/\b(gira|girar|mira)\b.*\bderecha\b/.test(t)) return { tipo: "mover", mover: "right" };
  if (/\b(acercate|acerca|acercar|mas cerca|zoom)\b/.test(t)) return { tipo: "mover", mover: "closer" };
  if (/\b(alejate|aleja|alejar|mas lejos)\b/.test(t)) return { tipo: "mover", mover: "farther" };
  if (/\b(vista general|desde fuera|desde arriba|toda la planta|planta entera)\b/.test(t)) return { tipo: "vista" };

  const recinto = recintoDicho(t, planta), ids = equiposDichos(t), articulo = modeloDicho(t, articles);
  const tuberia = /\b(tuberia|tuberias|tubo|tubos|lineas)\b/.test(t), central = /\bcentral\b/.test(t);
  const evaporador = Boolean(articulo) || /\b(evaporador|evaporadores|cubico|cubicos|plafon|plafones|equipo|equipos)\b/.test(t);

  if (/^(quita|quitar|quitame|elimina|borra|saca|sacar|fuera)\b/.test(t)) {
    if (/\btodo\b/.test(t)) return { tipo: "vaciar" };
    if (tuberia) return { tipo: "tuberia", poner: false };
    if (central) return { tipo: "central", poner: false };
    const quitar = ids.length ? ids.filter(id => estado.equipos.some(e => e.id === id)) : recinto ? estado.equipos.filter(e => e.recinto === recinto.id).map(e => e.id) : [];
    return quitar.length ? { tipo: "quitar", ids: quitar } : { tipo: "aviso", mensaje: ids.length ? `${lista(ids)} no está en la propuesta.` : recinto ? `${recinto.nombre} no tiene equipos puestos.` : "Dime qué quito: un equipo (BT03), un recinto, la tubería o la central." };
  }
  if (/^(cambia|cambiar|sustituye|sustituir)\b/.test(t) && ids.length) {
    if (!estado.equipos.some(e => e.id === ids[0])) return { tipo: "aviso", mensaje: `${ids[0]} no está en la propuesta.` };
    return articulo ? { tipo: "cambiar", id: ids[0], modelo: modeloDe(articulo)!, clase: claseDe(articulo) } : { tipo: "aviso", mensaje: "Dime por qué modelo del catálogo lo cambio." };
  }
  if (/\b(cuantos metros|cuanta tuberia|cuanto tubo|metros de|longitud)\b/.test(t)) return { tipo: "metros", circuito: circuitoDicho(t) };
  if (/\b(lo del plano|todo el plano|segun el plano|como (en )?el plano|presupuesta el plano|lo que marca el plano|lo que dice el plano)\b/.test(t)) return { tipo: "plano" };

  const verbo = /^(pon|poner|ponme|anade|anadir|coloca|colocar|mete|meter|instala|instalar|monta|montar)\b/.test(t);
  if (verbo && tuberia && !evaporador) return { tipo: "tuberia", poner: true };
  if (verbo && central && !evaporador) return { tipo: "central", poner: true };
  if ((verbo || evaporador) && evaporador && !/^(entra|ve|vamos|ensename|muestrame|mira|enfoca|que|cuantos|cuales)\b/.test(t)) {
    if (!recinto) return { tipo: "aviso", mensaje: "Dime en qué recinto: por ejemplo, «pon un evaporador en la cámara 3»." };
    const delPlano = planta.equipos.find(e => e.recinto === recinto.id);
    const clasePedida: ClaseEquipo | undefined = /\bplafon/.test(t) ? "plafon" : /\bcubico/.test(t) ? (recinto.uso === "congelado" ? "cubico" : "muelle") : undefined;
    const elegido = articulo ?? (delPlano && (!clasePedida || clasePedida === delPlano.clase) ? articuloDeModelo(articles, delPlano.modelo) : null) ?? evaporadores(articles).find(a => claseDe(a) === (clasePedida ?? clasePorUso(recinto)));
    if (!elegido && !delPlano) return { tipo: "aviso", mensaje: "No hay evaporadores en el catálogo. Añádelos en Catálogo, capítulo Refrigeración." };
    const n = Number(t.match(/\b(\d{1,2}) (?:evaporador|cubico|plafon|equipo|tew)/)?.[1] ?? 1);
    return { tipo: "poner", recinto: recinto.id, modelo: elegido ? modeloDe(elegido)! : delPlano!.modelo, clase: elegido ? claseDe(elegido) : delPlano!.clase, unidades: Math.min(Math.max(n, 1), MAX_UNIDADES) };
  }
  if (recinto) return /^(entra|entrar|ve|vamos|ir|ensename|muestrame|mira|enfoca|acercate)\b/.test(t) ? { tipo: "vista", recinto: recinto.id } : { tipo: "recinto", recinto: recinto.id };
  if (tuberia) return { tipo: "metros", circuito: circuitoDicho(t) };
  return null;
}

const tamano: Record<ClaseEquipo, Punto> = { cubico: [20.4, 7.3], plafon: [19, 9.4], muelle: [10.2, 13.8] };
const solapan = (a: Caja, b: Caja) => !(a[0] > b[2] + 2 || a[2] < b[0] - 2 || a[1] > b[3] + 2 || a[3] < b[1] - 2);
/** Sitio libre dentro del recinto para un equipo que el plano no dibuja: desde el centro hacia fuera, sin pisar otros. */
function hueco(planta: Planta, r: Recinto, clase: ClaseEquipo, ocupadas: Caja[]): Caja {
  const xs = r.contorno.map(p => p[0]), ys = r.contorno.map(p => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const [w, h] = tamano[clase], pasos = [0, -1, 1, -2, 2, -3, 3];
  const caja = (x: number, y: number): Caja => [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
  for (const dy of pasos) for (const dx of pasos) {
    const x = cx + dx * w * 1.5, y = cy + dy * h * 2.2, c = caja(x, y);
    if (([[c[0], c[1]], [c[2], c[1]], [c[2], c[3]], [c[0], c[3]]] as Punto[]).every(p => dentro(r.contorno, p)) && !ocupadas.some(o => solapan(o, c))) return c;
  }
  return caja(cx, cy);
}
function siguienteId(planta: Planta, equipos: EquipoPuesto[], prefijo: string) {
  const usados = [...planta.equipos, ...equipos].filter(e => e.id.startsWith(prefijo)).map(e => Number(e.id.slice(prefijo.length))).filter(Number.isFinite);
  return `${prefijo}${String(Math.max(0, ...usados) + 1).padStart(2, "0")}`;
}
const enOrden = (planta: Planta, equipos: EquipoPuesto[]) => [...equipos].sort((a, b) => a.id.localeCompare(b.id, "es", { numeric: true }));

/** Aplica una orden que cambia la propuesta. Las de cámara, consulta, total e incorporar no tocan el estado. */
export function aplicarPlanta(planta: Planta, estado: EstadoPlanta, orden: OrdenPlanta): EstadoPlanta {
  switch (orden.tipo) {
    case "plano": return { equipos: enOrden(planta, [...planta.equipos.map(e => estado.equipos.find(x => x.id === e.id) ?? { ...e, delPlano: true }), ...estado.equipos.filter(e => !e.delPlano)]), tuberia: true, central: true };
    case "vaciar": return estadoVacio();
    case "poner": {
      const r = planta.recintos.find(x => x.id === orden.recinto);
      if (!r) return estado;
      const equipos = [...estado.equipos];
      for (let i = 0; i < orden.unidades; i++) {
        // Primero los sitios que marca el plano para ese recinto; después, huecos libres.
        const suyo = planta.equipos.find(e => e.recinto === r.id && !equipos.some(x => x.id === e.id));
        if (suyo) { equipos.push({ ...suyo, modelo: orden.modelo, clase: orden.clase, delPlano: true }); continue; }
        const ocupadas = [...planta.equipos, ...equipos].filter(e => e.recinto === r.id).map(e => e.caja);
        equipos.push({ id: siguienteId(planta, equipos, r.uso === "congelado" ? "BT" : "MT"), recinto: r.id, modelo: orden.modelo, clase: orden.clase, caja: hueco(planta, r, orden.clase, ocupadas), delPlano: false });
      }
      return { ...estado, equipos: enOrden(planta, equipos) };
    }
    case "quitar": return { ...estado, equipos: estado.equipos.filter(e => !orden.ids.includes(e.id)) };
    case "cambiar": return { ...estado, equipos: estado.equipos.map(e => e.id === orden.id ? { ...e, modelo: orden.modelo, clase: orden.clase } : e) };
    case "tuberia": return { ...estado, tuberia: orden.poner };
    case "central": return { ...estado, central: orden.poner };
    default: return estado;
  }
}

/** Qué responde Plano a una consulta: lo que lleva un recinto o los metros de tubería. */
export function describirEquipos(planta: Planta, estado: EstadoPlanta, r: Recinto): string {
  const puestos = estado.equipos.filter(e => e.recinto === r.id), plano = planta.equipos.filter(e => e.recinto === r.id);
  const porModelo = (es: EquipoPlano[]) => lista([...new Set(es.map(e => e.modelo))].map(m => `${es.filter(e => e.modelo === m).length} × ${m}`));
  const cabecera = `${r.nombre}: ${describirRecinto(r)}.`;
  if (puestos.length) return `${cabecera} Puestos: ${porModelo(puestos)} (${lista(puestos.map(e => e.id))}).`;
  if (plano.length) return `${cabecera} El plano marca ${porModelo(plano)} (${lista(plano.map(e => e.id))}); todavía sin presupuestar.`;
  return `${cabecera} El plano no marca equipos aquí.`;
}
export function describirMetros(planta: Planta, estado: EstadoPlanta, circuito?: Circuito): string {
  const m = medicionTuberia(planta, estado.equipos.length ? new Set(estado.equipos.map(e => e.id)) : undefined);
  const base = estado.equipos.length ? "con los equipos puestos" : "con todo lo que marca el plano";
  if (circuito) return `${cifra(m.porCircuito[circuito], 1)} m de ${nombreCircuito[circuito]} en planta, ${base}. Sin bajadas ni subida a la central.`;
  return `${cifra(m.total, 1)} m de tubería en planta, ${base}: ${(Object.entries(m.porCircuito) as [Circuito, number][]).filter(([, v]) => v > 0).map(([c, v]) => `${nombreCircuito[c]} ${cifra(v, 1)} m`).join(", ")}. Sin bajadas ni subida a la central.`;
}

// ── Escena ─────────────────────────────────────────────────────────────────
export type EscenaRecinto = { id: string; nombre: string; rotulo: string; contorno: Punto[]; alto: number; uso: Uso };
export type EscenaEquipo = { id: string; caja: Caja; alto: number; puesto: boolean };
export type EscenaTubo = { circuito: Circuito; puntos: Punto[]; alto: number; grueso: number; puesto: boolean };
export type EscenaPlanta = { ancho: number; fondo: number; alto: number; recintos: EscenaRecinto[] };
function origen(planta: Planta): Punto { const ps = planta.recintos.flatMap(r => r.contorno); return [Math.min(...ps.map(p => p[0])), Math.min(...ps.map(p => p[1]))]; }
const aMetros = (planta: Planta, o: Punto) => ([x, y]: Punto): Punto => [(x - o[0]) * planta.escala, (y - o[1]) * planta.escala];
/** La planta en metros, con el origen en su esquina: lo que no cambia al presupuestar. */
export function escenaPlanta(planta: Planta): EscenaPlanta {
  const m = aMetros(planta, origen(planta)), recintos = planta.recintos.map(r => ({ id: r.id, nombre: r.nombre, rotulo: [`${cifra(r.superficie)} m²`, `${cifra(r.alto)} m`, temperatura(r)].filter(Boolean).join(" · "), contorno: r.contorno.map(m), alto: r.alto, uso: r.uso }));
  const ps = recintos.flatMap(r => r.contorno);
  return { ancho: Math.max(...ps.map(p => p[0])), fondo: Math.max(...ps.map(p => p[1])), alto: Math.max(...recintos.map(r => r.alto)), recintos };
}
/** Equipos y tuberías tal como están: lo puesto, macizo; lo que marca el plano y aún no se ha presupuestado, en silueta. */
export function escenaInstalacion(planta: Planta, estado: EstadoPlanta): { equipos: EscenaEquipo[]; tubos: EscenaTubo[] } {
  const m = aMetros(planta, origen(planta)), alto = (id: string) => planta.recintos.find(r => r.id === id)?.alto ?? 3;
  const caja = (c: Caja): Caja => [...m([c[0], c[1]]), ...m([c[2], c[3]])] as Caja;
  const puestos = new Set(estado.equipos.map(e => e.id));
  const equipos = [...estado.equipos.map(e => ({ id: e.id, caja: caja(e.caja), alto: alto(e.recinto), puesto: true })), ...planta.equipos.filter(e => !puestos.has(e.id)).map(e => ({ id: e.id, caja: caja(e.caja), alto: alto(e.recinto), puesto: false }))];
  // La altura de la tubería no viene en el plano: se dibuja bajo el techo del recinto más bajo por el que pasa.
  const techo = (t: Tramo) => Math.min(...planta.recintos.filter(r => t.puntos.some(p => dentro(r.contorno, p))).map(r => r.alto), 4.4) - 0.35;
  // Un tramo con una sola línea (plano leído: cada circuito trae su trazado) baja un escalón por circuito para no pisarse con los que van pegados.
  const escalon = (t: Tramo, c: Circuito) => t.lineas.length === 1 ? ORDEN_CIRCUITO.indexOf(c) * 0.22 : 0;
  const tubos = planta.tramos.flatMap(t => t.lineas.flatMap(l => Array.from({ length: l.n ?? 1 }, () => ({ circuito: l.c, puntos: t.puntos.map(m), alto: techo(t) - escalon(t, l.c), grueso: valorDiametro(l.d), puesto: estado.tuberia && (!t.equipo || puestos.has(t.equipo)) }))));
  return { equipos, tubos };
}
