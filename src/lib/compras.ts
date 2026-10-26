import type { Command, Purchase, Project, Workspace } from "./domain";

/**
 * Compras y materiales. Las reglas de estado las impone el dominio de Codex (`purchase.update`):
 * - Por pedir (planned): recibido 0.
 * - Pedido (ordered): recibido ≤ pedido, entregado ≤ recibido (admite recepciones parciales).
 * - Recibido (received): recibido = cantidad pedida.
 * - En obra (delivered): entregado = cantidad pedida.
 * Aquí solo se construyen los comandos que cumplen esas reglas y se decide qué acción toca.
 */

export type Accion = { id: "pedir" | "recibir" | "entregar" | "reabrir"; label: string; needsQuantity?: boolean };

export function accionesPara(p: Purchase): Accion[] {
  switch (p.status) {
    case "planned": return [{ id: "pedir", label: "Marcar como pedido" }];
    case "ordered": return [{ id: "recibir", label: "Registrar recepción", needsQuantity: true }];
    case "received": return [{ id: "entregar", label: "Entregar en obra" }];
    case "delivered": return [];
  }
}

/** Comando para la acción elegida; `cantidad` solo cuenta al recibir (acumulada sobre lo ya recibido). */
export function comandoPara(p: Purchase, accion: Accion["id"], cantidad = 0): Command {
  if (accion === "pedir") return { type: "purchase.update", id: p.id, status: "ordered", received_quantity: 0, delivered_quantity: 0 };
  if (accion === "entregar") return { type: "purchase.update", id: p.id, status: "delivered", received_quantity: p.quantity, delivered_quantity: p.quantity };
  if (accion === "reabrir") return { type: "purchase.update", id: p.id, status: "ordered", received_quantity: p.received_quantity, delivered_quantity: Math.min(p.delivered_quantity, p.received_quantity) };
  const recibido = Math.min(p.quantity, Math.max(0, p.received_quantity + cantidad));
  return { type: "purchase.update", id: p.id, status: recibido >= p.quantity ? "received" : "ordered", received_quantity: recibido, delivered_quantity: Math.min(p.delivered_quantity, recibido) };
}

export function pendienteDeRecibir(p: Purchase) {
  return Math.max(0, p.quantity - p.received_quantity);
}

export type Filtro = "all" | "planned" | "ordered" | "received" | "delivered";
export const filtros: { id: Filtro; label: string }[] = [
  { id: "all", label: "Todos" }, { id: "planned", label: "Por pedir" }, { id: "ordered", label: "Pedidos" }, { id: "received", label: "Recibidos" }, { id: "delivered", label: "En obra" }
];

export function agruparPorProyecto(data: Workspace, purchases: Purchase[]): { project: Project; items: Purchase[] }[] {
  const orden: Record<Purchase["status"], number> = { ordered: 0, planned: 1, received: 2, delivered: 3 };
  const grupos = new Map<string, Purchase[]>();
  for (const p of purchases) grupos.set(p.project_id, [...(grupos.get(p.project_id) ?? []), p]);
  return [...grupos.entries()].flatMap(([projectId, items]) => {
    const project = data.projects.find(x => x.id === projectId);
    return project ? [{ project, items: items.sort((a, b) => orden[a.status] - orden[b.status] || a.name.localeCompare(b.name, "es")) }] : [];
  }).sort((a, b) => a.project.name.localeCompare(b.project.name, "es"));
}

export function resumen(purchases: Purchase[]) {
  return {
    porPedir: purchases.filter(p => p.status === "planned").length,
    pedidos: purchases.filter(p => p.status === "ordered").length,
    recibidos: purchases.filter(p => p.status === "received").length,
    enObra: purchases.filter(p => p.status === "delivered").length
  };
}
