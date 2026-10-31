"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Pill } from "@/components/ui/status";
import { Button, LinkButton } from "@/components/ui/button";
import { TaskDialog } from "@/components/project/task-dialog";
import { budgetHistory } from "@/lib/budget-history";
import { Onboarding } from "@/components/onboarding";
import { InstallHint } from "@/components/install-hint";
import { queToca } from "@/lib/siguiente-paso";
import { enlacePaso, quienActua, quienEtiqueta, textoMovimiento } from "@/lib/pasos";
import { veSeccion } from "@/lib/navegacion";
import { can, dateLabel, money, totals, type Task, type Workspace } from "@/lib/domain";
import { buildAgenda, greeting, localDate, longDate } from "@/lib/hoy";

const textoMensaje = (body: string) => body.replace(/\[\[[^\]]*\]\]/g, "").trim();

function novedades(data: Workspace, yo: string) {
  const mensajes = data.messages.filter(m => !m.deleted_at && m.author_name !== yo && textoMensaje(m.body)).map(m => ({ id: m.id, when: m.created_at, project_id: m.project_id as string | null, tone: "info", texto: <>{m.author_name}: <em>«{textoMensaje(m.body)}»</em></> }));
  const hechos = data.activities.filter(a => !a.text.startsWith("Mensaje ") && !a.text.startsWith("Reacción ")).map(a => ({ id: a.id, when: a.created_at, project_id: a.project_id, tone: "success", texto: <>{a.actor_name}: {textoMovimiento(a.text)}</> }));
  return [...mensajes, ...hechos].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 4);
}

function empresa(data: Workspace, today: string) {
  const mes = today.slice(0, 7);
  const historias = data.budgets.map(b => budgetHistory(b, data.versions));
  const suma = (lista: (typeof data.versions)) => lista.reduce((s, v) => s + totals(v.items).total, 0);
  return {
    aceptado: suma(data.versions.filter(v => v.approved_at?.startsWith(mes))),
    enviado: suma(historias.flatMap(h => (h.working?.status === "issued" ? [h.working] : []))),
    borradores: suma(historias.flatMap(h => (h.working?.status === "draft" ? [h.working] : []))),
    cobros: data.certifications.filter(c => c.created_at.startsWith(mes)).reduce((s, c) => s + c.amount, 0)
  };
}

