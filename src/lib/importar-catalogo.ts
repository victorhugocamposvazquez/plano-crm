import type { Article, Command } from "./domain";
import { normalize } from "./search";
import { eurosACentimos, codigoSugerido, unidades, type Unidad } from "./catalogo";

/**
 * Importación masiva del catálogo desde CSV (pegado o archivo exportado de Excel / del programa de
 * presupuestos). Detecta el separador, reconoce las columnas por su nombre y convierte cada fila en
 * un `article.create`; lo que no cuadra se enseña con su motivo antes de importar nada.
 */

export type Campo = "code" | "name" | "chapter" | "unit" | "price" | "vat";
export const campos: { id: Campo; label: string; obligatorio: boolean }[] = [
  { id: "chapter", label: "Capítulo", obligatorio: true }, { id: "name", label: "Descripción", obligatorio: true }, { id: "unit", label: "Unidad", obligatorio: true },
  { id: "price", label: "Precio sin IVA", obligatorio: true }, { id: "code", label: "Código", obligatorio: false }, { id: "vat", label: "IVA %", obligatorio: false }
];

export type Mapeo = Partial<Record<Campo, number>>;

/** Divide un CSV en filas y celdas: separador «;», «,» o tabulador, comillas dobles y saltos dentro de comillas. */
export function parsearCSV(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, "");
  const primera = limpio.split(/\r?\n/).find(l => l.trim()) ?? "";
  const sep = [";", "\t", ","].map(s => ({ s, n: (primera.match(new RegExp(s === "\t" ? "\t" : `\\${s}`, "g")) ?? []).length })).sort((a, b) => b.n - a.n)[0]?.s ?? ";";
  const filas: string[][] = []; let fila: string[] = []; let celda = ""; let enComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (enComillas) {
      if (c === '"') { if (limpio[i + 1] === '"') { celda += '"'; i++; } else enComillas = false; }
      else celda += c;
    } else if (c === '"') enComillas = true;
    else if (c === sep) { fila.push(celda); celda = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && limpio[i + 1] === "\n") i++; fila.push(celda); if (fila.some(x => x.trim())) filas.push(fila); fila = []; celda = ""; }
    else celda += c;
  }
  fila.push(celda); if (fila.some(x => x.trim())) filas.push(fila);
  return filas.map(f => f.map(x => x.trim()));
}

/** Campo al que apunta una cabecera, por orden de prioridad («Precio sin IVA» es precio, no IVA). */
export function campoDeCabecera(cabecera: string): Campo | null {
  const n = normalize(cabecera).replace(/[^a-z0-9 %]/g, " ").replace(/\s+/g, " ").trim();
  if (!n) return null;
  if (/(^|\s)(precio|pvp|importe|tarifa|coste|pu|euros)(\s|$)/.test(n)) return "price";
  if (/(^|\s)(iva|impuesto|vat)(\s|$|%)/.test(n)) return "vat";
  if (/^(codigo|cod|ref|referencia|clave|id)(\s|$)/.test(n)) return "code";
  if (/(^|\s)(capitulo|cap|familia|categoria|grupo|seccion|apartado)(\s|$)/.test(n)) return "chapter";
  if (/(^|\s)(descripcion|nombre|concepto|articulo|partida|texto|resumen|denominacion)(\s|$)/.test(n)) return "name";
  if (/^(unidad|unidades|ud|u|medida|um)(\s|$)/.test(n)) return "unit";
  return null;
}

/** ¿La primera fila son cabeceras? Sí si al menos dos celdas se reconocen como nombres de campo. */
export function tieneCabecera(filas: string[][]) {
  const primera = filas[0] ?? [];
  return primera.filter(c => campoDeCabecera(c) !== null).length >= 2 && primera.every(c => eurosACentimos(c) === null || !/\d/.test(c));
}

/** Propone a qué campo va cada columna por el nombre de la cabecera; sin cabecera, por el orden habitual. */
export function detectarMapeo(filas: string[][]): Mapeo {
  const m: Mapeo = {};
  if (tieneCabecera(filas)) {
    filas[0].forEach((c, i) => { const campo = campoDeCabecera(c); if (campo && m[campo] === undefined) m[campo] = i; });
    return m;
  }
  const ancho = filas[0]?.length ?? 0;
  if (ancho >= 5) return { code: 0, chapter: 1, name: 2, unit: 3, price: 4, ...(ancho >= 6 ? { vat: 5 } : {}) };
  if (ancho === 4) return { chapter: 0, name: 1, unit: 2, price: 3 };
  return {};
}

