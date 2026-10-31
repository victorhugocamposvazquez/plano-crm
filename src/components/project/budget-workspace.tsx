"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, Camera, ChevronDown, LayoutTemplate, PenLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { BudgetActions } from "./budget-actions";
import { BudgetComparisonPanel } from "./budget-comparison-panel";
import { CatalogPicker } from "./catalog-picker";
export { BudgetComparison } from "./budget-comparison";
import { budgetHistory, versionMoment, versionSentence, versionState, versionTimestamp } from "@/lib/budget-history";
import { partidasPorCapitulo, totalCapitulo } from "@/lib/presupuesto";
import { compareVersions, money, totals, lineTotal, type Budget, type BudgetVersion, type Project } from "@/lib/domain";
import "@/styles/budget-identity.css";

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
  const toggle=(chapter:string)=>setCerrados(prev=>remember(prev.includes(chapter)?prev.filter(c=>c!==chapter):[...prev,chapter]));
  const setAll=(chapters:string[],open:boolean)=>setCerrados(remember(open?[]:chapters));
  return {cerrados,toggle,setAll};
}

const estadoTono=(version:BudgetVersion,approvedId?:string|null)=>version.id===approvedId?"success":version.status==="issued"?"info":version.status==="draft"?"warning":"muted";

export function BudgetWorkspace({project,budget,versions,onNavigate,onEdit,canEdit,planoHref,fotosHref}:{project:Project;budget:Budget;versions:BudgetVersion[];onNavigate:Patch;onEdit:()=>void;canEdit:boolean;planoHref:string;fotosHref:string}) {
  const router=useRouter();
  const params=useSearchParams(),history=budgetHistory(budget,versions),{approved,working,current}=history;
  const shown=history.versions.find(v=>v.id===params.get("v")) ?? current;
  const view:View=params.get("vista")==="versions"?"versions":params.get("vista")==="changes"?"changes":"items";
  const {cerrados,toggle,setAll}=useCapitulosCerrados(budget.id);
  const [catalogo,setCatalogo]=useState(false);
  if(!shown)return <p className="muted">Este presupuesto todavía no tiene versiones.</p>;
  const t=totals(shown.items),currentView=shown.id===current?.id;
  const borrador=shown.status==="draft" && shown.id===working?.id;
  const showVersion=(v:BudgetVersion)=>onNavigate({v:v.id,vista:"items",desde:null});
  const chapters=partidasPorCapitulo(shown.items);
  const allClosed=chapters.size>0 && [...chapters.keys()].every(chapter=>cerrados.includes(chapter));
  // A la vista, solo lo que importa: la actual, la que tiene el cliente y la aceptada. El resto, en el historial.
  const enviada=history.versions.find(v=>v.status==="issued" && v.id!==current?.id && (!approved || v.number>approved.number));
  const tarjetas=[current,enviada,approved].filter((v,i,all):v is BudgetVersion=>Boolean(v) && all.findIndex(o=>o?.id===v?.id)===i);
  const ocultas=history.versions.length-tarjetas.length;
  const referencia=approved && approved.id!==shown.id?approved:history.versions.find(v=>v.number<shown.number);
  const cambios=referencia?new Map(compareVersions(referencia,shown).map(c=>[c.id,c.kind])):new Map<string,string>();
  const deltaAceptada=approved && approved.id!==shown.id?t.total-totals(approved.items).total:null;
  const alternativas=shown.items.filter(i=>i.inclusion==="optional").length;
  const from=history.versions.find(v=>v.id===params.get("desde")) ?? referencia;
  const abrirEnviar=()=>onNavigate({accion:"enviar",v:shown.id});
  const abrirRespuesta=()=>onNavigate({accion:"respuesta",v:shown.id});

  return <section className="budget-layout" aria-label={`Presupuesto ${budget.title}`}>
    <div className="budget-main">
      <div className="version-cards" role="group" aria-label="Versiones a la vista">
        {tarjetas.map(v=>{const esActual=v.id===current?.id;return <button key={v.id} type="button" className="version-card" aria-pressed={v.id===shown.id && view==="items"} data-actual={esActual||undefined} aria-label={`V${v.number} · ${v.change_reason} · ${versionState(v,approved?.id)}${esActual?" · la actual":""}`} onClick={()=>showVersion(v)}>
          <span className="version-card-state" data-tone={esActual?"success":estadoTono(v,approved?.id)}>{esActual?<span className="pulse-dot" aria-hidden="true"/>:<span className="state-dot" aria-hidden="true"/>}{esActual?`Actual · ${versionState(v,approved?.id)}`:versionState(v,approved?.id)}</span>
          <strong>V{v.number} · {v.change_reason||"Sin motivo"}</strong>
          <span className="pl-mono version-card-total">{money(totals(v.items).total)}</span>
          <small>{versionMoment(v)}</small>
        </button>;})}
        {ocultas>0 && <button type="button" className="version-card version-card-more" onClick={()=>onNavigate({vista:"versions"})}>Historial · {ocultas} ›</button>}
      </div>

      {/* En móvil el total va justo debajo de las versiones. */}<div className="budget-side-phone"><BudgetTotal version={shown} delta={deltaAceptada} approved={approved}/></div>

      <div className="budget-subbar">
        <div className="pl-seg" role="group" aria-label="Qué ver del presupuesto">
          <button type="button" aria-pressed={view==="items"} onClick={()=>onNavigate({vista:"items"})}>Partidas</button>
          <button type="button" aria-pressed={view==="versions"} onClick={()=>onNavigate({vista:"versions"})}>Versiones · {history.versions.length}</button>
          <button type="button" aria-pressed={view==="changes"} onClick={()=>onNavigate({vista:"changes"})}>Ver qué cambia</button>
        </div>
        {view==="items" && canEdit && borrador && <Menu label="Añadir partidas" align="end" trigger={<><Plus size={15} strokeWidth={1.9} aria-hidden="true"/>Añadir partidas<ChevronDown size={14} strokeWidth={1.8} aria-hidden="true"/></>} items={[
          {id:"catalogo",label:"Del catálogo",hint:"Artículos con precio; tú pones la cantidad.",icon:<BookOpen size={16} strokeWidth={1.7}/>,onSelect:()=>setCatalogo(true)},
          {id:"plano",label:"Midiendo el plano",hint:"Sube el PDF: salen los m² y los ml.",icon:<LayoutTemplate size={16} strokeWidth={1.7}/>,onSelect:()=>router.push(planoHref)},
          {id:"fotos",label:"Desde fotos de la visita",hint:"Fotos, notas y una cifra orientativa.",icon:<Camera size={16} strokeWidth={1.7}/>,onSelect:()=>router.push(fotosHref)},
          {id:"mano",label:"Escribir una partida a mano",icon:<PenLine size={16} strokeWidth={1.7}/>,onSelect:onEdit}
        ]}/>}
      </div>

      {view==="items" && <div className="budget-view" role="region" aria-label={`Partidas de V${shown.number}`}>
        <div className="viewing-bar" data-tone={estadoTono(shown,approved?.id)}>
          <span className="state-dot" aria-hidden="true"/>
          <span className="viewing-text"><strong>Viendo V{shown.number} · {shown.change_reason||"Sin motivo"}</strong> <span>· {versionState(shown,approved?.id)} · {versionSentence(shown,history)}</span></span>
          {!currentView && current ? <button type="button" className="link-inline viewing-go" onClick={()=>showVersion(current)}>Ir a la actual (V{current.number})<ArrowRight size={14} strokeWidth={1.8} aria-hidden="true"/></button> : <span className="viewing-mode">{borrador?"Editable":"Solo lectura"}</span>}
        </div>
        {shown.items.length===0 ? <div className="empty"><strong>Esta versión aún no tiene partidas</strong><span className="muted">Añádelas del catálogo, midiendo un plano o desde las fotos de la visita.</span>{canEdit && borrador && <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Button variant="primary" onClick={()=>setCatalogo(true)}>Añadir del catálogo</Button><Button onClick={onEdit}>Escribir a mano</Button></div>}</div> : <div className="pl-card items-table" role="table" aria-label="Partidas por capítulo">
          <div className="items-row items-head" role="row"><span role="columnheader">Partida</span><span role="columnheader">Cantidad</span><span role="columnheader">Precio</span><span role="columnheader">Importe</span></div>
          {[...chapters].map(([chapter,items])=>{const abierto=!cerrados.includes(chapter),noSuman=items.filter(i=>i.inclusion!=="included").length;return <div key={chapter} className="items-chapter" role="rowgroup">
            <button type="button" className="items-chapter-head" aria-expanded={abierto} onClick={()=>toggle(chapter)}><span><ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" data-open={abierto}/><strong>{chapter}</strong><small> · {items.length} partida{items.length===1?"":"s"}{noSuman?` · ${noSuman} no suma${noSuman===1?"":"n"}`:""}</small></span><strong className="pl-mono">{money(totalCapitulo(items))}</strong></button>
            {abierto && items.map(item=>{const cambio=cambios.get(item.id);return <div key={item.id} className="items-row" role="row" data-inclusion={item.inclusion}>
              <span role="cell" className="items-desc">{item.description}{(item.adjustment_percent!==0 || item.inclusion!=="included" || cambio) && <span className="items-tags">{cambio && referencia && <span className="items-tag" data-tone="warning">{cambio==="added"?"nueva":"cambia"} · desde V{referencia.number}</span>}{item.adjustment_percent!==0 && <span className="items-tag">{item.adjustment_percent>0?"recargo":"descuento"} {number(Math.abs(item.adjustment_percent))} %</span>}{item.inclusion!=="included" && <span className="items-tag">{item.inclusion==="optional"?"alternativa":"excluida"} · no suma</span>}</span>}</span>
              <span role="cell" className="pl-mono items-num" data-label="Cantidad">{number(item.quantity)} {item.unit}</span>
              <span role="cell" className="pl-mono items-num" data-label="Precio">{money(item.unit_price)}</span>
              <span role="cell" className="pl-mono items-num items-amount" data-label="Importe">{money(lineTotal(item))}</span>
            </div>;})}
          </div>;})}
          <div className="items-foot"><span className="muted text-sm">{shown.items.length} partidas · importes sin IVA</span><button type="button" className="link-inline" onClick={()=>setAll([...chapters.keys()],allClosed)}>{allClosed?"Desplegar todo":"Plegar todo"}</button></div>
        </div>}
      </div>}

      {view==="versions" && <section className="budget-view" role="region" aria-label="Historial de versiones">
        <p className="muted text-sm">De la más nueva a la más antigua. Toca una para verla.</p>
        <ol className="version-list">{history.versions.map(v=>{const esActual=v.id===current?.id,esAceptada=v.id===approved?.id,prev=history.versions.find(p=>p.number<v.number);return <li key={v.id} className="version-row" data-actual={esActual||undefined} data-aceptada={esAceptada||undefined}>
          <button type="button" className="version-row-main" onClick={()=>showVersion(v)} aria-label={`Ver V${v.number}`}>
            <span className="version-row-dot" data-tone={esActual?"success":estadoTono(v,approved?.id)} aria-hidden="true">{esActual?<span className="pulse-dot"/>:<span className="state-dot"/>}</span>
            <span className="version-row-text">
              {esActual && <small className="version-row-kicker">La actual · la última que se ha tocado</small>}
              <strong>V{v.number} · {v.change_reason||"Sin motivo"}</strong>
              <span data-tone={estadoTono(v,approved?.id)}>{versionSentence(v,history)}</span>
              <small>Creada <time dateTime={v.created_at}>{versionTimestamp(v.created_at)}</time>{versionTimestamp(v.updated_at)!==versionTimestamp(v.created_at)?<> · editada <time dateTime={v.updated_at}>{versionTimestamp(v.updated_at)}</time></>:null} · {v.created_by_name}</small>
            </span>
            <span className="version-row-amount"><span className="pl-mono">{money(totals(v.items).total)}</span><small>{versionMoment(v)}</small></span>
          </button>
          {prev && <button type="button" className="link-inline version-row-diff" onClick={()=>onNavigate({vista:"changes",v:v.id,desde:prev.id})}>Ver qué cambió desde la V{prev.number}</button>}
        </li>;})}</ol>
      </section>}

      {view==="changes" && <section className="budget-view" role="region" aria-label="Ver qué cambia">
        {history.versions.length<2 ? <p className="pl-note">Cuando haya otra versión, aquí verás qué cambia entre las dos y cuánto cuesta cada cambio.</p> : <>
          <div className="compare-head">
            <p className="muted text-sm">{from?.id===approved?.id?`Comparando la V${shown.number} con lo que el cliente ya aceptó`:`Comparando la V${shown.number} con otra versión`}</p>
            <label className="compare-with"><span>Comparar con:</span><select className="workspace-select" aria-label="Comparar con" value={from?.id ?? ""} onChange={e=>onNavigate({desde:e.target.value})}>{history.versions.filter(v=>v.id!==shown.id).map(v=>{return <option key={v.id} value={v.id}>V{v.number} · {versionState(v,approved?.id)}{v.id===current?.id?" · la actual":""}</option>;})}</select></label>
          </div>
          {from && from.id!==shown.id && <BudgetComparisonPanel before={from} after={shown}/>}
        </>}
      </section>}

      {shown.notes && view==="items" && <details className="budget-notes budget-notes-phone"><summary>Notas y condiciones de V{shown.number}</summary><p>{shown.notes}</p></details>}
    </div>

    <aside className="budget-side" aria-label={`Total y acciones de V${shown.number}`}>
      <div className="budget-side-wide"><BudgetTotal version={shown} delta={deltaAceptada} approved={approved}/></div>
      <BudgetActions project={project} budget={budget} approved={approved} working={working} shown={shown} onEdit={onEdit} onSend={abrirEnviar} onResponse={abrirRespuesta} onRevisionCreated={showVersion}/>
      <div className="pl-card budget-facts">
        {alternativas>0 && <div><span>Alternativas</span><span className="muted">{alternativas} · no suman</span></div>}
        <div><span>Base · IVA</span><span className="pl-mono muted">{money(t.base)} + {money(t.tax)}</span></div>
        {shown.notes ? <details><summary>Condiciones y notas</summary><p>{shown.notes}</p></details> : <div><span>Condiciones y notas</span><span className="muted">Sin notas</span></div>}
      </div>
    </aside>
    {borrador && <CatalogPicker open={catalogo} onClose={()=>setCatalogo(false)} project={project} version={shown}/>}
  </section>;
}

function BudgetTotal({version,delta,approved}:{version:BudgetVersion;delta:number|null;approved?:BudgetVersion}) {
  return <div className="pl-card budget-total"><span>Total de V{version.number} · con IVA</span><strong className="pl-mono">{money(totals(version.items).total)}</strong>{delta!==null && approved && <small>{signed(delta)} frente a la V{approved.number} aceptada</small>}</div>;
}