export default function HoyPage() {
  const { data, actor, loading, busy, send, notify } = useWorkspace();
  const today = localDate();
  const agenda = useMemo(() => buildAgenda(data, today), [data, today]);
  const toca = useMemo(() => queToca(data, today), [data, today]);
  const conQuien = useMemo(() => toca.map(x => ({ ...x, quien: quienActua(data, x.project, today) })).filter(x => x.quien !== "al-dia"), [toca, data, today]);
  const orden = { atrasado: 0, "te-espera": 1, cliente: 2, "al-dia": 3 };
  const piden = [...conQuien].sort((a, b) => orden[a.quien] - orden[b.quien]);
  const primero = piden.find(x => x.quien === "te-espera") ?? piden.find(x => x.quien === "atrasado");
  const nuevas = useMemo(() => novedades(data, actor.name), [data, actor.name]);
  const cifras = useMemo(() => empresa(data, today), [data, today]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<Task | null>(null);
  const canToggle = can(actor.role, "task.toggle");
  const firstName = actor.name.split(/[\s·]+/)[0] ?? "";
  const esperan = conQuien.filter(x => x.quien === "te-espera").length;

  async function toggle(task: Task) {
    if (!canToggle || busy) return;
    setPendingId(task.id);
    try {
      await send({ type: "task.toggle", id: task.id, status: task.status === "done" ? "pending" : "done" });
      notify(task.status === "done" ? `Reabierta: ${task.title}` : `Completada: ${task.title}`, { label: "Deshacer", run: () => send({ type: "task.toggle", id: task.id, status: task.status }) });
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido actualizar la tarea."); }
    finally { setPendingId(null); }
  }

  const resumen = loading ? "Cargando…" : [
    longDate(today).replace(/^./, c => c.toUpperCase()),
    esperan ? `${esperan} ${esperan === 1 ? "cosa te espera" : "cosas te esperan"}` : "nada te espera",
    agenda.overdue.length ? `${agenda.overdue.length} ${agenda.overdue.length === 1 ? "tarea atrasada" : "tareas atrasadas"}` : ""
  ].filter(Boolean).join(" · ");
  const tareasHoy = [...agenda.overdue, ...agenda.today];
  const verEmpresa = veSeccion(actor.role, "/finanzas");

  return (
    <div className="page today">
      <div className="today-main">
        <div><h1 className="pl-title">{greeting()}{firstName ? `, ${firstName}` : ""}</h1><p className="pl-sub">{resumen}</p></div>
        <Onboarding />
        <InstallHint />

        {primero && (
          <section className="first-card" data-tone={quienEtiqueta[primero.quien].tone} aria-label="Lo primero">
            <div className="first-card-kicker">Lo primero · {quienEtiqueta[primero.quien].label.toLowerCase()}</div>
            <div className="first-card-body">
              <div><strong>{primero.paso.titulo}</strong><p>{primero.project.name}{primero.project.location ? ` · ${primero.project.location}` : ""}. {primero.paso.detalle}</p></div>
              <LinkButton variant="primary" data-accent="orange" href={enlacePaso(primero.project.id, primero.paso)}>{primero.paso.label}</LinkButton>
            </div>
          </section>
        )}
        {!primero && !loading && <section className="first-card" data-tone="success" aria-label="Lo primero"><div className="first-card-body"><div><strong>Hoy no hay nada urgente</strong><p>Ningún proyecto te está esperando.</p></div></div></section>}

        {piden.length > 0 && (
          <section className="pl-card" aria-label="Proyectos que piden algo">
            <header className="pl-card-head"><strong>Proyectos que piden algo</strong><Link href="/proyectos">Ver todos →</Link></header>
            <div className="need-list">
              {piden.slice(0, 6).map(({ project, paso, quien }) => (
                <Link key={project.id} href={enlacePaso(project.id, paso)} className="need-row">
                  <span className="need-text"><strong>{project.name}{project.location ? <span> · {project.location}</span> : null}</strong><small>{paso.titulo}</small></span>
                  <Pill label={quienEtiqueta[quien].label} tone={quienEtiqueta[quien].tone} />
                  <span className="need-action">{paso.label || "Ver proyecto"} <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="pl-card" aria-label="Hoy en obra">
          <header className="pl-card-head"><strong>Hoy en obra <span className="muted" style={{ fontWeight: 400 }}>· {tareasHoy.length} {tareasHoy.length === 1 ? "tarea" : "tareas"}</span></strong><Link href="/agenda">Ver la semana →</Link></header>
          {tareasHoy.length === 0 && <p className="muted text-sm" style={{ padding: "14px 18px" }}>Sin tareas para hoy.{can(actor.role, "task.create") && <> <Link href="/agenda?nueva=1" className="link-inline">Planificar una tarea</Link></>}</p>}
          {tareasHoy.map(task => {
            const tarde = task.due_date < today;
            return (
              <div key={task.id} className="work-row" data-late={tarde || undefined}>
                <input type="checkbox" checked={false} disabled={!canToggle || pendingId === task.id} onChange={() => toggle(task)} aria-label={`Completar ${task.title}`} />
                <button type="button" className="work-row-text" onClick={() => setAbierta(task)} aria-haspopup="dialog">
                  <strong>{task.title}</strong>
                  <small>{tarde ? `Venció el ${dateLabel(task.due_date)} · ` : ""}{task.project.name} · {task.trade}{task.assignee ? ` · ${task.assignee}` : ""}</small>
                </button>
                {tarde && can(actor.role, "task.update") && <Button onClick={() => setAbierta(task)}>Mover fecha</Button>}
              </div>
            );
          })}
          {agenda.doneToday.length > 0 && <p className="work-done"><Check size={14} strokeWidth={2} aria-hidden="true" />{agenda.doneToday.length} {agenda.doneToday.length === 1 ? "hecha" : "hechas"} hoy</p>}
        </section>
      </div>

      <aside className="today-side" aria-label="Novedades y cifras">
        <section className="pl-card side-card">
          <strong>Novedades</strong>
          {nuevas.length === 0 && <p className="muted text-sm">Aún no hay novedades.</p>}
          {nuevas.map(n => { const p = data.projects.find(x => x.id === n.project_id); return (
            <Link key={n.id} href={p ? `/proyectos/${p.id}` : "/proyectos"} className="news-row" data-tone={n.tone}>
              <span>{n.texto}<small>{p ? `${p.name} · ` : ""}{dateLabel(n.when)}</small></span>
            </Link>
          ); })}
        </section>
        {verEmpresa && (
          <section className="pl-card side-card">
            <strong>La empresa este mes</strong>
            <dl className="figures">
              <div><dt>Aceptado</dt><dd className="pl-mono">{money(cifras.aceptado)}</dd></div>
              <div><dt>Enviado, sin respuesta</dt><dd className="pl-mono" data-tone="info">{money(cifras.enviado)}</dd></div>
              <div><dt>Borradores sin enviar</dt><dd className="pl-mono" data-tone="warning">{money(cifras.borradores)}</dd></div>
              <div data-rule><dt>Cobros preparados · sin IVA</dt><dd className="pl-mono" data-tone="success">{money(cifras.cobros)}</dd></div>
            </dl>
          </section>
        )}
      </aside>
      <TaskDialog task={abierta ? data.tasks.find(t => t.id === abierta.id) ?? null : null} onClose={() => setAbierta(null)} />
    </div>
  );
}
