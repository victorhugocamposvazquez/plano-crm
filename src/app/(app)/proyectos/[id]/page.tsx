"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Ellipsis, MessageSquare, Plus, PenLine, Footprints } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { BackLink } from "@/components/ui/back-link";
import { TaskRow } from "@/components/project/task-row";
import { TaskDialog } from "@/components/project/task-dialog";
import { useQueryState } from "@/lib/use-query-state";
import { useWorkspace } from "@/components/workspace-provider";
import { Tabs } from "@/components/ui/tabs";
import { Button, LinkButton } from "@/components/ui/button";
import { ProjectStatus, Meter, progressTone } from "@/components/ui/status";
import { localDate } from "@/lib/hoy";
import { DocumentsPanel } from "@/components/project/documents-panel";
import { ChatPanel } from "@/components/project/chat-panel";
import { PurchasesPanel } from "@/components/project/purchases-panel";
import { BudgetEditor } from "@/components/project/budget-editor";
import { projectProgress, money, totals, dateLabel, compareVersions, kindNames, lineTotal, can, type Budget, type BudgetVersion, type ItemChange, type Task, type Workspace } from "@/lib/domain";

type Section = "budget" | "documents" | "purchases";

/** Revisión aprobada de un presupuesto, si la hay. */
function approvedOf(data: Workspace, budget: Budget | undefined) {
  return budget?.approved_version_id ? data.versions.find(v => v.id === budget.approved_version_id) : undefined;
}

/** Importe firmado en base (sin IVA): las comparaciones usan siempre el mismo criterio que `compareVersions`. */
const signed = (cents: number) => `${cents < 0 ? "−" : "+"}${money(Math.abs(cents))}`;

