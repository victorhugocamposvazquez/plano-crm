import { itemSchema, lineTotal, totals, type Article, type BudgetItem, type Project } from "./domain";

/**
 * Edición manual de un presupuesto desde la ficha del proyecto.
 * Las partidas salen del catálogo (precio copiado en el momento de añadirlas) o se escriben libres;
 * el cálculo es siempre el del dominio (`lineTotal`/`totals`). Nada de aquí llama al servidor.
 */

export const unidadesPartida = ["m²", "ml", "ud", "h", "global"] as const;
type Unidad = BudgetItem["unit"];

const unidadValida = (unit: string): Unidad => (unidadesPartida as readonly string[]).includes(unit) ? (unit as Unidad) : "ud";

/** Partida nueva a partir de un artículo del catálogo; la cantidad arranca en 1 para que sume algo desde el principio. */
export function partidaDesdeArticulo(article: Article, quantity = 1): BudgetItem {
  return {
    id: crypto.randomUUID(), chapter: article.chapter, description: article.name,
    quantity: redondear(quantity, 3), unit: unidadValida(article.unit), unit_price: article.unit_price,
    adjustment_percent: 0, vat_rate: article.vat_rate, inclusion: "included"
  };
}

/** Partida escrita a mano, sin artículo detrás: trabajos puntuales o actuaciones que el catálogo aún no recoge. */
export function partidaLibre(chapter: string, description = "", unit: Unidad = "ud", unit_price = 0, vat_rate = 21): BudgetItem {
  return { id: crypto.randomUUID(), chapter: chapter.trim() || "Varios", description, quantity: 1, unit, unit_price, adjustment_percent: 0, vat_rate, inclusion: "included" };
}

export const redondear = (value: number, decimals: number) => { const f = 10 ** decimals; return Math.round(value * f) / f; };

/** Cambia un campo de una partida respetando los límites del dominio (3 decimales en cantidad, 2 en porcentajes). */
export function actualizarPartida(items: BudgetItem[], id: string, patch: Partial<BudgetItem>): BudgetItem[] {
  return items.map(item => {
    if (item.id !== id) return item;
    const next = { ...item, ...patch };
    if (patch.quantity !== undefined) next.quantity = Math.max(0, redondear(patch.quantity, 3));
    if (patch.adjustment_percent !== undefined) next.adjustment_percent = Math.min(100, Math.max(-50, redondear(patch.adjustment_percent, 2)));
    if (patch.unit_price !== undefined) next.unit_price = Math.max(0, Math.round(patch.unit_price));
    return next;
  });
}

export const quitarPartida = (items: BudgetItem[], id: string) => items.filter(i => i.id !== id);

/** Mueve una partida un puesto arriba o abajo dentro de la lista. */
export function moverPartida(items: BudgetItem[], id: string, delta: -1 | 1): BudgetItem[] {
  const index = items.findIndex(i => i.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Problemas que impiden guardar, por partida, con texto para la interfaz. */
export function validarPartidas(items: BudgetItem[]): { id: string; message: string }[] {
  const out: { id: string; message: string }[] = [];
  for (const item of items) {
    if (!item.description.trim()) { out.push({ id: item.id, message: "Falta la descripción." }); continue; }
    const result = itemSchema.safeParse(item);
    if (!result.success) out.push({ id: item.id, message: result.error.issues[0]?.message ?? "Partida no válida." });
  }
  return out;
}

/** Agrupa las partidas por capítulo conservando el orden de aparición. */
export function partidasPorCapitulo(items: BudgetItem[]) {
  const map = new Map<string, BudgetItem[]>();
  for (const item of items) map.set(item.chapter, [...(map.get(item.chapter) ?? []), item]);
  return map;
}

export const totalCapitulo = (items: BudgetItem[]) => items.filter(i => i.inclusion === "included").reduce((sum, i) => sum + lineTotal(i), 0);

/* ---------- Guía por capítulos ---------- */

export type PasoGuia = { chapter: string; label: string; hint: string };

/** Orden natural de una obra, por tipo de proyecto: sirve de guion para no olvidar capítulos. Se puede saltar. */
export function guiaPorTipo(kind: Project["kind"]): PasoGuia[] {
  const comunes: PasoGuia[] = [
    { chapter: "Demoliciones", label: "Demoliciones y retirada", hint: "Qué se quita y cómo sale el escombro." },
    { chapter: "Albañilería", label: "Albañilería", hint: "Tabiques, regularizaciones, ayudas a instalaciones." },
    { chapter: "Electricidad", label: "Electricidad", hint: "Cuadro, circuitos, puntos de luz y mecanismos." },
    { chapter: "Fontanería", label: "Fontanería", hint: "Tomas, desagües, sanitarios y grifería." },
    { chapter: "Pavimentos", label: "Pavimentos y revestimientos", hint: "Suelos, alicatados y rodapiés." },
    { chapter: "Carpintería", label: "Carpintería", hint: "Puertas, armarios y frentes." },
    { chapter: "Pintura", label: "Pintura y acabados", hint: "Preparación de paramentos y acabado final." },
    { chapter: "Varios", label: "Gestión de residuos y limpieza", hint: "Contenedores, transporte y limpieza de entrega." }
  ];
  if (kind === "carpentry") return comunes.filter(p => ["Carpintería", "Pintura", "Varios"].includes(p.chapter));
  if (kind === "partial") return comunes.filter(p => p.chapter !== "Varios").concat(comunes.filter(p => p.chapter === "Varios"));
  return comunes;
}

/** Estado de la guía frente a las partidas actuales: un paso queda cubierto cuando su capítulo tiene alguna partida. */
export function progresoGuia(pasos: PasoGuia[], items: BudgetItem[]) {
  return pasos.map(p => ({ ...p, count: items.filter(i => i.chapter === p.chapter).length }));
}

/** Resumen económico para el pie del editor. */
export function resumen(items: BudgetItem[]) {
  const t = totals(items);
  return { ...t, incluidas: items.filter(i => i.inclusion === "included").length, alternativas: items.filter(i => i.inclusion === "optional").length };
}
