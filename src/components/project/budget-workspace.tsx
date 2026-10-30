"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText, GitCompareArrows, History, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { BudgetActions } from "./budget-actions";
import { BudgetVersionIdentity } from "./budget-version-identity";
import { BudgetComparison } from "./budget-comparison";
export { BudgetComparison } from "./budget-comparison";
import { budgetHistory, compareBudgetHistory, versionLabel, versionState, versionTimestamp } from "@/lib/budget-history";
import { partidasPorCapitulo, totalCapitulo } from "@/lib/presupuesto";
import { money, totals, lineTotal, type Budget, type BudgetVersion } from "@/lib/domain";

type Patch=(patch:Record<string,string|null|undefined>)=>void;
const signed=(value:number)=>value===0?money(0):`${value<0?"−":"+"}${money(Math.abs(value))}`;
const number=(value:number)=>new Intl.NumberFormat("es-ES",{maximumFractionDigits:3}).format(value);
type View="items"|"versions"|"changes";
/** Capítulos que el usuario ha plegado en este presupuesto; nacen abiertos y la app recuerda cuáles cerró. */
function useCapitulosCerrados(budgetId:string) {
  const key=`plano.capitulos-cerrados.${budgetId}`;
  const [cerrados,setCerrados]=useState<string[]>([]);
  useEffect(()=>{try{const raw=JSON.parse(localStorage.getItem(key) ?? "[]");setCerrados(Array.isArray(raw)?raw.filter((chapter):chapter is string=>typeof chapter==="string"):[]);}catch{setCerrados([]);}},[key]);
  const remember=(next:string[])=>{try{localStorage.setItem(key,JSON.stringify(next));}catch{}return next;};
  const toggle=(chapter:string,open:boolean)=>setCerrados(prev=>{
    if(prev.includes(chapter)===!open)return prev;
    return remember(open?prev.filter(c=>c!==chapter):[...prev,chapter]);
  });
  const setAll=(chapters:string[],open:boolean)=>setCerrados(remember(open?[]:chapters));
  return {cerrados,toggle,setAll};
}

