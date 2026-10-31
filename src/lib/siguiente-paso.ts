import { budgetHistory } from "./budget-history";
import { totals, type Project, type Task, type Workspace } from "./domain";

/**
 * «Qué toca ahora» en cada proyecto. Lee el estado real (presupuestos, tareas, certificaciones)
 * y propone una sola acción principal, para que la ficha y «Hoy» no obliguen a deducirla.
 * La fase visible va de la visita a la entrega; la del dominio (`project.status`) se mantiene.
 */

export type Etapa = "visita" | "presupuesto" | "aprobacion" | "obra" | "entrega";
export const etapas: { id: Etapa; label: string }[] = [
  { id: "visita", label: "Visita" }, { id: "presupuesto", label: "Presupuesto" }, { id: "aprobacion", label: "Aprobación" }, { id: "obra", label: "Obra" }, { id: "entrega", label: "Entrega" }
];

export type TipoAccion = "presupuesto" | "editar" | "cerrar" | "aprobar" | "planificar" | "tareas" | "iniciar-obra" | "tarea" | "certificar" | "finalizar" | "ninguna";
export type SiguientePaso = { etapa: Etapa; titulo: string; detalle: string; accion: TipoAccion; label: string; tarea?: Task; urgencia: 0 | 1 | 2; budget_id?: string };

export function siguientePaso(data: Workspace, project: Project, hoy = new Date().toISOString().slice(0, 10)): SiguientePaso {
  const budgets = data.budgets.filter(b => b.project_id === project.id);
  const versions = data.versions.filter(v => budgets.some(b => b.id === v.budget_id));
  const histories = budgets.map(b => budgetHistory(b, versions));
  const pending = histories.filter(h => h.working).sort((a,b) => Number(Boolean(a.approved)) - Number(Boolean(b.approved)) || b.working!.updated_at.localeCompare(a.working!.updated_at));
  const working = pending[0]?.working;
  // La aprobada de otro ámbito no es la referencia que esta revisión va a sustituir.
  const approved = working ? pending[0].approved : histories.find(h => h.approved)?.approved;
  const conPartidas = versions.some(v => v.items.length > 0);
  const tasks = data.tasks.filter(t => t.project_id === project.id);
  const pendientes = tasks.filter(t => t.status === "pending").sort((a, b) => a.due_date.localeCompare(b.due_date));
  const atrasadas = pendientes.filter(t => t.due_date < hoy);
  const certificado = data.certifications.filter(c => c.project_id === project.id).reduce((s, c) => s + c.amount, 0);

  if (project.status === "completed") return { etapa: "entrega", titulo: "Proyecto entregado", detalle: "Queda el histórico de presupuestos, documentos y conversación.", accion: "ninguna", label: "", urgencia: 0 };

  // Si la empresa ya está planificando o en obra, manda la obra aunque el presupuesto siga en revisión.
  const enObra = project.status === "planning" || project.status === "active";

  if ((!conPartidas || (working?.items.length === 0 && !approved)) && !enObra) {
    if (!budgets.length) return { etapa: "visita", titulo: "Todavía no hay presupuesto", detalle: "Ábrelo aquí con el catálogo o estímalo a pie de obra en la visita.", accion: "presupuesto", label: "Abrir presupuesto", urgencia: 1 };
    return { etapa: "presupuesto", titulo: `La V${working?.number ?? 1} está vacía`, detalle: "Añade las partidas del catálogo con la guía por capítulos.", accion: "editar", budget_id: working?.budget_id ?? budgets[0]?.id, label: "Añadir partidas", urgencia: 1 };
  }

  if (!approved && !enObra) {
    if (working?.status === "draft") return { etapa: "presupuesto", titulo: `Enviar la V${working.number} al cliente`, detalle: "Revisa las partidas y las condiciones. Al enviarla ya no se puede editar: los cambios van en una versión nueva.", accion: "cerrar", budget_id: working.budget_id, label: "Revisar y enviar", urgencia: 1 };
    if (working?.status === "issued") return { etapa: "aprobacion", titulo: `El cliente tiene la V${working.number} y no ha respondido`, detalle: "Cuando conteste, registra su respuesta: si acepta, si pide cambios o si dice que no.", accion: "aprobar", budget_id: working.budget_id, label: "Registrar respuesta", urgencia: 2 };
  }

  if (approved && working?.status === "issued" && !enObra) return { etapa: "aprobacion", titulo: `El cliente tiene la V${working.number} y no ha respondido`, detalle: `Mientras tanto sigue valiendo la V${approved.number} aceptada.`, accion: "aprobar", budget_id: working.budget_id, label: "Registrar respuesta", urgencia: 2 };

  if (approved && (project.status === "lead" || project.status === "estimating")) return { etapa: "aprobacion", titulo: "Presupuesto aceptado · planifica la obra", detalle: "Pasa el proyecto a planificación y reparte las tareas por oficio y fecha.", accion: "planificar", label: "Pasar a planificación", urgencia: 1 };

  if (project.status === "planning") {
    if (!tasks.length) return { etapa: "obra", titulo: "Crea las tareas de la obra", detalle: "Demoliciones, albañilería, instalaciones… con oficio, responsable, fecha y peso en el avance.", accion: "tareas", label: "Planificar tarea", urgencia: 1 };
    return { etapa: "obra", titulo: "Planificación lista · arranca la obra", detalle: `${tasks.length} tareas planificadas. Al arrancar, el proyecto pasa a «Obra» y aparece en Hoy.`, accion: "iniciar-obra", label: "Arrancar la obra", urgencia: 1 };
  }

  if (project.status === "active") {
    if (atrasadas.length) return { etapa: "obra", titulo: `${atrasadas.length} tarea${atrasadas.length === 1 ? "" : "s"} con el plazo vencido`, detalle: `La más antigua: ${atrasadas[0].title} (${atrasadas[0].trade}).`, accion: "tarea", label: "Ver tarea", tarea: atrasadas[0], urgencia: 2 };
    if (pendientes.length) return { etapa: "obra", titulo: `Siguiente: ${pendientes[0].title}`, detalle: `${pendientes[0].trade}${pendientes[0].assignee ? ` · ${pendientes[0].assignee}` : ""} · ${pendientes.length} pendiente${pendientes.length === 1 ? "" : "s"} en total.`, accion: "tarea", label: "Ver tarea", tarea: pendientes[0], urgencia: 0 };
    if (!tasks.length) return { etapa: "obra", titulo: "En obra sin tareas planificadas", detalle: "Sin tareas no hay avance que medir ni agenda por oficios.", accion: "tareas", label: "Planificar tarea", urgencia: 1 };
    if (approved && certificado < totals(approved.items).base) return { etapa: "entrega", titulo: "Tareas completadas · prepara el cobro", detalle: `Preparado para cobrar ${(certificado / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" })} de ${(totals(approved.items).base / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" })} aceptados, sin IVA.`, accion: "certificar", label: "Preparar cobro", urgencia: 1 };
    return { etapa: "entrega", titulo: "Obra terminada y cobros preparados", detalle: "Marca el proyecto como entregado para cerrarlo.", accion: "finalizar", label: "Marcar como entregado", urgencia: 0 };
  }

  return { etapa: "presupuesto", titulo: "Presupuesto en marcha", detalle: "Revisa la revisión en curso desde la pestaña Presupuesto.", accion: "editar", budget_id: working?.budget_id ?? budgets[0]?.id, label: "Ver presupuesto", urgencia: 0 };
}

