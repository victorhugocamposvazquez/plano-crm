"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Printer, ArrowLeft, Palette, ImagePlus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { BudgetDocument } from "@/components/documents/budget-document";
import { PresentationDrawer } from "@/components/documents/presentation-drawer";
import { useBranding } from "@/lib/use-branding";
import { useQueryState } from "@/lib/use-query-state";
import { cargarPresentacion, presentacionVacia, tienePresentacion, type Presentacion } from "@/lib/presentacion";

/** Vista de impresión de una revisión con la identidad de la organización y la presentación de este presupuesto; se guarda en PDF con «Imprimir». */
export default function ImprimirPresupuestoPage() {
  const { version: versionId } = useParams<{ version: string }>();
  const { data, loading } = useWorkspace();
  const [branding, , brandingReady] = useBranding();
  const [portadaParam, setPortadaParam] = useQueryState<"1" | "0" | "">("portada", "");
  const [editando, setEditando] = useQueryState<"1" | "">("presentacion", "");
  const [presentacion, setPresentacion] = useState<Presentacion>(presentacionVacia);
  const version = data.versions.find(v => v.id === versionId);
  const budget = version ? data.budgets.find(b => b.id === version.budget_id) : undefined;
  const project = budget ? data.projects.find(p => p.id === budget.project_id) : undefined;
  const ambitos = project ? data.budgets.filter(b => b.project_id === project.id) : [];
  const ambito = ambitos.length > 1 && budget ? ambitos.findIndex(b => b.id === budget.id) + 1 : undefined;
  const portada = portadaParam ? portadaParam === "1" : branding.cover_enabled || Boolean(presentacion.cover_image_data_url);

  useEffect(() => { if (budget) setPresentacion(cargarPresentacion(budget.id)); }, [budget?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (project && version) document.title = `${project.code} V${version.number} · ${budget?.title ?? "Presupuesto"} · ${project.client_name}`; }, [project, version, budget]);

  if (loading || !brandingReady) return <p className="muted" style={{ padding: 24 }}>Preparando el documento…</p>;
  if (!version || !budget || !project) return <div className="empty" style={{ margin: 24 }}><strong>Esa revisión no existe</strong><Link href="/presupuestos" className="btn btn-secondary">Ir a presupuestos</Link></div>;

  return (
    <>
      <div className="print-bar">
        <Link href={`/proyectos/${project.id}?s=budget&p=${budget.id}`} className="btn btn-ghost"><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />Volver a la ficha</Link>
        <div className="print-tools">
          <label className="print-toggle"><input type="checkbox" checked={portada} onChange={e => setPortadaParam(e.target.checked ? "1" : "0")} />Con portada</label>
          <button type="button" className="btn btn-secondary" onClick={() => setEditando("1")} aria-haspopup="dialog"><ImagePlus size={15} strokeWidth={1.8} aria-hidden="true" />Presentación{tienePresentacion(presentacion) ? " ·" : ""}</button>
          <Link href="/configuracion/identidad" className="btn btn-ghost" title="Logo, colores, portada y datos legales de la empresa"><Palette size={15} strokeWidth={1.8} aria-hidden="true" />Identidad</Link>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={16} strokeWidth={1.7} aria-hidden="true" />Imprimir o guardar en PDF</button>
        </div>
      </div>
      <BudgetDocument branding={branding} project={project} budget={budget} version={version} ambito={ambito} cover={portada} presentacion={presentacion} />
      <PresentationDrawer open={editando === "1"} onClose={() => setEditando("")} budgetId={budget.id} budgetTitle={budget.title} value={presentacion} onChange={setPresentacion} />
    </>
  );
}
