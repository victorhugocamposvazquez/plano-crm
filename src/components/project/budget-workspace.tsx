"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BudgetActions } from "./budget-actions";
import { budgetHistory, compareBudgetHistory, versionLabel, changedText } from "@/lib/budget-history";
import { partidasPorCapitulo, totalCapitulo } from "@/lib/presupuesto";
import { money, totals, dateLabel, lineTotal, fieldNames, type Budget, type BudgetVersion, type BudgetItem } from "@/lib/domain";

type Patch=(patch:Record<string,string|null|undefined>)=>void;
const signed=(value:number)=>value===0?money(0):`${value<0?"−":"+"}${money(Math.abs(value))}`;
const number=(value:number)=>new Intl.NumberFormat("es-ES",{maximumFractionDigits:3}).format(value);
type View="items"|"versions"|"changes";

export function BudgetWorkspace({budget,versions,onNavigate,onEdit,canEdit,adding}:{budget:Budget;versions:BudgetVersion[];onNavigate:Patch;onEdit:()=>void;canEdit:boolean;adding:ReactNode}) {
  const params=useSearchParams(),history=budgetHistory(budget,versions),{approved,working,current}=history;
  const shown=history.versions.find(v=>v.id===params.get("v")) ?? current;
  const view:View=params.get("vista")==="versions"?"versions":params.get("vista")==="changes"?"changes":"items";
  if(!shown)return <p className="muted">Este presupuesto todavía no tiene versiones.</p>;
  const t=totals(shown.items),previous=history.versions.find(v=>v.number<shown.number);
  const defaultTarget=previous?shown:current ?? shown;
  const defaultFrom=defaultTarget.id===working?.id && approved?approved:history.versions.find(v=>v.number<defaultTarget.number);
  const from=history.versions.find(v=>v.id===params.get("desde")) ?? defaultFrom;
  const to=history.versions.find(v=>v.id===params.get("hasta")) ?? defaultTarget;
  const currentView=shown.id===current?.id;
  const showVersion=(v:BudgetVersion)=>onNavigate({v:v.id,vista:"items",desde:null,hasta:null});
  const compare=(before:BudgetVersion,after:BudgetVersion)=>onNavigate({vista:"changes",v:after.id,desde:before.id,hasta:after.id});
  const chapters=partidasPorCapitulo(shown.items);

  return <section className="budget-workspace" aria-label={`Presupuesto ${budget.title}`}>
    <div className="budget-version-picker">
      <label className="field"><span>Versión que estás viendo</span><select className="workspace-select" value={shown.id} onChange={e=>{const v=history.versions.find(v=>v.id===e.target.value);if(v)showVersion(v);}}>
        {history.versions.map(v=><option key={v.id} value={v.id}>V{v.number} · {versionLabel(v,history)}</option>)}
      </select></label>
      {current && (shown.id===current.id
        ? <p className="current-badge" data-tone="current"><span className="pulse-dot" aria-hidden="true"/><strong>Actual</strong> · V{current.number} {current.id===approved?.id?"aprobada para obra":current.status==="draft"?"en borrador":"pendiente de aprobación"}</p>
        : <p className="current-badge" data-tone="old"><span>Versión anterior · la actual es la <strong>V{current.number}</strong></span><button type="button" className="link-button" onClick={()=>showVersion(current)}>Ir a la actual</button></p>)}
      {approved && <p className="version-authority"><span className="status-dot" aria-hidden="true"/>Para ejecutar la obra: <strong>V{approved.number} aprobada</strong>{working?` · V${working.number} en preparación`:""}</p>}
      {!approved && <p className="muted text-sm">Todavía no hay una versión aprobada para ejecutar la obra.</p>}
    </div>

    <Tabs label="Vistas del presupuesto" value={view} onChange={vista=>onNavigate({vista})} options={[
      {id:"items",label:"Partidas"},{id:"versions",label:"Versiones",count:history.versions.length},{id:"changes",label:"Comparar cambios"}
    ]}/>

    {view==="items" && <div className="budget-view" role="tabpanel" aria-label={`Partidas de V${shown.number}`}>
      <header className="budget-reading-head">
        <div><span className="eyebrow">{versionLabel(shown,history)}</span><h2>V{shown.number} · {budget.title}</h2><p className="muted text-sm">Última edición {dateLabel(shown.updated_at)} · creada por {shown.created_by_name}</p></div>
        <div className="budget-reading-total"><small>Total con IVA</small><strong className="pl-mono">{money(t.total)}</strong><span className="muted">Base {money(t.base)} · IVA {money(t.tax)}</span></div>
      </header>
      {!currentView && <div className="workspace-callout"><p>{shown.id===approved?.id?`Esta es la versión aprobada. Hay una V${current?.number} posterior en preparación.`:`Estás consultando una versión anterior. La versión actual es la V${current?.number}.`}</p><Button variant="secondary" onClick={()=>current && showVersion(current)}>Ver V{current?.number} actual<ArrowRight size={16} aria-hidden="true"/></Button></div>}
      {currentView && approved && working && <p className="version-delta">V{working.number} frente a V{approved.number} aprobada: <strong className="pl-mono">{signed(totals(working.items).total-totals(approved.items).total)}</strong> con IVA. <button className="workspace-text-button" type="button" onClick={()=>compare(approved,working)}>Ver qué cambió</button></p>}
      {currentView && <div id="acciones-presupuesto">{(shown.items.length>0 || shown.status!=="draft") && <BudgetActions budget={budget} approved={approved} working={working} shown={shown} onEdit={onEdit} onRevisionCreated={showVersion}/>}</div>}
      {!currentView && shown.items.length>0 && <Link prefetch={false} href={`/imprimir/presupuesto/${shown.id}`} target="_blank" rel="noopener" className="btn btn-secondary"><FileText size={16} aria-hidden="true"/>PDF de V{shown.number}</Link>}

      {shown.items.length===0 ? <div className="empty"><strong>Esta versión aún no tiene partidas</strong><span className="muted">Añade trabajos desde el catálogo, un plano o las fotos de la visita.</span>{canEdit && currentView && shown.status==="draft" && <Button variant="primary" onClick={onEdit}>Añadir partidas</Button>}</div> : <div className="budget-chapters">
        <p className="muted text-sm">Abre un capítulo para ver sus partidas.</p>
        {[...chapters].map(([chapter,items])=><details className="budget-chapter" key={chapter}>
          <summary><span><strong>{chapter}</strong><small className="muted">{items.length} partida{items.length===1?"":"s"}</small></span><strong className="pl-mono">{money(totalCapitulo(items))}</strong></summary>
          <ul>{items.map(item=><li key={item.id} className="budget-reading-item"><div><strong>{item.description}</strong><small className="muted">{number(item.quantity)} {item.unit} × {money(item.unit_price)}{item.adjustment_percent?` · ajuste ${number(item.adjustment_percent)} %`:""}{item.inclusion!=="included"?` · ${item.inclusion==="optional"?"Alternativa":"Excluida"}, no suma`:""}</small></div><span className="pl-mono">{money(lineTotal(item))}</span></li>)}</ul>
        </details>)}
      </div>}
      {shown.notes && <details className="budget-notes"><summary>Notas y condiciones de V{shown.number}</summary><p>{shown.notes}</p></details>}
      {canEdit && currentView && <details className="budget-add-details"><summary>Añadir trabajos desde planos, fotos o catálogo</summary>{adding}</details>}
    </div>}

    {view==="versions" && <section className="budget-view" role="tabpanel" aria-label="Historial de versiones">
      <div><h2>Versiones del presupuesto</h2><p className="muted">Consulta cualquier versión o descubre qué cambió respecto a la anterior.</p></div>
      <ol className="budget-history-list">{history.versions.map(v=>{
        const prev=history.versions.find(p=>p.number<v.number),diff=prev?compareBudgetHistory(prev,v):null;
        return <li key={v.id} className="budget-history-card" data-actual={v.id===current?.id||undefined}>
          <header><span><strong>V{v.number}{v.id===current?.id && <span className="current-badge current-badge-inline" data-tone="current"><span className="pulse-dot" aria-hidden="true"/>Actual</span>}</strong><span className="version-status" data-current={v.id===approved?.id?"approved":v.id===working?.id?"working":undefined}>{versionLabel(v,history)}</span></span><strong className="pl-mono">{money(totals(v.items).total)}<small className="muted">con IVA</small></strong></header>
          <p className="muted text-sm">Última edición {dateLabel(v.updated_at)} · creada por {v.created_by_name}</p>
          <p>{v.change_reason || "Sin motivo registrado"}</p>
          {diff?<p className="history-diff-summary">Desde V{prev!.number}: {diff.hasChanges?[
            diff.counts.added?`${diff.counts.added} añadida${diff.counts.added===1?"":"s"}`:"",diff.counts.changed?`${diff.counts.changed} modificada${diff.counts.changed===1?"":"s"}`:"",diff.counts.removed?`${diff.counts.removed} eliminada${diff.counts.removed===1?"":"s"}`:"",diff.notesChanged?"condiciones actualizadas":""
          ].filter(Boolean).join(" · "):"sin cambios de partidas ni condiciones"}. <strong className="pl-mono">{signed(diff.delta.total)}</strong> con IVA.</p>:<p className="muted text-sm">Primera versión del presupuesto.</p>}
          <footer><Button variant="secondary" onClick={()=>showVersion(v)}>Ver V{v.number}</Button>{prev && <Button variant="ghost" onClick={()=>compare(prev,v)}>Ver qué cambió</Button>}</footer>
        </li>;
      })}</ol>
      <p className="muted text-sm">Cada tarjeta es una versión guardada del presupuesto. Las ediciones dentro de un mismo borrador no tienen todavía un historial individual.</p>
    </section>}

    {view==="changes" && <section className="budget-view" role="tabpanel" aria-label="Comparar versiones del presupuesto">
      <div><h2>Qué cambió entre versiones</h2><p className="muted">Elige las dos versiones. Se comparan las partidas y las condiciones guardadas.</p></div>
      {history.versions.length<2?<p className="workspace-callout">Necesitas al menos dos versiones para comparar cambios.</p>:<>
        <div className="budget-comparison-pickers">{([{key:"desde",label:"Desde",value:from},{key:"hasta",label:"Hasta",value:to}] as const).map(p=><label className="field" key={p.key}><span>{p.label}</span><select className="workspace-select" value={p.value?.id ?? ""} onChange={e=>onNavigate({desde:p.key==="desde"?e.target.value:from?.id,hasta:p.key==="hasta"?e.target.value:to?.id})}>{history.versions.map(v=><option key={v.id} value={v.id}>V{v.number} · {versionLabel(v,history)}</option>)}</select></label>)}</div>
        {from && to && from.id!==to.id?<BudgetComparison before={from} after={to}/>:<p className="workspace-callout">Elige dos versiones distintas para ver sus diferencias.</p>}
      </>}
    </section>}
  </section>;
}

