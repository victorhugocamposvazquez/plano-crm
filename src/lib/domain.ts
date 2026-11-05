import type { RoomDraft, RoomImport } from "./captura/room-draft";
import { deltaManual } from "./stock";
import type { PlanDraft } from "./captura/plan-draft";
import { z } from "zod";
import type { Puesto } from "./puestos";
export const positionSchema = z.enum(["direccion", "oficina", "tienda", "facturacion", "materiales", "jefe_obra", "equipo"]);
const roleSchema = z.enum(["admin", "office", "manager", "site", "viewer"]);

export type Role = "admin" | "office" | "manager" | "site" | "viewer";
export type Actor = { id: string; name: string; role: Role; position: Puesto };
export type OrganizationMember = { user_id: string; display_name: string; position: Puesto; role: Role };
export type Project = { id: string; organization_id: string; code: string; name: string; client_name: string; location: string; kind: "integral" | "partial" | "carpentry"; status: "lead" | "estimating" | "planning" | "active" | "completed"; created_at: string };
export type Article = { id: string; organization_id: string; code: string; name: string; chapter: string; unit: string; unit_price: number; vat_rate: number;
  /** Almacén: solo los artículos que se guardan en la nave llevan existencias (ver `stock.ts`). Opcionales hasta aplicar la migración. */
  stocked?: boolean; stock_qty?: number; stock_min?: number | null; stock_location?: string };
export type Budget = { id: string; organization_id: string; project_id: string; title: string; approved_version_id: string | null; created_at: string };
export const itemSchema = z.object({
  id: z.uuid(), chapter: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(2000),
  quantity: z.number().min(0).max(1000000).multipleOf(0.001), unit: z.enum(["m²", "ml", "ud", "h", "global"]),
  unit_price: z.number().int().min(0).max(100000000), adjustment_percent: z.number().min(-50).max(100).multipleOf(0.01),
  vat_rate: z.number().min(0).max(30).multipleOf(0.01), inclusion: z.enum(["included", "optional", "excluded"])
});
export type BudgetItem = z.infer<typeof itemSchema>;
export type BudgetVersion = { id: string; organization_id: string; budget_id: string; number: number; status: "draft" | "issued" | "approved" | "superseded"; draft_revision: number; items: BudgetItem[]; notes: string; change_reason: string; created_by_name: string; created_at: string; updated_at: string; approved_at: string | null; approval_reference: string | null };
/** Cada guardado conserva cambios y fecha de servidor; las copias de versión no son ediciones. */
export type BudgetItemEdit = { item_id: string; version_id: string; draft_revision: number; kind: ItemChange["kind"]; fields: string[]; occurred_at: string; actor_name: string };
export type BudgetItemEvent = BudgetItemEdit & { id: string; organization_id: string; budget_id: string; actor_id: string; before_item?: BudgetItem; after_item?: BudgetItem };
/** Una subtarea: texto, hecha o no y, si Administración la ha asignado, a quién (operario o persona de la empresa). */
export type PuntoLista = { id: string; text: string; done: boolean; assignee?: string; assignee_id?: string | null; operario_id?: string | null };
export type Subtarea = PuntoLista;
export type Task = { id: string; organization_id: string; project_id: string; title: string; trade: string; assignee: string; assignee_id: string | null; operario_id?: string | null; due_date: string; status: "pending" | "done"; weight: number; description?: string; checklist?: PuntoLista[] };
/** Persona que trabaja en las obras, tenga o no cuenta en Plano: propia, autónoma o de una subcontrata. `trades` son categorías del catálogo que hace. */
/** Parte vivo de una tarea: el enlace con token que recibe un operario por WhatsApp y que funciona sin cuenta. */
export type ParteSnapshot = { direccion: string; notas: string; contacto: string; telefono: string; para: string; material: string[] };
export type TaskShare = { id: string; organization_id: string; task_id: string; operario_id: string | null; token: string; snapshot: ParteSnapshot; created_by_name: string; created_at: string; expires_at: string; revoked_at: string | null; done_at: string | null; seen_at: string | null; messages_count: number; photos_count: number };
export type Operario = { id: string; organization_id: string; name: string; phone: string; email: string; company: string; trades: string[]; hourly_cost: number | null; available: boolean; user_id: string | null; notes: string; created_at: string };
export type Purchase = { id: string; organization_id: string; project_id: string; name: string; supplier: string; assignee: string; assignee_id: string | null; quantity: number; received_quantity: number; delivered_quantity: number; unit: string; status: "planned" | "ordered" | "received" | "delivered"; article_id?: string | null };
/** Un cambio en las existencias de un artículo: `quantity` con signo y existencias después del cambio. */
export type StockMovement = { id: string; organization_id: string; article_id: string; project_id: string | null; purchase_id: string | null; kind: "entrada" | "salida" | "recuento" | "recepcion" | "a_obra"; quantity: number; stock_after: number; note: string; actor_name: string; created_at: string };
export type Document = { id: string; organization_id: string; project_id: string; name: string; category: "plan" | "contract" | "technical" | "before" | "during" | "after" | "other"; storage_path: string; mime_type: string; size_bytes: number; created_at: string };
export type Message = { id: string; organization_id: string; project_id: string; body: string; author_name: string; created_at: string; edited_at?: string | null; deleted_at?: string | null; reactions?: Record<string, string[]> | null };
export type Activity = { id: string; organization_id: string; project_id: string | null; text: string; actor_name: string; created_at: string };
export type Certification = { id: string; organization_id: string; project_id: string; budget_version_id: string; title: string; amount: number; status: "draft"; created_at: string };
/** Registro de factura: el número se asigna al enviarla, en serie anual sin huecos. No sustituye a la factura oficial. */
export type Invoice = { id: string; organization_id: string; project_id: string; certification_id: string | null; client_name: string; concept: string; base: number; vat_rate: number; tax: number; total: number; status: "draft" | "sent" | "paid"; number: string | null; number_year: number | null; number_seq: number | null; issue_date: string | null; due_date: string | null; paid_on: string | null; created_by_name: string; created_at: string; updated_at: string };
export type Workspace = { organization_id: string; organization_name: string; members: OrganizationMember[]; projects: Project[]; articles: Article[]; budgets: Budget[]; versions: BudgetVersion[]; tasks: Task[]; purchases: Purchase[]; documents: Document[]; messages: Message[]; activities: Activity[]; certifications: Certification[]; plan_captures?: PlanDraft[]; room_captures?: RoomDraft[]; room_imports?: RoomImport[]; budget_item_events?: BudgetItemEvent[]; invoices?: Invoice[]; stock_movements?: StockMovement[]; operarios?: Operario[]; task_shares?: TaskShare[] };

