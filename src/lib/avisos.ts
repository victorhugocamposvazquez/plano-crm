import { budgetHistory } from "./budget-history";
import { normalizar } from "./busqueda";
import { localDate } from "./hoy";
import { facturasDe, vencidas } from "./facturas";
import { money, type Actor, type Workspace } from "./domain";

/**
 * Avisos de la persona. No hay tabla de notificaciones todavía (docs/PREGUNTAS.md): se deducen de lo que ya está
 * en el espacio, y lo leído se recuerda en este dispositivo.
 */
export type TipoAviso = "mencion" | "atrasada" | "agenda" | "cliente" | "factura";
export type Aviso = { id: string; tipo: TipoAviso; quien: string; texto: string; cuando: string; href: string };

const primerNombre = (nombre: string) => nombre.split(/[\s·]+/)[0] ?? "";
const esMia = (assignee: string, yo: string) => Boolean(yo) && normalizar(assignee).split(/[\s·,]+/).includes(normalizar(yo));

export function construirAvisos(data: Workspace, actor: Actor, hoy = localDate()): Aviso[] {
  const yo = primerNombre(actor.name), avisos: Aviso[] = [];
  const nombre = (id: string) => data.projects.find(p => p.id === id)?.name ?? "";
  const seVeTodo = actor.role === "admin" || actor.role === "office";
  const mencion = yo ? new RegExp(`(^|\\s)@${normalizar(yo).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9ñ])`) : null;
  for (const m of data.messages) {
    if (m.deleted_at || m.author_name === actor.name || !mencion?.test(normalizar(m.body))) continue;
    avisos.push({ id: `m-${m.id}`, tipo: "mencion", quien: m.author_name, texto: `te ha mencionado en ${nombre(m.project_id)}`, cuando: m.created_at, href: `/proyectos/${m.project_id}?chat=1` });
  }
  const manana = new Date(`${hoy}T12:00:00`); manana.setDate(manana.getDate() + 1);
  const isoManana = localDate(manana);
  for (const t of data.tasks) {
    if (t.status !== "pending") continue;
    const mia = esMia(t.assignee, yo);
    if (t.due_date < hoy && (mia || seVeTodo)) avisos.push({ id: `a-${t.id}`, tipo: "atrasada", quien: t.title, texto: `venció el ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(`${t.due_date}T12:00:00`))} · ${nombre(t.project_id)}`, cuando: `${t.due_date}T12:00:00`, href: `/proyectos/${t.project_id}?s=work` });
    else if (mia && (t.due_date === hoy || t.due_date === isoManana)) avisos.push({ id: `g-${t.id}-${t.due_date}`, tipo: "agenda", quien: t.title, texto: `${t.due_date === hoy ? "hoy" : "mañana"} · ${nombre(t.project_id)}`, cuando: `${t.due_date}T08:00:00`, href: `/proyectos/${t.project_id}?s=work` });
  }
  if (seVeTodo) for (const b of data.budgets) {
    const v = budgetHistory(b, data.versions).working;
    if (v?.status !== "issued") continue;
    const dias = Math.round((Date.parse(`${hoy}T12:00:00`) - new Date(v.updated_at).getTime()) / 864e5);
    if (dias >= 3) avisos.push({ id: `c-${v.id}`, tipo: "cliente", quien: nombre(b.project_id), texto: `lleva ${dias} días sin contestar a la V${v.number}`, cuando: v.updated_at, href: `/proyectos/${b.project_id}?s=budget&p=${b.id}&accion=respuesta` });
  }
  if (seVeTodo) for (const f of vencidas(facturasDe(data), hoy)) avisos.push({ id: `f-${f.id}`, tipo: "factura", quien: `Factura ${f.number}`, texto: `venció · ${f.client_name} · ${money(f.total)}`, cuando: `${f.due_date}T12:00:00`, href: `/finanzas?factura=${f.id}` });
  return avisos.sort((a, b) => b.cuando.localeCompare(a.cuando));
}

/**
 * Qué enseña el menú de escritorio: todos los sin leer, porque el aro no se apaga hasta entrar en cada uno,
 * y los leídos más recientes hasta llegar a `minimo`.
 */
export function avisosVisibles(avisos: Aviso[], leidos: Set<string>, minimo = 3) {
  const sinLeer = avisos.filter(a => !leidos.has(a.id)).length;
  let huecos = Math.max(0, minimo - sinLeer);
  return avisos.filter(a => { if (!leidos.has(a.id)) return true; if (huecos > 0) { huecos--; return true; } return false; });
}

const clave = "plano.avisos.leidos";
export function leerLeidos(): Set<string> {
  try { const raw = JSON.parse(localStorage.getItem(clave) ?? "[]"); return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []); } catch { return new Set(); }
}
export function marcarLeidos(ids: string[]) {
  const todos = [...new Set([...leerLeidos(), ...ids])].slice(-500);
  try { localStorage.setItem(clave, JSON.stringify(todos)); window.dispatchEvent(new Event("plano:avisos")); } catch {}
}
