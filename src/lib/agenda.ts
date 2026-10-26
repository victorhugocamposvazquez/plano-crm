import type { Project, Task, Workspace } from "./domain";
import { localDate } from "./hoy";

/**
 * Agenda de oficios. El dominio solo tiene tareas con oficio (`trade`), responsable (`assignee`)
 * y fecha; la disponibilidad real de equipos y las horas por trabajador llegarán con el dominio.
 */

export const oficiosHabituales = ["Albañilería", "Electricidad", "Fontanería", "Pintura", "Carpintería", "Pladur", "Alicatado", "Climatización", "Coordinación", "Oficina"];

export function lunesDe(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  const diff = (date.getDay() + 6) % 7; // lunes = 0
  date.setDate(date.getDate() - diff);
  return localDate(date);
}

export function sumarDias(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

export function diasDeSemana(lunes: string) {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

const diaCorto = new Intl.DateTimeFormat("es-ES", { weekday: "short" });
const diaLargo = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "short" });
const rango = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });

export function etiquetaDia(iso: string, larga = false) {
  const label = (larga ? diaLargo : diaCorto).format(new Date(`${iso}T12:00:00`)).replace(".", "");
  return label.replace(/^./, c => c.toUpperCase());
}

export function etiquetaSemana(lunes: string) {
  return `${rango.format(new Date(`${lunes}T12:00:00`))} – ${rango.format(new Date(`${sumarDias(lunes, 6)}T12:00:00`))}`;
}

export type TareaAgenda = Task & { project: Project };

export function tareasConProyecto(data: Workspace): TareaAgenda[] {
  return data.tasks.flatMap(task => { const project = data.projects.find(p => p.id === task.project_id); return project ? [{ ...task, project }] : []; });
}

export type Filtros = { oficio: string; persona: string };

export function filtrar(tareas: TareaAgenda[], f: Filtros) {
  return tareas.filter(t => (!f.oficio || t.trade === f.oficio) && (!f.persona || t.assignee === f.persona));
}

/** Tareas por día de la semana (pendientes primero, luego por peso). */
export function porDia(tareas: TareaAgenda[], lunes: string) {
  const dias = diasDeSemana(lunes);
  const map = new Map<string, TareaAgenda[]>(dias.map(d => [d, []]));
  for (const t of tareas) if (map.has(t.due_date)) map.get(t.due_date)!.push(t);
  for (const list of map.values()) list.sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || b.weight - a.weight);
  return map;
}

/** Tareas pendientes de antes de la semana: siguen contando y hay que recolocarlas. */
export function atrasadasAntesDe(tareas: TareaAgenda[], lunes: string) {
  return tareas.filter(t => t.status === "pending" && t.due_date < lunes).sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export type Carga = { clave: string; pendientes: number; proyectos: number };

/** Cuántas tareas pendientes tiene cada oficio (o cada persona) en la semana: la lectura rápida de quién está cargado. */
export function cargaSemanal(tareas: TareaAgenda[], lunes: string, por: "trade" | "assignee"): Carga[] {
  const fin = sumarDias(lunes, 6);
  const enSemana = tareas.filter(t => t.status === "pending" && t.due_date >= lunes && t.due_date <= fin);
  const map = new Map<string, { pendientes: number; proyectos: Set<string> }>();
  for (const t of enSemana) {
    const clave = (por === "trade" ? t.trade : t.assignee) || "Sin asignar";
    const entry = map.get(clave) ?? { pendientes: 0, proyectos: new Set<string>() };
    entry.pendientes++; entry.proyectos.add(t.project_id); map.set(clave, entry);
  }
  return [...map.entries()].map(([clave, v]) => ({ clave, pendientes: v.pendientes, proyectos: v.proyectos.size })).sort((a, b) => b.pendientes - a.pendientes || a.clave.localeCompare(b.clave, "es"));
}

export function oficios(tareas: Task[]) {
  return [...new Set([...oficiosHabituales, ...tareas.map(t => t.trade)])].filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
}

export function personas(tareas: Task[]) {
  return [...new Set(tareas.map(t => t.assignee).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}
