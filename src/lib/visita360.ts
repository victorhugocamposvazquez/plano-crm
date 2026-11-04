import { normalizar } from "./busqueda";
import { money, type Article, type BudgetItem } from "./domain";
import { partidaDesdeArticulo } from "./presupuesto";

/**
 * Visita 360: una foto esférica de la estancia donde se toca o se dice qué va en cada sitio.
 * Las fotos son de ejemplo (Poly Haven, CC0) hasta que la cámara 360 de GARAL suba las suyas.
 * Cada foto es una estancia: lo que se pone va a esa estancia y su partida lo dice («Tarima… · Cocina»).
 * La única medida es la del suelo marcado a mano sobre la foto, siempre aproximada (≈) y corregible.
 */
export type Panorama = { id: string; nombre: string; url: string; nota: string };
export const panoramas: Panorama[] = [
  { id: "small_empty_house", nombre: "Cocina", url: "/visual/360/small_empty_house.jpg", nota: "Foto 360 de ejemplo · Poly Haven, CC0" },
  { id: "old_room", nombre: "Salón", url: "/visual/360/old_room.jpg", nota: "Foto 360 de ejemplo · Poly Haven, CC0" }
];

/** Las fotos 360 propias se guardan como documento del proyecto con este prefijo en el nombre: así viajan con el proyecto sin cambiar la base de datos. */
export const prefijo360 = "360 · ";
export const esFoto360 = (doc: { name: string; mime_type: string }) => doc.name.startsWith(prefijo360) && /^image\/(jpeg|png|webp)$/.test(doc.mime_type);
/** Una foto 360 equirectangular es el doble de ancha que de alta (se admite un margen pequeño). */
export const proporcion360 = (ancho: number, alto: number) => alto > 0 && Math.abs(ancho / alto - 2) <= 0.08;

export type Colocacion = { id: string; article_id: string; quantity: number; yaw: number; pitch: number; origen: "voz" | "toque"; aproximada: boolean; foto: string; superficie?: { tipo: TipoSuperficie; puntos: { yaw: number; pitch: number }[]; huecos?: { yaw: number; pitch: number }[][] };
  /** Superficie detectada en la foto: máscara comprimida del tamaño analizado. */
  zona?: { tipo: TipoSuperficie; mascara: string; w: number; h: number } };
/** Contorno del suelo de una estancia: las esquinas tocadas en la foto, siguiendo la base de paredes y muebles. */
export type Contorno = { yaw: number; pitch: number }[];
export type Zona = { id: string; nombre: string };

/** Altura supuesta de la cámara 360 sobre el suelo. Solo afecta a la superficie estimada, no a cómo se ve. */
export const alturaCamara = 1.5;
/** Punto del suelo al que apunta una dirección; `null` si mira al horizonte o hacia arriba. */
export function puntoSuelo(d: { yaw: number; pitch: number }): { x: number; z: number } | null {
  if (d.pitch > -0.03) return null;
  const distancia = alturaCamara / Math.tan(-d.pitch);
  if (distancia > 25) return null;
  return { x: Math.sin(d.yaw) * distancia, z: Math.cos(d.yaw) * distancia };
}
/** Superficie del contorno en m², redondeada a medio metro. Es una estimación: depende de la altura de la cámara. */
export function areaContorno(contorno: Contorno): number {
  const p = contorno.map(puntoSuelo).filter((x): x is { x: number; z: number } => Boolean(x));
  if (p.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < p.length; i++) { const j = (i + 1) % p.length; a += p[i].x * p[j].z - p[j].x * p[i].z; }
  return Math.round(Math.abs(a / 2) * 2) / 2;
}
/** Dirección al centro del contorno: ahí va la marca del suelo. */
export function centroContorno(contorno: Contorno): { yaw: number; pitch: number } {
  const p = contorno.map(puntoSuelo).filter((x): x is { x: number; z: number } => Boolean(x));
  if (!p.length) return contorno[0] ?? { yaw: 0, pitch: -0.6 };
  const x = p.reduce((s, q) => s + q.x, 0) / p.length, z = p.reduce((s, q) => s + q.z, 0) / p.length;
  return { yaw: Math.atan2(x, z), pitch: -Math.atan2(alturaCamara, Math.hypot(x, z)) };
}
export const esSuelo = (article: Pick<Article, "chapter" | "name">) => muestra(article).superficie === "suelo";
/** Altura supuesta del techo; solo se usa para dibujar un techo marcado. */
export const alturaTecho = 2.6;