/**
 * Lo que enseña la ficha y Hoy: si el cliente tiene una versión sin contestar y la obra no va atrasada,
 * eso es lo siguiente aunque el proyecto ya esté en obra. El resto lo decide `siguientePaso`.
 */
export function pasoVisible(data: Workspace, project: Project, hoy = new Date().toISOString().slice(0, 10)): SiguientePaso {
  const paso = siguientePaso(data, project, hoy);
  if (project.status === "completed" || paso.urgencia === 2) return paso;
  const enviada = data.budgets.filter(b => b.project_id === project.id).map(b => budgetHistory(b, data.versions)).find(h => h.working?.status === "issued");
  if (!enviada?.working) return paso;
  const v = enviada.working;
  return { etapa: "aprobacion", titulo: `El cliente tiene la V${v.number} y no ha respondido`, detalle: enviada.approved ? `Mientras tanto la obra sigue con la V${enviada.approved.number}.` : "Cuando conteste, registra su respuesta.", accion: "aprobar", budget_id: v.budget_id, label: "Registrar respuesta", urgencia: 1 };
}

/** Los proyectos con algo que hacer, los más urgentes primero y los finalizados fuera. */
export function queToca(data: Workspace, hoy?: string) {
  return data.projects
    .filter(p => p.status !== "completed")
    .map(project => ({ project, paso: pasoVisible(data, project, hoy) }))
    .filter(x => x.paso.accion !== "ninguna")
    .sort((a, b) => b.paso.urgencia - a.paso.urgencia || a.project.name.localeCompare(b.project.name, "es"));
}