export default function ObraPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading } = useWorkspace();
  const [section, setSection] = useQueryState<Section>("s", "budget");
  const [budgetParam, setBudgetParam] = useQueryState<string>("p", "");
  const budgetId = budgetParam || null;
  const setBudgetId = (id: string | null) => setBudgetParam(id ?? "");
  const [abierta, setAbierta] = useState<Task | null>(null);
  const [chatParam, setChatParam] = useQueryState<string>("chat", "");
  const [editParam, setEditParam] = useQueryState<string>("editar", "");
  const [pendingEdit, setPendingEdit] = useState(false);
  const chatAbierto = chatParam === "1";
  const [pendingTask, setPendingTask] = useState<string | null>(null);
  const { actor, busy, send, notify } = useWorkspace();
  const canToggle = can(actor.role, "task.toggle");
  async function toggleTask(task: Task) {
    if (!canToggle || busy || pendingTask) return;
    setPendingTask(task.id);
    try { await send({ type: "task.toggle", id: task.id, status: task.status === "done" ? "pending" : "done" }); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido actualizar la tarea."); }
    finally { setPendingTask(null); }
  }

  const project = data.projects.find(p => p.id === id);
  const canBudget = can(actor.role, "budget.create");
  const [creatingBudget, setCreatingBudget] = useState(false);
  /** Abre el primer presupuesto de un proyecto dado de alta en oficina; queda en borrador y seleccionado. */
  async function crearPresupuesto() {
    if (!project || busy || creatingBudget) return;
    setCreatingBudget(true);
    try {
      const ws = await send({ type: "budget.create", project_id: project.id, title: "Presupuesto de reforma" });
      const nuevo = ws.budgets.filter(b => b.project_id === project.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (project.status === "lead") await send({ type: "project.status", id: project.id, status: "estimating" });
      if (nuevo) setBudgetId(nuevo.id);
      setPendingEdit(true);
      notify("Presupuesto abierto en borrador.");
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido abrir el presupuesto."); }
    finally { setCreatingBudget(false); }
  }
  const budgets = useMemo(() => data.budgets.filter(b => b.project_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at)), [data.budgets, id]);
  useEffect(() => { if (budgetId && budgets.length && !budgets.some(b => b.id === budgetId)) setBudgetId(null); }, [budgets, budgetId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Tras abrir el primer presupuesto, el editor se abre con la guía en cuanto la URL apunta a él.
  useEffect(() => { if (pendingEdit && budgetParam) { setEditParam("1"); setPendingEdit(false); } }, [pendingEdit, budgetParam, setEditParam]);
  const budget = budgets.find(b => b.id === budgetId) ?? budgets[0];
  const versions = useMemo(() => data.versions.filter(v => v.budget_id === budget?.id).sort((a, b) => b.number - a.number), [data.versions, budget?.id]);
  const approved = approvedOf(data, budget);
  const working = versions.find(v => v.status === "draft" || v.status === "issued");
  const changes: ItemChange[] = approved && working ? compareVersions(approved, working) : [];
  const deltaBase = changes.reduce((sum, c) => sum + c.delta, 0);
  const shown: BudgetVersion | undefined = working ?? approved ?? versions[0];
  const canSave = can(actor.role, "budget.save");
  const editable = working && working.status === "draft" ? working : undefined;
  const editando = editParam === "1" && Boolean(editable) && canSave;
  // «Estimar en visita» tiene sentido mientras nadie ha puesto una sola partida en el proyecto.
  const sinPartidas = data.versions.filter(v => budgets.some(b => b.id === v.budget_id)).every(v => v.items.length === 0);

  // El total de la obra suma la base aprobada de todos sus ámbitos (apartamento, piso, terraza…).
  const approvedProjectBase = budgets.reduce((sum, b) => { const v = approvedOf(data, b); return sum + (v ? totals(v.items).base : 0); }, 0);
  const approvedScopes = budgets.filter(b => approvedOf(data, b)).length;
  // Las certificaciones de hoy son borradores con importe base: todavía no están validadas ni facturadas.
  const certificationsDraft = data.certifications.filter(c => c.project_id === id).reduce((sum, c) => sum + c.amount, 0);

  const documents = data.documents.filter(d => d.project_id === id);
  const messages = data.messages.filter(m => m.project_id === id);
  const purchases = data.purchases.filter(p => p.project_id === id);
  const tasks = data.tasks.filter(t => t.project_id === id);

  if (loading) return <p className="muted">Cargando el proyecto…</p>;
  if (!project) return <div className="empty"><strong>Proyecto no encontrado</strong><LinkButton href="/proyectos" variant="ghost">Volver a proyectos</LinkButton></div>;

  const progress = projectProgress(data, project.id);
  const overdueTasks = tasks.filter(t => t.status === "pending" && t.due_date < localDate()).length;
  const meterTone = progressTone({ overdue: overdueTasks, done: project.status === "completed" || progress >= 100 });
  const changeFor = (itemId: string) => changes.find(c => c.id === itemId);

  return (
    <div className="page">
      <div>
        <div className="eyebrow">
          <BackLink fallback="/proyectos">Proyectos</BackLink>
          <span>· {project.code} · {kindNames[project.kind]}</span>
        </div>
        <div className="page-head">
          <h1 className="h2" style={{ fontSize: "var(--pl-text-h1)" }}>{project.name}</h1>
          <div className="head-actions">
            {canBudget && sinPartidas && (project.status === "lead" || project.status === "estimating") && <LinkButton href={`/proyectos/nueva?proyecto=${project.id}`} variant="secondary"><Footprints size={17} strokeWidth={1.6} aria-hidden="true" />Estimar en visita</LinkButton>}
            <Button variant="secondary" className="chat-launcher" onClick={() => setChatParam("1")} aria-haspopup="dialog" aria-expanded={chatAbierto}><MessageSquare size={17} strokeWidth={1.6} aria-hidden="true" />Chat<span className="pl-mono">{messages.length}</span></Button>
            <Button variant="icon" aria-label="Más acciones"><Ellipsis size={19} strokeWidth={1.55} aria-hidden="true" /></Button>
          </div>
        </div>
        <p className="subtitle">{[project.client_name, project.location, `desde ${dateLabel(project.created_at)}`].filter(Boolean).join(" · ")}</p>
      </div>

      <div className="detail">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="panel">
            <div className="panel-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <ProjectStatus status={project.status} />
                <span className="pl-mono text-sm progress-value" data-tone={meterTone}>{progress}%</span>
              </div>
              <div style={{ marginTop: 9 }}><Meter value={progress} label={`Avance de ${project.name}`} tone={meterTone} /></div>
              <p className="muted text-xs" style={{ marginTop: 8 }}>{tasks.filter(t => t.status === "done").length} de {tasks.length} tareas completadas · avance ponderado por tarea</p>
            </div>
            <div className="kpis">
              <div className="kpi"><small>Aprobado · sin IVA{approvedScopes > 1 ? ` · ${approvedScopes} ámbitos` : ""}</small><strong>{approvedScopes ? money(approvedProjectBase) : "—"}</strong></div>
              <div className="kpi"><small>Certificaciones en preparación</small><strong>{certificationsDraft ? money(certificationsDraft) : "—"}</strong></div>
              <div className="kpi"><small>En revisión · sin IVA</small><strong>{working ? money(totals(working.items).base) : "—"}</strong></div>
            </div>
          </div>

          <Tabs label="Secciones de la obra" value={section} onChange={setSection} options={[
            { id: "budget", label: budgets.length > 1 ? "Presupuestos" : "Presupuesto", count: versions.length },
            { id: "documents", label: "Documentos", count: documents.length },
            { id: "purchases", label: "Compras", count: purchases.length }
          ]} />

          {section === "budget" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {budgets.length === 0 && (
                <div className="empty">
                  <strong>Este proyecto aún no tiene presupuesto</strong>
                  <span className="muted text-sm">{canBudget ? "Ábrelo aquí con los precios del catálogo; también puede salir de una estimación en la visita." : "Lo abrirá oficina con los precios del catálogo o desde una estimación en la visita."}</span>
                  {canBudget && <Button variant="primary" className="btn-new" disabled={busy || creatingBudget} onClick={crearPresupuesto}><Plus size={17} strokeWidth={1.8} aria-hidden="true" />{creatingBudget ? "Abriendo…" : "Nuevo presupuesto"}</Button>}
                </div>
              )}

              {budgets.length > 1 && (
                <div className="segments" role="tablist" aria-label="Ámbito del presupuesto">
                  {budgets.map(b => {
                    const v = approvedOf(data, b);
                    return (
                      <button key={b.id} type="button" role="tab" className="segment" aria-selected={b.id === budget?.id} onClick={() => setBudgetId(b.id)}>
                        <span>{b.title}</span>
                        <small className="pl-mono">{v ? money(totals(v.items).base) : "sin aprobar"}</small>
                      </button>
                    );
                  })}
                </div>
              )}

              {versions.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {approved && <span className="chip-version" data-kind="approved"><span>V{approved.number} · aprobada para obra · {dateLabel(approved.approved_at ?? approved.updated_at)}</span><span className="pl-mono">{money(totals(approved.items).base)} <small className="muted">sin IVA</small></span></span>}
                  {working && <span className="chip-version" data-kind="draft"><span>V{working.number} · {working.status === "draft" ? (approved ? "cambios en preparación" : "borrador") : "revisión cerrada"} · {working.created_by_name}, {dateLabel(working.updated_at)}</span><span className="pl-mono">{approved ? signed(deltaBase) : money(totals(working.items).base)} <small className="muted">sin IVA</small></span></span>}
                  {!approved && !working && shown && <span className="chip-version" data-kind="draft"><span>V{shown.number} · {shown.change_reason}</span><span className="pl-mono">{money(totals(shown.items).base)} <small className="muted">sin IVA</small></span></span>}
                </div>
              )}

              {shown && (
                <div>
                  <div className="section-label"><span>Partidas de la V{shown.number}{approved && working ? " · cambios respecto a la aprobada" : ""}</span><span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>{editable && canSave && shown.id === editable.id && <button type="button" className="btn btn-ghost" style={{ height: 30 }} onClick={() => setEditParam("1")}><PenLine size={14} strokeWidth={1.8} aria-hidden="true" />Editar partidas</button>}<span className="pl-mono">{shown.items.length}</span></span></div>
                  {shown.items.length === 0 && editable && canSave && shown.id === editable.id && <div className="empty" style={{ padding: "22px 16px" }}><strong>La V{shown.number} está vacía</strong><span className="muted text-sm">Añade partidas del catálogo con la guía por capítulos, o estímalas en la visita.</span><Button variant="primary" className="btn-new" onClick={() => setEditParam("1")}><Plus size={17} strokeWidth={1.8} aria-hidden="true" />Añadir partidas</Button></div>}
                  <div style={{ borderTop: "var(--pl-hairline) solid var(--pl-line)" }}>
                    {shown.items.map(item => {
                      const change = changeFor(item.id);
                      const note = !change ? (approved && working ? "Sin cambios" : item.chapter)
                        : change.kind === "added" ? `Añadida en V${shown.number}`
                        : `Cambiado · ${change.fields.map(f => f === "quantity" ? `${change.before?.quantity} → ${change.after?.quantity} ${item.unit}` : f === "unit_price" ? `${money(change.before?.unit_price ?? 0)} → ${money(change.after?.unit_price ?? 0)}` : f === "adjustment_percent" ? `ajuste ${change.after?.adjustment_percent}%` : f === "description" ? "descripción" : f === "inclusion" ? "inclusión" : f).join(" · ")}`;
                      return (
                        <div key={item.id} className="row-item">
                          <span><strong>{item.description}</strong><small className={change ? "warning" : ""}>{note}{item.inclusion !== "included" ? ` · ${item.inclusion === "optional" ? "Alternativa, no suma" : "Excluida, no suma"}` : ""}</small></span>
                          <span className="pl-mono muted text-xs">{item.quantity} {item.unit}</span>
                          <span className="pl-mono" style={item.inclusion !== "included" ? { color: "var(--pl-muted)" } : undefined}>{money(lineTotal(item))}{change && change.delta !== 0 ? <small className="warning" style={{ display: "block", textAlign: "right" }}>{signed(change.delta)}</small> : null}</span>
                        </div>
                      );
                    })}
                    {changes.filter(c => c.kind === "removed").map(change => (
                      <div key={change.id} className="row-item">
                        <span><strong className="removed" style={{ textDecoration: "line-through" }}>{change.before?.description}</strong><small className="warning">Eliminada en V{working?.number}</small></span>
                        <span className="pl-mono muted text-xs">{change.before?.quantity} {change.before?.unit}</span>
                        <span className="pl-mono muted">{signed(change.delta)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="totals">
                    <span><small>Base</small><strong className="pl-mono">{money(totals(shown.items).base)}</strong></span>
                    <span><small>IVA</small><strong className="pl-mono">{money(totals(shown.items).tax)}</strong></span>
                    <span><small>Total</small><strong className="pl-mono">{money(totals(shown.items).total)}</strong></span>
                    {approved && working && <span><small>Diferencia con la aprobada</small><strong className="pl-mono">{signed(deltaBase)} <span className="muted" style={{ fontWeight: 400 }}>base · {signed(totals(working.items).total - totals(approved.items).total)} total</span></strong></span>}
                  </div>
                  {(shown.notes || (approved && approved.notes && approved.id !== shown.id)) && (
                    <div className="panel" style={{ marginTop: 12 }}>
                      {shown.notes && <div className="panel-body"><small className="muted text-xs">Notas y condiciones · V{shown.number}</small><p className="text-sm" style={{ marginTop: 4 }}>{shown.notes}</p></div>}
                      {approved && approved.notes && approved.id !== shown.id && <div className="panel-body" style={{ borderTop: "var(--pl-hairline) solid var(--pl-line)" }}><small className="muted text-xs">Notas y condiciones · V{approved.number} aprobada</small><p className="text-sm muted" style={{ marginTop: 4 }}>{approved.notes}</p></div>}
                    </div>
                  )}
                </div>
              )}

              {approved && working && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button variant="secondary">Ver cambios completos</Button>
                  <Button variant="primary">Enviar V{working.number} al cliente</Button>
                </div>
              )}
            </div>
          )}

          {section === "documents" && <DocumentsPanel project={project} documents={documents} />}

          {section === "purchases" && <PurchasesPanel projectId={project.id} purchases={purchases} />}
        </div>

        <aside className="zone" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div className="section-label" style={{ marginTop: 0 }}><span>Tareas</span><span className="pl-mono">{tasks.filter(t => t.status === "pending").length} pendientes</span></div>
            <div className="panel">
              {tasks.length === 0 && <div className="panel-body muted text-sm">Sin tareas planificadas.</div>}
              {tasks.map(task => <div key={task.id} style={{ padding: "0 14px" }}><TaskRow task={task} canToggle={canToggle} pending={pendingTask === task.id} showDate compact onToggle={toggleTask} onOpen={setAbierta} /></div>)}
            </div>
          </div>
          <div>
            <div className="section-label" style={{ marginTop: 0 }}><span>Actividad</span></div>
            {data.activities.filter(a => a.project_id === id).slice(0, 5).map(activity => (
              <div key={activity.id} className="row-doc"><span>{activity.text}<small>{activity.actor_name} · {dateLabel(activity.created_at)}</small></span></div>
            ))}
          </div>
        </aside>
      </div>
      <TaskDialog task={abierta ? data.tasks.find(t => t.id === abierta.id) ?? null : null} onClose={() => setAbierta(null)} />
      {editable && <BudgetEditor open={editando} onClose={() => setEditParam("")} project={project} version={editable} guiaInicial={editable.items.length === 0} />}
      <Drawer open={chatAbierto} onClose={() => setChatParam("")} title="Chat del proyecto" subtitle={`${project.name} · lo ve todo el equipo con acceso`}>
        <ChatPanel projectId={project.id} messages={messages} />
      </Drawer>
    </div>
  );
}