function fieldValue(item:BudgetItem|undefined,field:keyof BudgetItem) {
  if(!item)return "—";
  if(field==="unit_price")return money(item.unit_price);
  if(field==="quantity")return `${number(item.quantity)} ${item.unit}`;
  if(field==="adjustment_percent" || field==="vat_rate")return `${number(item[field])} %`;
  if(field==="inclusion")return {included:"Incluida",optional:"Alternativa, no suma",excluded:"Excluida, no suma"}[item.inclusion];
  return String(item[field]);
}
function TextChange({before,after}:{before:string;after:string}) {
  const diff=changedText(before,after);
  return <div className="comparison-text-pair"><div><small>Antes</small><p>{before?<>{diff.prefix}<del>{diff.before}</del>{diff.suffix}</>:"Sin texto"}</p></div><div><small>Después</small><p>{after?<>{diff.prefix}<mark>{diff.after}</mark>{diff.suffix}</>:"Sin texto"}</p></div></div>;
}
export function BudgetComparison({before,after}:{before:BudgetVersion;after:BudgetVersion}) {
  const comparison=compareBudgetHistory(before,after),{changes,delta}=comparison;
  return <div className="budget-comparison">
    <div className="comparison-summary"><div><small>V{before.number} · antes</small><strong className="pl-mono">{money(comparison.previous.total)}</strong></div><div><small>V{after.number} · después</small><strong className="pl-mono">{money(comparison.next.total)}</strong></div><div><small>Diferencia con IVA</small><strong className="pl-mono">{signed(delta.total)}</strong></div></div>
    <p className="muted text-sm">Diferencia sin IVA: {signed(delta.base)} · diferencia de IVA: {signed(delta.tax)}. Solo se muestran los cambios.</p>
    {!comparison.hasChanges && <p className="workspace-callout">No hay cambios en partidas ni condiciones entre V{before.number} y V{after.number}.</p>}
    {comparison.hasChanges && <p className="comparison-counts">{comparison.counts.added} añadidas · {comparison.counts.changed} modificadas · {comparison.counts.removed} eliminadas{comparison.notesChanged?" · condiciones actualizadas":""}</p>}
    {changes.map(change=><article className="comparison-change" key={change.id}>
      <header><div><span className="eyebrow">{change.kind==="added"?"Partida añadida":change.kind==="removed"?"Partida eliminada":"Partida modificada"}</span><h3>{(change.after ?? change.before)?.description}</h3></div><span className="pl-mono">{change.delta?signed(change.delta):"Sin cambio de base"}</span></header>
      {change.kind==="changed"?<dl className="comparison-fields">{change.fields.map(field=><div key={field}><dt>{fieldNames[field] ?? field}</dt><dd><span><small>Antes</small><del>{fieldValue(change.before,field as keyof BudgetItem)}</del></span><span><small>Después</small><mark>{fieldValue(change.after,field as keyof BudgetItem)}</mark></span></dd></div>)}</dl>:<ItemChangeSummary item={(change.after ?? change.before)!} label={change.kind==="added"?"Después":"Antes"}/>}
    </article>)}
    {comparison.notesChanged && <article className="comparison-change"><header><h3>Notas y condiciones modificadas</h3></header><TextChange before={before.notes} after={after.notes}/></article>}
  </div>;
}

function ItemChangeSummary({item,label}:{item:BudgetItem;label:string}) {
  return <p>{label}: {fieldValue(item,"quantity")} × {fieldValue(item,"unit_price")}{item.adjustment_percent!==0?` · ajuste ${number(item.adjustment_percent)} %`:""} · IVA {number(item.vat_rate)} % · Importe sin IVA: {money(lineTotal(item))} · {fieldValue(item,"inclusion")}</p>;
}
