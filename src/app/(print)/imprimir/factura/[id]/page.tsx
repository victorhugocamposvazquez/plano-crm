"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { DocBrand, estiloDocumento } from "@/components/documents/budget-document";
import { lineasLegales } from "@/lib/branding";
import { fechaDocumento } from "@/lib/documento-presupuesto";
import { facturasDe } from "@/lib/facturas";
import { money } from "@/lib/domain";
import { useBranding } from "@/lib/use-branding";

/** Vista de impresión de una factura registrada en Plano. Deja claro que no sustituye a la oficial. */
export default function ImprimirFacturaPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading } = useWorkspace();
  const [branding, , brandingReady] = useBranding();
  const factura = facturasDe(data).find(f => f.id === id);
  const project = data.projects.find(p => p.id === factura?.project_id);
  useEffect(() => { if (factura) document.title = `Factura ${factura.number ?? "borrador"}`; }, [factura]);
  if (loading || !brandingReady) return <p className="muted" style={{ padding: 24 }}>Preparando la factura…</p>;
  if (!factura) return <div className="empty" style={{ margin: 24 }}><strong>Factura no encontrada</strong><Link href="/finanzas" className="btn btn-secondary">Ir a Finanzas</Link></div>;
  const contacto = [branding.phone, branding.email, branding.website].filter(Boolean).join(" · ");
  const legales = lineasLegales(branding);
  return (
    <>
      <div className="print-bar">
        <Link href={`/finanzas?factura=${factura.id}`} className="btn btn-ghost"><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />Volver a Finanzas</Link>
        <div className="print-tools"><button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={16} strokeWidth={1.7} aria-hidden="true" />Imprimir o guardar en PDF</button></div>
      </div>
      <div className="doc-pages" style={estiloDocumento(branding)}>
        <article className="doc">
          <header className="doc-head">
            <div style={{ minWidth: 0 }}><DocBrand branding={branding} />{contacto && <span className="doc-contact">{contacto}</span>}<span className="doc-kicker">{factura.status === "draft" ? "Borrador · sin número" : "Factura"}</span></div>
            <div className="doc-number"><span className="pl-mono">{factura.number ?? "Borrador"}</span><small>{factura.issue_date ? fechaDocumento(`${factura.issue_date}T12:00:00`) : ""}</small></div>
          </header>
          <h1 className="doc-title">{factura.concept}</h1>
          <dl className="doc-meta">
            <div><dt>Cliente</dt><dd>{factura.client_name}</dd></div>
            <div><dt>Obra</dt><dd>{project ? `${project.name} · ${project.code}` : "—"}</dd></div>
            <div><dt>Dirección</dt><dd>{project?.location || "—"}</dd></div>
            <div><dt>Vencimiento</dt><dd>{factura.due_date ? fechaDocumento(`${factura.due_date}T12:00:00`) : "—"}</dd></div>
          </dl>
          <table className="doc-table">
            <thead><tr><th>Concepto</th><th className="num">Base</th></tr></thead>
            <tbody><tr><td>{factura.concept}</td><td className="num pl-mono">{money(factura.base)}</td></tr></tbody>
          </table>
          <div className="doc-totals">
            <div><span>Base imponible</span><strong className="pl-mono">{money(factura.base)}</strong></div>
            <div><span>IVA {factura.vat_rate} %</span><strong className="pl-mono">{money(factura.tax)}</strong></div>
            <div className="doc-total"><span>Total</span><strong className="pl-mono">{money(factura.total)}</strong></div>
          </div>
          <p className="doc-note">Documento de control generado por Plano. No sustituye a la factura oficial.</p>
          {legales.length > 0 && <footer className="doc-foot">{legales.map(l => <span key={l}>{l}</span>)}</footer>}
        </article>
      </div>
    </>
  );
}
