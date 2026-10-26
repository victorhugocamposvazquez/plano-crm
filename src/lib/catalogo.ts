import type { Article } from "./domain";
import { normalize } from "./search";

export const unidades = ["m²", "ml", "ud", "h", "global"] as const;
export type Unidad = (typeof unidades)[number];
export const unidadNombres: Record<Unidad, string> = { "m²": "m² · superficie", ml: "ml · metro lineal", ud: "ud · unidad", h: "h · hora", global: "global · partida alzada" };

/**
 * Convierte un importe escrito en euros («49,50», «1.250,00 €», «49.5») en céntimos enteros.
 * Devuelve null si no es un número válido. El dominio guarda precios en céntimos.
 */
export function eurosACentimos(texto: string): number | null {
  const limpio = texto.replace(/[€\s]/g, "");
  if (!limpio) return null;
  // Si hay coma, la coma es el decimal y los puntos son miles; si no, el último punto es el decimal.
  const normalizado = limpio.includes(",") ? limpio.replace(/\./g, "").replace(",", ".") : limpio.replace(/\.(?=.*\.)/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  return Math.round(Number(normalizado) * 100);
}

/** Código propuesto a partir del capítulo: tres letras + correlativo (PIN-002). */
export function codigoSugerido(chapter: string, articles: Article[]) {
  const prefijo = normalize(chapter).replace(/[^a-z]/g, "").slice(0, 3).toUpperCase() || "ART";
  const usados = articles.map(a => a.code.toUpperCase()).filter(c => c.startsWith(`${prefijo}-`)).map(c => Number(c.slice(prefijo.length + 1))).filter(n => Number.isInteger(n));
  return `${prefijo}-${String((usados.length ? Math.max(...usados) : 0) + 1).padStart(3, "0")}`;
}

export function capitulos(articles: Article[]) {
  return [...new Set(articles.map(a => a.chapter))].sort((a, b) => a.localeCompare(b, "es"));
}

/** Busca por código, nombre o capítulo, sin acentos y con las palabras en cualquier orden. */
export function buscarArticulos(articles: Article[], query: string) {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (!terms.length) return articles;
  return articles.filter(a => { const texto = normalize(`${a.code} ${a.name} ${a.chapter}`); return terms.every(t => texto.includes(t)); });
}

export function agruparPorCapitulo(articles: Article[]) {
  const map = new Map<string, Article[]>();
  for (const a of [...articles].sort((x, y) => x.chapter.localeCompare(y.chapter, "es") || x.code.localeCompare(y.code, "es"))) {
    map.set(a.chapter, [...(map.get(a.chapter) ?? []), a]);
  }
  return map;
}