const unidadDesde = (texto: string): Unidad | null => {
  const n = normalize(texto).replace(/\./g, "");
  if (["m2", "m²", "metro cuadrado", "metros cuadrados", "mc"].includes(n)) return "m²";
  if (["ml", "m", "metro", "metros", "metro lineal", "metros lineales"].includes(n)) return "ml";
  if (["ud", "uds", "u", "unidad", "unidades", "pza", "pieza", "piezas", "un"].includes(n)) return "ud";
  if (["h", "hora", "horas", "hr"].includes(n)) return "h";
  if (["global", "pa", "p a", "partida alzada", "alzada", "glb", "conjunto"].includes(n)) return "global";
  return (unidades as readonly string[]).includes(texto) ? (texto as Unidad) : null;
};

export type FilaImportada = { fila: number; comando?: Extract<Command, { type: "article.create" }>; errores: string[]; duplicado?: "catalogo" | "archivo" };

/** Convierte las filas en comandos; una fila con cualquier problema no se importa y se explica. */
export function filasAArticulos(filas: string[][], mapeo: Mapeo, existentes: Article[], ivaPorDefecto = 21): FilaImportada[] {
  const datos = tieneCabecera(filas) ? filas.slice(1) : filas;
  const codigosCatalogo = new Set(existentes.map(a => a.code.toUpperCase()));
  const vistos = new Set<string>();
  const nombresCatalogo = new Set(existentes.map(a => normalize(`${a.chapter}|${a.name}`)));
  const generados: Article[] = [...existentes];
  return datos.map((celdas, i) => {
    const fila = i + (tieneCabecera(filas) ? 2 : 1);
    const get = (c: Campo) => (mapeo[c] !== undefined ? celdas[mapeo[c]!] ?? "" : "");
    const errores: string[] = [];
    const chapter = get("chapter").trim(); const name = get("name").trim();
    if (!chapter) errores.push("sin capítulo"); if (!name) errores.push("sin descripción");
    const unit = unidadDesde(get("unit")); if (!unit) errores.push(`unidad «${get("unit") || "vacía"}» no reconocida (m², ml, ud, h o global)`);
    const price = eurosACentimos(get("price")); if (price === null) errores.push(`precio «${get("price") || "vacío"}» no válido`);
    const ivaTexto = get("vat").replace("%", "").trim();
    const vat = ivaTexto ? Number(ivaTexto.replace(",", ".")) : ivaPorDefecto;
    if (!Number.isFinite(vat) || vat < 0 || vat > 30) errores.push(`IVA «${get("vat")}» no válido`);
    let code = get("code").trim().toUpperCase();
    if (!code && chapter) { code = codigoSugerido(chapter, generados); }
    let duplicado: FilaImportada["duplicado"];
    if (code && codigosCatalogo.has(code)) duplicado = "catalogo";
    else if (code && vistos.has(code)) duplicado = "archivo";
    else if (chapter && name && nombresCatalogo.has(normalize(`${chapter}|${name}`))) duplicado = "catalogo";
    if (code) vistos.add(code);
    if (errores.length || duplicado) return { fila, errores, duplicado };
    generados.push({ id: `tmp-${fila}`, organization_id: "", code, name, chapter, unit: unit!, unit_price: price!, vat_rate: vat });
    return { fila, errores: [], comando: { type: "article.create", code, name, chapter, unit: unit!, unit_price: price!, vat_rate: vat } };
  });
}

export function resumenImportacion(filas: FilaImportada[]) {
  return { validas: filas.filter(f => f.comando).length, conErrores: filas.filter(f => f.errores.length).length, duplicadas: filas.filter(f => f.duplicado && !f.errores.length).length };
}

/** CSV con punto y coma (Excel en español lo abre directo) y precios con coma decimal. */
export function aCSV(articles: Article[]) {
  const esc = (v: string | number) => { const s = String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lineas = [["Código", "Capítulo", "Descripción", "Unidad", "Precio sin IVA", "IVA %"].join(";")];
  for (const a of [...articles].sort((x, y) => x.chapter.localeCompare(y.chapter, "es") || x.code.localeCompare(y.code, "es"))) {
    lineas.push([esc(a.code), esc(a.chapter), esc(a.name), esc(a.unit), esc((a.unit_price / 100).toFixed(2).replace(".", ",")), esc(a.vat_rate)].join(";"));
  }
  return `﻿${lineas.join("\r\n")}`;
}

export const ejemploCSV = `Capítulo;Descripción;Unidad;Precio sin IVA;IVA %;Código
Demoliciones;Demolición de tabique de ladrillo hueco;m²;9,80;21;DEM-010
Albañilería;Tabique de placa de yeso laminado 15 mm;m²;38,50;21;
Pintura;Pintura plástica lisa en paramentos verticales;m²;7,20;21;PIN-020`;
