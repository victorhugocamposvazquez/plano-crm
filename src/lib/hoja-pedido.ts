import type { Project, Purchase } from "./domain";

/**
 * Hoja de pedido: lo que se manda a un proveedor para un proyecto. Sale de la lista de materiales:
 * por defecto las líneas por pedir y las ya pedidas (para reenviar o reclamar); lo recibido no se repite.
 */

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const proveedorSlug = (supplier: string) => norm(supplier).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sin-proveedor";

export type GrupoProveedor = { slug: string; supplier: string; items: Purchase[]; pendientes: number };

/** Agrupa los materiales de un proyecto por proveedor (sin distinguir acentos ni mayúsculas), con cuántos quedan por pedir o recibir. */
export function pedidosPorProveedor(purchases: Purchase[]): GrupoProveedor[] {
  const map = new Map<string, GrupoProveedor>();
  for (const p of purchases) {
    const slug = proveedorSlug(p.supplier);
    const g = map.get(slug) ?? { slug, supplier: p.supplier.trim() || "Sin proveedor", items: [], pendientes: 0 };
    g.items.push(p);
    if (p.status === "planned" || p.status === "ordered") g.pendientes++;
    map.set(slug, g);
  }
  return [...map.values()].sort((a, b) => b.pendientes - a.pendientes || a.supplier.localeCompare(b.supplier, "es"));
}

/** Líneas que van en la hoja: por pedir siempre; las pedidas también salvo que se pida solo lo nuevo. */
export function lineasHoja(items: Purchase[], incluirPedidos = true): Purchase[] {
  const orden: Record<Purchase["status"], number> = { planned: 0, ordered: 1, received: 2, delivered: 3 };
  return items.filter(p => p.status === "planned" || (incluirPedidos && p.status === "ordered")).sort((a, b) => orden[a.status] - orden[b.status] || a.name.localeCompare(b.name, "es"));
}

/** Número de la hoja: código del proyecto, proveedor y fecha del día (AAAAMMDD). */
export function numeroHoja(project: Pick<Project, "code">, slug: string, fecha = new Date()) {
  const iso = `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, "0")}${String(fecha.getDate()).padStart(2, "0")}`;
  return `${project.code} · ${slug.toUpperCase().slice(0, 12)} · ${iso}`;
}

export const estadoLinea: Record<Purchase["status"], string> = { planned: "Nuevo pedido", ordered: "Ya pedido · pendiente de recibir", received: "Recibido", delivered: "En obra" };
