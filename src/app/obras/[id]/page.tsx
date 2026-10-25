"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Ellipsis } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Tabs } from "@/components/ui/tabs";
import { Button, LinkButton } from "@/components/ui/button";
import { ProjectStatus, PurchaseStatus, Meter } from "@/components/ui/status";
import { projectProgress, money, totals, dateLabel, compareVersions, kindNames, lineTotal, type BudgetVersion, type ItemChange } from "@/lib/domain";

type Section = "budget" | "documents" | "chat" | "purchases";

export default function ObraPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading } = useWorkspace();
  const [section, setSection] = useState<Section>("budget");

  const project = data.projects.find(p => p.id === id);
  const budget = data.budgets.find(b => b.project_id === id);
  const versions = useMemo(() => data.versions.filter(v => v.budget_id === budget?.id).sort((a, b) => b.number - a.number), [data.versions, budget?.id]);
  const approved = versions.find(v => v.id === budget?.approved_version_id);
  const working = versions.find(v => v.status === "draft" || v.status === "issued");
  const changes: ItemChange[] = approved && working ? compareVersions(approved, working) : [];
  const delta = changes.reduce((sum, c) => sum + c.delta, 0);
  const shown: BudgetVersion | undefined = working ?? approved;
  const certified = data.certifications.filter(c => c.project_id === id).reduce((sum, c) => sum + c.amount, 0);
  const documents = data.documents.filter(d => d.project_id === id);
  const messages = data.messages.filter(m => m.project_id === id);
  const purchases = data.purchases.filter(p => p.project_id === id);
  const tasks = data.tasks.filter(t => t.project_id === id);

  if (loading) return <p className="muted">Cargando la obra…</p>;
  if (!project) return <div className="empty"><strong>Obra no encontrada</strong><LinkButton href="/obras" variant="ghost">Volver a obras</LinkButton></div>;

  const progress = projectProgress(data, project.id);
  const changeFor = (itemId: string) => changes.find(c => c.id === itemId);

  return (
    <div className="page">
      <div>
        <div className="eyebrow">
          <Link href="/obras" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}><ArrowLeft size={13} strokeWidth={1.8} aria-hidden="true" />Obras</Link>
          <span>· {project.code} · {kindNames[project.kind]}</span>
        </div>
        <div className="page-head">
          <h1 className="h2" style={{ fontSize: "var(--pl-text-h1)" }}>{project.name}</h1>
          <Button variant="icon" aria-label="Más acciones"><Ellipsis size={19} strokeWidth={1.55} aria-hidden="true" /></Button>
        </div>
        <p className="subtitle">{project.client_name} · {project.location} · desde {dateLabel(project.created_at)}</p>
      </div>

      <div className="detail">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="panel">
            <div className="panel-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <ProjectStatus status={project.status} />
                <span className="pl-mono text-sm">{progress}%</span>
              </div>
              <div style={{ marginTop: 9 }}><Meter value={progress} label={`Avance de ${project.name}`} /></div>
              <p className="muted text-xs" style={{ marginTop: 8 }}>{tasks.filter(t => t.status === "done").length} de {tasks.length} tareas completadas · avance ponderado por tarea</p>
            </div>
            <div className="kpis">
              <div className="kpi"><small>Aprobado</small><strong>{approved ? money(totals(approved.items).total) : "—"}</strong></div>
              <div className="kpi"><small>Certificado</small><strong>{certified ? money(certified) : "—"}</strong></div>
              <div className="kpi"><small>En revisión</small><strong>{working ? money(totals(working.items).total) : "—"}</strong></div>
            </div>
          </div>

          <Tabs label="Secciones de la obra" value={section} onChange={setSection} options={[
            { id: "budget", label: "Presupuesto", count: versions.length },
            { id: "documents", label: "Documentos", count: documents.length },
            { id: "chat", label: "Chat", count: messages.length },
            { id: "purchases", label: "Compras", count: purchases.length }
          ]} />

          {section === "budget" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {!budget && <div className="empty"><strong>Esta obra aún no tiene presupuesto</strong><span className="muted text-sm">Se crea desde la visita o desde el catálogo de artículos.</span></div>}
              {versions.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {approved && <span className="chip-version" data-kind="approved"><span>V{approved.number} · aprobada para obra · {dateLabel(approved.approved_at ?? approved.updated_at)}</span><span className="pl-mono">{money(totals(approved.items).total)}</span></span>}
                  {working && <span className="chip-version" data-kind="draft"><span>V{working.number} · {working.status === "draft" ? "en revisión" : "revisión cerrada"} · {working.created_by_name}, {dateLabel(working.updated_at)}</span><span className="pl-mono">{approved ? `${delta >= 0 ? "+" : "−"}${money(Math.abs(delta))}` : money(totals(working.items).total)}</span></span>}
                  {!approved && !working && versions[0] && <span className="chip-version" data-kind="draft"><span>V{versions[0].number} · {versions[0].change_reason}</span><span className="pl-mono">{money(totals(versions[0].items).total)}</span></span>}
                </div>
              )}
              {shown && (
                <div>
                  <div className="section-label"><span>Partidas de la V{shown.number}{approved && working ? " · cambios respecto a la aprobada" : ""}</span><span className="pl-mono">{shown.items.length}</span></div>
                  <div style={{ borderTop: "var(--pl-hairline) solid var(--pl-line)" }}>
                    {shown.items.map(item => {
                      const change = changeFor(item.id);
                      const note = !change ? (approved && working ? "Sin cambios" : item.chapter)
                        : change.kind === "added" ? `Añadida en V${shown.number}`
                        : `Cambiado · ${change.fields.map(f => f === "quantity" ? `${change.before?.quantity} → ${change.after?.quantity} ${item.unit}` : f === "unit_price" ? `${money(change.before?.unit_price ?? 0)} → ${money(change.after?.unit_price ?? 0)}` : f === "adjustment_percent" ? `ajuste ${change.after?.adjustment_percent}%` : f).join(" · ")}`;
                      return (
                        <div key={item.id} className="row-item">
                          <span><strong>{item.description}</strong><small className={change ? "warning" : ""}>{note}{item.inclusion !== "included" ? ` · ${item.inclusion === "optional" ? "Alternativa" : "Excluida"}` : ""}</small></span>
                          <span className="pl-mono muted text-xs">{item.quantity} {item.unit}</span>
                          <span className="pl-mono">{money(lineTotal(item))}</span>
                        </div>
                      );
                    })}
                    {changes.filter(c => c.kind === "removed").map(change => (
                      <div key={change.id} className="row-item">
                        <span><strong style={{ textDecoration: "line-through", color: "var(--pl-muted)" }}>{change.before?.description}</strong><small className="warning">Eliminada en V{working?.number}</small></span>
                        <span className="pl-mono muted text-xs">{change.before?.quantity} {change.before?.unit}</span>
                        <span className="pl-mono muted">−{money(Math.abs(change.delta))}</span>
                      </div>
                    ))}
                  </div>
                  <p className="muted text-xs" style={{ marginTop: 10 }}>Base {money(totals(shown.items).base)} · IVA {money(totals(shown.items).tax)} · Total {money(totals(shown.items).total)}</p>
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

          {section === "documents" && (
            documents.length === 0
              ? <div className="empty"><strong>Aún no hay documentos</strong><span className="muted text-sm">Planos, contratos y fotos de antes, durante y después se adjuntan aquí.</span><Button variant="secondary">Adjuntar documento</Button></div>
              : <div>{documents.map(doc => <div key={doc.id} className="row-doc"><span>{doc.name}<small>{doc.category} · {dateLabel(doc.created_at)}</small></span></div>)}</div>
          )}

          {section === "chat" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.length === 0 && <div className="empty"><strong>Sin mensajes</strong><span className="muted text-sm">La conversación de la obra la ven todos los perfiles con acceso.</span></div>}
              {messages.map(message => (
                <div key={message.id} className="panel"><div className="panel-body"><p className="text-sm">{message.body}</p><p className="muted text-xs" style={{ marginTop: 8 }}>{message.author_name} · {dateLabel(message.created_at)}</p></div></div>
              ))}
            </div>
          )}

          {section === "purchases" && (
            purchases.length === 0
              ? <div className="empty"><strong>Sin materiales previstos</strong><span className="muted text-sm">La lista de compras se vincula al presupuesto aprobado.</span></div>
              : <div style={{ borderTop: "var(--pl-hairline) solid var(--pl-line)" }}>{purchases.map(purchase => (
                  <div key={purchase.id} className="row-item">
                    <span><strong>{purchase.name}</strong><small>{purchase.supplier} · recibido {purchase.received_quantity}/{purchase.quantity} {purchase.unit}</small></span>
                    <span />
                    <PurchaseStatus status={purchase.status} />
                  </div>
                ))}</div>
          )}
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div className="section-label" style={{ marginTop: 0 }}><span>Tareas</span><span className="pl-mono">{tasks.filter(t => t.status === "pending").length} pendientes</span></div>
            <div className="panel">
              {tasks.length === 0 && <div className="panel-body muted text-sm">Sin tareas planificadas.</div>}
              {tasks.map((task, i) => (
                <div key={task.id} className="panel-row" style={i === 0 ? { borderTop: 0 } : undefined}>
                  <span style={{ minWidth: 0 }}><span style={{ display: "block", textDecoration: task.status === "done" ? "line-through" : undefined, color: task.status === "done" ? "var(--pl-muted)" : undefined }}>{task.title}</span><small className="muted text-xs">{task.trade} · {task.assignee || "Sin asignar"} · {dateLabel(task.due_date)}</small></span>
                  <span className="pl-mono muted text-xs">{task.weight}%</span>
                </div>
              ))}
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
    </div>
  );
}
