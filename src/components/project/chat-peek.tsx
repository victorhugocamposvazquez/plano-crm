"use client";
import { budgetHistory } from "@/lib/budget-history";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, FileText } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { ProjectStatus, Meter, progressTone } from "@/components/ui/status";
import { useWorkspace } from "@/components/workspace-provider";
import { BudgetPeek } from "@/components/project/budget-peek";
import { TaskRow } from "@/components/project/task-row";
import { TaskDialog } from "@/components/project/task-dialog";
import { PurchasesPanel } from "@/components/project/purchases-panel";
import { DocumentsPanel } from "@/components/project/documents-panel";
import { NextStep } from "@/components/project/next-step";
import { BudgetDocument } from "@/components/documents/budget-document";
import { useBranding } from "@/lib/use-branding";
import { cargarPresentacion, presentacionVacia } from "@/lib/presentacion";
import { siguientePaso, type TipoAccion } from "@/lib/siguiente-paso";
import { localDate } from "@/lib/hoy";
import { can, money, totals, dateLabel, versionStatus, projectProgress, kindNames, type Task } from "@/lib/domain";
import type { VistaChat } from "@/lib/chat-comandos";

type Vista = Exclude<VistaChat, { kind: "buscar" } | { kind: "ayuda" } | { kind: "aviso" }>;

/**
 * Lo que se consulta desde el chat se abre aquí, encima de la conversación, con lo mismo que se vería
 * en la ficha (tareas que se pueden marcar, compras con su flujo, documentos con su subida…). Al cerrar
 * se sigue en el chat; «Ir a la ficha» es siempre un botón explícito al pie.
 */
