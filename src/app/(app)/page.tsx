"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { useWorkspace, usePuesto } from "@/components/workspace-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { TaskDialog } from "@/components/project/task-dialog";
import { budgetHistory } from "@/lib/budget-history";
import { Onboarding } from "@/components/onboarding";
import { InstallHint } from "@/components/install-hint";
import { emitidas, facturasDe, sumaBase } from "@/lib/facturas";
import { textoMovimiento } from "@/lib/pasos";
import { loTuyo, resumenOtras, tituloTuyo } from "@/lib/lo-tuyo";
import { puestoNombres } from "@/lib/puestos";
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
    cobrado: sumaBase(facturasDe(data).filter(f => f.paid_on?.startsWith(mes))), facturado: sumaBase(emitidas(facturasDe(data)).filter(f => f.issue_date?.startsWith(mes)))
  };
}

export default function HoyPage() {
  const { data, actor, loading, busy, send, notify } = useWorkspace();
  const today = localDate();
  const agenda = useMemo(() => buildAgenda(data, today), [data, today]);
  const puesto = usePuesto();
  // Una sola fuente para Hoy, la barra y el menú: lo tuyo según el puesto, y lo que espera a otros.
  const { tuyas, otras } = useMemo(() => loTuyo(data, actor, puesto, today), [data, actor, puesto, today]);
  const primero = tuyas[0];
  const nuevas = useMemo(() => novedades(data, actor.name), [data, actor.name]);
  const cifras = useMemo(() => empresa(data, today), [data, today]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<Task | null>(null);
  const canToggle = can(actor.role, "task.toggle");
  const firstName = actor.name.split(/[\s·]+/)[0] ?? "";
  const esperan = tuyas.length;

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
    esperan ? `${esperan} ${esperan === 1 ? "cosa te toca" : "cosas te tocan"}` : "nada te toca",
    agenda.overdue.length ? `${agenda.overdue.length} ${agenda.overdue.length === 1 ? "tarea atrasada" : "tareas atrasadas"}` : ""
  ].filter(Boolean).join(" · ");
  const tareasHoy = [...agenda.overdue, ...agenda.today];
  const verEmpresa = puesto === "direccion" && veSeccion(actor.role, "/finanzas");

  return (
    <div className="page today">
      <div className="today-main">
        <div className="solo-escritorio"><h1 className="pl-title">{greeting()}{firstName ? `, ${firstName}` : ""}</h1><p className="pl-sub">{resumen}</p></div>
        <div className="solo-movil today-phone-head"><small>{longDate(today).replace(/^./, c => c.toUpperCase())} · {puestoNombres[puesto]}</small><h1 className="pl-title">Hoy</h1></div>
        <Onboarding />
        <InstallHint />

        {tuyas.length > 0 && <section className="solo-movil phone-todo" aria-label={tituloTuyo[puesto]}>
          <h2 className="phone-section"><span>{tituloTuyo[puesto]}</span><span className="pl-mono">{tuyas.length}</span></h2>
          {tuyas.slice(0, 4).map((c, i) => (
            <article key={c.id} className="todo-card" data-tone={c.tono}>
              <header><span>{c.kicker}</span></header>
              <strong>{c.titulo}</strong>
              {c.detalle && <small>{c.detalle}</small>}
              <LinkButton variant={i === 0 ? "primary" : "secondary"} href={c.href}>{c.label}</LinkButton>
            </article>
          ))}
          {tuyas.length > 4 && <Link href="/proyectos?quien=yo" className="link-inline text-sm">Ver las {tuyas.length}</Link>}
        </section>}

        {primero && (
          <section className="first-card solo-escritorio" data-tone={primero.tono} aria-label="Lo primero">
            <div className="first-card-kicker">Lo primero · {primero.kicker}</div>
            <div className="first-card-body">
              <div><strong>{primero.titulo}</strong><p>{primero.detalle}</p></div>
              <LinkButton variant="primary" data-accent="orange" href={primero.href}>{primero.label}</LinkButton>
            </div>
          </section>
        )}
        {!primero && !loading && <section className="first-card today-calm" data-tone="success" aria-label="Lo primero"><div className="first-card-body"><div><strong>Hoy no hay nada urgente</strong><p>Nada de {puestoNombres[puesto].toLocaleLowerCase()} está esperando.</p></div></div></section>}

        {tuyas.length > 1 && (
          <section className="pl-card solo-escritorio" aria-label={tituloTuyo[puesto]}>
            <header className="pl-card-head"><strong>{tituloTuyo[puesto]} <span className="muted" style={{ fontWeight: 400 }}>· {tuyas.length}</span></strong><Link href="/proyectos">Ver todos →</Link></header>
            <div className="need-list">
              {tuyas.slice(1, 6).map(c => (
                <Link key={c.id} href={c.href} className="need-row">
                  <span className="need-text"><strong>{c.titulo}{c.detalle ? <span> · {c.detalle}</span> : null}</strong><small>{c.kicker}</small></span>
                  <span className="need-action">{c.label} <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {otras.length > 0 && (
          <details className="pl-card otras">
            <summary>Esperan a otros <span className="muted">· {resumenOtras(otras)}</span></summary>
            <div className="otras-lista">{otras.slice(0, 6).map(c => <Link key={c.id} href={c.href} className="otras-fila" data-tone={c.tono}><i aria-hidden="true" /><span><strong>{c.titulo}</strong><small>{c.kicker}{c.detalle ? ` · ${c.detalle}` : ""}</small></span><ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" /></Link>)}</div>
          </details>
        )}

        <section className="pl-card" aria-label="Hoy en obra">
          <header className="pl-card-head"><strong><span className="solo-movil-inline">Agenda de hoy</span><span className="solo-escritorio-inline">Hoy en obra</span> <span className="muted" style={{ fontWeight: 400 }}>· {tareasHoy.length} {tareasHoy.length === 1 ? "tarea" : "tareas"}</span></strong><Link href="/agenda">Ver la semana →</Link></header>
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
              <div data-rule><dt>Facturado · sin IVA</dt><dd className="pl-mono">{money(cifras.facturado)}</dd></div>
              <div><dt>Cobrado · sin IVA</dt><dd className="pl-mono" data-tone="success">{money(cifras.cobrado)}</dd></div>
            </dl>
          </section>
        )}
      </aside>
      <TaskDialog task={abierta ? data.tasks.find(t => t.id === abierta.id) ?? null : null} onClose={() => setAbierta(null)} />
    </div>
  );
}
