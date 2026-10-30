"use client";
import { money, totals, lineTotal, type Workspace } from "@/lib/domain";
import { capitulosDocumento, alternativas, unidadLarga } from "@/lib/documento-presupuesto";
import { budgetHistory } from "@/lib/budget-history";
import { BudgetVersionIdentity } from "./budget-version-identity";

/**
 * Presupuesto consultado desde el chat: estado e importes, diferencia respecto a la revisión aprobada,
 * partidas por capítulo, alternativas y notas. Se cambia de revisión con los chips; ir a la ficha o al PDF
 * lo decide quien lo lee desde el pie del modal, no la consulta.
 */
export function BudgetPeek({ versionId, data, onVersion }: { versionId: string; data: Workspace; onVersion: (id: string) => void }) {
  const v = data.versions.find(x => x.id === versionId);
  const b = v ? data.budgets.find(x => x.id === v.budget_id) : undefined;
  if (!v || !b) return <p className="muted text-sm">Esa revisión ya no existe.</p>;
  const t = totals(v.items);
  const aprobada = b.approved_version_id === v.id;
  const ref = !aprobada && b.approved_version_id ? data.versions.find(x => x.id === b.approved_version_id) : undefined;
  const diff = ref ? t.total - totals(ref.items).total : 0;
  const capitulos = capitulosDocumento(v.items);
  const opcionales = alternativas(v.items);
  const hermanas = data.versions.filter(x => x.budget_id === b.id).sort((a, c) => a.number - c.number);
  const history=budgetHistory(b,data.versions);
  return (
    <div className="budget-peek">
      <header className="peek-head">
        <span style={{ minWidth: 0 }}>
          <strong className="h3" style={{ display: "block" }}>V{v.number} · {b.title}</strong>
          <BudgetVersionIdentity version={v} currentId={history.current?.id} approvedId={b.approved_version_id} showUpdated/>
          <small className="muted">Creada por {v.created_by_name}{v.approval_reference ? ` · ref. ${v.approval_reference}` : ""}</small>
        </span>
      </header>
      {hermanas.length > 1 && (
        <nav className="peek-versions" aria-label="Revisiones">
          {hermanas.map(h => <button key={h.id} type="button" className="chip peek-version-choice" aria-pressed={h.id === v.id} onClick={() => onVersion(h.id)}><BudgetVersionIdentity version={h} currentId={history.current?.id} approvedId={b.approved_version_id}/></button>)}
        </nav>
      )}
      <dl className="peek-totals">
        <div><dt>Sin IVA</dt><dd className="pl-mono">{money(t.base)}</dd></div>
        <div><dt>IVA</dt><dd className="pl-mono">{money(t.tax)}</dd></div>
        <div><dt>Total con IVA · V{v.number}</dt><dd className="pl-mono"><strong>{money(t.total)}</strong></dd></div>
        {ref && <div><dt>Diferencia con IVA respecto a V{ref.number} aprobada</dt><dd className="pl-mono">{diff > 0 ? "+" : ""}{money(diff)}</dd></div>}
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
    </div>
  );
}
