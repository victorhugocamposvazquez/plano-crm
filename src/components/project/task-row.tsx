"use client";
import type { Task } from "@/lib/domain";
import { dateLabel } from "@/lib/domain";

/**
 * Fila de tarea compartida por Hoy, Agenda y la ficha: la casilla completa, el título abre el detalle
 * en un diálogo (sin cambiar de pantalla). Nada de enlaces que te saquen de donde estás.
 */
export function TaskRow({ task, projectName, onToggle, onOpen, canToggle, pending, showDate, compact }: {
  task: Task; projectName?: string; onToggle: (task: Task) => void; onOpen: (task: Task) => void;
  canToggle: boolean; pending?: boolean; showDate?: boolean; compact?: boolean;
}) {
  return (
    <div className="task-row" data-done={task.status === "done"} data-compact={compact || undefined}>
      <input type="checkbox" checked={task.status === "done"} disabled={!canToggle || pending} onChange={() => onToggle(task)} aria-label={`${task.status === "done" ? "Reabrir" : "Completar"} ${task.title}`} />
      <button type="button" className="task-open-btn" onClick={() => onOpen(task)} aria-haspopup="dialog">
        <span className="task-title">{task.title}</span>
        <span className="task-meta">{projectName ? `${projectName} · ` : ""}{task.trade}{task.assignee ? ` · ${task.assignee}` : " · sin asignar"}{showDate ? ` · ${dateLabel(task.due_date)}` : ""}{compact ? "" : ` · peso ${task.weight}%`}</span>
      </button>
    </div>
  );
}