/** `vertices` y `plano` traen primero el contorno y luego cada hueco; `huecos` dice dónde empieza cada uno. */
export type Geometria = { vertices: [number, number, number][]; plano: [number, number][]; huecos: number[]; area: number; centro: { yaw: number; pitch: number } };
const dir = (d: { yaw: number; pitch: number }) => ({ x: Math.cos(d.pitch) * Math.sin(d.yaw), y: Math.sin(d.pitch), z: Math.cos(d.pitch) * Math.cos(d.yaw) });
const areaPlano = (p: [number, number][]) => { let a = 0; for (let i = 0; i < p.length; i++) { const j = (i + 1) % p.length; a += p[i][0] * p[j][1] - p[j][0] * p[i][1]; } return Math.abs(a / 2); };
const centroDe = (v: [number, number, number][]) => { const x = v.reduce((s, q) => s + q[0], 0) / v.length, y = v.reduce((s, q) => s + q[1], 0) / v.length, z = v.reduce((s, q) => s + q[2], 0) / v.length; return { yaw: Math.atan2(x, z), pitch: Math.atan2(y, Math.hypot(x, z)) }; };

/**
 * Convierte las esquinas tocadas en la foto en una superficie real, con la cámara en el origen y el suelo a `alturaCamara` por debajo.
 * Suelo y techo: cada punto es el corte de su rayo con el plano horizontal. Pared, puerta o mueble: las dos primeras esquinas son
 * donde toca el suelo y fijan un plano vertical; el resto se proyecta sobre él. Devuelve un error legible si los puntos no sirven.
 */
export function geometriaSuperficie(tipo: TipoSuperficie, puntos: Contorno, huecos: Contorno[] = []): Geometria | { error: string } {
  if (puntos.length < 3) return { error: "Hacen falta al menos tres esquinas." };
  const vertices: [number, number, number][] = [], plano: [number, number][] = [];
  const todos = [...puntos, ...huecos.filter(h => h.length >= 3).flat()];
  if (tipo === "suelo" || tipo === "techo") {
    const y = tipo === "suelo" ? -alturaCamara : alturaTecho - alturaCamara;
    for (const p of todos) {
      const d = dir(p);
      if (tipo === "suelo" ? d.y > -0.03 : d.y < 0.03) return { error: tipo === "suelo" ? "Toca solo puntos del suelo, por debajo del horizonte." : "Toca solo puntos del techo, por encima del horizonte." };
      const t = y / d.y; if (t > 30) return { error: "Una esquina queda demasiado lejos; acércala a la base de la pared." };
      vertices.push([d.x * t, y, d.z * t]); plano.push([d.x * t, d.z * t]);
    }
  } else {
    const b1 = puntoSuelo(puntos[0]), b2 = puntoSuelo(puntos[1]);
    if (!b1 || !b2) return { error: "Las dos primeras esquinas tienen que ser donde la superficie toca el suelo." };
    const ex = b2.x - b1.x, ez = b2.z - b1.z, largo = Math.hypot(ex, ez);
    if (largo < 0.1) return { error: "Las dos primeras esquinas están demasiado juntas." };
    const ux = ex / largo, uz = ez / largo, nx = -uz, nz = ux;
    const B = [b1.x, -alturaCamara, b1.z];
    const nb = nx * B[0] + nz * B[2];
    for (const p of todos) {
      const d = dir(p), nd = nx * d.x + nz * d.z;
      if (Math.abs(nd) < 1e-4) return { error: "Una esquina cae fuera de esa pared." };
      const t = nb / nd; if (t <= 0 || t > 30) return { error: "Una esquina cae fuera de esa pared." };
      const P: [number, number, number] = [d.x * t, d.y * t, d.z * t];
      vertices.push(P); plano.push([(P[0] - B[0]) * ux + (P[2] - B[2]) * uz, P[1] - B[1]]);
    }
  }
  const n = puntos.length, inicios: number[] = []; let i = n;
  for (const h of huecos.filter(h => h.length >= 3)) { inicios.push(i); i += h.length; }
  const exterior = areaPlano(plano.slice(0, n));
  const restar = inicios.reduce((s, ini, k) => s + areaPlano(plano.slice(ini, inicios[k + 1] ?? plano.length)), 0);
  const area = Math.max(0, Math.round((exterior - restar) * 2) / 2);
  return { vertices, plano, huecos: inicios, area, centro: centroDe(vertices.slice(0, n)) };
}

export type Orden =
  | { tipo: "añadir"; article: Article; quantity: number | null; zona?: Zona }
  | { tipo: "quitar"; article: Article; zona?: Zona }
  | { tipo: "total" }
  | { tipo: "incorporar" }
  | { tipo: "deshacer" }
  | { tipo: "cambiar"; zona: Zona };

export const claveVisita = (projectId: string) => `plano.visita360.${projectId}`;

