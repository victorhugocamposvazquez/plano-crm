import { totals, type Project, type Task, type Workspace } from "./domain";

/** Fecha local en formato YYYY-MM-DD, el mismo que usa `Task.due_date`. */
export function localDate(date = new Date()) {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, "0"), d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

export type AgendaTask = Task & { project: Project };
export type Agenda = { overdue: AgendaTask[]; today: AgendaTask[]; upcoming: AgendaTask[]; doneToday: AgendaTask[] };

/** Tareas pendientes repartidas en atrasadas, de hoy y de los próximos siete días. */
export function buildAgenda(data: Workspace, today = localDate()): Agenda {
  const horizon = addDays(today, 7);
  const byDate = (a: Task, b: Task) => a.due_date.localeCompare(b.due_date) || b.weight - a.weight;
  const withProject = data.tasks.flatMap(task => { const project = data.projects.find(p => p.id === task.project_id); return project ? [{ ...task, project }] : []; });
  const pending = withProject.filter(t => t.status === "pending").sort(byDate);
  return {
    overdue: pending.filter(t => t.due_date < today),
    today: pending.filter(t => t.due_date === today),
    upcoming: pending.filter(t => t.due_date > today && t.due_date <= horizon),
    doneToday: withProject.filter(t => t.status === "done" && t.due_date === today)
  };
}

export type AlertTone = "warning" | "ink" | "blue" | "muted";
export type Alert = { id: string; tone: AlertTone; title: string; detail: string; href: string; kind: "task" | "approval" | "draft" | "purchase" | "estimate" };

/**
 * Avisos del día, ordenados por lo que más urge: plazos vencidos, aprobaciones que bloquean obra,
 * cambios en preparación, material pedido sin recibir y visitas sin estimar.
 */
export function buildAlerts(data: Workspace, today = localDate()): Alert[] {
  const project = (id: string) => data.projects.find(p => p.id === id);
  const alerts: Alert[] = [];

  const overdue = buildAgenda(data, today).overdue;
  for (const task of overdue) {
    const days = Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${task.due_date}T12:00:00`)) / 86400000);
    alerts.push({ id: `task-${task.id}`, tone: "warning", kind: "task", title: task.title, detail: `${task.project.name} · ${task.trade} · ${days === 1 ? "vence desde ayer" : `${days} días de retraso`}`, href: `/proyectos/${task.project_id}` });
  }

  for (const version of data.versions.filter(v => v.status === "issued")) {
    const budget = data.budgets.find(b => b.id === version.budget_id); const p = budget && project(budget.project_id);
    if (!p) continue;
    alerts.push({ id: `issued-${version.id}`, tone: "ink", kind: "approval", title: `V${version.number} cerrada, pendiente de aprobar`, detail: `${p.name} · ${budget.title} · ${version.change_reason}`, href: `/proyectos/${p.id}` });
  }

  for (const version of data.versions.filter(v => v.status === "draft")) {
    const budget = data.budgets.find(b => b.id === version.budget_id); const p = budget && project(budget.project_id);
    if (!p || !budget.approved_version_id) continue;
    const approved = data.versions.find(v => v.id === budget.approved_version_id);
    const delta = approved ? totals(version.items).base - totals(approved.items).base : 0;
    alerts.push({ id: `draft-${version.id}`, tone: "muted", kind: "draft", title: `V${version.number} con cambios en preparación`, detail: `${p.name} · ${delta >= 0 ? "+" : "−"}${Math.abs(delta / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" })} sin IVA · ${version.created_by_name}`, href: `/proyectos/${p.id}` });
  }

  for (const purchase of data.purchases.filter(p => p.status === "ordered")) {
    const p = project(purchase.project_id); if (!p) continue;
    alerts.push({ id: `purchase-${purchase.id}`, tone: "blue", kind: "purchase", title: `${purchase.name} · pedido, sin recibir`, detail: `${p.name} · ${purchase.supplier} · ${purchase.received_quantity}/${purchase.quantity} ${purchase.unit}`, href: `/proyectos/${p.id}` });
  }

  for (const p of data.projects.filter(p => p.status === "lead" && !data.budgets.some(b => b.project_id === p.id))) {
    alerts.push({ id: `estimate-${p.id}`, tone: "muted", kind: "estimate", title: `${p.name} · sin estimación`, detail: `${p.client_name} · ${p.location} · primera visita`, href: `/proyectos/${p.id}` });
  }

  return alerts;
}

/** Saludo según la hora local; sin nombres propios, que ya los pone la pantalla. */
export function greeting(hour = new Date().getHours()) {
  return hour < 6 ? "Buenas noches" : hour < 14 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";
}

export function longDate(today = localDate()) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${today}T12:00:00`));
}
