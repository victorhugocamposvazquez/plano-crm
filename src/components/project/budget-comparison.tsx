import type { ReactNode } from "react";
import { compareBudgetHistory, changedText, versionTimestamp } from "@/lib/budget-history";
import { fieldNames, lineTotal, money, totals, type BudgetItem, type BudgetItemEdit, type BudgetVersion, type ItemChange } from "@/lib/domain";

const number = (value: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(value);
const tone = (value: number) => value > 0 ? "up" : value < 0 ? "down" : undefined;
const impact = (value: number) => value === 0 ? "No cambia el total del presupuesto" : `${value > 0 ? "Aumenta" : "Reduce"} ${money(Math.abs(value))} el presupuesto`;
const contribution = (item?: BudgetItem) => totals(item ? [item] : []);

function fieldValue(item: BudgetItem, field: keyof BudgetItem) {
  if (field === "unit_price") return `${money(item.unit_price)} / ${item.unit}`;
  if (field === "quantity") return `${number(item.quantity)} ${item.unit}`;
  if (field === "adjustment_percent") return item.adjustment_percent === 0 ? "Sin recargo ni descuento" : `${item.adjustment_percent > 0 ? "Recargo" : "Descuento"} del ${number(Math.abs(item.adjustment_percent))} %`;
  if (field === "vat_rate") return `${number(item.vat_rate)} %`;
  if (field === "inclusion") return { included: "Incluida en el presupuesto", optional: "Alternativa · no suma al total", excluded: "Excluida · no suma al total" }[item.inclusion];
  return String(item[field]);
}

function explanation(change: ItemChange) {
  const { before, after, fields, kind } = change;
  if (kind === "added") return after?.inclusion === "included" ? "Se añade este trabajo al presupuesto." : after?.inclusion === "optional" ? "Se añade una alternativa. Su precio no se suma al presupuesto." : "Se añade como trabajo excluido. Su precio no se suma al presupuesto.";
  if (kind === "removed") return before?.inclusion === "included" ? "Este trabajo se ha retirado del presupuesto." : "Se retira esta opción, que no sumaba al total.";
  if (fields.length === 1 && before && after) {
    if (fields[0] === "quantity") return `La cantidad pasa de ${number(before.quantity)} a ${number(after.quantity)} ${after.unit}.`;
    if (fields[0] === "adjustment_percent") return `Ajuste del precio: antes, ${fieldValue(before,"adjustment_percent").toLowerCase()}; después, ${fieldValue(after,"adjustment_percent").toLowerCase()}.`;
    if (fields[0] === "vat_rate") return `El IVA pasa del ${number(before.vat_rate)} % al ${number(after.vat_rate)} %.`;
    if (fields[0] === "inclusion") return after.inclusion === "included" ? "Esta partida empieza a sumar al presupuesto." : before.inclusion === "included" ? "Esta partida deja de sumar al presupuesto." : "Cambia cómo se presenta esta opción; sigue sin sumar al total.";
  }
  if(before && after && fields.length<=3)return fields.map(field=>{
    if(field==="description")return "Se actualiza la descripción.";
    const key=field as keyof BudgetItem;
    return `${field==="unit_price"?"Precio unitario sin IVA":fieldNames[field]}: antes ${fieldValue(before,key)}; después ${fieldValue(after,key)}.`;
  }).join(" ");
  const names: Record<string, string> = { description: "la descripción", chapter: "el capítulo", quantity: "la cantidad", unit: "la unidad", unit_price: "el precio unitario", adjustment_percent: "el recargo o descuento", vat_rate: "el IVA", inclusion: "si entra en el precio" };
  const parts = fields.map(field => names[field]);
  if (parts.length > 3) return `Se actualizan ${parts.length} datos de esta partida.`;
  return `${parts.length === 1 ? "Cambia" : "Cambian"} ${parts.length < 2 ? parts[0] : `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`}.`;
}

function Highlight({ before, after, side }: { before: string; after: string; side: "before" | "after" }) {
  const diff = changedText(before, after), text = side === "before" ? diff.before : diff.after;
  return <>{diff.prefix}{text && <mark>{text}</mark>}{diff.suffix}</>;
}

function Pair({ beforeLabel, afterLabel, before, after, longText = false }: { beforeLabel: string; afterLabel: string; before: ReactNode; after: ReactNode; longText?: boolean }) {
  return <div className="comparison-pair" data-long-text={longText || undefined}>
    <section className="comparison-side" data-side="before" aria-label={beforeLabel}><h4>{beforeLabel}</h4>{before}</section>
    <section className="comparison-side" data-side="after" aria-label={afterLabel}><h4>{afterLabel}</h4>{after}</section>
  </div>;
}

function Snapshot({ item, other, fields, side }: { item?: BudgetItem; other?: BudgetItem; fields: (keyof BudgetItem)[]; side: "before" | "after" }) {
  if (!item) return <p className="comparison-missing">Esta partida no está en esta versión.</p>;
  const included = item.inclusion === "included";
  return <dl className="comparison-values">
    {fields.map(field => <div key={field}><dt>{field === "unit_price" ? "Precio unitario · sin IVA" : fieldNames[field]}</dt><dd>{other && (field === "description" || field === "chapter") ? <Highlight before={String((side === "before" ? item : other)[field])} after={String((side === "after" ? item : other)[field])} side={side}/> : fieldValue(item, field)}</dd></div>)}
    <div className="comparison-item-total"><dt>{included ? "Total incluido · con IVA" : item.inclusion === "optional" ? "Alternativa" : "Excluida"}</dt><dd>{included ? <span className="pl-mono">{money(contribution(item).total)}</span> : "No se suma al total"}</dd></div>
  </dl>;
}

/** Expone versiones e impacto con la misma base fiscal; no atribuye causas no registradas. */
export function BudgetComparison({ before, after, edits = [], editStatus = "ready" }: { before: BudgetVersion; after: BudgetVersion; edits?: BudgetItemEdit[]; editStatus?: "ready" | "loading" | "unavailable" | "error" }) {
  const latest = new Map<string, BudgetItemEdit>();
  for (const edit of edits) {
    const current = latest.get(edit.item_id);
    if (edit.version_id === after.id && edit.draft_revision <= after.draft_revision && (!current || edit.draft_revision > current.draft_revision)) latest.set(edit.item_id, edit);
  }
  const comparison = compareBudgetHistory(before, after), { changes, delta, counts } = comparison;
  const chronological = before.number < after.number;
  const beforeLabel = `${chronological ? "Antes" : "Referencia"} · V${before.number}`;
  const afterLabel = `${chronological ? "Después" : "Comparada"} · V${after.number}`;
  const chapters = new Map<string, ItemChange[]>();
  const ids=new Set(after.items.map(item=>item.id));
  const unlinked=before.items.length>0 && after.items.length>0 && !before.items.some(item=>ids.has(item.id));
  for (const change of changes) {
    const chapter = (change.after ?? change.before)!.chapter;
    chapters.set(chapter, [...(chapters.get(chapter) ?? []), change]);
  }
  const summary = [counts.changed ? `${counts.changed} partida${counts.changed === 1 ? " modificada" : "s modificadas"}` : "", counts.added ? `${counts.added} añadida${counts.added === 1 ? "" : "s"}` : "", counts.removed ? `${counts.removed} eliminada${counts.removed === 1 ? "" : "s"}` : "", comparison.notesChanged ? "Cambian las condiciones" : ""].filter(Boolean).join(" · ");
  return <div className="budget-comparison">
    <section className="comparison-overview" aria-label="Efecto en el total del presupuesto">
      <header><p className="comparison-overline">De V{before.number} a V{after.number} · importes con IVA</p><h3 data-tone={tone(delta.total)}>{delta.total === 0 ? "El total se mantiene" : `El presupuesto ${delta.total > 0 ? "sube" : "baja"} ${money(Math.abs(delta.total))}`}</h3></header>
      <Pair beforeLabel={beforeLabel} afterLabel={afterLabel} before={<><strong className="pl-mono comparison-total">{money(comparison.previous.total)}</strong><VersionDates version={before}/></>} after={<><strong className="pl-mono comparison-total">{money(comparison.next.total)}</strong><VersionDates version={after}/></>}/>
      {summary && <p className="comparison-summary-text">{summary}</p>}
      <details className="comparison-calculation"><summary>Ver desglose de IVA</summary><Pair beforeLabel={beforeLabel} afterLabel={afterLabel} before={<FiscalTotals base={comparison.previous.base} tax={comparison.previous.tax}/>} after={<FiscalTotals base={comparison.next.base} tax={comparison.next.tax}/>}/></details>
    </section>
    {!comparison.hasChanges && <p className="workspace-callout">No hay cambios en partidas ni condiciones entre V{before.number} y V{after.number}.</p>}
    {unlinked && <p className="workspace-callout" role="status">Las versiones no conservan el vínculo entre sus partidas. Se muestran como añadidas y eliminadas; no se puede confirmar cuáles son modificaciones de una misma partida.</p>}
    {[...chapters].map(([chapter, list]) => <section className="comparison-chapter" key={chapter} aria-label={chapter}>
      <h3>{chapter}</h3>
      {list.map(change => {
        const item = (change.before ?? change.after)!;
        const fields: (keyof BudgetItem)[] = change.kind === "changed" ? change.fields as (keyof BudgetItem)[] : ["quantity", "unit_price", ...(item.adjustment_percent ? ["adjustment_percent" as const] : []), "vat_rate", "inclusion"];
        const previous = contribution(change.before), next = contribution(change.after), difference = next.total - previous.total;
        const kind = change.kind === "changed" ? "Partida modificada" : change.kind === "removed" ? "Partida eliminada" : change.after?.inclusion === "optional" ? "Alternativa añadida" : change.after?.inclusion === "excluded" ? "Partida excluida añadida" : "Partida añadida";
        return <article key={change.id} className="comparison-change" aria-label={`Cambios en ${item.description}`}>
          <header><span className="comparison-overline">{kind}</span><h4>{item.description}</h4><p>{explanation(change)}</p></header>
          <footer className="comparison-impact" data-tone={tone(difference)}><span>Impacto en el total</span><strong>{impact(difference)}{difference !== 0 && " · con IVA"}</strong></footer>
          <ItemEditDate edit={latest.get(change.id)} version={after} status={editStatus}/>
          <details className="comparison-calculation"><summary>Ver V{before.number} y V{after.number} en detalle</summary><Pair beforeLabel={beforeLabel} afterLabel={afterLabel} longText={fields.some(field => field === "description" || field === "chapter")} before={<Snapshot item={change.before} other={change.after} fields={fields} side="before"/>} after={<Snapshot item={change.after} other={change.before} fields={fields} side="after"/>}/><details className="comparison-calculation"><summary>Cálculo e impuestos</summary><Pair beforeLabel={beforeLabel} afterLabel={afterLabel} before={<ItemCalculation item={change.before}/>} after={<ItemCalculation item={change.after}/>}/></details></details>
        </article>;
      })}
    </section>)}
    {comparison.notesChanged && <section className="comparison-chapter" aria-label="Condiciones"><h3>Condiciones</h3><article className="comparison-change"><header><h4>Notas para el cliente</h4><p>Cambia el texto de las condiciones. Las partes diferentes están resaltadas.</p></header><Pair beforeLabel={beforeLabel} afterLabel={afterLabel} longText before={<p className="comparison-notes">{before.notes ? <Highlight before={before.notes} after={after.notes} side="before"/> : "Sin condiciones escritas"}</p>} after={<p className="comparison-notes">{after.notes ? <Highlight before={before.notes} after={after.notes} side="after"/> : "Sin condiciones escritas"}</p>}/></article></section>}
  </div>;
}

function VersionDates({version}:{version:BudgetVersion}) {
  return <p className="comparison-date">Creada <time dateTime={version.created_at}>{versionTimestamp(version.created_at)}</time>{versionTimestamp(version.created_at)!==versionTimestamp(version.updated_at) && <><br/>Editada <time dateTime={version.updated_at}>{versionTimestamp(version.updated_at)}</time></>}</p>;
}

function FiscalTotals({ base, tax }: { base: number; tax: number }) {
  return <dl className="comparison-values"><div><dt>Importe sin IVA</dt><dd className="pl-mono">{money(base)}</dd></div><div><dt>IVA</dt><dd className="pl-mono">{money(tax)}</dd></div></dl>;
}

function ItemCalculation({ item }: { item?: BudgetItem }) {
  if (!item) return <p className="comparison-missing">Esta partida no está en esta versión.</p>;
  return <dl className="comparison-values">
    <div><dt>Cantidad</dt><dd>{fieldValue(item, "quantity")}</dd></div><div><dt>Precio unitario · sin IVA</dt><dd>{fieldValue(item, "unit_price")}</dd></div>
    <div><dt>Recargo o descuento</dt><dd>{fieldValue(item, "adjustment_percent")}</dd></div><div><dt>Importe sin IVA</dt><dd className="pl-mono">{money(lineTotal(item))}</dd></div>
    <div><dt>IVA de la partida</dt><dd>{fieldValue(item, "vat_rate")}</dd></div><div><dt>¿Suma al presupuesto?</dt><dd>{fieldValue(item, "inclusion")}</dd></div>
    <div><dt>IVA que suma al total</dt><dd className="pl-mono">{money(contribution(item).tax)}</dd></div>
  </dl>;
}

function ItemEditDate({ edit, version, status }: { edit?: BudgetItemEdit; version: BudgetVersion; status: "ready" | "loading" | "unavailable" | "error" }) {
  if (status === "loading") return <p className="comparison-date" role="status">Consultando la fecha de edición…</p>;
  if (status === "error") return <p className="comparison-date" role="status">No se ha podido consultar la fecha de esta partida. Vuelve a abrir la comparación para reintentar.</p>;
  if (edit) return <p className="comparison-date">Última edición de esta partida en V{version.number}: <time dateTime={edit.occurred_at}>{versionTimestamp(edit.occurred_at)}</time> · {edit.actor_name}</p>;
  return <p className="comparison-date">V{version.number} guardada <time dateTime={version.updated_at}>{versionTimestamp(version.updated_at)}</time>.<br/>{status === "unavailable" ? "Registro por partida pendiente de activar." : "Fecha individual del cambio: no registrada en este histórico."}</p>;
}
