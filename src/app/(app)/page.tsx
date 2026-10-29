"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ChevronRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Status, type Tone } from "@/components/ui/status";
import { Button, LinkButton } from "@/components/ui/button";
import { TaskRow } from "@/components/project/task-row";
import { TaskDialog } from "@/components/project/task-dialog";
import { budgetHistory } from "@/lib/budget-history";
import { Onboarding } from "@/components/onboarding";
import { queToca, etapas } from "@/lib/siguiente-paso";
import { can, dateLabel, type Task } from "@/lib/domain";
import { buildAgenda, buildAlerts, greeting, localDate, longDate, type AgendaTask } from "@/lib/hoy";

export default function HoyPage() {
  const { data, actor, loading, busy, send, notify } = useWorkspace();
  const today = localDate();
  const agenda = useMemo(() => buildAgenda(data, today), [data, today]);
  const alerts = useMemo(() => buildAlerts(data, today), [data, today]);
  const toca = useMemo(() => queToca(data, today).slice(0, 3), [data, today]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const canToggle = can(actor.role, "task.toggle");
  const firstName = actor.name.split(/[\s·]+/)[0] ?? "";

  async function toggle(task: Task) {
    if (!canToggle || busy) return;
    setPendingId(task.id);
    try {
      await send({ type: "task.toggle", id: task.id, status: task.status === "done" ? "pending" : "done" });
      notify(task.status === "done" ? `Reabierta: ${task.title}` : `Completada: ${task.title}`, { label: "Deshacer", run: () => send({ type: "task.toggle", id: task.id, status: task.status }) });
    } catch (e) {
      notify(e instanceof Error ? e.message : "No se ha podido actualizar la tarea.");
    } finally {
      setPendingId(null);
    }
  }

  const [abierta, setAbierta] = useState<Task | null>(null);
  const tareaAbierta = abierta ? data.tasks.find(t => t.id === abierta.id) ?? null : null;

  const TaskList = ({ tasks, empty, accion }: { tasks: AgendaTask[]; empty: string; accion?: React.ReactNode }) => (
    tasks.length === 0
      ? <p className="muted text-sm empty-line" style={{ padding: "10px 0" }}>{empty}{accion}</p>
      : <div>{tasks.map(task => <TaskRow key={task.id} task={task} projectName={task.project.name} canToggle={canToggle} pending={pendingId === task.id} showDate={task.due_date !== today} compact onToggle={toggle} onOpen={setAbierta} />)}</div>
  );

  const toneFor = (tone: Tone) => tone;
  // «Lo siguiente»: la primera tarea atrasada o de hoy; si no hay, lo que toca en el proyecto más urgente.
  const siguiente = agenda.overdue[0] ?? agenda.today[0] ?? null;
  const siguienteToca = !siguiente && toca.length ? toca[0] : null;
  const resumen = loading ? "Cargando el espacio de trabajo…" : [
    `${agenda.today.length} ${agenda.today.length === 1 ? "tarea" : "tareas"} hoy`,
    toca.length ? `${toca.length} ${toca.length === 1 ? "proyecto pide" : "proyectos piden"} algo` : "",
    agenda.overdue.length ? `${agenda.overdue.length} ${agenda.overdue.length === 1 ? "atrasada" : "atrasadas"}` : "nada atrasado"
  ].filter(Boolean).join(" · ");

  return (
    <div className="page">
      <div>
        <div className="eyebrow"><CalendarDays size={13} strokeWidth={1.8} aria-hidden="true" /><span>{longDate(today).replace(/^./, c => c.toUpperCase())}</span></div>
        <h1 className="h1">{greeting()}{firstName ? `, ${firstName}` : ""}.</h1>
        <p className="subtitle">{resumen}</p>
      </div>

      <Onboarding />

      <div className="detail">
        <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {siguiente && (
            <section className="next-card" aria-label="Lo siguiente" style={{ marginBottom: 14 }}>
              <span className="next-card-kicker">{siguiente.due_date < today ? `Lo siguiente · atrasada desde el ${dateLabel(siguiente.due_date)}` : "Lo siguiente · hoy"}</span>
              <span className="next-card-title">{siguiente.title}</span>
              <span className="next-card-meta"><span className="chip-mini">{siguiente.project.name}</span>{siguiente.trade}{siguiente.assignee ? ` · ${siguiente.assignee}` : ""}</span>
              <div className="next-card-actions">
                <Button variant="primary" onClick={() => setAbierta(siguiente)} aria-haspopup="dialog">Abrir tarea<ArrowRight size={16} strokeWidth={1.7} aria-hidden="true" /></Button>
                {canToggle && <Button variant="icon" aria-label={`Marcar como hecha: ${siguiente.title}`} title="Marcar como hecha" disabled={busy || pendingId === siguiente.id} onClick={() => toggle(siguiente)}><Check size={19} strokeWidth={1.7} aria-hidden="true" /></Button>}
              </div>
            </section>
          )}
          {siguienteToca && (
            <section className="next-card" aria-label="Lo siguiente" style={{ marginBottom: 14 }}>
              <span className="next-card-kicker">Lo siguiente</span>
              <span className="next-card-title">{siguienteToca.paso.titulo}</span>
              <span className="next-card-meta"><span className="chip-mini">{siguienteToca.project.name}</span>{etapas.find(e => e.id === siguienteToca.paso.etapa)?.label}</span>
              <div className="next-card-actions"><LinkButton variant="primary" href={`/proyectos/${siguienteToca.project.id}`}>{siguienteToca.paso.label}<ArrowRight size={16} strokeWidth={1.7} aria-hidden="true" /></LinkButton></div>
            </section>
          )}
          {toca.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 0 }}><span>Qué toca en cada proyecto</span><span className="pl-mono">{toca.length}</span></div>
              <div className="toca-list">
                {toca.map(({ project, paso }) => (
                  <Link key={project.id} href={`/proyectos/${project.id}`} className="toca-row" data-urgencia={paso.urgencia} title={paso.label}>
                    <span style={{ minWidth: 0 }}><strong>{paso.titulo}</strong><small><span className="chip-mini">{project.name}</span>{etapas.find(e => e.id === paso.etapa)?.label}</small></span>
                    <ChevronRight size={19} strokeWidth={1.55} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </>
          )}
          {agenda.overdue.length > 0 && (
            <>
              <div className="section-label"><span className="warning">Atrasadas</span><span className="pl-mono">{agenda.overdue.length}</span></div>
              <TaskList tasks={agenda.overdue} empty="" />
            </>
          )}
          <div className="section-label"><span>Hoy</span><span className="pl-mono">{agenda.today.length}</span></div>
          <TaskList tasks={agenda.today} empty={agenda.overdue.length ? "Nada más previsto para hoy." : "Sin tareas previstas para hoy."} accion={can(actor.role, "task.create") ? <Link href="/agenda?nueva=1" className="link-inline">Planificar una tarea</Link> : undefined} />
          {agenda.doneToday.length > 0 && (
            <>
              <details className="home-disclosure"><summary>Hechas hoy ({agenda.doneToday.length})</summary><div className="section-label"><span>Hechas hoy</span><span className="pl-mono">{agenda.doneToday.length}</span></div>
              <TaskList tasks={agenda.doneToday} empty="" /></details>
            </>
          )}
          <Link href="/agenda" className="home-link-row">Próximos 7 días<span className="muted">{agenda.upcoming.length ? `${agenda.upcoming.length} ${agenda.upcoming.length === 1 ? "tarea" : "tareas"}` : "semana despejada"}</span><ChevronRight size={19} strokeWidth={1.55} aria-hidden="true" /></Link>
          {!canToggle && <p className="muted text-xs" style={{ marginTop: 8 }}>Tu perfil puede consultar la agenda pero no marcar tareas.</p>}
          <details className="home-disclosure" style={{ marginTop: 10 }}><summary>Resumen de la empresa</summary><div className="summary">
            <Link href="/proyectos?f=active"><strong>{data.projects.filter(p => p.status === "active").length}</strong><small>proyectos en obra</small></Link>
            <Link href="/presupuestos?f=review"><strong>{data.budgets.filter(b => budgetHistory(b, data.versions).working).length}</strong><small>presupuestos en revisión</small></Link>
            <Link href="/compras?f=ordered"><strong>{data.purchases.filter(p => p.status === "ordered").length}</strong><small>pedidos sin recibir</small></Link>
          </div></details>
        </section>

        <details className="zone home-disclosure"><summary>Avisos y actividad ({alerts.length})</summary>
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
                <Link key={activity.id} href={project ? `/proyectos/${project.id}` : "/proyectos"} className="row-doc">
                  <span>{activity.text}<small>{project ? `${project.name} · ` : ""}{activity.actor_name} · {dateLabel(activity.created_at)}</small></span>
                </Link>
              );
            })}
            {data.activities.length === 0 && <p className="muted text-sm">Aún no hay actividad.</p>}
          </div>
        </details>
      </div>
      <TaskDialog task={tareaAbierta} onClose={() => setAbierta(null)} />
    </div>
  );
}
