"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Status, type Tone } from "@/components/ui/status";
import { can, dateLabel, type Task } from "@/lib/domain";
import { buildAgenda, buildAlerts, greeting, localDate, longDate, type AgendaTask } from "@/lib/hoy";

export default function HoyPage() {
  const { data, actor, loading, busy, send, notify } = useWorkspace();
  const today = localDate();
  const agenda = useMemo(() => buildAgenda(data, today), [data, today]);
  const alerts = useMemo(() => buildAlerts(data, today), [data, today]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const canToggle = can(actor.role, "task.toggle");
  const firstName = actor.name.split(/[\s·]+/)[0] ?? "";

  async function toggle(task: Task) {
    if (!canToggle || busy) return;
    setPendingId(task.id);
    try {
      await send({ type: "task.toggle", id: task.id, status: task.status === "done" ? "pending" : "done" });
      notify(task.status === "done" ? `Reabierta: ${task.title}` : `Completada: ${task.title}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "No se ha podido actualizar la tarea.");
    } finally {
      setPendingId(null);
    }
  }

  const TaskList = ({ tasks, empty }: { tasks: AgendaTask[]; empty: string }) => (
    tasks.length === 0
      ? <p className="muted text-sm" style={{ padding: "10px 0" }}>{empty}</p>
      : <div>{tasks.map(task => (
          <label key={task.id} className="task-row" data-done={task.status === "done"}>
            <input type="checkbox" checked={task.status === "done"} disabled={!canToggle || pendingId === task.id} onChange={() => toggle(task)} aria-label={`${task.status === "done" ? "Reabrir" : "Completar"} ${task.title}`} />
            <span style={{ minWidth: 0 }}>
              <span className="task-title">{task.title}</span>
              <span className="task-meta">{task.project.name} · {task.trade}{task.assignee ? ` · ${task.assignee}` : ""}{task.due_date !== today ? ` · ${dateLabel(task.due_date)}` : ""}</span>
            </span>
            <Link href={`/obras/${task.project_id}`} className="muted" aria-label={`Abrir ${task.project.name}`} style={{ display: "inline-flex" }}><ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" /></Link>
          </label>
        ))}</div>
  );

  const toneFor = (tone: Tone | "muted") => tone;

  return (
    <div className="page">
      <div>
        <div className="eyebrow"><CalendarDays size={13} strokeWidth={1.8} aria-hidden="true" /><span>{longDate(today).replace(/^./, c => c.toUpperCase())}</span></div>
        <h1 className="h1">{greeting()}{firstName ? `, ${firstName}` : ""}.</h1>
        <p className="subtitle">
          {loading ? "Cargando el espacio de trabajo…" : `${agenda.today.length} tareas para hoy · ${agenda.overdue.length} atrasadas · ${alerts.length} avisos`}
        </p>
      </div>

      <div className="summary">
        <Link href="/obras"><strong>{data.projects.filter(p => p.status === "active").length}</strong><small>obras en marcha</small></Link>
        <Link href="/obras"><strong>{data.versions.filter(v => v.status === "draft" || v.status === "issued").length}</strong><small>presupuestos en revisión</small></Link>
        <Link href="/obras"><strong>{data.purchases.filter(p => p.status === "ordered").length}</strong><small>pedidos sin recibir</small></Link>
      </div>

      <div className="detail">
        <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {agenda.overdue.length > 0 && (
            <>
              <div className="section-label"><span className="warning">Atrasadas</span><span className="pl-mono">{agenda.overdue.length}</span></div>
              <TaskList tasks={agenda.overdue} empty="" />
            </>
          )}
          <div className="section-label"><span>Hoy</span><span className="pl-mono">{agenda.today.length}</span></div>
          <TaskList tasks={agenda.today} empty={agenda.overdue.length ? "Nada más previsto para hoy." : "Sin tareas previstas para hoy."} />
          {agenda.doneToday.length > 0 && (
            <>
              <div className="section-label"><span>Hechas hoy</span><span className="pl-mono">{agenda.doneToday.length}</span></div>
              <TaskList tasks={agenda.doneToday} empty="" />
            </>
          )}
          <div className="section-label"><span>Próximos 7 días</span><span className="pl-mono">{agenda.upcoming.length}</span></div>
          <TaskList tasks={agenda.upcoming} empty="Semana despejada por ahora." />
          {!canToggle && <p className="muted text-xs" style={{ marginTop: 8 }}>Tu perfil puede consultar la agenda pero no marcar tareas.</p>}
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div className="section-label" style={{ marginTop: 0 }}><span>Atención</span><span className="pl-mono">{String(alerts.length).padStart(2, "0")}</span></div>
            <div className="panel">
              {alerts.length === 0 && <div className="panel-body muted text-sm">Nada que requiera atención ahora mismo.</div>}
              {alerts.slice(0, 8).map(alert => (
                <Link key={alert.id} href={alert.href} className="alert-row">
                  <span style={{ minWidth: 0 }}><strong>{alert.title}</strong><small>{alert.detail}</small></span>
                  <Status tone={toneFor(alert.tone)} label={alert.kind === "task" ? "Plazo" : alert.kind === "approval" ? "Aprobar" : alert.kind === "draft" ? "Revisión" : alert.kind === "purchase" ? "Pedido" : "Estimar"} />
                </Link>
              ))}
              {alerts.length > 8 && <div className="panel-row muted text-xs">y {alerts.length - 8} más</div>}
            </div>
          </div>
          <div>
            <div className="section-label" style={{ marginTop: 0 }}><span>Actividad reciente</span></div>
            {data.activities.slice(0, 5).map(activity => {
              const project = data.projects.find(p => p.id === activity.project_id);
              return (
                <Link key={activity.id} href={project ? `/obras/${project.id}` : "/obras"} className="row-doc">
                  <span>{activity.text}<small>{project ? `${project.name} · ` : ""}{activity.actor_name} · {dateLabel(activity.created_at)}</small></span>
                </Link>
              );
            })}
            {data.activities.length === 0 && <p className="muted text-sm">Aún no hay actividad.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