/** Dónde va un material en la estancia: `suelo` y `techo` son planos horizontales; `pared` es cualquier plano vertical (pared, puerta, frente de mueble). */
export type TipoSuperficie = "suelo" | "techo" | "pared";
/** Cómo se dibuja: una textura (CC0) repetida cada `escala` metros, o un color que conserva las luces y sombras de la foto. */
export type Acabado = { textura: string; escala: number; opacidad: number } | { color: string; opacidad: number };
const madera = { textura: "/visual/materiales/laminate_floor_02_diff_1k.jpg", escala: 1.4, opacidad: 0.96 };
const baldosa = { textura: "/visual/materiales/marble_tiles_diff_1k.jpg", escala: 0.9, opacidad: 0.96 };

/** Muestra del material (para la marca y el catálogo), dónde se pone y con qué acabado se dibuja. */
/** Si al pedirlo por voz se aplica a toda la superficie de la estancia (suelo, paredes, techo) o solo a lo que se toque. */
export const seAplicaATodo = (article: Pick<Article, "chapter" | "name">) => /pavimento|tarima|parquet|suelo|baldosa|porcelanico|gres|pintura|pintar|alicatad|azulejo|revestimiento|techo/.test(normalizar(`${article.chapter} ${article.name}`));
export function muestra(article: Pick<Article, "chapter" | "name">): { imagen?: string; color: string; superficie?: TipoSuperficie; acabado?: Acabado; suelo?: string } {
  const t = normalizar(`${article.chapter} ${article.name}`);
  if (/pavimento|tarima|parquet|suelo/.test(t)) return { imagen: "/visual/360/muestras/madera.jpg", color: "#a77b4f", superficie: "suelo", acabado: madera, suelo: madera.textura };
  if (/baldosa|porcelanico|gres/.test(t) && !/pared|alicatad|azulejo/.test(t)) return { imagen: "/visual/360/muestras/marmol.jpg", color: "#d8d6d0", superficie: "suelo", acabado: baldosa, suelo: baldosa.textura };
  if (/alicatad|azulejo|revestimiento/.test(t)) return { imagen: "/visual/360/muestras/marmol.jpg", color: "#d8d6d0", superficie: "pared", acabado: { ...baldosa, escala: 0.6 } };
  if (/falso techo|techo/.test(t)) return { color: "#f4f2ee", superficie: "techo", acabado: { color: "#f6f4ef", opacidad: 0.9 } };
  if (/pintura|pintar/.test(t)) return { color: "#f3efe6", superficie: "pared", acabado: { color: "#f6f3ec", opacidad: 0.9 } };
  if (/demolic|derribo|retirada/.test(t)) return { color: "#b4532a", superficie: "pared", acabado: { color: "#c8402c", opacidad: 0.5 } };
  if (/albanil|tabique|yeso|pladur/.test(t)) return { color: "#d9d4cc", superficie: "pared", acabado: { color: "#ebe8e2", opacidad: 0.88 } };
  if (/carpinter|madera|armario|puerta|mueble|cocina/.test(t)) return { imagen: "/visual/360/muestras/madera.jpg", color: "#a77b4f", superficie: "pared", acabado: { ...madera, escala: 0.9 } };
  if (/fontaner|bano|sanitari/.test(t)) return { imagen: "/visual/360/muestras/marmol.jpg", color: "#d8d6d0" };
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
const vacias = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "en", "por", "para", "con", "y", "a", "al", "aqui", "ahi", "alli", "esto", "eso", "este", "esta", "ese", "esa", "me", "que", "lo", "le", "mas", "otro", "otra", "nuevo", "nueva", "toda", "todo", "todas", "todos", "quiero", "necesito", "pon", "ponme", "poner", "anade", "anadir", "anademe", "mete", "meter", "incluye", "incluir", "quita", "quitar", "elimina", "borra", "saca", "sacar", "instalar", "instala", "colocar", "coloca", "hacer", "haz", "cambiar", "cambia", "metro", "metros", "cuadrado", "cuadrados", "lineal", "lineales", "unidad", "unidades", "m2", "ml", "ud", "uds", "euros", "cuanto", "va", "es", "solo", "solamente", "unicamente", "nada", "mas", "entera", "entero", "zona", "estancia", "habitacion"]);

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

/** La estancia nombrada en la frase, si la hay: «en la cocina», «el salón». Devuelve el texto sin ese nombre. */
export function zonaDicha(texto: string, zonas: Zona[]): { zona?: Zona; resto: string } {
  const t = normalizar(texto);
  for (const zona of zonas) {
    const palabras = palabrasDe(zona.nombre).filter(p => p.length >= 4);
    const hallada = palabras.find(p => new RegExp(`\\b${p}\\b`).test(t));
    if (hallada) return { zona, resto: t.replace(new RegExp(`\\b(en |de |del |el |la |los |las )*${hallada}\\b`), " ") };
  }
  return { resto: t };
}