export function BudgetWorkspace({budget,versions,onNavigate,onEdit,canEdit,adding}:{budget:Budget;versions:BudgetVersion[];onNavigate:Patch;onEdit:()=>void;canEdit:boolean;adding:ReactNode}) {
  const params=useSearchParams(),history=budgetHistory(budget,versions),{approved,working,current}=history;
  const shown=history.versions.find(v=>v.id===params.get("v")) ?? current;
  const view:View=params.get("vista")==="versions"?"versions":params.get("vista")==="changes"?"changes":"items";
  const versionRow=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const row=versionRow.current,selected=row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if(row && selected)row.scrollLeft=selected.offsetLeft-(row.clientWidth-selected.clientWidth)/2;
  },[shown?.id,view]);
  const {cerrados,toggle,setAll}=useCapitulosCerrados(budget.id);
  const [anadiendo,setAnadiendo]=useState(false);
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
  const allClosed=chapters.size>0 && [...chapters.keys()].every(chapter=>cerrados.includes(chapter));
  const ascendente=[...history.versions].reverse();
  const referencia=shown.id===working?.id && approved?approved:previous;
  const deltaAprobada=currentView && approved && working?totals(working.items).total-totals(approved.items).total:null;
  const volver=<button type="button" className="btn btn-ghost budget-view-back" onClick={()=>showVersion(shown)}><ArrowLeft size={16} aria-hidden="true"/>Partidas de V{shown.number}</button>;

  return <section className="budget-workspace" aria-label={`Presupuesto ${budget.title}`}>
    {view==="items" && <div className="budget-view" data-view="items" role="region" aria-label={`Partidas de V${shown.number}`}>
      <div className="budget-version-bar"><span className="budget-section-label">Versiones</span><div ref={versionRow} className="version-row" role="group" aria-label="Versiones del presupuesto">
        {ascendente.map(v=><button key={v.id} type="button" className="version-pill" data-actual={v.id===current?.id||undefined} aria-pressed={v.id===shown.id} onClick={()=>showVersion(v)}><BudgetVersionIdentity version={v} currentId={current?.id} approvedId={approved?.id}/></button>)}
      </div></div>

      <div className="budget-summary budget-summary-plain">
        <header className="budget-total-head">
          <div className="budget-summary-title"><span className="budget-section-label">V{shown.number} · {currentView?"Actual":"Versión anterior"} · {versionState(shown,approved?.id)}</span><h2>{budget.title}</h2><span className="version-identity-date">Última edición <time dateTime={shown.updated_at}>{versionTimestamp(shown.updated_at)}</time></span></div>
          <strong className="budget-total-figure"><span className="pl-mono">{money(t.total)}</span><small>con IVA</small></strong>
          {deltaAprobada!==null && approved && working && <button type="button" className="budget-difference" onClick={()=>compare(approved,working)}>V{working.number}: {signed(deltaAprobada)} con IVA respecto a V{approved.number}<ArrowRight size={15} aria-hidden="true"/></button>}
        </header>
        {currentView && <div className="budget-approved-reference">{approved ? <><span>Para ejecutar la obra se usa</span><strong>V{approved.number} · Aprobada para obra</strong><span><span className="pl-mono">{money(totals(approved.items).total)}</span> con IVA{approved.approved_at && <> · aprobada <time dateTime={approved.approved_at}>{versionTimestamp(approved.approved_at)}</time></>}</span></> : <span>Todavía no hay una versión aprobada para ejecutar la obra.</span>}</div>}
        <div className="budget-summary-actions">
          <div className="budget-reading-nav">
            <Button variant="ghost" aria-label="Historial de versiones" onClick={()=>onNavigate({vista:"versions"})}><History size={17} strokeWidth={1.6} aria-hidden="true"/>Historial</Button>
            {referencia && <Button variant="ghost" aria-label={`Comparar V${referencia.number} con V${shown.number}`} onClick={()=>compare(referencia,shown)}><GitCompareArrows size={17} strokeWidth={1.6} aria-hidden="true"/>Comparar</Button>}
          </div>
          <div className="budget-total-tools">
            {currentView && (shown.items.length>0 || shown.status!=="draft") && <BudgetActions budget={budget} approved={approved} working={working} shown={shown} onEdit={onEdit} onRevisionCreated={showVersion}/>}
            {!currentView && shown.items.length>0 && <Link prefetch={false} href={`/imprimir/presupuesto/${shown.id}`} target="_blank" rel="noopener" className="btn btn-secondary" aria-label={`PDF de la V${shown.number}`}><FileText size={17} strokeWidth={1.6} aria-hidden="true"/>PDF</Link>}
          </div>
        </div>
        <details className="budget-summary-details"><summary>Desglose y datos de esta versión</summary><dl className="workspace-facts">
          <div><dt>Importe sin IVA</dt><dd className="pl-mono">{money(t.base)}</dd></div>
          <div><dt>IVA</dt><dd className="pl-mono">{money(t.tax)}</dd></div>
          <div><dt>Última edición</dt><dd>{versionTimestamp(shown.updated_at)}</dd></div>
          <div><dt>Creada por</dt><dd>{shown.created_by_name}</dd></div>
          {shown.approved_at && <div><dt>Aprobación</dt><dd>{versionTimestamp(shown.approved_at)}</dd></div>}
        </dl></details>
      </div>
      {!currentView && <div className="workspace-callout"><p>{shown.id===approved?.id?`Esta es la versión aprobada. Hay una V${current?.number} posterior en preparación.`:`Estás consultando una versión anterior. La actual es la V${current?.number}.`}</p><Button variant="secondary" onClick={()=>current && showVersion(current)}>Ver V{current?.number}<ArrowRight size={16} aria-hidden="true"/></Button></div>}

      {shown.items.length===0 ? <div className="empty"><strong>Esta versión aún no tiene partidas</strong><span className="muted">Añade trabajos desde el catálogo, un plano o las fotos de la visita.</span>{canEdit && currentView && shown.status==="draft" && <Button variant="primary" onClick={onEdit}>Añadir partidas</Button>}</div> : <section className="budget-content" aria-label="Lectura de partidas">
        <header className="budget-content-head"><div><h3>Trabajos por capítulo</h3><span className="muted text-sm">{shown.items.length} partidas · importes sin IVA</span></div><Button variant="ghost" onClick={()=>setAll([...chapters.keys()],allClosed)}>{allClosed?"Desplegar todo":"Plegar todo"}</Button></header>
        <div className="budget-chapters">
        {[...chapters].map(([chapter,items])=><details className="budget-chapter" key={chapter} open={!cerrados.includes(chapter)}>
          <summary onClick={event=>{event.preventDefault();toggle(chapter,cerrados.includes(chapter));}}><span><strong>{chapter}</strong><small className="muted">{items.length} partida{items.length===1?"":"s"}{items.some(i=>i.inclusion!=="included")?` · ${items.filter(i=>i.inclusion!=="included").length} no suma`:""}</small></span><strong className="pl-mono">{money(totalCapitulo(items))}</strong></summary>
          <ul>{items.map(item=><li key={item.id} className="budget-reading-item" data-inclusion={item.inclusion}><div><strong>{item.description}</strong><small className="muted">{number(item.quantity)} {item.unit} × {money(item.unit_price)}{item.adjustment_percent?` · ${item.adjustment_percent>0?"recargo":"descuento"} ${number(Math.abs(item.adjustment_percent))} %`:""}{item.inclusion!=="included"?` · ${item.inclusion==="optional"?"alternativa":"excluida"}, no suma`:""}</small></div><span className="pl-mono">{money(lineTotal(item))}</span></li>)}</ul>
        </details>)}
      </div></section>}
      {canEdit && currentView && <button type="button" className="budget-add-row" onClick={()=>setAnadiendo(true)} aria-haspopup="dialog"><Plus size={17} strokeWidth={1.8} aria-hidden="true"/>Añadir trabajos a la V{shown.number}<small>catálogo · plano · fotos</small></button>}
      {shown.notes && <details className="budget-notes"><summary>Notas y condiciones de V{shown.number}</summary><p>{shown.notes}</p></details>}
      {canEdit && currentView && <Modal open={anadiendo} onClose={()=>setAnadiendo(false)} title={`Añadir trabajos a la V${shown.number}`}>{adding}</Modal>}
    </div>}

    {view==="versions" && <section className="budget-view" role="region" aria-label="Historial de versiones">
      <div className="budget-view-head">{volver}</div>
      <div><h2>Versiones del presupuesto</h2><p className="muted">Consulta cualquier versión o descubre qué cambió respecto a la anterior.</p></div>
      <ol className="budget-history-list">{history.versions.map(v=>{
        const prev=history.versions.find(p=>p.number<v.number),diff=prev?compareBudgetHistory(prev,v):null;
        return <li key={v.id} className="budget-history-card" data-actual={v.id===current?.id||undefined}>
          <header><BudgetVersionIdentity version={v} currentId={current?.id} approvedId={approved?.id} showUpdated/><strong className="pl-mono">{money(totals(v.items).total)}<small className="muted">con IVA</small></strong></header>
          <p className="muted text-sm">Creada por {v.created_by_name}</p>
          <p>{v.change_reason || "Sin motivo registrado"}</p>
          {diff?<p className="history-diff-summary">Desde V{prev!.number}: {diff.hasChanges?[
            diff.counts.added?`${diff.counts.added} añadida${diff.counts.added===1?"":"s"}`:"",diff.counts.changed?`${diff.counts.changed} modificada${diff.counts.changed===1?"":"s"}`:"",diff.counts.removed?`${diff.counts.removed} eliminada${diff.counts.removed===1?"":"s"}`:"",diff.notesChanged?"condiciones actualizadas":""
          ].filter(Boolean).join(" · "):"sin cambios de partidas ni condiciones"}. <strong className="pl-mono">{signed(diff.delta.total)}</strong> con IVA.</p>:<p className="muted text-sm">Primera versión del presupuesto.</p>}
          <footer><Button variant="secondary" onClick={()=>showVersion(v)}>Ver V{v.number}</Button>{prev && <Button variant="ghost" onClick={()=>compare(prev,v)}>Ver qué cambió</Button>}</footer>
        </li>;
      })}</ol>
      <p className="muted text-sm">Cada tarjeta es una versión guardada del presupuesto. Las ediciones dentro de un mismo borrador no tienen todavía un historial individual.</p>
    </section>}

    {view==="changes" && <section className="budget-view" role="region" aria-label="Comparar versiones del presupuesto">
      <div className="budget-view-head">{volver}</div>
      <div><h2>Qué cambió entre versiones</h2><p className="muted">Elige las dos versiones. Se comparan las partidas y las condiciones guardadas.</p></div>
      {history.versions.length<2?<p className="workspace-callout">Necesitas al menos dos versiones para comparar cambios.</p>:<>
        <div className="budget-comparison-pickers">{([{key:"desde",label:"Desde",value:from},{key:"hasta",label:"Hasta",value:to}] as const).map(p=><label className="field" key={p.key}><span>{p.label}</span><select className="workspace-select" value={p.value?.id ?? ""} onChange={e=>onNavigate({desde:p.key==="desde"?e.target.value:from?.id,hasta:p.key==="hasta"?e.target.value:to?.id})}>{history.versions.map(v=><option key={v.id} value={v.id}>{v.id===current?.id?"Actual · ":""}V{v.number} · {versionState(v,approved?.id)} · {versionTimestamp(v.created_at)}</option>)}</select></label>)}</div>
        {from && to && from.id!==to.id?<BudgetComparison before={from} after={to}/>:<p className="workspace-callout">Elige dos versiones distintas para ver sus diferencias.</p>}
      </>}
    </section>}
  </section>;
}

