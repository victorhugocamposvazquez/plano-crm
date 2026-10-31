"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/status";
import { InvoicePanel, type FacturaInicial } from "@/components/project/invoice-panel";
import { useWorkspace } from "@/components/workspace-provider";
import { emitidas, etiquetaFactura, sumaBase } from "@/lib/facturas";
import { can, dateLabel, money, totals, type BudgetVersion, type Certification, type Invoice } from "@/lib/domain";

/** Pestaña Cobros: lo aceptado, lo facturado, lo cobrado y lo que ya se puede facturar según el avance de la obra. */
export function CobrosPanel({ projectId, cobros, facturas, approved, progress }: { projectId: string; cobros: Certification[]; facturas: Invoice[]; approved?: BudgetVersion; progress: number }) {
  const { actor } = useWorkspace();
  const [panel, setPanel] = useState<{ id?: string; inicial?: FacturaInicial } | null>(null);
  const puede = can(actor.role, "invoice.create");
  const base = approved ? totals(approved.items).base : 0;
  const hechas = emitidas(facturas), facturado = sumaBase(hechas), cobrado = sumaBase(facturas.filter(f => f.status === "paid"));
  const sinFactura = cobros.filter(c => !facturas.some(f => f.certification_id === c.id));
  const segunAvance = Math.round((base * progress) / 100);
  const puedeFacturar = Math.max(0, segunAvance - sumaBase(facturas) - sinFactura.reduce((s, c) => s + c.amount, 0));
  const orden = [...facturas].sort((a, b) => (b.number ?? "9").localeCompare(a.number ?? "9"));
  return (
    <section className="cobros-panel" aria-label="Cobros">
      <div className="stat-row stat-row-4">
        <div className="pl-card stat"><span>{approved ? `Aceptado · V${approved.number}` : "Aceptado"}</span><strong className="pl-mono">{approved ? money(base) : "—"}</strong><small>sin IVA</small></div>
        <div className="pl-card stat"><span>Facturado</span><strong className="pl-mono">{money(facturado)}</strong><small>sin IVA</small></div>
        <div className="pl-card stat"><span>Cobrado</span><strong className="pl-mono" data-tone="success">{money(cobrado)}</strong><small>sin IVA</small></div>
        <div className="pl-card stat" data-tone={puedeFacturar > 0 ? "warning" : undefined}><span>Puedes facturar ya · {progress} % hecho</span><strong className="pl-mono">{money(puedeFacturar)}</strong><small>sin IVA</small></div>
      </div>
      <section className="pl-card" aria-label="Facturas del proyecto">
        <header className="pl-card-head"><strong>Facturas</strong>{puede && <Button onClick={() => setPanel({ inicial: { project_id: projectId } })}><Plus size={15} strokeWidth={1.8} aria-hidden="true" />Nueva factura</Button>}</header>
        {orden.map(f => { const e = etiquetaFactura(f); return (
          <button key={f.id} type="button" className="cobro-row cobro-row-button" onClick={() => setPanel({ id: f.id })} aria-haspopup="dialog">
            <span className="cobro-text"><strong>{f.number ?? "Sin número"} · {f.concept}</strong><small>{f.issue_date ? dateLabel(f.issue_date) : "Sin enviar"}{f.due_date && f.status === "sent" ? ` · vence ${dateLabel(f.due_date)}` : ""}</small></span>
            <Pill label={e.label} tone={e.tone} />
            <strong className="pl-mono cobro-amount">{money(f.total)}</strong>
          </button>
        ); })}
        {sinFactura.map(c => (
          <div key={c.id} className="cobro-row">
            <span className="cobro-text"><strong>{c.title}</strong><small>Cobro preparado · {dateLabel(c.created_at)} · {money(c.amount)} sin IVA</small></span>
            {puede && <Button onClick={() => setPanel({ inicial: { project_id: projectId, concept: c.title, base: c.amount, certification_id: c.id } })}>Facturar</Button>}
          </div>
        ))}
        {puedeFacturar > 0 && puede && (
          <div className="cobro-row" data-propuesta>
            <span className="cobro-text"><strong>Cobro parcial según el avance</strong><small>Propuesto por Plano: {progress} % de lo aceptado menos lo ya facturado</small></span>
            <Button variant="primary" onClick={() => setPanel({ inicial: { project_id: projectId, concept: `Cobro parcial · ${progress} % de la obra`, base: puedeFacturar } })}>Facturar {money(puedeFacturar)}</Button>
          </div>
        )}
        {orden.length === 0 && sinFactura.length === 0 && puedeFacturar === 0 && <p className="muted text-sm" style={{ padding: "14px 18px", margin: 0 }}>Aún no hay facturas. {approved ? "Cuando la obra avance, Plano propone cuánto se puede facturar." : "Cuando el cliente acepte, Plano propondrá cuánto facturar según avance la obra."}</p>}
      </section>
      <p className="pl-note">Si se acepta una versión nueva, lo facturado se mantiene y lo pendiente se recalcula sobre ella.</p>
      <InvoicePanel open={Boolean(panel)} onClose={() => setPanel(null)} invoiceId={panel?.id} inicial={panel?.inicial} />
    </section>
  );
}