/** Interpreta una frase dicha en obra. Devuelve null si no se entiende; nunca inventa un artículo. */
export function interpretarOrden(texto: string, articles: Article[], zonas: Zona[] = panoramas): Orden | null {
  const t = normalizar(texto).replace(/[¿?¡!.,;]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (/\b(cuanto va|cuanto es|cuanto cuesta|cuanto llevamos|que llevamos|total|dime el total)\b/.test(t)) return { tipo: "total" };
  if (/\b(incorpora|incorporar|al presupuesto|pasalo|pasarlo|guardalo|guardar)\b/.test(t)) return { tipo: "incorporar" };
  if (/\b(deshaz|deshacer|anula|atras|lo ultimo no)\b/.test(t)) return { tipo: "deshacer" };
  const { zona, resto: sinZona } = zonaDicha(t, zonas);
  if (zona && /^(cambia|cambiar|pasa|pasamos|vamos|ve|ver|ensename|abre|llevame|mira)\b/.test(t) && !buscarArticulo(sinZona.replace(/^(cambia|cambiar|pasa|pasamos|vamos|ve|ver|ensename|abre|llevame|mira)\b/, " "), articles)) return { tipo: "cambiar", zona };
  if (esQuitar.test(t)) { const article = buscarArticulo(sinZona, articles); return article ? { tipo: "quitar", article, zona } : null; }
  const { cantidad, resto } = leerCantidad(sinZona);
  const article = buscarArticulo(resto, articles);
  if (!article) return null;
  if (!esAñadir.test(t) && cantidad === null) return null;
  return { tipo: "añadir", article, quantity: cantidad, zona };
}

/** Las partidas del ticket: una por artículo y estancia, con las cantidades sumadas; la descripción dice la estancia. */
export function partidasDe(colocaciones: Colocacion[], articles: Article[], zonas: Zona[] = []): (BudgetItem & { zona: string; article_id: string; aproximada: boolean })[] {
  const grupos = new Map<string, { article_id: string; foto: string; quantity: number; aproximada: boolean }>();
  for (const c of colocaciones) {
    const clave = `${c.article_id}|${c.foto}`, g = grupos.get(clave);
    if (g) { g.quantity += c.quantity; g.aproximada ||= c.aproximada; } else grupos.set(clave, { article_id: c.article_id, foto: c.foto, quantity: c.quantity, aproximada: c.aproximada });
  }
  const items: (BudgetItem & { zona: string; article_id: string; aproximada: boolean })[] = [];
  for (const g of grupos.values()) {
    const article = articles.find(a => a.id === g.article_id); if (!article) continue;
    const zona = zonas.find(z => z.id === g.foto)?.nombre ?? "";
    const item = partidaDesdeArticulo(article, Math.round(g.quantity * 1000) / 1000);
    items.push({ ...item, description: zona ? `${article.name} · ${zona}` : article.name, zona, article_id: article.id, aproximada: g.aproximada });
  }
  return items;
}
/** Para el presupuesto: sin los campos propios de la visita. */
export const soloPartida = ({ zona: _zona, article_id: _article, aproximada: _aprox, ...item }: ReturnType<typeof partidasDe>[number]): BudgetItem => item;

const cantidadTexto = (n: number, unit: string) => `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n)} ${unit === "m²" ? "metros cuadrados" : unit === "ml" ? "metros" : unit === "ud" ? (n === 1 ? "unidad" : "unidades") : unit}`;

/** Lo que Plano contesta en voz alta y en pantalla. */
export function describirOrden(orden: Orden, total?: number, cantidad?: { quantity: number; aproximada: boolean }): string {
  switch (orden.tipo) {
    case "añadir": { const q = cantidad?.quantity ?? orden.quantity ?? cantidadPorDefecto(orden.article.unit); const aprox = cantidad?.aproximada ?? orden.quantity === null; return `${orden.article.name}${orden.zona ? ` en ${orden.zona.nombre.toLocaleLowerCase()}` : ""}: ${cantidadTexto(q, orden.article.unit)}${aprox ? ", aproximado" : ""}, ${money(orden.article.unit_price * q)} sin IVA`; }
    case "quitar": return `Quitado: ${orden.article.name}${orden.zona ? ` de ${orden.zona.nombre.toLocaleLowerCase()}` : ""}`;
    case "total": return total === undefined ? "Todavía no hay nada" : `Van ${money(total)} con IVA`;
    case "incorporar": return "Pasando al presupuesto";
    case "deshacer": return "Deshecho lo último";
    case "cambiar": return `Ahora ves ${orden.zona.nombre.toLocaleLowerCase()}`;
  }
}
