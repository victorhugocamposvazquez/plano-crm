"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import { useWorkspace } from "@/components/workspace-provider";
import { can, dateLabel, type Task } from "@/lib/domain";
import { localDate } from "@/lib/hoy";

const fechaLarga = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Detalle de una tarea sin salir de la pantalla: estado, proyecto, oficio, responsable, fecha y peso. */
export function TaskDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { data, actor, busy, send, notify } = useWorkspace();
  const [pending, setPending] = useState(false);
  const project = task ? data.projects.find(p => p.id === task.project_id) : undefined;
  const canToggle = can(actor.role, "task.toggle");

  async function toggle() {
    if (!task || !canToggle || busy || pending) return;
    setPending(true);
    try { await send({ type: "task.toggle", id: task.id, status: task.status === "done" ? "pending" : "done" }); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido actualizar la tarea."); }
    finally { setPending(false); }
  }

  const vencida = task ? task.status === "pending" && task.due_date < localDate() : false;
  const tone = !task ? "muted" : task.status === "done" ? "success" : vencida ? "danger" : task.due_date === localDate() ? "warning" : "info";
  const label = !task ? "" : task.status === "done" ? "Completada" : vencida ? "Atrasada" : task.due_date === localDate() ? "Para hoy" : "Pendiente";

  return (
    <Modal open={Boolean(task)} onClose={onClose} title="Tarea" footer={task && (
      <>
        {project && <Link href={`/proyectos/${project.id}`} className="btn btn-secondary" onClick={onClose}><ArrowUpRight size={16} strokeWidth={1.6} aria-hidden="true" />Abrir proyecto</Link>}
        {canToggle && <Button variant="primary" onClick={toggle} disabled={pending || busy}>{task.status === "done" ? "Reabrir" : "Marcar como hecha"}</Button>}
      </>
    )}>
      {task && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <Status label={label} tone={tone} />
            <h3 className="h2" style={{ marginTop: 8, textDecoration: task.status === "done" ? "line-through" : undefined, color: task.status === "done" ? "var(--pl-muted)" : undefined }}>{task.title}</h3>
          </div>
          <dl className="facts">
            <div><dt>Proyecto</dt><dd>{project ? `${project.name} · ${project.client_name}` : "—"}</dd></div>
            <div><dt>Oficio</dt><dd>{task.trade}</dd></div>
            <div><dt>Responsable</dt><dd>{task.assignee || "Sin asignar"}</dd></div>
            <div><dt>Fecha</dt><dd>{fechaLarga.format(new Date(`${task.due_date}T12:00:00`)).replace(/^./, c => c.toUpperCase())}{vencida ? <span className="danger"> · vencida</span> : ""}</dd></div>
            <div><dt>Peso en el avance</dt><dd className="pl-mono">{task.weight} %</dd></div>
          </dl>
          <p className="muted text-xs">Cambiar fecha, oficio o responsable llegará con el comando de edición de tareas del dominio; hoy solo se puede completar o reabrir.</p>
          {project && <p className="muted text-xs">Creada el {dateLabel(project.created_at)} como parte de la planificación del proyecto.</p>}
        </div>
      )}
    </Modal>
  );
}