export function ChatPeek({ vista, projectId, onChange, onClose }: { vista: Vista | null; projectId: string; onChange: (v: Vista) => void; onClose: () => void }) {
  const { data, actor, busy, send, notify } = useWorkspace();
  const [tarea, setTarea] = useState<Task | null>(null);
  const [pendingTask, setPendingTask] = useState<string | null>(null);
  const project = data.projects.find(p => p.id === projectId);
  const canToggle = can(actor.role, "task.toggle");
  const [branding] = useBranding();
  // El documento se pinta aquí mismo con la identidad y la presentación guardadas, igual que en la página de impresión.
  const docVersion = vista?.kind === "pdf" ? data.versions.find(v => v.id === vista.versionId) : undefined;
  const docBudget = docVersion ? data.budgets.find(b => b.id === docVersion.budget_id) : undefined;
  const presentacion = useMemo(() => (docBudget ? cargarPresentacion(docBudget.id) : presentacionVacia), [docBudget?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleTask(task: Task) {
    if (!canToggle || busy || pendingTask) return;
    setPendingTask(task.id);
    try { await send({ type: "task.toggle", id: task.id, status: task.status === "done" ? "pending" : "done" }); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido actualizar la tarea."); }
    finally { setPendingTask(null); }
  }

  if (!project) return null;
  const budgets = data.budgets.filter(b => b.project_id === projectId);
  const versiones = data.versions.filter(v => budgets.some(b => b.id === v.budget_id)).map(v => ({ v, b: budgets.find(b => b.id === v.budget_id)! })).sort((a, z) => z.v.number - a.v.number);
  const ultima = versiones[0];
  const ficha = (s?: string) => `/proyectos/${projectId}${s ? `?s=${s}` : ""}`;

  const titulo = !vista ? "" : vista.kind === "presupuesto" ? "Presupuesto" : vista.kind === "versiones" ? "Revisiones del presupuesto" : vista.kind === "pdf" ? "Documento del presupuesto" : vista.kind === "tareas" ? "Tareas del proyecto" : vista.kind === "compras" ? "Compras y materiales" : vista.kind === "documentos" ? "Documentos del proyecto" : vista.kind === "cliente" ? "Cliente" : "Cómo va el proyecto";
  const destino = !vista ? ficha() : vista.kind === "presupuesto" || vista.kind === "versiones" || vista.kind === "pdf" ? ficha("budget") : vista.kind === "compras" ? ficha("purchases") : vista.kind === "documentos" ? ficha("documents") : vista.kind === "cliente" ? `/clientes?q=${encodeURIComponent(project.client_name)}` : ficha();
  const pdfDe = vista?.kind === "presupuesto" ? data.versions.find(v => v.id === vista.versionId) : undefined;

  function accionPaso(tipo: TipoAccion) {
    if (tipo === "tareas" || tipo === "planificar") { onChange({ kind: "tareas" }); return; }
    if (tipo === "tarea") { const t = siguientePaso(data, project!).tarea; if (t) setTarea(t); return; }
    if (ultima && (tipo === "editar" || tipo === "cerrar" || tipo === "aprobar")) { onChange({ kind: "presupuesto", versionId: ultima.v.id }); return; }
    window.location.assign(ficha(tipo === "presupuesto" ? "budget" : undefined));
  }

  const footer = vista ? (
    <>
      {pdfDe && pdfDe.items.length > 0 && <Link href={`/imprimir/presupuesto/${pdfDe.id}`} target="_blank" rel="noopener" className="btn btn-secondary"><FileText size={15} strokeWidth={1.8} aria-hidden="true" />PDF<ExternalLink size={12} strokeWidth={1.8} aria-hidden="true" /></Link>}
      {vista.kind === "pdf" && <a href={`/imprimir/presupuesto/${vista.versionId}`} target="_blank" rel="noopener" className="btn btn-secondary"><FileText size={15} strokeWidth={1.8} aria-hidden="true" />Imprimir o guardar en PDF<ExternalLink size={12} strokeWidth={1.8} aria-hidden="true" /></a>}
      <Link href={destino} className="btn btn-ghost" style={{ marginRight: "auto" }}>Ir a la ficha<ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" /></Link>
      <button type="button" className="btn btn-primary" onClick={onClose}>Volver al chat</button>
    </>
  ) : undefined;

  const tasks = data.tasks.filter(t => t.project_id === projectId).sort((a, b) => (a.status === b.status ? a.due_date.localeCompare(b.due_date) : a.status === "pending" ? -1 : 1));
  const progress = projectProgress(data, projectId);
  const atrasadas = tasks.filter(t => t.status === "pending" && t.due_date < localDate()).length;
  const meterTone = progressTone({ overdue: atrasadas, done: project.status === "completed" || progress >= 100 });
  const aprobada = versiones.find(x => x.b.approved_version_id === x.v.id);
  const enCurso = versiones.find(x => budgetHistory(x.b, data.versions).working?.id === x.v.id);
  const delCliente = data.projects.filter(p => p.client_name === project.client_name);

  return (
    <>
      <Modal open={Boolean(vista)} onClose={onClose} title={titulo} size="wide" footer={footer}>
        {vista?.kind === "presupuesto" && <BudgetPeek versionId={vista.versionId} data={data} onVersion={id => onChange({ kind: "presupuesto", versionId: id })} />}
        {vista?.kind === "versiones" && (
          versiones.length === 0 ? <p className="muted text-sm">Este proyecto todavía no tiene presupuesto. Se crea desde la ficha, en «Presupuesto».</p> : (
            <ul className="info-list">{versiones.map(x => <li key={x.v.id}><button type="button" className="info-row" onClick={() => onChange({ kind: "presupuesto", versionId: x.v.id })}><span style={{ minWidth: 0, flex: 1 }}><strong>V{x.v.number} · {x.b.title}</strong><small className="muted">{x.b.approved_version_id === x.v.id ? "Aprobada para obra" : versionStatus[x.v.status]} · {dateLabel(x.v.updated_at)} · {x.v.created_by_name}</small></span><span className="pl-mono text-sm">{money(totals(x.v.items).base)}</span><ArrowRight size={14} strokeWidth={1.7} aria-hidden="true" className="muted" /></button></li>)}</ul>
          )
        )}
        {vista?.kind === "pdf" && docVersion && docBudget && (
          <div className="peek-doc"><BudgetDocument branding={branding} project={project} budget={docBudget} version={docVersion} ambito={budgets.length > 1 ? budgets.findIndex(b => b.id === docBudget.id) + 1 : undefined} cover={branding.cover_enabled || Boolean(presentacion.cover_image_data_url)} presentacion={presentacion} /></div>
        )}
        {vista?.kind === "tareas" && (
          <div className="panel">
            {tasks.length === 0 && <div className="panel-body muted text-sm">Sin tareas planificadas. Se añaden desde el menú «···» de la ficha.</div>}
            {tasks.map(task => <div key={task.id} style={{ padding: "0 14px" }}><TaskRow task={task} canToggle={canToggle} pending={pendingTask === task.id} showDate compact onToggle={toggleTask} onOpen={setTarea} /></div>)}
          </div>
        )}
        {vista?.kind === "compras" && <PurchasesPanel projectId={projectId} purchases={data.purchases.filter(p => p.project_id === projectId)} />}
        {vista?.kind === "documentos" && <DocumentsPanel project={project} documents={data.documents.filter(d => d.project_id === projectId)} />}
        {vista?.kind === "cliente" && (
          <div className="peek-client">
            <p><strong className="h3">{project.client_name}</strong>{project.location && <span className="muted text-sm" style={{ display: "block" }}>Obra en {project.location}</span>}</p>
            <p className="muted text-xs" style={{ margin: "12px 0 6px" }}>{delCliente.length === 1 ? "Su único proyecto con nosotros" : `${delCliente.length} proyectos con nosotros`}</p>
            <ul className="info-list">{delCliente.map(p => <li key={p.id}>{p.id === projectId ? <span className="info-row" aria-current="true"><span style={{ minWidth: 0, flex: 1 }}><strong>{p.name}</strong><small className="muted">{p.code} · {kindNames[p.kind]} · este proyecto</small></span><ProjectStatus status={p.status} /></span> : <Link href={`/proyectos/${p.id}`} className="info-row"><span style={{ minWidth: 0, flex: 1 }}><strong>{p.name}</strong><small className="muted">{p.code} · {kindNames[p.kind]}</small></span><ProjectStatus status={p.status} /><ArrowRight size={14} strokeWidth={1.7} aria-hidden="true" className="muted" /></Link>}</li>)}</ul>
          </div>
        )}
        {vista?.kind === "estado" && (
          <div className="peek-state">
            <p style={{ margin: 0 }}><strong className="h3">{project.name}</strong><span className="muted text-sm" style={{ display: "block" }}>{project.code} · {project.client_name}{project.location ? ` · ${project.location}` : ""}</span></p>
            <NextStep paso={siguientePaso(data, project)} busy={busy} onAccion={accionPaso} />
            <div className="panel">
              <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><ProjectStatus status={project.status} /><span className="pl-mono text-sm progress-value" data-tone={meterTone}>{progress}%</span></span>
                <Meter value={progress} label={`Avance de ${project.name}`} tone={meterTone} />
                <span className="muted text-xs">{tasks.filter(t => t.status === "done").length} de {tasks.length} tareas completadas · avance ponderado por tarea{atrasadas ? ` · ${atrasadas} atrasada${atrasadas === 1 ? "" : "s"}` : ""}</span>
              </div>
              <dl className="peek-totals" style={{ border: 0, borderTop: "var(--pl-hairline) solid var(--pl-line)", borderRadius: 0 }}>
                <div><dt>Aprobado · sin IVA</dt><dd className="pl-mono">{aprobada ? money(totals(aprobada.v.items).base) : "—"}</dd></div>
                <div><dt>En revisión · sin IVA</dt><dd className="pl-mono">{enCurso ? money(totals(enCurso.v.items).base) : "—"}</dd></div>
                <div><dt>Tareas pendientes</dt><dd className="pl-mono">{tasks.filter(t => t.status === "pending").length}</dd></div>
              </dl>
            </div>
            <div>
              <div className="section-label" style={{ marginTop: 0 }}><span>Última actividad</span></div>
              {data.activities.filter(a => a.project_id === projectId).slice(0, 5).map(a => <div key={a.id} className="row-doc"><span>{a.text}<small>{a.actor_name} · {dateLabel(a.created_at)}</small></span></div>)}
              {!data.activities.some(a => a.project_id === projectId) && <p className="muted text-sm">Todavía no hay actividad registrada.</p>}
            </div>
          </div>
        )}
      </Modal>
      <TaskDialog task={tarea ? data.tasks.find(t => t.id === tarea.id) ?? null : null} onClose={() => setTarea(null)} />
    </>
  );
}
