"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Plus, X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { can, money, lineTotal, type Document, type Project } from "@/lib/domain";
import { versionTimestamp } from "@/lib/budget-history";
import { createRoomProposal, replaceRoomArticle, type RoomSurvey } from "@/lib/captura/room-survey";
import { applyRoomCapture, type RoomDraft, type RoomImport, type RoomCaptureRequest } from "@/lib/captura/room-draft";
import { addRoomWork, attachRoomDocument, newRoom, newRoomSurvey, setRoomQuantity } from "@/lib/captura/room-editor";
import "@/styles/room-capture.css";
type ImportInfo=Pick<RoomImport,"id"|"version_id"|"capture_revision"|"created_at"|"created_by_name">;
const workspaceKey="plano.workspace.v1";
export function RoomCapture({project,budgetId}:{project:Project;budgetId:string|null}){
  const router=useRouter();
  const [exitDialog,setExitDialog]=useState(false);
  const [stage,setStage]=useState<"capture"|"works"|"review">("capture");
  const {data,actor,mode,refresh,upload,fileUrl,notify}=useWorkspace();
  const [form,setForm]=useState<RoomSurvey>(()=>newRoomSurvey(project.id)),[saved,setSaved]=useState<RoomDraft|null>(null),[imports,setImports]=useState<ImportInfo[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[available,setAvailable]=useState(true),[dirty,setDirty]=useState(true),[active,setActive]=useState(""),[reviewed,setReviewed]=useState(false),[reloadDialog,setReloadDialog]=useState(false);
  const [photoKind,setPhotoKind]=useState<"photo"|"panorama">("photo"),[articleId,setArticleId]=useState(""),[query,setQuery]=useState(""),[versionId,setVersionId]=useState(""),[existingPhoto,setExistingPhoto]=useState("");
  const [snapshot,setSnapshot]=useState<RoomImport|null>(null);
  const allowed=can(actor.role,"budget.save"),back=`/proyectos/${project.id}?s=budget${budgetId?`&p=${budgetId}`:""}`;
  const drafts=data.versions.filter(v=>v.status==="draft" && data.budgets.some(b=>b.id===v.budget_id && b.project_id===project.id && (!budgetId || b.id===budgetId)));
  const version=drafts.find(v=>v.id===versionId) ?? drafts[0];
  const room=form.rooms.find(r=>r.id===active) ?? form.rooms[0];
  const result=useMemo(()=>{try{return {proposal:createRoomProposal(form,{organization_id:data.organization_id,articles:data.articles}),error:""};}catch{return {proposal:null,error:"Completa el nombre de la zona y revisa las cantidades indicadas."};}},[form,data.organization_id,data.articles]);
  useEffect(()=>setReviewed(false),[result.proposal]);
  const proposal=result.proposal,roomProposal=proposal?.rooms.find(r=>r.id===room.id);
  const changed= (edit:(next:RoomSurvey)=>void)=>{setForm(previous=>{const next=structuredClone(previous);edit(next);return next;});setDirty(true);setReviewed(false);setError("");};
  async function load(){
    setLoading(true);setError("");
    try{
      let capture:RoomDraft|null,history:ImportInfo[];
      if(mode==="demo"){const ws=JSON.parse(localStorage.getItem(workspaceKey)!);capture=ws.room_captures?.find((c:RoomDraft)=>c.project_id===project.id) ?? null;history=(ws.room_imports ?? []).filter((i:RoomImport)=>i.project_id===project.id).reverse().slice(0,20);}
      else{const response=await fetch(`/api/proyectos/${project.id}/captura`,{cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error);setAvailable(body.available);capture=body.capture;history=body.imports;}
      setSaved(capture);setForm(capture?.survey ?? newRoomSurvey(project.id));setDirty(!capture);setImports(history);setReviewed(false);setSnapshot(null);
    }catch(e){setError((e as Error).message);setAvailable(false);}finally{setLoading(false);}
  }
  useEffect(()=>{void load(); /* El proyecto no cambia durante la vida de esta pantalla. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[project.id,mode]);
  useEffect(()=>{const before=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue="";}};window.addEventListener("beforeunload",before);return()=>window.removeEventListener("beforeunload",before);},[dirty]);
  async function mutate(request:RoomCaptureRequest){
    if(mode==="demo"){
      const previous=JSON.parse(localStorage.getItem(workspaceKey)!);
      const next=applyRoomCapture(previous,request,actor,project.id);
      localStorage.setItem(workspaceKey,JSON.stringify(next));await refresh();
      const capture=next.room_captures?.find(c=>c.project_id===project.id)!;setSaved(capture);setImports((next.room_imports ?? []).filter(i=>i.project_id===project.id).reverse().slice(0,20));
      return;
    }
    const response=await fetch(`/api/proyectos/${project.id}/captura`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(request)});
    const body=await response.json();if(!response.ok)throw new Error(body.error || "No se ha podido guardar.");
    if(request.action==="save")setSaved(body.capture);else{setImports(previous=>[body.snapshot,...previous.filter(i=>i.id!==body.snapshot.id)].slice(0,20));await refresh();}
  }
  async function save(){setBusy(true);setError("");try{await mutate({action:"save",expected_revision:saved?.revision ?? 0,survey:form});setDirty(false);notify("Captura guardada por zonas");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function apply(){if(!saved || !version || !proposal || !reviewed)return;setBusy(true);setError("");try{await mutate({action:"apply",capture_revision:saved.revision,version_id:version.id,expected_revision:version.draft_revision,expected_items:proposal.lines.map(l=>l.item!),reviewed:true});setReviewed(false);notify(`Partidas incorporadas a V${version.number}; la aprobada se conserva`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function photos(files:FileList|null){if(!files?.length)return;setBusy(true);setError("");try{for(const file of Array.from(files)){const doc=await upload(file,project.id,"before");changed(next=>attachRoomDocument(next,room.id,doc,photoKind));}}catch(e){setError(`${(e as Error).message} Las fotos ya subidas se conservan en el proyecto.`);}finally{setBusy(false);}}
  async function inspect(info:ImportInfo){setError("");try{if(mode==="demo"){const ws=JSON.parse(localStorage.getItem(workspaceKey)!);setSnapshot(ws.room_imports.find((i:RoomImport)=>i.id===info.id));}else{const response=await fetch(`/api/proyectos/${project.id}/captura?incorporacion=${info.id}`,{cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error);setSnapshot(body.snapshot);}}catch(e){setError((e as Error).message);}}
  const photoSources=form.sources.filter(s=>room.source_ids.includes(s.id) && ["photo","panorama"].includes(s.kind));
  const existing=data.documents.filter(d=>d.project_id===project.id && ["image/jpeg","image/png","image/webp"].includes(d.mime_type));
  const articles=data.articles.filter(a=>(a.name+" "+a.chapter).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const already=Boolean(saved && version && imports.some(i=>i.version_id===version.id && i.capture_revision===saved.revision));
  if(loading)return <p className="muted">Cargando la captura…</p>;
  return <div className="room-capture">
    <Link href={back} className="link-inline" onClick={e=>{if(dirty){e.preventDefault();setExitDialog(true);}}}>← Volver al presupuesto</Link>
    <header><h1 className="pl-title">Fotos y trabajos por zonas</h1><p className="subtitle">{project.name} · guarda lo que hay y lo que se quiere hacer en cada estancia o zona.</p></header>
    <p className="workspace-callout" hidden={stage!=="capture"}>Las fotos y los 360 ayudan a documentar. En esta fase las cantidades se anotan: no se miden ni se reconocen trabajos automáticamente.</p>
    {!available && <p role="status">No se puede guardar la captura en este entorno. Las fotos ya subidas siguen en Planos y fotos. Pide a administración que active esta función.</p>}
    {error && <p className="error" role="alert">{error} Tu edición sigue en pantalla.</p>}
    <div className="room-save"><span>{saved?`Guardada ${versionTimestamp(saved.updated_at)} · ${saved.updated_by_name}`:"Captura sin guardar"}{dirty && " · cambios pendientes"}</span><Button variant="secondary" onClick={()=>dirty?setReloadDialog(true):void load()} disabled={busy}>Cargar la guardada</Button><Button variant="primary" onClick={save} disabled={busy || !allowed || !available || !proposal || !dirty}>{busy?"Guardando…":"Guardar captura"}</Button></div>
    <nav className="room-tabs room-stage" aria-label="Pasos de la captura">{([['capture','1 · Fotos y zonas'],['works','2 · Trabajos'],['review','3 · Revisar']] as const).map(([value,label])=><button type="button" key={value} disabled={busy} aria-pressed={stage===value} onClick={()=>setStage(value)}>{label}</button>)}</nav>
      <nav className="room-tabs" aria-label="Zonas de la captura" hidden={stage==="review"}>{form.rooms.map(r=><button type="button" key={r.id} aria-pressed={r.id===room.id} onClick={()=>{setActive(r.id);setArticleId("");setQuery("");}}>{r.label || "Sin nombre"}</button>)}<Button variant="secondary" disabled={!allowed || busy || form.rooms.length>=50} onClick={()=>{const r=newRoom(`Zona ${form.rooms.length+1}`);changed(next=>{next.rooms.push(r);});setActive(r.id);setStage("capture");}}><Plus size={16}/>Añadir zona</Button></nav>
    <fieldset disabled={busy || !allowed}>
      <label className="field" hidden={stage!=="capture"}>Qué se quiere hacer<textarea value={form.scope} maxLength={5000} rows={2} onChange={e=>changed(next=>{next.scope=e.target.value;})}/></label>

      <section aria-label="Zona seleccionada" className="room-section" hidden={stage!=="capture"}>
        <label className="field">Nombre de la zona<input value={room.label} maxLength={500} onChange={e=>changed(next=>{next.rooms.find(r=>r.id===room.id)!.label=e.target.value;})}/></label>
        <label className="field">Qué cambia y qué se conserva<textarea value={room.scope} rows={2} maxLength={5000} onChange={e=>changed(next=>{next.rooms.find(r=>r.id===room.id)!.scope=e.target.value;})} placeholder="Por ejemplo, cambiar el suelo y conservar las puertas"/></label>
        <h2>Fotos de {room.label}</h2>
        <Select value={photoKind} label="Tipo de imagen" onChange={setPhotoKind} options={[{value:"photo",label:"Fotos de teléfono"},{value:"panorama",label:"Panorámicas 360"}]}/>
        <div className="room-photo-actions"><label className="btn btn-secondary"><Camera size={16}/>Hacer foto<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="room-file" onChange={e=>{void photos(e.target.files);e.target.value="";}}/></label><label className="btn btn-secondary">Elegir de la galería<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="room-file" onChange={e=>{void photos(e.target.files);e.target.value="";}}/></label></div>
        {photoSources.length>0 && <ul className="room-photos">{photoSources.map(source=>{const doc=data.documents.find(d=>d.id===source.document_id);return <li key={source.id}>{doc && <Photo document={doc} fileUrl={fileUrl}/>}<span>{source.label} · {source.kind==="panorama"?"360":"Foto"}</span><button type="button" className="btn btn-icon" aria-label={`Desvincular ${source.label}`} onClick={()=>changed(next=>{const r=next.rooms.find(r=>r.id===room.id)!;r.source_ids=r.source_ids.filter(id=>id!==source.id);r.observations=r.observations.filter(o=>o.source_id!==source.id);})}><X size={16}/></button></li>;})}</ul>}
        <details><summary>Usar una foto ya subida al proyecto</summary><Select value={existingPhoto} onChange={setExistingPhoto} label="Foto del proyecto" options={existing.map(d=>({value:d.id,label:d.name}))}/><Button variant="secondary" disabled={!existingPhoto} onClick={()=>{const doc=existing.find(d=>d.id===existingPhoto);if(doc)changed(next=>attachRoomDocument(next,room.id,doc,photoKind));setExistingPhoto("");}}>Vincular a esta zona</Button></details>
        <Button variant="primary" onClick={()=>setStage("works")}>Continuar con los trabajos</Button>
      </section>
      <section aria-label="Trabajos de la zona" className="room-section" hidden={stage!=="works"}>
        <h2>Trabajos de {room.label}</h2>
        <label className="field">Buscar un artículo<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Suelo, pintura, tabique…"/></label>
        <Select value={articleId} label="Artículo para añadir" onChange={setArticleId} options={articles.map(a=>({value:a.id,label:a.name,hint:`${money(a.unit_price)} / ${a.unit} · sin IVA`}))}/>
        <Button variant="secondary" disabled={!articleId} onClick={()=>{const article=data.articles.find(a=>a.id===articleId);if(article)changed(next=>addRoomWork(next,room.id,article));setArticleId("");}}><Plus size={16}/>Añadir trabajo</Button>
        {room.selections.map(selection=>{
          if(selection.kind!=="work")return <p key={selection.id}>{selection.label} · Se conserva, no suma al presupuesto.</p>;
          const intent=selection.intent,line=roomProposal?.lines.find(l=>l.id===intent.id),article=data.articles.find(a=>a.id===intent.article_id);
          const formula=intent.formula;
          const m=formula.kind==="sum"?room.measurements.find(m=>m.id===formula.measurement_ids[0]):undefined;
          const editable=intent.formula.kind==="sum" && intent.formula.measurement_ids.length===1 && (!m || m.kind==="quantity");
          return <article key={intent.id} className="room-work" aria-label={`Trabajo ${intent.label}`}><Select value={intent.article_id ?? ""} label={`Artículo de ${intent.label}`} options={data.articles.map(a=>({value:a.id,label:a.name,hint:`${money(a.unit_price)} / ${a.unit} · sin IVA`}))} onChange={id=>{setForm(previous=>replaceRoomArticle(previous,room.id,intent.id,id));setDirty(true);setReviewed(false);}}/>
            {editable?<div className="room-measure"><label className="field">Cantidad ({m?.kind==="quantity"?m.unit:article?.unit ?? "unidad"})<input type="number" min="0.001" max="1000000" step="0.001" value={m?.kind==="quantity"?m.value:""} placeholder="Pendiente" onChange={e=>{const n=e.target.value?Number(e.target.value):null;changed(next=>setRoomQuantity(next,room.id,intent.id,n,m?.kind==="quantity" && m.method==="laser"?"laser":m?.kind==="quantity" && m.method==="visual_estimate"?"visual_estimate":"manual",article?.unit ?? "ud"));}}/></label><Select value={m?.kind==="quantity" && m.method==="laser"?"laser":m?.kind==="quantity" && m.method==="visual_estimate"?"visual_estimate":"manual"} label={`Cómo se obtuvo ${intent.label}`} options={[{value:"manual",label:"Medida anotada"},{value:"laser",label:"Medida anotada con láser"},{value:"visual_estimate",label:"Aproximación visual · pendiente de comprobar"}]} onChange={method=>{if(m?.kind==="quantity")changed(next=>setRoomQuantity(next,room.id,intent.id,m.value,method,article?.unit ?? "ud"));}}/></div>:<p>Esta cantidad procede de un plano y se conserva con sus referencias.</p>}
            {line?.item?<p className="room-amount">{money(lineTotal(line.item))} sin IVA · {line.item.quantity} {line.item.unit}{line.item.inclusion!=="included" && " · no suma al total"}</p>:<p role="status">Pendiente: {line?.issues.map(i=>i.message).join(" ") || "indica una cantidad compatible con el artículo."}</p>}
            {line?.measurements.some(m=>m.basis==="visual_estimate") && <p className="muted">Cantidad aproximada visualmente; no es una medición verificada.</p>}
            <Button variant="secondary" onClick={()=>changed(next=>{const r=next.rooms.find(r=>r.id===room.id)!;r.selections=r.selections.filter(s=>s.kind!=="work" || s.intent.id!==intent.id);})}>Quitar trabajo de la captura</Button>
            <details><summary>Ajuste y alternativas</summary><label className="field">Ajuste de precio (%)<input type="number" min="-50" max="100" step="0.01" value={intent.adjustment_percent} onChange={e=>changed(next=>{const s=next.rooms.find(r=>r.id===room.id)!.selections.find(s=>s.kind==="work" && s.intent.id===intent.id)!;if(s.kind==="work")s.intent.adjustment_percent=Number(e.target.value);})}/></label>{intent.adjustment_percent!==0 && <label className="field">Motivo del ajuste<input value={intent.adjustment_reason} maxLength={500} onChange={e=>changed(next=>{const s=next.rooms.find(r=>r.id===room.id)!.selections.find(s=>s.kind==="work" && s.intent.id===intent.id)!;if(s.kind==="work")s.intent.adjustment_reason=e.target.value;})}/></label>}<Select label={`Incluir ${intent.label}`} value={intent.inclusion} options={[{value:"included",label:"Incluido"},{value:"optional",label:"Alternativa · no suma"},{value:"excluded",label:"Excluido · no suma"}]} onChange={inclusion=>changed(next=>{const s=next.rooms.find(r=>r.id===room.id)!.selections.find(s=>s.kind==="work" && s.intent.id===intent.id)!;if(s.kind==="work")s.intent.inclusion=inclusion;})}/></details>
          </article>;
        })}
        {room.questions.map(q=><label className="field" key={q.id}>{q.question}{q.required?" · necesaria":""}<textarea value={q.answer} maxLength={2000} onChange={e=>changed(next=>{next.rooms.find(r=>r.id===room.id)!.questions.find(question=>question.id===q.id)!.answer=e.target.value;})}/></label>)}
        <Button variant="secondary" disabled={room.questions.length>=100} onClick={()=>changed(next=>{next.rooms.find(r=>r.id===room.id)!.questions.push({id:crypto.randomUUID(),question:"Acceso, ascensor o trabajos ocultos: ¿qué queda por comprobar?",required:true,answer:""});})}>Anotar una comprobación pendiente</Button>
        <Button variant="primary" onClick={()=>setStage("review")}>Revisar la propuesta</Button>
      </section>
    </fieldset>
    <section className="room-section" aria-label="Propuesta de presupuesto" hidden={stage!=="review"}><h2>Propuesta pendiente de revisión</h2>{proposal?.rooms.map(r=><p key={r.id}>{r.label}: {money(r.priced_subtotal.total)} con IVA{!r.pricing_complete || r.pending_questions.length?" · con pendientes":""}</p>)}<p>{proposal?money(proposal.priced_subtotal.total):"—"} con IVA · solo trabajos calculados</p><p>{proposal?.pending_line_ids.length ?? 0} trabajos pendientes. Las fotos no prueban que estén incluidos todos los trabajos de la reforma.</p>{result.error && <p role="status">{result.error}</p>}
      {drafts.length>0?<Select label="Borrador de destino" value={version?.id ?? ""} onChange={setVersionId} options={drafts.map(v=>({value:v.id,label:`${data.budgets.find(b=>b.id===v.budget_id)?.title} · V${v.number}`}))}/>:<p>Abre un borrador desde el presupuesto del proyecto para incorporar estas partidas.</p>}
      <label className="room-review"><input type="checkbox" checked={reviewed} disabled={busy || dirty || !proposal?.complete} onChange={e=>setReviewed(e.target.checked)}/>He revisado trabajos, cantidades y precios. Las aproximaciones siguen pendientes de comprobación.</label>
      <Button variant="primary" onClick={apply} disabled={busy || !allowed || !available || dirty || !saved || !version || !proposal?.complete || !reviewed || already}>{already?"Esta captura ya está incorporada":`Incorporar a ${version?`V${version.number}`:"un borrador"}`}</Button>
      <p className="muted">Se conserva la procedencia y una copia del cálculo. Las partidas retiradas de la captura no se borran del presupuesto; una edición manual posterior bloquea su sustitución automática.</p>
    </section>
    {imports.length>0 && <section className="room-section" hidden={stage!=="review"}><h2>Últimas incorporaciones · hasta 20</h2>{imports.map(info=><p key={info.id}><button type="button" className="link-inline" onClick={()=>void inspect(info)}>Captura {info.capture_revision} · V{data.versions.find(v=>v.id===info.version_id)?.number ?? "—"} · {versionTimestamp(info.created_at)}</button></p>)}</section>}
    <Modal open={exitDialog} onClose={()=>setExitDialog(false)} title="Salir con cambios pendientes" footer={<><Button variant="secondary" onClick={()=>setExitDialog(false)}>Seguir en la captura</Button><Button variant="primary" onClick={()=>router.push(back)}>Salir sin guardar la captura</Button></>}><p>Las fotos subidas se conservan en el proyecto. Las zonas, medidas y trabajos sin guardar se perderán.</p></Modal>
    <Modal open={reloadDialog} onClose={()=>setReloadDialog(false)} title="Cargar la captura guardada" footer={<><Button variant="secondary" onClick={()=>setReloadDialog(false)}>Conservar mi edición</Button><Button variant="primary" onClick={()=>{setReloadDialog(false);void load();}}>Descartar mi edición y cargar</Button></>}><p>Se sustituirán los cambios que tienes en pantalla por la captura guardada. Los archivos ya subidos al proyecto se conservan.</p></Modal>
    <Modal open={Boolean(snapshot)} onClose={()=>setSnapshot(null)} title="De dónde salen estas partidas">{snapshot && <><p>Incorporadas {versionTimestamp(snapshot.created_at)} · {snapshot.created_by_name}. Propuesta revisada; no certifica medidas ni trabajos ocultos.</p>{snapshot.items.map(item=>{const origin=snapshot.survey.rooms.find(r=>r.selections.some(s=>s.kind==="work" && s.intent.id===item.id));return <section className="room-section" key={item.id}><h3>{item.description}</h3><p>{origin?.label} · {item.quantity} {item.unit} · {money(item.unit_price)} / {item.unit} sin IVA</p><p>{snapshot.survey.sources.filter(s=>origin?.source_ids.includes(s.id)).map(s=>s.label).join(" · ")}</p><p>{origin?.scope}</p></section>;})}</>}</Modal>
  </div>;
}
function Photo({document,fileUrl}:{document:Document;fileUrl:(d:Document)=>Promise<string>}){
  const [url,setUrl]=useState("");useEffect(()=>{let active=true;let objectUrl="";fileUrl(document).then(value=>{if(value.startsWith("blob:"))objectUrl=value;if(active)setUrl(value);else if(objectUrl)URL.revokeObjectURL(objectUrl);}).catch(()=>{});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[document.id]);
  return url?<img src={url} alt={document.name} loading="lazy"/>:<span>Foto guardada en el proyecto</span>;
}
