import type { RoomDraft, RoomImport } from "./captura/room-draft";
import { z } from "zod";

export type Role = "admin" | "office" | "manager" | "site" | "viewer";
export type Actor = { id: string; name: string; role: Role };
export type Project = { id: string; organization_id: string; code: string; name: string; client_name: string; location: string; kind: "integral" | "partial" | "carpentry"; status: "lead" | "estimating" | "planning" | "active" | "completed"; created_at: string };
export type Article = { id: string; organization_id: string; code: string; name: string; chapter: string; unit: string; unit_price: number; vat_rate: number };
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
export type Task = { id: string; organization_id: string; project_id: string; title: string; trade: string; assignee: string; due_date: string; status: "pending" | "done"; weight: number };
export type Purchase = { id: string; organization_id: string; project_id: string; name: string; supplier: string; quantity: number; received_quantity: number; delivered_quantity: number; unit: string; status: "planned" | "ordered" | "received" | "delivered" };
export type Document = { id: string; organization_id: string; project_id: string; name: string; category: "plan" | "contract" | "technical" | "before" | "during" | "after" | "other"; storage_path: string; mime_type: string; size_bytes: number; created_at: string };
export type Message = { id: string; organization_id: string; project_id: string; body: string; author_name: string; created_at: string; edited_at?: string | null; deleted_at?: string | null; reactions?: Record<string, string[]> | null };
export type Activity = { id: string; organization_id: string; project_id: string | null; text: string; actor_name: string; created_at: string };
export type Certification = { id: string; organization_id: string; project_id: string; budget_version_id: string; title: string; amount: number; status: "draft"; created_at: string };
/** Registro de factura: el número se asigna al enviarla, en serie anual sin huecos. No sustituye a la factura oficial. */
export type Invoice = { id: string; organization_id: string; project_id: string; certification_id: string | null; client_name: string; concept: string; base: number; vat_rate: number; tax: number; total: number; status: "draft" | "sent" | "paid"; number: string | null; number_year: number | null; number_seq: number | null; issue_date: string | null; due_date: string | null; paid_on: string | null; created_by_name: string; created_at: string; updated_at: string };
export type Workspace = { organization_id: string; organization_name: string; projects: Project[]; articles: Article[]; budgets: Budget[]; versions: BudgetVersion[]; tasks: Task[]; purchases: Purchase[]; documents: Document[]; messages: Message[]; activities: Activity[]; certifications: Certification[]; room_captures?: RoomDraft[]; room_imports?: RoomImport[]; budget_item_events?: BudgetItemEvent[]; invoices?: Invoice[] };

const text = z.string().trim().min(1).max(500);
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("project.create"), name: text, client_name: text, location: z.string().trim().max(500), kind: z.enum(["integral", "partial", "carpentry"]) }),
  z.object({ type: z.literal("project.status"), id: z.uuid(), status: z.enum(["lead", "estimating", "planning", "active", "completed"]) }),
  z.object({ type: z.literal("budget.create"), project_id: z.uuid(), title: text }),
  z.object({ type: z.literal("budget.revise"), version_id: z.uuid(), reason: text }),
  z.object({ type: z.literal("budget.save"), version_id: z.uuid(), expected_revision: z.number().int().min(0), items: z.array(itemSchema).max(500).refine(items => new Set(items.map(i => i.id)).size === items.length, "Hay partidas duplicadas").refine(items => items.reduce((s,i) => s + lineTotal(i) * 1.3, 0) <= Number.MAX_SAFE_INTEGER, "El presupuesto supera el límite de cálculo seguro"), notes: z.string().max(5000) }),
  z.object({ type: z.literal("budget.issue"), version_id: z.uuid(), expected_revision: z.number().int().min(0) }),
  z.object({ type: z.literal("budget.approve"), version_id: z.uuid(), reference: text }),
  z.object({ type: z.literal("article.create"), code: text, name: text, chapter: z.string().trim().min(1).max(120), unit: z.enum(["m²", "ml", "ud", "h", "global"]), unit_price: z.number().int().min(0).max(100000000), vat_rate: z.number().min(0).max(30).multipleOf(0.01) }),
  z.object({ type: z.literal("article.update"), id: z.uuid(), code: text.optional(), name: text.optional(), chapter: z.string().trim().min(1).max(120).optional(), unit: z.enum(["m²", "ml", "ud", "h", "global"]).optional(), unit_price: z.number().int().min(0).max(100000000).optional(), vat_rate: z.number().min(0).max(30).multipleOf(0.01).optional() }),
  z.object({ type: z.literal("article.delete"), id: z.uuid() }),
  z.object({ type: z.literal("task.create"), project_id: z.uuid(), title: text, trade: text, assignee: z.string().max(120), due_date: z.iso.date(), weight: z.number().int().min(1).max(100) }),
  z.object({ type: z.literal("task.toggle"), id: z.uuid(), status: z.enum(["pending", "done"]) }),
  z.object({ type: z.literal("task.update"), id: z.uuid(), title: text.optional(), trade: text.optional(), assignee: z.string().max(120).optional(), due_date: z.iso.date().optional(), weight: z.number().int().min(1).max(100).optional() }),
  z.object({ type: z.literal("task.delete"), id: z.uuid() }),
  z.object({ type: z.literal("purchase.create"), project_id: z.uuid(), name: text, supplier: text, quantity: z.number().positive().max(1000000), unit: z.enum(["m²", "ml", "ud", "h", "global"]) }),
  z.object({ type: z.literal("purchase.update"), id: z.uuid(), status: z.enum(["planned", "ordered", "received", "delivered"]), received_quantity: z.number().min(0), delivered_quantity: z.number().min(0) }),
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
  if (role === "viewer") return false;
  if (role === "site") return ["task.toggle", "message.send", "message.edit", "message.delete", "message.react", "document.add", "purchase.update"].includes(action);
  if (action === "budget.approve" || action === "certification.create" || action.startsWith("invoice.")) return role === "admin" || role === "office";
  return true;
}

