import { lineTotal, totals, type Article, type BudgetItem } from "./domain";

/**
 * Estimación rápida en la visita.
 * Nada de aquí interpreta fotos ni voz: el técnico elige trabajos del catálogo de precios,
 * estima cantidades y el cálculo sale de `lineTotal`/`totals`, igual que en un presupuesto.
 */

export type TrabajoRapido = { id: string; label: string; chapter: string; hint: string };

/** Selectores precargados: los trabajos más repetidos en una reforma, apuntando a un capítulo del catálogo. */
export const trabajosRapidos: TrabajoRapido[] = [
  { id: "demolicion", label: "Demoler tabiques", chapter: "Demoliciones", hint: "m² de tabique a retirar" },
  { id: "tabiques", label: "Levantar tabiques", chapter: "Albañilería", hint: "m² de tabique nuevo" },
  { id: "suelo", label: "Cambiar suelo", chapter: "Pavimentos", hint: "m² de superficie" },
  { id: "pintura", label: "Pintar", chapter: "Pintura", hint: "m² de paredes y techos" },
  { id: "electricidad", label: "Puntos de luz y enchufes", chapter: "Electricidad", hint: "unidades" },
  { id: "fontaneria", label: "Fontanería de baño", chapter: "Fontanería", hint: "instalación completa" },
  { id: "carpinteria", label: "Puertas y armarios", chapter: "Carpintería", hint: "unidades" }
];

/** Una línea de la estimación: artículo del catálogo, cantidad estimada y ajuste por dificultad. */
export type Linea = { id: string; article_id: string; quantity: number; adjustment_percent: number; motivo: string };

export function articulosPorCapitulo(articles: Article[]) {
  const map = new Map<string, Article[]>();
  for (const a of [...articles].sort((x, y) => x.chapter.localeCompare(y.chapter) || x.name.localeCompare(y.name))) {
    map.set(a.chapter, [...(map.get(a.chapter) ?? []), a]);
  }
  return map;
}

/** Primer artículo del capítulo de un trabajo rápido; null si el catálogo no lo cubre. */
export function articuloPara(trabajo: TrabajoRapido, articles: Article[]) {
  return articles.find(a => a.chapter === trabajo.chapter) ?? null;
}

/** Convierte las líneas en partidas válidas para `budget.save`; las cantidades a 0 se descartan. */
export function partidasDesdeLineas(lineas: Linea[], articles: Article[]): BudgetItem[] {
  return lineas.flatMap(linea => {
    const article = articles.find(a => a.id === linea.article_id);
    if (!article || !(linea.quantity > 0)) return [];
    const unit = (["m²", "ml", "ud", "h", "global"] as const).includes(article.unit as BudgetItem["unit"]) ? (article.unit as BudgetItem["unit"]) : "ud";
    return [{
      id: linea.id, chapter: article.chapter,
      description: linea.motivo ? `${article.name} · ${linea.motivo}` : article.name,
      quantity: Math.round(linea.quantity * 1000) / 1000, unit, unit_price: article.unit_price,
      adjustment_percent: Math.round(linea.adjustment_percent * 100) / 100, vat_rate: article.vat_rate, inclusion: "included"
    }];
  });
}

export type Rango = { base: number; total: number; minTotal: number; maxTotal: number; margen: number };

/** Horquilla orientativa alrededor del total: la cantidad estimada en visita puede desviarse. */
export function rangoEstimacion(items: BudgetItem[], margen = 0.15): Rango {
  const { base, total } = totals(items);
  return { base, total, minTotal: Math.round(total * (1 - margen)), maxTotal: Math.round(total * (1 + margen)), margen };
}

export function importeLinea(linea: Linea, articles: Article[]) {
  const [item] = partidasDesdeLineas([linea], articles);
  return item ? lineTotal(item) : 0;
}

/** Notas que acompañan a la revisión: dejan claro qué es estimación y qué falta por comprobar. */
export function notasDeVisita(alcance: string, pendientes: string[], fecha: string, margen: number) {
  const partes = [
    `Estimación orientativa realizada en la visita del ${fecha}. Cantidades estimadas a ojo o con medidas rápidas, pendientes de medición; horquilla de ±${Math.round(margen * 100)} %.`,
    alcance.trim() ? `Alcance indicado por el cliente: ${alcance.trim()}` : "",
    pendientes.length ? `Pendiente de comprobar: ${pendientes.join("; ")}.` : ""
  ];
  return partes.filter(Boolean).join("\n\n");
}

/** Preguntas breves que suelen cambiar el precio; se guardan como pendientes si no se responden en la visita. */
export const comprobaciones = [
  "Acceso y ascensor para retirada de escombros",
  "Estado de las instalaciones ocultas (electricidad, fontanería)",
  "Altura libre y techos existentes",
  "Calidades de acabados que quiere el cliente",
  "Elementos que se conservan"
];
