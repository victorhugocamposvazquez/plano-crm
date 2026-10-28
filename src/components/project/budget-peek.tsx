"use client";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, FileText } from "lucide-react";
import { money, dateLabel, totals, versionStatus, lineTotal, type Workspace } from "@/lib/domain";
import { capitulosDocumento, alternativas, unidadLarga } from "@/lib/documento-presupuesto";

/**
 * Presupuesto visto desde el chat sin salir de él: cabecera con estado e importes, partidas por capítulo,
 * alternativas y, si procede, la diferencia respecto a la revisión aprobada. Ir a la ficha o al PDF es
 * una decisión explícita (botones al final), no la consecuencia de consultar.
 */
export function BudgetPeek({ versionId, data, projectId, onBack, onVersion }: { versionId: string; data: Workspace; projectId: string; onBack: () => void; onVersion: (id: string) => void }) {
  const v = data.versions.find(x => x.id === versionId);
  const b = v ? data.budgets.find(x => x.id === v.budget_id) : undefined;
  if (!v || !b) return <div className="chat-info"><button type="button" className="chat-top-back" onClick={onBack}><ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />Volver al chat</button><p className="muted text-sm">Esa revisión ya no existe.</p></div>;
  const t = totals(v.items);
  const aprobada = b.approved_version_id === v.id;
  const ref = !aprobada && b.approved_version_id ? data.versions.find(x => x.id === b.approved_version_id) : undefined;
  const diff = ref ? t.base - totals(ref.items).base : 0;
  const capitulos = capitulosDocumento(v.items);
  const opcionales = alternativas(v.items);
  const hermanas = data.versions.filter(x => x.budget_id === b.id).sort((a, c) => a.number - c.number);
  const tono = aprobada ? "success" : v.status === "issued" ? "info" : v.status === "superseded" ? undefined : "warning";
  return (
    <div className="chat-info budget-peek">
      <header className="peek-head">
        <span style={{ minWidth: 0 }}>
          <strong className="h3" style={{ display: "block" }}>V{v.number} · {b.title}</strong>
          <small className="muted">{dateLabel(v.updated_at)} · {v.created_by_name}{v.approval_reference ? ` · ref. ${v.approval_reference}` : ""}</small>
        </span>
        <span className="pill" data-tone={tono}>{aprobada ? "Aprobada para obra" : versionStatus[v.status]}</span>
      </header>
      {hermanas.length > 1 && (
        <nav className="peek-versions" aria-label="Revisiones">
          {hermanas.map(h => <button key={h.id} type="button" className="chip" aria-pressed={h.id === v.id} onClick={() => onVersion(h.id)}>V{h.number}{b.approved_version_id === h.id ? " ✓" : ""}</button>)}
        </nav>
      )}
      <dl className="peek-totals">
        <div><dt>Base</dt><dd className="pl-mono">{money(t.base)}</dd></div>
        <div><dt>IVA</dt><dd className="pl-mono">{money(t.tax)}</dd></div>
        <div><dt>Total</dt><dd className="pl-mono"><strong>{money(t.total)}</strong></dd></div>
        {ref && <div><dt>Respecto a la V{ref.number} aprobada</dt><dd className="pl-mono" data-tone={diff > 0 ? "warning" : diff < 0 ? "success" : undefined}>{diff > 0 ? "+" : ""}{money(diff)}</dd></div>}
      </dl>
      {v.change_reason && <p className="text-sm"><span className="muted">Motivo: </span>{v.change_reason}</p>}
      {capitulos.length === 0 && <p className="muted text-sm">Esta revisión todavía no tiene partidas.</p>}
      {capitulos.map(c => (
        <section key={c.chapter} className="peek-chapter">
          <h3><span>{c.chapter}</span><span className="pl-mono">{money(c.subtotal)}</span></h3>
          <ul>{c.items.map(i => <li key={i.id}><span className="peek-desc">{i.description}</span><span className="muted pl-mono text-xs">{i.quantity} {unidadLarga[i.unit]} × {money(i.unit_price)}{i.adjustment_percent ? ` ${i.adjustment_percent > 0 ? "+" : ""}${i.adjustment_percent}%` : ""}</span><span className="pl-mono">{money(lineTotal(i))}</span></li>)}</ul>
        </section>
      ))}
      {opcionales.length > 0 && (
        <section className="peek-chapter" data-optional="true">
          <h3><span>Alternativas no incluidas</span><span className="pl-mono">{opcionales.length}</span></h3>
          <ul>{opcionales.map(i => <li key={i.id}><span className="peek-desc">{i.description}<small className="muted"> · {i.chapter}</small></span><span className="muted pl-mono text-xs">{i.quantity} {unidadLarga[i.unit]}</span><span className="pl-mono muted">{money(lineTotal(i))}</span></li>)}</ul>
        </section>
      )}
      {v.notes && <p className="text-sm muted" style={{ whiteSpace: "pre-wrap" }}>{v.notes}</p>}
      <footer className="peek-foot">
        <button type="button" className="btn btn-secondary" onClick={onBack}><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />Volver al chat</button>
        {v.items.length > 0 && <Link href={`/imprimir/presupuesto/${v.id}`} target="_blank" rel="noopener" className="btn btn-secondary"><FileText size={15} strokeWidth={1.8} aria-hidden="true" />PDF<ExternalLink size={12} strokeWidth={1.8} aria-hidden="true" /></Link>}
        <Link href={`/proyectos/${projectId}?s=budget&p=${b.id}`} className="btn btn-ghost" style={{ marginLeft: "auto" }}>Ir a la ficha<ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" /></Link>
      </footer>
    </div>
  );
}