const text = z.string().trim().min(1).max(500);
/** Campos de la ficha de un operario. El teléfono admite espacios, «+» y guiones; el coste por hora va en céntimos. */
/** Lista de comprobación tal como llega en un comando: el id es opcional (los puntos nuevos lo reciben al guardar). */
const listaSchema = z.array(z.object({ id: z.string().max(40).optional(), text: z.string().trim().min(1).max(300), done: z.boolean().optional(), assignee_id: z.uuid().nullable().optional(), operario_id: z.uuid().nullable().optional() })).max(50);
const operarioCampos = {
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).regex(/^[0-9+()\s.-]*$/, "El teléfono solo admite números, espacios, «+» y guiones."),
  email: z.union([z.literal(""), z.email().max(200)]),
  company: z.string().trim().max(120),
  trades: z.array(z.string().trim().min(1).max(120)).max(20),
  hourly_cost: z.number().int().min(0).max(100000).nullable(),
  available: z.boolean(),
  user_id: z.uuid().nullable(),
  notes: z.string().trim().max(500)
};
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("member.invite"), email: z.email().trim().toLowerCase().max(254), position: positionSchema, role: roleSchema }),
  z.object({ type: z.literal("member.update"), user_id: z.uuid(), position: positionSchema, role: roleSchema }),
  z.object({ type: z.literal("member.remove"), user_id: z.uuid() }),
  z.object({ type: z.literal("project.create"), name: text, client_name: text, location: z.string().trim().max(500), kind: z.enum(["integral", "partial", "carpentry"]) }),
  z.object({ type: z.literal("project.status"), id: z.uuid(), status: z.enum(["lead", "estimating", "planning", "active", "completed"]) }),
  z.object({ type: z.literal("budget.create"), project_id: z.uuid(), title: text }),
  z.object({ type: z.literal("budget.revise"), version_id: z.uuid(), reason: text }),
  z.object({ type: z.literal("budget.save"), version_id: z.uuid(), expected_revision: z.number().int().min(0), items: z.array(itemSchema).max(500).refine(items => new Set(items.map(i => i.id)).size === items.length, "Hay partidas duplicadas").refine(items => items.reduce((s,i) => s + lineTotal(i) * 1.3, 0) <= Number.MAX_SAFE_INTEGER, "El presupuesto supera el límite de cálculo seguro"), notes: z.string().max(5000) }),
  z.object({ type: z.literal("budget.issue"), version_id: z.uuid(), expected_revision: z.number().int().min(0) }),
  z.object({ type: z.literal("budget.approve"), version_id: z.uuid(), reference: text }),
  z.object({ type: z.literal("article.create"), code: text, name: text, chapter: z.string().trim().min(1).max(120), unit: z.enum(["m²", "ml", "ud", "h", "global"]), unit_price: z.number().int().min(0).max(100000000), vat_rate: z.number().min(0).max(30).multipleOf(0.01), stocked: z.boolean().optional(), stock_min: z.number().min(0).max(1000000).nullable().optional(), stock_location: z.string().trim().max(120).optional() }),
  z.object({ type: z.literal("article.update"), id: z.uuid(), code: text.optional(), name: text.optional(), chapter: z.string().trim().min(1).max(120).optional(), unit: z.enum(["m²", "ml", "ud", "h", "global"]).optional(), unit_price: z.number().int().min(0).max(100000000).optional(), vat_rate: z.number().min(0).max(30).multipleOf(0.01).optional(), stocked: z.boolean().optional(), stock_min: z.number().min(0).max(1000000).nullable().optional(), stock_location: z.string().trim().max(120).optional() }),
  z.object({ type: z.literal("article.delete"), id: z.uuid() }),
  z.object({ type: z.literal("stock.move"), article_id: z.uuid(), kind: z.enum(["entrada", "salida", "recuento"]), quantity: z.number().min(0).max(1000000), note: z.string().trim().max(300).optional(), project_id: z.uuid().optional() }),
  z.object({ type: z.literal("task.create"), project_id: z.uuid(), title: text, trade: text, assignee: z.string().max(120).optional(), assignee_id: z.uuid().nullable().optional(), operario_id: z.uuid().nullable().optional(), due_date: z.iso.date(), weight: z.number().int().min(1).max(100), description: z.string().max(4000).optional(), checklist: listaSchema.optional() }),
  z.object({ type: z.literal("task.toggle"), id: z.uuid(), status: z.enum(["pending", "done"]) }),
  z.object({ type: z.literal("task.update"), id: z.uuid(), title: text.optional(), trade: text.optional(), assignee: z.string().max(120).optional(), assignee_id: z.uuid().nullable().optional(), operario_id: z.uuid().nullable().optional(), due_date: z.iso.date().optional(), weight: z.number().int().min(1).max(100).optional(), description: z.string().max(4000).optional(), checklist: listaSchema.optional() }),
  z.object({ type: z.literal("task.check"), id: z.uuid(), item_id: z.string().min(1).max(40), done: z.boolean() }),
  z.object({ type: z.literal("task.subassign"), id: z.uuid(), item_id: z.string().min(1).max(40), assignee_id: z.uuid().nullable().optional(), operario_id: z.uuid().nullable().optional() }),
  z.object({ type: z.literal("operario.create"), ...operarioCampos }),
  z.object({ type: z.literal("operario.update"), id: z.uuid(), ...Object.fromEntries(Object.entries(operarioCampos).map(([k, v]) => [k, v.optional()])) as { [K in keyof typeof operarioCampos]: z.ZodOptional<(typeof operarioCampos)[K]> } }),
  z.object({ type: z.literal("operario.delete"), id: z.uuid() }),
  z.object({ type: z.literal("parte.create"), id: z.uuid(), task_id: z.uuid(), operario_id: z.uuid().nullable().optional(), snapshot: z.object({ direccion: z.string().max(300), notas: z.string().max(800), contacto: z.string().max(120), telefono: z.string().max(40), para: z.string().max(120), material: z.array(z.string().max(160)).max(8) }) }),
  z.object({ type: z.literal("parte.revoke"), id: z.uuid() }),
  z.object({ type: z.literal("task.delete"), id: z.uuid() }),
  z.object({ type: z.literal("purchase.create"), project_id: z.uuid(), name: text, supplier: text, quantity: z.number().positive().max(1000000), unit: z.enum(["m²", "ml", "ud", "h", "global"]), article_id: z.uuid().nullable().optional() }),
  z.object({ type: z.literal("purchase.update"), id: z.uuid(), assignee_id: z.uuid().nullable().optional(), assignee: z.string().max(120).optional(), status: z.enum(["planned", "ordered", "received", "delivered"]).optional(), received_quantity: z.number().min(0).optional(), delivered_quantity: z.number().min(0).optional() }),
  z.object({ type: z.literal("message.send"), project_id: z.uuid(), body: z.string().trim().min(1).max(5000) }),
  z.object({ type: z.literal("message.edit"), id: z.uuid(), body: z.string().trim().min(1).max(5000) }),
  z.object({ type: z.literal("message.delete"), id: z.uuid() }),
  z.object({ type: z.literal("message.react"), id: z.uuid(), emoji: z.enum(["👍", "✅", "❤️", "👀", "🙏", "⚠️"]) }),
  z.object({ type: z.literal("document.add"), project_id: z.uuid(), name: text, category: z.enum(["plan", "contract", "technical", "before", "during", "after", "other"]), storage_path: text, mime_type: text, size_bytes: z.number().int().positive().max(52428800) }),
  z.object({ type: z.literal("certification.create"), project_id: z.uuid(), budget_version_id: z.uuid(), title: text, amount: z.number().int().positive().max(100000000) }),
  z.object({ type: z.literal("invoice.create"), project_id: z.uuid(), concept: text, base: z.number().int().positive().max(100000000), vat_rate: z.number().min(0).max(30).multipleOf(0.01), due_date: z.iso.date().nullable().optional(), certification_id: z.uuid().nullable().optional() }),
  z.object({ type: z.literal("invoice.update"), id: z.uuid(), concept: text.optional(), base: z.number().int().positive().max(100000000).optional(), vat_rate: z.number().min(0).max(30).multipleOf(0.01).optional(), due_date: z.iso.date().nullable().optional() }),
  z.object({ type: z.literal("invoice.delete"), id: z.uuid() }),
  z.object({ type: z.literal("invoice.send"), id: z.uuid(), due_date: z.iso.date() }),
  z.object({ type: z.literal("invoice.pay"), id: z.uuid(), paid_on: z.iso.date() }),
  z.object({ type: z.literal("invoice.unpay"), id: z.uuid() })
]);
export type Command = z.infer<typeof commandSchema>;
export const roleNames: Record<Role, string> = { admin: "Administración", office: "Oficina", manager: "Jefe de obra", site: "Equipo de obra", viewer: "Consulta" };
export const projectStatus = { lead: "Visita", estimating: "Presupuesto", planning: "Obra · planificando", active: "Obra", completed: "Entregado" };
export const kindNames = { integral: "Reforma integral", partial: "Reforma parcial", carpentry: "Carpintería" };
export const versionStatus = { draft: "Borrador", issued: "Enviado", approved: "Aceptado", superseded: "Archivada" };
export const purchaseStatus = { planned: "Por pedir", ordered: "Pedido", received: "Recibido", delivered: "En obra" };
export const money = (cents: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" }).format(cents / 100);
export const dateLabel = (value: string) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value));
function roundRatio(numerator: bigint, denominator: bigint) {
  const rounded = Number((numerator + denominator / 2n) / denominator);
  if (!Number.isSafeInteger(rounded)) throw new Error("Importe fuera del rango de cálculo seguro.");
  return rounded;
}
// Cantidad en milésimas y porcentajes en centésimas: mismo redondeo decimal que PostgreSQL.
export const lineTotal = (item: BudgetItem) => roundRatio(BigInt(Math.round(item.quantity * 1000)) * BigInt(item.unit_price) * BigInt(10000 + Math.round(item.adjustment_percent * 100)), 10000000n);
export function totals(items: BudgetItem[]) {
  const included = items.filter(i => i.inclusion === "included");
  const base = included.reduce((sum, i) => sum + lineTotal(i), 0);
  const tax = included.reduce((sum, i) => sum + roundRatio(BigInt(lineTotal(i)) * BigInt(Math.round(i.vat_rate * 100)), 10000n), 0);
  if (!Number.isSafeInteger(base + tax)) throw new Error("Importe fuera del rango de cálculo seguro.");
  return { base, tax, total: base + tax };
}
export function projectProgress(state: Workspace, id: string) {
  const tasks = state.tasks.filter(t => t.project_id === id);
  const total = tasks.reduce((s, t) => s + t.weight, 0);
  return total ? Math.round(100 * tasks.filter(t => t.status === "done").reduce((s, t) => s + t.weight, 0) / total) : 0;
}
export type ItemChange = { id: string; kind: "added" | "removed" | "changed"; before?: BudgetItem; after?: BudgetItem; fields: string[]; delta: number };
const trackedFields: (keyof BudgetItem)[] = ["chapter", "description", "quantity", "unit", "unit_price", "adjustment_percent", "vat_rate", "inclusion"];
export const fieldNames: Record<string, string> = { chapter: "Capítulo", description: "Descripción / material", quantity: "Cantidad", unit: "Unidad", unit_price: "Precio unitario", adjustment_percent: "Recargo o descuento", vat_rate: "IVA", inclusion: "Entra en el precio" };
export function compareVersions(before: BudgetVersion, after: BudgetVersion): ItemChange[] {
  const old = new Map(before.items.map(i => [i.id, i])); const current = new Map(after.items.map(i => [i.id, i]));
  return [...new Set([...old.keys(), ...current.keys()])].flatMap(id => {
    const a = old.get(id), b = current.get(id);
    const fields = a && b ? trackedFields.filter(k => a[k] !== b[k]) : [];
    if (a && b && !fields.length) return [];
    return [{ id, kind: !a ? "added" as const : !b ? "removed" as const : "changed" as const, before: a, after: b, fields, delta: (b?.inclusion === "included" ? lineTotal(b) : 0) - (a?.inclusion === "included" ? lineTotal(a) : 0) }];
  });
}
export const impuestoFactura = (base: number, vatRate: number) => roundRatio(BigInt(base) * BigInt(Math.round(vatRate * 100)), 10000n);
export function can(role: Role, action: Command["type"]) {
  if (action.startsWith("member.") || action === "task.subassign") return role === "admin";
  if (role === "viewer") return false;
  if (role === "site") return ["task.toggle", "task.check", "message.send", "message.edit", "message.delete", "message.react", "document.add", "purchase.update"].includes(action);
  if (action === "budget.approve" || action === "certification.create" || action.startsWith("invoice.")) return role === "admin" || role === "office";
  return true;
}

