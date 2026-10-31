import type { Tone } from "@/components/ui/status";
import { budgetHistory } from "./budget-history";
import { pasoVisible } from "./siguiente-paso";
import { localDate } from "./hoy";
import type { Project, Workspace } from "./domain";

/**
 * Los cuatro pasos que ve la gente: Visita → Presupuesto → Obra → Entregado.
 * El dominio conserva sus cinco estados; `planning` y `active` se leen los dos como «Obra».
 */
export type Paso = "visita" | "presupuesto" | "obra" | "entregado";
export const pasos: { id: Paso; label: string; plural: string }[] = [
  { id: "visita", label: "Visita", plural: "Visita" },
  { id: "presupuesto", label: "Presupuesto", plural: "Presupuesto" },
  { id: "obra", label: "Obra", plural: "Obra" },
  { id: "entregado", label: "Entregado", plural: "Entregados" }
];
const pasoPorEstado: Record<Project["status"], Paso> = { lead: "visita", estimating: "presupuesto", planning: "obra", active: "obra", completed: "entregado" };
export const pasoDe = (status: Project["status"]): Paso => pasoPorEstado[status];
/** Estado que representa cada paso al cambiarlo a mano. */
export const estadoDePaso: Record<Paso, Project["status"]> = { visita: "lead", presupuesto: "estimating", obra: "active", entregado: "completed" };

export type Quien = "te-espera" | "cliente" | "atrasado" | "al-dia";
export const quienEtiqueta: Record<Quien, { label: string; tone: Tone }> = {
  "te-espera": { label: "Te espera a ti", tone: "warning" },
  cliente: { label: "Esperando al cliente", tone: "info" },
  atrasado: { label: "Atrasado", tone: "danger" },
  "al-dia": { label: "Al día", tone: "success" }
};

/** Quién tiene que actuar ahora en el proyecto: siempre una de las cuatro etiquetas de toda la aplicación. */
export function quienActua(data: Workspace, project: Project, hoy = localDate()): Quien {
  if (project.status === "completed") return "al-dia";
  if (data.tasks.some(t => t.project_id === project.id && t.status === "pending" && t.due_date < hoy)) return "atrasado";
  const enviada = data.budgets.filter(b => b.project_id === project.id).some(b => budgetHistory(b, data.versions).working?.status === "issued");
  if (enviada) return "cliente";
  const paso = pasoVisible(data, project, hoy);
  return paso.accion === "ninguna" || paso.accion === "tarea" ? "al-dia" : "te-espera";
}

export const iniciales = (texto: string) => texto.split(/[\s·]+/).filter(w => /^[\p{L}\d]/u.test(w) && !/^(de|del|la|el|en|y)$/i.test(w)).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "·";

/** En la ficha y las listas ya se dice que es lo siguiente: el título no lo repite. */
export const tituloPaso = (titulo: string) => titulo.replace(/^Siguiente: /, "").replace(/^./, c => c.toUpperCase());

/** Adónde lleva la acción de un paso desde fuera de la ficha (Hoy, listas). */
export function enlacePaso(projectId: string, paso: { accion: string; budget_id?: string }) {
  const base = `/proyectos/${projectId}`;
  const p = paso.budget_id ? `&p=${paso.budget_id}` : "";
  if (paso.accion === "editar") return `${base}?s=budget${p}&editar=1`;
  if (paso.accion === "cerrar") return `${base}?s=budget${p}&accion=enviar`;
  if (paso.accion === "aprobar") return `${base}?s=budget${p}&accion=respuesta`;
  if (paso.accion === "certificar") return `${base}?s=cobros`;
  if (paso.accion === "tareas" || paso.accion === "tarea") return `${base}?s=work`;
  return base;
}

/** Los movimientos se guardan con su texto original; aquí se dicen con las palabras de la obra. */
export function textoMovimiento(texto: string) {
  return texto.replace("cerrada para revisión", "enviada al cliente").replace("aprobada para obra", "aceptada").replace("Borrador de certificación", "Cobro preparado");
}
