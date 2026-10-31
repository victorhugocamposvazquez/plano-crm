import type { Tone } from "@/components/ui/status";
import { localDate } from "./hoy";
import { money, type Invoice, type Workspace } from "./domain";

/** «Vencida» no se guarda: es una factura enviada cuyo vencimiento ya ha pasado. */
export type EstadoFactura = "borrador" | "enviada" | "vencida" | "cobrada";
export const estadosFactura: { id: EstadoFactura; label: string; tone: Tone }[] = [
  { id: "borrador", label: "Borrador", tone: "muted" },
  { id: "enviada", label: "Enviada", tone: "info" },
  { id: "vencida", label: "Vencida", tone: "danger" },
  { id: "cobrada", label: "Cobrada", tone: "success" }
];
export function estadoFactura(f: Pick<Invoice, "status" | "due_date">, hoy = localDate()): EstadoFactura {
  if (f.status === "paid") return "cobrada";
  if (f.status === "draft") return "borrador";
  return f.due_date && f.due_date < hoy ? "vencida" : "enviada";
}
export const etiquetaFactura = (f: Pick<Invoice, "status" | "due_date">, hoy = localDate()) => estadosFactura.find(e => e.id === estadoFactura(f, hoy))!;

export const facturasDe = (data: Workspace, projectId = "") => (data.invoices ?? []).filter(f => !projectId || f.project_id === projectId);
export const emitidas = (lista: Invoice[]) => lista.filter(f => f.status !== "draft");
/** Lo que el cliente debe: primero lo vencido y, dentro, lo más antiguo. */
export function porCobrar(lista: Invoice[], hoy = localDate()) {
  return lista.filter(f => f.status === "sent").sort((a, b) => Number(estadoFactura(b, hoy) === "vencida") - Number(estadoFactura(a, hoy) === "vencida") || (a.due_date ?? "").localeCompare(b.due_date ?? ""));
}
export const vencidas = (lista: Invoice[], hoy = localDate()) => lista.filter(f => estadoFactura(f, hoy) === "vencida");
export const sumaBase = (lista: Invoice[]) => lista.reduce((s, f) => s + f.base, 0);
export const sumaTotal = (lista: Invoice[]) => lista.reduce((s, f) => s + f.total, 0);

export function vencimientoPorDefecto(hoy = localDate()) {
  const d = new Date(`${hoy}T12:00:00`); d.setDate(d.getDate() + 30);
  return localDate(d);
}
export const recordatorioFactura = (f: Invoice) => `Hola. Te recuerdo la factura ${f.number} de ${money(f.total)} (${f.concept}), con vencimiento el ${f.due_date ? new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(new Date(`${f.due_date}T12:00:00`)) : "—"}. Cualquier duda me dices. Gracias.`;
