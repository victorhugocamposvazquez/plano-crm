"use client";
import { money, totals, lineTotal, type Workspace } from "@/lib/domain";
import { capitulosDocumento, alternativas, unidadLarga } from "@/lib/documento-presupuesto";
import { budgetHistory, versionSentence, versionState, versionTimestamp } from "@/lib/budget-history";

/**
 * Presupuesto consultado desde el chat: estado e importes, diferencia respecto a la revisión aprobada,
 * partidas por capítulo, alternativas y notas. Se cambia de revisión con el selector de versiones; ir a la ficha o al PDF
 * lo decide quien lo lee desde el pie del modal, no la consulta.
 */
/** Un motivo que solo repite la versión («V2 --») no explica nada: no se enseña. */
const motivoUtil = (motivo?: string | null) => Boolean(motivo && !/^[\s\p{P}vV\d]*$/u.test(motivo));
export function BudgetPeek({ versionId, data, onVersion }: { versionId: string; data: Workspace; onVersion: (id: string) => void }) {
  const v = data.versions.find(x => x.id === versionId);
  const b = v ? data.budgets.find(x => x.id === v.budget_id) : undefined;
  if (!v || !b) return <p className="muted text-sm">Esa versión ya no existe.</p>;
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
      <header className="bp-head">
        <h3 className="h3">{b.title}</h3>
        <p className="bp-meta">
          <strong>V{v.number}</strong>
          <span className="bp-estado" data-estado={aprobada ? "aceptado" : v.status}>{versionState(v, b.approved_version_id)}</span>
          {v.id === history.current?.id && <span className="version-identity-current"><span className="pulse-dot" aria-hidden="true" />Actual</span>}
        </p>
        <p className="bp-frase">{versionSentence(v, history)}</p>
        <p className="bp-quien">Creada el <time dateTime={v.created_at}>{versionTimestamp(v.created_at)}</time> por {v.created_by_name}{v.approval_reference ? ` · ref. ${v.approval_reference}` : ""}</p>
      </header>
      {hermanas.length > 1 && (
        <nav className="bp-versiones" aria-label="Versiones del presupuesto">
          {hermanas.map(h => <button key={h.id} type="button" className="bp-version" aria-pressed={h.id === v.id} onClick={() => onVersion(h.id)}>
            <span className="bp-version-linea"><strong>V{h.number}</strong>{h.id === history.current?.id && <span className="bp-version-actual">Actual</span>}</span>
            <span className="bp-version-estado">{versionState(h, b.approved_version_id)}</span>
            <small><time dateTime={h.created_at}>{versionTimestamp(h.created_at)}</time></small>
          </button>)}
        </nav>
      )}
      <dl className="bp-importes">
        <div><dt>Sin IVA</dt><dd className="pl-mono">{money(t.base)}</dd></div>
        <div><dt>IVA</dt><dd className="pl-mono">{money(t.tax)}</dd></div>
        <div className="bp-total"><dt>Total con IVA</dt><dd className="pl-mono">{money(t.total)}</dd></div>
        {ref && <div className="bp-diferencia"><dt>Diferencia con la V{ref.number} aceptada</dt><dd className="pl-mono">{diff > 0 ? "+" : ""}{money(diff)}</dd></div>}
      </dl>
      {motivoUtil(v.change_reason) && <p className="bp-motivo"><span>Motivo del cambio</span>{v.change_reason}</p>}
      {capitulos.length === 0 && <p className="muted text-sm">Esta versión todavía no tiene partidas.</p>}
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
