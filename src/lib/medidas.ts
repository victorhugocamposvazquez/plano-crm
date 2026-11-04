/**
 * Medidas de una estancia tomadas con el medidor láser y las superficies que salen de ellas.
 * Plano no mide en la foto: la persona dice o escribe «la cocina mide 4 por 3 y 2,6 de alto» y de ahí salen
 * suelo, techo y paredes (descontando puertas y ventanas). Es exacto en lo que se dice y no depende de ninguna IA.
 */
import type { Article } from "./domain";
import { normalizar } from "./busqueda";
import { muestra, seAplicaATodo, zonaDicha, type Zona } from "./visita360";

export type Medidas = { largo?: number; ancho?: number; alto?: number; puertas?: number; ventanas?: number };

/** Huecos estándar que se descuentan de las paredes: puerta de 0,80 × 2,05 m y ventana de 1,20 × 1,20 m. */
export const huecoPuerta = 0.8 * 2.05;
export const huecoVentana = 1.2 * 1.2;
export const anchoPuerta = 0.8;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Superficies de una estancia rectangular. Lo que no se puede calcular con lo que hay, null. */
export function superficies(m: Medidas): { suelo: number | null; techo: number | null; paredes: number | null; perimetro: number | null } {
  const planta = m.largo && m.ancho ? r2(m.largo * m.ancho) : null;
  const perimetro = m.largo && m.ancho ? r2(2 * (m.largo + m.ancho)) : null;
  const huecos = (m.puertas ?? 0) * huecoPuerta + (m.ventanas ?? 0) * huecoVentana;
  const paredes = perimetro !== null && m.alto ? r2(Math.max(0, perimetro * m.alto - huecos)) : null;
  return { suelo: planta, techo: planta, paredes, perimetro };
}

/** Qué falta para calcular la cantidad de un artículo con las medidas («el largo y el ancho», «la altura»), o null si no falta nada. */
export function faltaPara(article: Pick<Article, "chapter" | "name" | "unit">, m: Medidas = {}): string | null {
  const tipo = muestra(article).superficie;
  if (!m.largo || !m.ancho) return "el largo y el ancho";
  if (tipo === "pared" && article.unit === "m²" && !m.alto) return "la altura";
  return null;
}

/**
 * Cantidad de un artículo según las medidas de su estancia: suelo y techo en m² de planta, paredes en m² menos huecos,
 * rodapiés y molduras en metros de perímetro menos puertas. Null si el artículo no va por superficie de la estancia
 * (una puerta, un punto de luz, un tabique nuevo) o si faltan medidas.
 */
export function cantidadDesdeMedidas(article: Pick<Article, "chapter" | "name" | "unit">, m?: Medidas): number | null {
  if (!m) return null;
  const s = superficies(m), t = normalizar(`${article.chapter} ${article.name}`);
  if (article.unit === "ml" && /rodapi|zocalo|moldura|cornisa/.test(t)) return s.perimetro === null ? null : r2(Math.max(0, s.perimetro - (m.puertas ?? 0) * anchoPuerta));
  if (article.unit !== "m²" || !seAplicaATodo(article)) return null;
  const tipo = muestra(article).superficie;
  return tipo === "suelo" ? s.suelo : tipo === "techo" ? s.techo : tipo === "pared" ? s.paredes : null;
}

const cifra = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** «4 × 3 m · 2,6 m de alto · 1 puerta · 1 ventana». */
export function describirMedidas(m: Medidas): string {
  const partes: string[] = [];
  if (m.largo && m.ancho) partes.push(`${cifra(m.largo)} × ${cifra(m.ancho)} m`);
  else if (m.largo || m.ancho) partes.push(`${cifra((m.largo ?? m.ancho)!)} m`);
  if (m.alto) partes.push(`${cifra(m.alto)} m de alto`);
  if (m.puertas) partes.push(plural(m.puertas, "puerta", "puertas"));
  if (m.ventanas) partes.push(plural(m.ventanas, "ventana", "ventanas"));
  return partes.join(" · ");
}
/** «Suelo 12 m² · paredes 33,4 m² · techo 12 m²», solo lo que se puede calcular. */
export function describirSuperficies(m: Medidas): string {
  const s = superficies(m), partes: string[] = [];
  if (s.suelo !== null) partes.push(`suelo ${cifra(s.suelo)} m²`);
  if (s.paredes !== null) partes.push(`paredes ${cifra(s.paredes)} m²`);
  if (s.techo !== null) partes.push(`techo ${cifra(s.techo)} m²`);
  const texto = partes.join(" · ");
  return texto ? texto[0].toUpperCase() + texto.slice(1) : "";
}

// ---- frases de medidas: «la cocina mide 4 por 3 y 2,6 de alto», «4,20 x 3,10», «altura 2,70», «tiene una puerta y dos ventanas»
const numeros: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90
};
const decimal = (entero: number, parte: string) => entero + Number(parte) / 10 ** parte.length;

