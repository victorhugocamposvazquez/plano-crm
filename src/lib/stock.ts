/**
 * Almacén: existencias de los artículos del catálogo que se guardan en la nave.
 * Solo llevan stock los artículos marcados «se guarda en almacén» (material); la mano de obra y los servicios no.
 * Las existencias cambian con movimientos registrados: entradas y salidas a mano, recuentos, y de forma automática
 * al recibir un pedido de Materiales ligado al artículo (suma) y al llevarlo a obra (resta).
 * Lo recibido para una obra y aún no llevado está reservado: cuenta en el almacén, pero no está libre.
 */
import type { Article, Purchase, StockMovement, Workspace } from "./domain";

export type EstadoStock = { enAlmacen: number; reservado: number; libre: number; minimo: number | null; bajoMinimo: boolean; agotado: boolean };

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Lo recibido de pedidos ligados al artículo que todavía no se ha llevado a su obra. */
export function reservado(article: Pick<Article, "id">, purchases: Purchase[]): number {
  return r3(purchases.filter(p => p.article_id === article.id).reduce((s, p) => s + Math.max(0, p.received_quantity - p.delivered_quantity), 0));
}

export function estadoStock(article: Article, purchases: Purchase[]): EstadoStock {
  const enAlmacen = r3(article.stock_qty ?? 0), res = Math.min(reservado(article, purchases), Math.max(0, enAlmacen)), libre = r3(enAlmacen - res);
  const minimo = article.stock_min ?? null;
  return { enAlmacen, reservado: res, libre, minimo, bajoMinimo: minimo !== null && libre < minimo, agotado: libre <= 0 };
}

export const nombreMovimiento: Record<StockMovement["kind"], string> = {
  entrada: "Entrada", salida: "Salida", recuento: "Recuento", recepcion: "Recibido de un pedido", a_obra: "Llevado a obra"
};

/** Movimientos de un artículo, del más reciente al más antiguo. */
export function movimientosDe(articleId: string, data: Pick<Workspace, "stock_movements">): StockMovement[] {
  return (data.stock_movements ?? []).filter(m => m.article_id === articleId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

const fmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 });
export const cantidadStock = (n: number, unit: string) => `${fmt.format(n)} ${unit}`;

/** Diferencia que produce un movimiento manual sobre las existencias; lanza un error legible si no tiene sentido. */
export function deltaManual(kind: "entrada" | "salida" | "recuento", quantity: number, actual: number): number {
  if (!(quantity >= 0) || quantity > 1_000_000) throw new Error("Indica una cantidad válida.");
  if (kind === "recuento") return r3(quantity - actual);
  if (quantity <= 0) throw new Error("Indica una cantidad mayor que cero.");
  if (kind === "salida" && quantity > actual) throw new Error(`Solo hay ${fmt.format(actual)} en almacén.`);
  return kind === "entrada" ? quantity : -quantity;
}
