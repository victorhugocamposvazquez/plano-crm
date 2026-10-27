"use client";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Printer, ArrowLeft, Palette } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PurchaseOrderDocument } from "@/components/documents/purchase-order-document";
import { useBranding } from "@/lib/use-branding";
import { useQueryState } from "@/lib/use-query-state";
import { pedidosPorProveedor, lineasHoja } from "@/lib/hoja-pedido";

/** Vista de impresión de la hoja de pedido de un proveedor para un proyecto (`?p=<proveedor>`). */
export default function ImprimirPedidoPage() {
  const { project: projectId } = useParams<{ project: string }>();
  const { data, loading } = useWorkspace();
  const [branding, , brandingReady] = useBranding();
  const [slug, setSlug] = useQueryState<string>("p", "");
  const [soloNuevos, setSoloNuevos] = useQueryState<"1" | "">("nuevos", "");
  const project = data.projects.find(p => p.id === projectId);
  const grupos = useMemo(() => pedidosPorProveedor(data.purchases.filter(p => p.project_id === projectId)), [data.purchases, projectId]);
  const grupo = grupos.find(g => g.slug === slug) ?? grupos[0];
  const items = grupo ? lineasHoja(grupo.items, soloNuevos !== "1") : [];

  useEffect(() => { if (project && grupo) document.title = `Pedido · ${grupo.supplier} · ${project.code}`; }, [project, grupo]);

  if (loading || !brandingReady) return <p className="muted" style={{ padding: 24 }}>Preparando la hoja de pedido…</p>;
  if (!project || !grupo) return <div className="empty" style={{ margin: 24 }}><strong>No hay materiales que pedir en este proyecto</strong><Link href="/compras" className="btn btn-secondary">Ir a compras</Link></div>;

  return (
    <>
      <div className="print-bar">
        <Link href={`/proyectos/${project.id}?s=purchases`} className="btn btn-ghost"><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />Volver a la ficha</Link>
        <div className="print-tools">
          {grupos.length > 1 && (
            <div className="chips chips-compact" role="group" aria-label="Proveedor">
              {grupos.map(g => <button key={g.slug} type="button" className="chip" aria-pressed={g.slug === grupo.slug} onClick={() => setSlug(g.slug)}>{g.supplier} <span className="pl-mono muted">{g.pendientes}</span></button>)}
            </div>
          )}
          <label className="print-toggle"><input type="checkbox" checked={soloNuevos === "1"} onChange={e => setSoloNuevos(e.target.checked ? "1" : "")} />Solo lo nuevo</label>
          <Link href="/configuracion/identidad" className="btn btn-ghost" title="Logo, colores y datos legales"><Palette size={15} strokeWidth={1.8} aria-hidden="true" />Identidad</Link>
          <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={items.length === 0}><Printer size={16} strokeWidth={1.7} aria-hidden="true" />Imprimir o guardar en PDF</button>
        </div>
      </div>
      {items.length === 0
        ? <div className="empty" style={{ margin: 24 }}><strong>Nada que pedir a {grupo.supplier}</strong><span className="muted text-sm">Todo lo de este proveedor está recibido o en obra{soloNuevos === "1" ? ", o ya pedido" : ""}.</span></div>
        : <PurchaseOrderDocument branding={branding} project={project} supplier={grupo.supplier} slug={grupo.slug} items={items} />}
    </>
  );
}
