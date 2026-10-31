import { lineTotal, totals, type BudgetItem, type BudgetVersion, type Project } from "./domain";

/**
 * Datos del documento de presupuesto que se entrega al cliente: capítulos con sus partidas incluidas
 * y subtotal, alternativas aparte (no suman), excluidas aparte, y un número de documento estable.
 */

export type CapituloDoc = { chapter: string; items: BudgetItem[]; subtotal: number };

export function capitulosDocumento(items: BudgetItem[]): CapituloDoc[] {
  const map = new Map<string, BudgetItem[]>();
  for (const item of items.filter(i => i.inclusion === "included")) map.set(item.chapter, [...(map.get(item.chapter) ?? []), item]);
  return [...map.entries()].map(([chapter, list]) => ({ chapter, items: list, subtotal: list.reduce((s, i) => s + lineTotal(i), 0) }));
}

export const alternativas = (items: BudgetItem[]) => items.filter(i => i.inclusion === "optional");
export const excluidas = (items: BudgetItem[]) => items.filter(i => i.inclusion === "excluded");

/** Número de documento: código del proyecto, ámbito si hay varios y revisión. */
export function numeroDocumento(project: Pick<Project, "code">, version: Pick<BudgetVersion, "number">, ambito?: number) {
  return `${project.code}${ambito ? `-${ambito}` : ""} · V${version.number}`;
}

/** Desglose de IVA por tipo, para el pie del documento. */
export function desgloseIva(items: BudgetItem[]) {
  const map = new Map<number, { base: number; cuota: number }>();
  for (const item of items.filter(i => i.inclusion === "included")) {
    const base = lineTotal(item);
    const prev = map.get(item.vat_rate) ?? { base: 0, cuota: 0 };
    map.set(item.vat_rate, { base: prev.base + base, cuota: prev.cuota + totals([item]).tax });
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0]).map(([rate, v]) => ({ rate, ...v }));
}

export const estadoDocumento = (version: BudgetVersion) =>
  version.status === "approved" ? "Aceptado" : version.status === "issued" ? "Presupuesto" : version.status === "superseded" ? "Versión archivada" : "Borrador · no válido como oferta";

export const fechaDocumento = (iso: string) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

/** Unidad escrita como la lee un cliente. */
export const unidadLarga: Record<BudgetItem["unit"], string> = { "m²": "m²", ml: "ml", ud: "ud", h: "h", global: "p.a." };
