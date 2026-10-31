"use client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-provider";
import { can, dateLabel, money, totals, type BudgetVersion, type Certification } from "@/lib/domain";

/** Pestaña Cobros: lo aceptado, lo preparado y lo que ya se puede cobrar según el avance de la obra. */
export function CobrosPanel({ cobros, approved, progress, onPreparar }: { cobros: Certification[]; approved?: BudgetVersion; progress: number; onPreparar: (sugerido?: { title: string; amount: number }) => void }) {
  const { actor } = useWorkspace();
  const puede = can(actor.role, "certification.create") && Boolean(approved);
  const base = approved ? totals(approved.items).base : 0;
  const preparado = cobros.reduce((s, c) => s + c.amount, 0);
  const segunAvance = Math.round((base * progress) / 100);
  const puedeCobrar = Math.max(0, segunAvance - preparado);
  if (!approved) return <div className="empty"><strong>Todavía no hay nada que cobrar</strong><span className="muted text-sm">Cuando el cliente acepte un presupuesto, aquí verás lo aceptado y lo que se puede cobrar según avance la obra.</span></div>;
  return (
    <section className="cobros-panel" aria-label="Cobros">
      <div className="stat-row">
        <div className="pl-card stat"><span>Aceptado · V{approved.number}</span><strong className="pl-mono">{money(base)}</strong><small>sin IVA</small></div>
        <div className="pl-card stat"><span>Cobros preparados</span><strong className="pl-mono" data-tone="success">{money(preparado)}</strong><small>sin IVA · todavía no son facturas</small></div>
        <div className="pl-card stat" data-tone="warning"><span>Puedes cobrar ya · {progress} % hecho</span><strong className="pl-mono">{money(puedeCobrar)}</strong><small>sin IVA</small></div>
      </div>
      <section className="pl-card" aria-label="Lista de cobros">
        <header className="pl-card-head"><strong>Cobros de la obra</strong>{puede && <Button onClick={() => onPreparar()}><Plus size={15} strokeWidth={1.8} aria-hidden="true" />Preparar cobro</Button>}</header>
        {cobros.map(c => (
          <div key={c.id} className="cobro-row">
            <span className="cobro-text"><strong>{c.title}</strong><small>{dateLabel(c.created_at)}</small></span>
            <span className="pill" data-tone="muted">Borrador</span>
            <span className="cobro-sobre">sobre V{approved.number}</span>
            <strong className="pl-mono cobro-amount">{money(c.amount)}</strong>
          </div>
        ))}
        {puedeCobrar > 0 && (
          <div className="cobro-row" data-propuesta>
            <span className="cobro-text"><strong>Cobro parcial según el avance</strong><small>Propuesto por Plano: {progress} % de lo aceptado menos lo ya preparado</small></span>
            <span className="pill" data-tone="warning">Por preparar</span>
            <span className="cobro-sobre">sobre V{approved.number}</span>
            {puede ? <Button variant="primary" onClick={() => onPreparar({ title: `Cobro parcial · ${progress} % de la obra`, amount: puedeCobrar })}>Preparar {money(puedeCobrar)}</Button> : <strong className="pl-mono cobro-amount">{money(puedeCobrar)}</strong>}
          </div>
        )}
        {cobros.length === 0 && puedeCobrar === 0 && <p className="muted text-sm" style={{ padding: "14px 18px" }}>Aún no hay cobros. Cuando la obra avance, Plano propone cuánto se puede cobrar.</p>}
      </section>
      <p className="pl-note">Si se acepta una versión nueva, lo ya preparado se mantiene y el pendiente se recalcula sobre la nueva. Plano no deja aceptar una versión por debajo de lo ya preparado.</p>
    </section>
  );
}