/** The demo uses the same command contract as the authenticated PostgreSQL RPC. */
export function applyCommand(previous: Workspace, input: Command, actor: Actor, now = new Date().toISOString(), uuid = () => crypto.randomUUID()): Workspace {
  const command = commandSchema.parse(input);
  if (!can(actor.role, command.type)) throw new Error("Tu perfil no tiene permiso para esta acción.");
  const state = structuredClone(previous), org = state.organization_id;
  let projectId: string | null = "project_id" in command ? command.project_id : null;
  if (projectId && !state.projects.some(p => p.id === projectId)) throw new Error("Proyecto no encontrado.");
  const version = (id: string) => { const v = state.versions.find(v => v.id === id); if (!v) throw new Error("Revisión no encontrada."); const b = state.budgets.find(b => b.id === v.budget_id)!; projectId = b.project_id; return { v, b }; };
  const newVersion = (budgetId: string, number: number, items: BudgetItem[], reason: string): BudgetVersion => ({ id: uuid(), organization_id: org, budget_id: budgetId, number, status: "draft", draft_revision: 0, items, notes: "", change_reason: reason, created_by_name: actor.name, created_at: now, updated_at: now, approved_at: null, approval_reference: null });
  let activity = "";
  switch (command.type) {
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
      state.articles.push({ id: uuid(), organization_id: org, ...fields }); activity = `Artículo creado: ${command.name}`; break;
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
      state.articles = state.articles.filter(x => x.id !== command.id); activity = `Artículo eliminado: ${a.name}`; break;
    }
    case "task.create": {
      const { type: _, ...fields } = command; void _;
      state.tasks.push({ id: uuid(), organization_id: org, ...fields, status: "pending" }); activity = `Tarea planificada: ${command.title}`; break;
    }
    case "task.toggle": {
      const t = state.tasks.find(t => t.id === command.id); if (!t) throw new Error("Tarea no encontrada."); t.status = command.status; projectId = t.project_id; activity = `${t.status === "done" ? "Completada" : "Reabierta"}: ${t.title}`; break;
    }
    case "task.update": {
      const t = state.tasks.find(t => t.id === command.id); if (!t) throw new Error("Tarea no encontrada.");
      const { type: _, id: __, ...cambios } = command; void _; void __;
      Object.assign(t, Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined)));
      projectId = t.project_id; activity = `Tarea actualizada: ${t.title}`; break;
    }
    case "task.delete": {
      const t = state.tasks.find(t => t.id === command.id); if (!t) throw new Error("Tarea no encontrada.");
      state.tasks = state.tasks.filter(x => x.id !== command.id); projectId = t.project_id; activity = `Tarea eliminada: ${t.title}`; break;
    }
    case "purchase.create": {
      const { type: _, ...fields } = command; void _;
      state.purchases.push({ id: uuid(), organization_id: org, ...fields, received_quantity: 0, delivered_quantity: 0, status: "planned" }); activity = `Material añadido: ${command.name}`; break;
    }
    case "purchase.update": {
      const p = state.purchases.find(p => p.id === command.id); if (!p) throw new Error("Pedido no encontrado.");
      if (command.received_quantity > p.quantity || command.delivered_quantity > command.received_quantity) throw new Error("Las cantidades entregadas no pueden superar las recibidas, ni estas las pedidas.");
      if ((command.status === "planned" && command.received_quantity !== 0) || (command.status === "received" && command.received_quantity !== p.quantity) || (command.status === "delivered" && command.delivered_quantity !== p.quantity)) throw new Error("El estado no coincide con las cantidades recibidas o entregadas.");
      p.status = command.status; p.received_quantity = command.received_quantity; p.delivered_quantity = command.delivered_quantity; projectId = p.project_id; activity = `${p.name}: ${purchaseStatus[p.status]}`; break;
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