/** Pasa a cifras lo dicho con palabras: «cuatro coma dos» → 4.2, «dos sesenta» → 2.60, «tres con diez» → 3.10. */
function enCifras(texto: string): string {
  const fichas = texto.split(/\s+/).flatMap(p => {
    if (p in numeros) return [String(numeros[p])];
    return [p];
  });
  // «treinta y cinco» → 35
  for (let i = 0; i + 2 < fichas.length; i++) if (/^[2-9]0$/.test(fichas[i]) && fichas[i + 1] === "y" && /^[1-9]$/.test(fichas[i + 2])) fichas.splice(i, 3, String(Number(fichas[i]) + Number(fichas[i + 2])));
  let t = fichas.join(" ");
  t = t.replace(/(\d+)\s+(?:coma|punto)\s+(\d+)/g, (_, a, b) => String(decimal(Number(a), b)));
  // «tres con diez» es 3,10; «3 con una puerta» no es un decimal.
  t = t.replace(/(\d+)\s+con\s+(\d{2})\b(?!\s*(?:puertas?|ventanas?))/g, (_, a, b) => String(decimal(Number(a), b)));
  // En obra «dos sesenta» es 2,60: una cifra seguida de decenas, sin unidad entre medias.
  t = t.replace(/\b([1-9])\s+([1-9]\d)\b(?!\s*(?:puertas?|ventanas?))/g, (_, a, b) => String(decimal(Number(a), b)));
  return t;
}

/**
 * Medidas dichas en una frase y, si se nombra, la estancia. Null si la frase no habla de medidas (así «pon dos puertas» sigue siendo una orden).
 * Admite centímetros («420 por 310»): si todo pasa de 30, se divide por 100.
 */
export function interpretarMedidas(texto: string, zonas: Zona[]): { zona?: Zona; medidas: Medidas } | null {
  const base = normalizar(texto).replace(/(\d),(\d)/g, "$1.$2").replace(/[¿?¡!;:]/g, " ").replace(/\s+/g, " ").trim();
  const { zona, resto } = zonaDicha(base, zonas);
  const t = enCifras(resto.replace(/×/g, " x ").replace(/(\d)x(\d)/g, "$1 x $2"));
  const num = "(\\d+(?:\\.\\d+)?)", unidad = "\\s*(?:m|metros?|cm|centimetros?)?\\s*";
  const m: Medidas = {};
  const dims = t.match(new RegExp(`${num}${unidad}(?:por|x|\\*)\\s*${num}(?:${unidad}(?:por|x|\\*)\\s*${num})?`));
  if (dims) { m.largo = Number(dims[1]); m.ancho = Number(dims[2]); if (dims[3]) m.alto = Number(dims[3]); }
  const tras = (palabra: string) => t.match(new RegExp(`\\b(?:${palabra})\\b\\s*(?:de|a|es|mide|son)?\\s*${num}`)) ?? t.match(new RegExp(`${num}${unidad}de\\s*(?:${palabra})\\b`));
  const alto = tras("alto|altura|techo"); if (alto) m.alto = Number(alto[1]);
  const largo = tras("largo|longitud"); if (largo) m.largo = Number(largo[1]);
  const ancho = tras("ancho|anchura"); if (ancho) m.ancho = Number(ancho[1]);
  const hayMedida = m.largo !== undefined || m.ancho !== undefined || m.alto !== undefined;
  // Puertas y ventanas solo cuentan como huecos si la frase es de medidas o empieza por «tiene» / «hay».
  if (hayMedida || /^(?:tiene|hay|con)\b/.test(t.trim())) {
    const puertas = t.match(/\b(\d+)\s+puertas?\b/), ventanas = t.match(/\b(\d+)\s+ventanas?\b/);
    if (puertas) m.puertas = Number(puertas[1]);
    if (ventanas) m.ventanas = Number(ventanas[1]);
    if (/\bsin\s+ventanas?\b/.test(t)) m.ventanas = 0;
  }
  if (!Object.keys(m).length) return null;
  // Dicho en centímetros.
  const longitudes = [m.largo, m.ancho, m.alto].filter((v): v is number => v !== undefined);
  if (/\b(?:cm|centimetros?)\b/.test(t) || (longitudes.length && longitudes.every(v => v > 30))) for (const k of ["largo", "ancho", "alto"] as const) if (m[k] !== undefined) m[k] = r2(m[k]! / 100);
  // Fuera de lo razonable para una estancia: no se toma.
  for (const k of ["largo", "ancho", "alto"] as const) if (m[k] !== undefined && (m[k]! <= 0.3 || m[k]! > 40)) delete m[k];
  return Object.keys(m).length ? { zona, medidas: m } : null;
}