/** The demo uses the same command contract as the authenticated PostgreSQL RPC. */
export function applyCommand(previous: Workspace, input: Command, actor: Actor, now = new Date().toISOString(), uuid = () => crypto.randomUUID()): Workspace {
  const command = commandSchema.parse(input);
  if (!can(actor.role, command.type)) throw new Error("Tu perfil no tiene permiso para esta acción.");
  const state = structuredClone(previous), org = state.organization_id;
  let projectId: string | null = "project_id" in command ? command.project_id ?? null : null;
  if (projectId && !state.projects.some(p => p.id === projectId)) throw new Error("Proyecto no encontrado.");
  const version = (id: string) => { const v = state.versions.find(v => v.id === id); if (!v) throw new Error("Revisión no encontrada."); const b = state.budgets.find(b => b.id === v.budget_id)!; projectId = b.project_id; return { v, b }; };
  const newVersion = (budgetId: string, number: number, items: BudgetItem[], reason: string): BudgetVersion => ({ id: uuid(), organization_id: org, budget_id: budgetId, number, status: "draft", draft_revision: 0, items, notes: "", change_reason: reason, created_by_name: actor.name, created_at: now, updated_at: now, approved_at: null, approval_reference: null });
  // A quién va una subtarea: un operario (con su cuenta si la tiene) o una persona de la empresa. Solo lo decide Administración.
  const asignarSubtarea = (p: { assignee_id?: string | null; operario_id?: string | null }): Pick<PuntoLista, "assignee" | "assignee_id" | "operario_id"> => {
    if (p.operario_id) { const o = (state.operarios ?? []).find(x => x.id === p.operario_id); if (!o) throw new Error("Ese operario no está en el equipo."); return { operario_id: o.id, assignee: o.name, ...(o.user_id && state.members.some(m => m.user_id === o.user_id) ? { assignee_id: o.user_id } : {}) }; }
    if (p.assignee_id) { const m = state.members.find(x => x.user_id === p.assignee_id); if (!m) throw new Error("La persona no pertenece a esta empresa."); return { assignee_id: m.user_id, assignee: m.display_name }; }
    return {};
  };
  const asigna = actor.role === "admin";
  const normalizarLista = (l: z.infer<typeof listaSchema> | undefined, previo: PuntoLista[] = []): PuntoLista[] => (l ?? []).map(p => {
    const id = p.id?.trim() || uuid(), antes = previo.find(x => x.id === id);
    const quien = asigna ? asignarSubtarea(p) : antes ? Object.fromEntries(Object.entries({ operario_id: antes.operario_id, assignee_id: antes.assignee_id, assignee: antes.assignee }).filter(([, v]) => v)) : {};
    return { id, text: p.text.trim(), done: p.done ?? false, ...quien };
  });
  // Responsable de una tarea: una persona con cuenta (assignee_id), un operario de la ficha (operario_id) o un nombre libre.
  const assignment = (input: { assignee_id?: string | null; assignee?: string; operario_id?: string | null }, current: { assignee_id: string | null; assignee: string; operario_id?: string | null } = { assignee_id: null, assignee: "", operario_id: null }) => {
    if (input.operario_id) { const o = (state.operarios ?? []).find(x => x.id === input.operario_id); if (!o) throw new Error("Ese operario no está en el equipo."); return { assignee_id: o.user_id && state.members.some(m => m.user_id === o.user_id) ? o.user_id : null, assignee: o.name, operario_id: o.id }; }
    if (input.assignee_id) { const member = state.members.find(m => m.user_id === input.assignee_id); if (!member) throw new Error("La persona no pertenece a esta empresa."); return { assignee_id: member.user_id, assignee: member.display_name, operario_id: null }; }
    if (input.assignee_id === null || input.operario_id === null || input.assignee !== undefined) return { assignee_id: null, assignee: input.assignee ?? "", operario_id: null };
    return { ...current, operario_id: current.operario_id ?? null };
  };
  let activity = "";
  switch (command.type) {
    case "member.invite": throw new Error("La demostración no envía invitaciones. El alta se realiza en Supabase Auth.");
    case "member.update": {
      const member = state.members.find(m => m.user_id === command.user_id); if (!member) throw new Error("Persona no encontrada.");
      if (member.role === "admin" && command.role !== "admin" && state.members.filter(m => m.role === "admin").length <= 1) throw new Error("La empresa debe conservar al menos una persona administradora.");
      member.role = command.role; member.position = command.position; activity = `Puesto y permiso actualizados: ${member.display_name}`; break;
    }
    case "member.remove": {
      const member = state.members.find(m => m.user_id === command.user_id); if (!member) throw new Error("Persona no encontrada.");
      if (member.user_id === actor.id) throw new Error("No puedes quitarte a ti mismo del equipo.");
      if (member.role === "admin" && state.members.filter(m => m.role === "admin").length <= 1) throw new Error("La empresa debe conservar al menos una persona administradora.");
      state.tasks.forEach(t => { if(t.assignee_id === member.user_id)t.assignee_id = null; });
      state.purchases.forEach(p => { if(p.assignee_id === member.user_id)p.assignee_id = null; });
      state.members = state.members.filter(m => m.user_id !== member.user_id); activity = `Persona retirada del equipo: ${member.display_name}`; break;
    }
    case "project.create": {
      projectId = uuid();
      state.projects.unshift({ id: projectId, organization_id: org, code: `PL-${String(state.projects.length + 1).padStart(3, "0")}`, name: command.name, client_name: command.client_name, location: command.location, kind: command.kind, status: "lead", created_at: now });
      activity = `Proyecto creado: ${command.name}`; break;
    }
    case "project.status": {
      const p = state.projects.find(p => p.id === command.id); if (!p) throw new Error("Proyecto no encontrado.");
      p.status = command.status; projectId = p.id; activity = `Estado del proyecto: ${projectStatus[p.status]}`; break;
    }
    case "budget.create": {
      const id = uuid(); state.budgets.push({ id, organization_id: org, project_id: command.project_id, title: command.title, approved_version_id: null, created_at: now });
      state.versions.push(newVersion(id, 1, [], "Presupuesto inicial")); activity = `Presupuesto creado: ${command.title}`; break;
    }
    case "budget.revise": {
      const { v, b } = version(command.version_id);
      if (state.versions.some(x => x.budget_id === b.id && x.status === "draft")) throw new Error("Ya hay un borrador abierto. Continúa esa revisión.");
      const next = newVersion(b.id, Math.max(...state.versions.filter(x => x.budget_id === b.id).map(x => x.number)) + 1, structuredClone(v.items), command.reason);
      next.notes = v.notes; state.versions.push(next); activity = `V${next.number} creada desde V${v.number}: ${command.reason}`; break;
    }
    case "budget.save": {
      const { v } = version(command.version_id);
      if (v.status !== "draft") throw new Error("Esta revisión está cerrada. Crea una nueva versión.");
      if (v.draft_revision !== command.expected_revision) throw new Error("Otra persona ha actualizado el borrador. Recarga antes de guardar.");
      const edits = compareVersions(v, { ...v, items: command.items });
      if (edits.length) state.budget_item_events = [...(state.budget_item_events ?? []), ...edits.map(change => ({
        id: uuid(), organization_id: org, budget_id: v.budget_id, version_id: v.id,
        item_id: change.id, draft_revision: v.draft_revision + 1, kind: change.kind, fields: change.kind === "changed" ? change.fields : [...trackedFields],
        before_item: change.before, after_item: change.after, occurred_at: now, actor_id: actor.id, actor_name: actor.name,
      }))];
      v.items = command.items; v.notes = command.notes; v.draft_revision++; v.updated_at = now; activity = `Borrador V${v.number} guardado`; break;
    }
    case "budget.issue": {
      const { v } = version(command.version_id);
      if (v.status !== "draft" || v.draft_revision !== command.expected_revision) throw new Error("La revisión ha cambiado. Recarga antes de cerrarla.");
      if (!v.items.some(i => i.inclusion === "included" && i.quantity > 0)) throw new Error("Añade al menos una partida incluida con cantidad positiva.");
      v.status = "issued"; v.updated_at = now; activity = `V${v.number} cerrada para revisión`; break;
    }
    case "budget.approve": {
      const { v, b } = version(command.version_id);
      if (v.status !== "issued") throw new Error("Primero cierra la revisión antes de aprobarla.");
      const reserved = state.certifications.filter(c => state.versions.find(x => x.id === c.budget_version_id)?.budget_id === b.id).reduce((s,c) => s + c.amount,0);
      if (totals(v.items).base < reserved) throw new Error("La revisión es inferior al importe ya reservado en certificaciones.");
      const old = state.versions.find(x => x.id === b.approved_version_id);
      if (old) old.status = "superseded";
      v.status = "approved"; v.approval_reference = command.reference; v.approved_at = now; v.updated_at = now; b.approved_version_id = v.id;
      activity = `V${v.number} aprobada para obra · ${command.reference}`; break;
    }
    case "article.create": {
      if (state.articles.some(a => a.code.toLowerCase() === command.code.toLowerCase())) throw new Error("Ya existe un artículo con esa referencia.");
      const { type: _, ...fields } = command; void _;
      state.articles.push({ id: uuid(), organization_id: org, ...fields, stocked: command.stocked ?? false, stock_qty: 0, stock_min: command.stock_min ?? null, stock_location: command.stock_location ?? "" }); activity = `Artículo creado: ${command.name}`; break;
    }
    case "article.update": {
      const a = state.articles.find(a => a.id === command.id); if (!a) throw new Error("Artículo no encontrado.");
      if (command.code && state.articles.some(x => x.id !== a.id && x.code.toLowerCase() === command.code!.toLowerCase())) throw new Error("Ya existe un artículo con esa referencia.");
      const { type: _, id: __, ...cambios } = command; void _; void __;
      Object.assign(a, Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined)));
      activity = `Artículo actualizado: ${a.name}`; break;
    }
    case "article.delete": {
      const a = state.articles.find(a => a.id === command.id); if (!a) throw new Error("Artículo no encontrado.");
      state.articles = state.articles.filter(x => x.id !== command.id);
      // Sus movimientos de almacén se van con él; los pedidos se quedan sin vínculo, con su nombre.
      state.stock_movements = (state.stock_movements ?? []).filter(m => m.article_id !== a.id);
      for (const p of state.purchases) if (p.article_id === a.id) p.article_id = null;
      activity = `Artículo eliminado: ${a.name}`; break;
    }
    case "stock.move": {
      const a = state.articles.find(a => a.id === command.article_id); if (!a) throw new Error("Artículo no encontrado.");
      if (!a.stocked) throw new Error("Este artículo no se guarda en almacén.");
      const delta = deltaManual(command.kind, command.quantity, a.stock_qty ?? 0);
      a.stock_qty = Math.round(((a.stock_qty ?? 0) + delta) * 1000) / 1000;
      (state.stock_movements ??= []).push({ id: uuid(), organization_id: org, article_id: a.id, project_id: command.project_id ?? null, purchase_id: null, kind: command.kind, quantity: delta, stock_after: a.stock_qty, note: command.note ?? "", actor_name: actor.name, created_at: now });
      activity = `Almacén · ${a.name}: ${command.kind === "recuento" ? `recuento, ${a.stock_qty} ${a.unit}` : `${command.kind} de ${command.quantity} ${a.unit}`}`; break;
    }
    case "operario.create": {
      const { type: _, ...campos } = command; void _;
      if (campos.user_id && !state.members.some(m => m.user_id === campos.user_id)) throw new Error("Esa cuenta no pertenece a esta empresa.");
      (state.operarios ??= []).push({ id: uuid(), organization_id: org, ...campos, created_at: now }); activity = `Operario añadido: ${campos.name}`; break;
    }
    case "operario.update": {
      const o = (state.operarios ?? []).find(x => x.id === command.id); if (!o) throw new Error("Operario no encontrado.");
      const { type: _, id: __, ...cambios } = command; void _; void __;
      if (cambios.user_id && !state.members.some(m => m.user_id === cambios.user_id)) throw new Error("Esa cuenta no pertenece a esta empresa.");
      Object.assign(o, Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined)));
      // Las tareas que tiene asignadas siguen con su nombre al día.
      for (const t of state.tasks) if (t.operario_id === o.id) t.assignee = o.name;
      activity = `Operario actualizado: ${o.name}`; break;
    }
    case "operario.delete": {
      const o = (state.operarios ?? []).find(x => x.id === command.id); if (!o) throw new Error("Operario no encontrado.");
      state.operarios = (state.operarios ?? []).filter(x => x.id !== o.id);
      // Sus tareas se quedan con el nombre escrito, sin vínculo.
      for (const t of state.tasks) if (t.operario_id === o.id) t.operario_id = null;
      activity = `Operario dado de baja: ${o.name}`; break;
    }
    case "parte.create": {
      const t = state.tasks.find(x => x.id === command.task_id); if (!t) throw new Error("Tarea no encontrada.");
      if (command.operario_id && !(state.operarios ?? []).some(o => o.id === command.operario_id)) throw new Error("Ese operario no está en el equipo.");
      const token = (uuid() + uuid()).replace(/-/g, "").toLowerCase();
      const caduca = new Date(now); caduca.setDate(caduca.getDate() + 30);
      (state.task_shares ??= []).push({ id: command.id, organization_id: org, task_id: t.id, operario_id: command.operario_id ?? null, token, snapshot: command.snapshot, created_by_name: actor.name, created_at: now, expires_at: caduca.toISOString(), revoked_at: null, done_at: null, seen_at: null, messages_count: 0, photos_count: 0 });
      projectId = t.project_id; activity = `Tarea enviada por WhatsApp: ${t.title}`; break;
    }
    case "parte.revoke": {
      const sh = (state.task_shares ?? []).find(x => x.id === command.id && !x.revoked_at); if (!sh) throw new Error("Envío no encontrado.");
      sh.revoked_at = now; const t = state.tasks.find(x => x.id === sh.task_id); projectId = t?.project_id ?? null; activity = `Enlace anulado: ${t?.title ?? ""}`; break;
    }
    case "task.create": {
      const { type: _, ...fields } = command; void _;
      state.tasks.push({ id: uuid(), organization_id: org, ...fields, ...assignment(command), description: (command.description ?? "").trim(), checklist: normalizarLista(command.checklist), status: "pending" }); activity = `Tarea planificada: ${command.title}`; break;
    }
    case "task.check": {
      const t = state.tasks.find(x => x.id === command.id); if (!t) throw new Error("Tarea no encontrada.");
      const punto = (t.checklist ?? []).find(p => p.id === command.item_id); if (!punto) throw new Error("Esa subtarea ya no existe.");
      punto.done = command.done; projectId = t.project_id; activity = `${command.done ? "Subtarea hecha" : "Subtarea reabierta"} en «${t.title}»: ${punto.text}`; break;
    }
    case "task.subassign": {
      const t = state.tasks.find(x => x.id === command.id); if (!t) throw new Error("Tarea no encontrada.");
      const i = (t.checklist ?? []).findIndex(p => p.id === command.item_id); if (i < 0) throw new Error("Esa subtarea ya no existe.");
      const { assignee: _a, assignee_id: _b, operario_id: _c, ...resto } = t.checklist![i]; void _a; void _b; void _c;
      const quien = asignarSubtarea(command);
      t.checklist![i] = { ...resto, ...quien };
      projectId = t.project_id; activity = `Subtarea de «${t.title}» ${quien.assignee ? `asignada a ${quien.assignee}` : "sin asignar"}: ${resto.text}`; break;
    }
    case "task.toggle": {
      const t = state.tasks.find(t => t.id === command.id); if (!t) throw new Error("Tarea no encontrada."); t.status = command.status; projectId = t.project_id; activity = `${t.status === "done" ? "Completada" : "Reabierta"}: ${t.title}`; break;
    }
    case "task.update": {
      const t = state.tasks.find(t => t.id === command.id); if (!t) throw new Error("Tarea no encontrada.");
      const assigned = assignment(command, { assignee_id: t.assignee_id, assignee: t.assignee, operario_id: t.operario_id ?? null });
      const subtareasAntes = t.checklist ?? [];
      const { type: _, id: __, ...cambios } = command; void _; void __;
      Object.assign(t, Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined)));
      Object.assign(t, assigned);
      if (command.description !== undefined) t.description = command.description.trim();
      if (command.checklist !== undefined) t.checklist = normalizarLista(command.checklist, subtareasAntes);
      projectId = t.project_id; activity = `Tarea actualizada: ${t.title}`; break;
    }
    case "task.delete": {
      const t = state.tasks.find(t => t.id === command.id); if (!t) throw new Error("Tarea no encontrada.");
      state.tasks = state.tasks.filter(x => x.id !== command.id); projectId = t.project_id; activity = `Tarea eliminada: ${t.title}`; break;
    }
    case "purchase.create": {
      const { type: _, ...fields } = command; void _;
      if (command.article_id) { const a = state.articles.find(a => a.id === command.article_id); if (!a) throw new Error("Artículo no encontrado."); if (a.unit !== command.unit) throw new Error(`El artículo se mide en ${a.unit}: el pedido también.`); }
      state.purchases.push({ id: uuid(), organization_id: org, ...fields, article_id: command.article_id ?? null, assignee: "", assignee_id: null, received_quantity: 0, delivered_quantity: 0, status: "planned" }); activity = `Material añadido: ${command.name}`; break;
    }
    case "purchase.update": {
      const p = state.purchases.find(p => p.id === command.id); if (!p) throw new Error("Pedido no encontrado.");
      const received = command.received_quantity ?? p.received_quantity, delivered = command.delivered_quantity ?? p.delivered_quantity, status = command.status ?? p.status;
      if (received > p.quantity || delivered > received) throw new Error("Las cantidades entregadas no pueden superar las recibidas, ni estas las pedidas.");
      if ((status === "planned" && received !== 0) || (status === "received" && received !== p.quantity) || (status === "delivered" && delivered !== p.quantity)) throw new Error("El estado no coincide con las cantidades recibidas o entregadas.");
      const { operario_id: _sinOperario, ...asignado } = assignment(command, p); void _sinOperario;
      Object.assign(p, asignado);
      // Pedido ligado a un artículo de almacén: lo recibido entra en la nave y lo llevado a obra sale.
      const art = p.article_id ? state.articles.find(a => a.id === p.article_id) : undefined;
      if (art?.stocked) {
        for (const [kind, delta] of [["recepcion", received - p.received_quantity], ["a_obra", -(delivered - p.delivered_quantity)]] as const) {
          if (!delta) continue;
          art.stock_qty = Math.round(((art.stock_qty ?? 0) + delta) * 1000) / 1000;
          (state.stock_movements ??= []).push({ id: uuid(), organization_id: org, article_id: art.id, project_id: p.project_id, purchase_id: p.id, kind, quantity: delta, stock_after: art.stock_qty, note: "", actor_name: actor.name, created_at: now });
        }
      }
      p.status = status; p.received_quantity = received; p.delivered_quantity = delivered; projectId = p.project_id; activity = `${p.name}: ${purchaseStatus[p.status]}`; break;
    }
    case "message.send": state.messages.push({ id: uuid(), organization_id: org, project_id: command.project_id, body: command.body, author_name: actor.name, created_at: now }); activity = "Mensaje en la conversación del proyecto"; break;
    case "message.edit": {
      const m = state.messages.find(x => x.id === command.id); if (!m || m.deleted_at) throw new Error("Mensaje no encontrado.");
      if (m.author_name !== actor.name) throw new Error("Solo quien escribió el mensaje puede editarlo.");
      m.body = command.body; m.edited_at = now; projectId = m.project_id; activity = "Mensaje editado en la conversación"; break;
    }
    case "message.delete": {
      const m = state.messages.find(x => x.id === command.id); if (!m || m.deleted_at) throw new Error("Mensaje no encontrado.");
      if (m.author_name !== actor.name && actor.role !== "admin" && actor.role !== "office") throw new Error("Solo quien escribió el mensaje, oficina o administración pueden borrarlo.");
      m.deleted_at = now; m.body = ""; projectId = m.project_id; activity = "Mensaje eliminado de la conversación"; break;
    }
    case "message.react": {
      const m = state.messages.find(x => x.id === command.id); if (!m || m.deleted_at) throw new Error("Mensaje no encontrado.");
      const reactions = { ...(m.reactions ?? {}) }; const quienes = reactions[command.emoji] ?? [];
      reactions[command.emoji] = quienes.includes(actor.name) ? quienes.filter(q => q !== actor.name) : [...quienes, actor.name];
      if (!reactions[command.emoji].length) delete reactions[command.emoji];
      m.reactions = reactions; projectId = m.project_id; activity = `Reacción ${command.emoji} en la conversación`; break;
    }
    case "document.add": {
      const { type: _, ...fields } = command; void _;
      if (!command.storage_path.startsWith(`${org}/${command.project_id}/`)) throw new Error("Ruta de archivo no válida.");
      state.documents.push({ id: uuid(), organization_id: org, ...fields, created_at: now }); activity = `Documento añadido: ${command.name}`; break;
    }
    case "certification.create": {
      const { v, b } = version(command.budget_version_id);
      if (b.project_id !== command.project_id || b.approved_version_id !== v.id) throw new Error("Selecciona el presupuesto aprobado vigente del proyecto.");
      const already = state.certifications.filter(c => state.versions.find(x => x.id === c.budget_version_id)?.budget_id === b.id).reduce((s, c) => s + c.amount, 0);
      if (already + command.amount > totals(v.items).base) throw new Error("El importe supera el saldo del presupuesto aprobado.");
      state.certifications.push({ id: uuid(), organization_id: org, project_id: command.project_id, budget_version_id: v.id, title: command.title, amount: command.amount, status: "draft", created_at: now }); activity = `Borrador de certificación: ${command.title}`; break;
    }
    case "invoice.create": {
      const facturas = state.invoices ?? (state.invoices = []);
      let base = command.base;
      if (command.certification_id) {
        const cert = state.certifications.find(c => c.id === command.certification_id && c.project_id === command.project_id);
        if (!cert) throw new Error("Cobro no encontrado.");
        if (facturas.some(f => f.certification_id === cert.id)) throw new Error("Ese cobro ya tiene factura.");
        base = cert.amount;
      }
      const tax = impuestoFactura(base, command.vat_rate);
      facturas.push({ id: uuid(), organization_id: org, project_id: command.project_id, certification_id: command.certification_id ?? null, client_name: state.projects.find(p => p.id === command.project_id)!.client_name, concept: command.concept, base, vat_rate: command.vat_rate, tax, total: base + tax, status: "draft", number: null, number_year: null, number_seq: null, issue_date: null, due_date: command.due_date ?? null, paid_on: null, created_by_name: actor.name, created_at: now, updated_at: now });
      activity = `Factura en borrador: ${command.concept}`; break;
    }
    case "invoice.update": {
      const f = (state.invoices ?? []).find(x => x.id === command.id); if (!f) throw new Error("Factura no encontrada.");
      if (f.status !== "draft") throw new Error("Una factura enviada no se edita.");
      if (f.certification_id && command.base !== undefined && command.base !== f.base) throw new Error("El importe sale del cobro preparado.");
      if (command.concept !== undefined) f.concept = command.concept;
      if (command.base !== undefined) f.base = command.base;
      if (command.vat_rate !== undefined) f.vat_rate = command.vat_rate;
      if (command.due_date !== undefined) f.due_date = command.due_date;
      f.tax = impuestoFactura(f.base, f.vat_rate); f.total = f.base + f.tax; f.updated_at = now; projectId = f.project_id;
      activity = `Factura en borrador actualizada: ${f.concept}`; break;
    }
    case "invoice.delete": {
      const f = (state.invoices ?? []).find(x => x.id === command.id); if (!f) throw new Error("Factura no encontrada.");
      if (f.status !== "draft") throw new Error("Una factura enviada no se borra: el número debe quedar registrado.");
      state.invoices = state.invoices!.filter(x => x.id !== f.id); projectId = f.project_id;
      activity = `Factura en borrador eliminada: ${f.concept}`; break;
    }
    case "invoice.send": {
      const f = (state.invoices ?? []).find(x => x.id === command.id); if (!f) throw new Error("Factura no encontrada.");
      if (f.status !== "draft") throw new Error("Esta factura ya está enviada.");
      const hoy = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date(now));
      if (command.due_date < hoy) throw new Error("El vencimiento no puede ser anterior a hoy.");
      const year = Number(hoy.slice(0, 4)), seq = Math.max(0, ...state.invoices!.filter(x => x.number_year === year).map(x => x.number_seq ?? 0)) + 1;
      f.status = "sent"; f.number_year = year; f.number_seq = seq; f.number = `${year}-${String(seq).padStart(4, "0")}`; f.issue_date = hoy; f.due_date = command.due_date; f.updated_at = now; projectId = f.project_id;
      activity = `Factura ${f.number} enviada: ${f.concept}`; break;
    }
    case "invoice.pay": {
      const f = (state.invoices ?? []).find(x => x.id === command.id); if (!f) throw new Error("Factura no encontrada.");
      if (f.status !== "sent") throw new Error("Solo se cobra una factura enviada.");
      f.status = "paid"; f.paid_on = command.paid_on; f.updated_at = now; projectId = f.project_id;
      activity = `Factura ${f.number} cobrada`; break;
    }
    case "invoice.unpay": {
      const f = (state.invoices ?? []).find(x => x.id === command.id); if (!f) throw new Error("Factura no encontrada.");
      if (f.status !== "paid") throw new Error("Esta factura no está cobrada.");
      f.status = "sent"; f.paid_on = null; f.updated_at = now; projectId = f.project_id;
      activity = `Factura ${f.number} vuelve a pendiente de cobro`; break;
    }
  }
  state.activities.unshift({ id: uuid(), organization_id: org, project_id: projectId, text: activity, actor_name: actor.name, created_at: now });
  return state;
}
