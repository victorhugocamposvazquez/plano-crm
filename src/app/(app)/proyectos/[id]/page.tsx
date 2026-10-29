"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { MessageSquare, Plus, Check } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { BackLink } from "@/components/ui/back-link";
import { TaskRow } from "@/components/project/task-row";
import { TaskDialog } from "@/components/project/task-dialog";
import { useQueryPatch } from "@/lib/use-query-state";
import { useWorkspace } from "@/components/workspace-provider";
import { Tabs } from "@/components/ui/tabs";
import { Button, LinkButton } from "@/components/ui/button";
import { Pill, Meter, progressTone, type Tone } from "@/components/ui/status";
import { localDate } from "@/lib/hoy";
import { DocumentsPanel } from "@/components/project/documents-panel";
import { ChatPanel } from "@/components/project/chat-panel";
import { PurchasesPanel } from "@/components/project/purchases-panel";
import { BudgetEditor } from "@/components/project/budget-editor";
import { BudgetWorkspace } from "@/components/project/budget-workspace";
import { ProjectMenu } from "@/components/project/project-menu";
import { NextStep } from "@/components/project/next-step";
import { AddToBudget } from "@/components/plan/add-to-budget";
import { BudgetDoors } from "@/components/plan/budget-doors";
import { cargarBorrador } from "@/lib/plano-flujo";
import { budgetHistory } from "@/lib/budget-history";
import { siguientePaso, type TipoAccion } from "@/lib/siguiente-paso";
import { projectProgress, projectStatus, money, totals, dateLabel, kindNames, can, type Task, type Command } from "@/lib/domain";
import "@/styles/project-workspace.css";

type Section = "overview" | "budget" | "work" | "documents" | "purchases";
const sections:Section[]=["overview","budget","work","documents","purchases"];
const subscribe=()=>()=>{},clientSnapshot=()=>true,serverSnapshot=()=>false;
const signed=(value:number)=>`${value<0?"−":"+"}${money(Math.abs(value))}`;
/** Tono del chip de fase: el mismo que `ProjectStatus` (docs/sistema-diseno.md §7). */
const faseTone=(status:keyof typeof projectStatus):Tone=>status==="active"?"info":status==="completed"?"success":"muted";

export default function ObraPage() {
  const hydrated=useSyncExternalStore(subscribe,clientSnapshot,serverSnapshot);
  const {id}=useParams<{id:string}>(),params=useSearchParams(),navigate=useQueryPatch();
  const {data,loading,actor,busy,send,notify}=useWorkspace();
  const requested=params.get("s") as Section|null;
  const section:Section=requested && sections.includes(requested)?requested:params.get("editar")==="1"?"budget":"overview";
  const selectSection=(s:Section)=>navigate({s:s==="overview"?null:s,editar:null});
  const budgetId=params.get("p"),chatAbierto=params.get("chat")==="1";
  const [abierta,setAbierta]=useState<Task|null>(null),[pendingTask,setPendingTask]=useState<string|null>(null);
  const [solicitud,setSolicitud]=useState<"tarea"|"certificacion"|"estado"|null>(null);
  const [creatingBudget,setCreatingBudget]=useState(false),[borradorPlano,setBorradorPlano]=useState(false);
  const project=data.projects.find(p=>p.id===id),canBudget=can(actor.role,"budget.create"),canToggle=can(actor.role,"task.toggle");
  const budgets=useMemo(()=>data.budgets.filter(b=>b.project_id===id).sort((a,b)=>a.created_at.localeCompare(b.created_at)),[data.budgets,id]);
  const budget=budgets.find(b=>b.id===budgetId) ?? budgets[0];
  const history=budget?budgetHistory(budget,data.versions):null;
  const approved=history?.approved,working=history?.working,current=history?.current;
  const editable=working?.status==="draft"?working:undefined;
  const editando=params.get("editar")==="1" && Boolean(editable) && can(actor.role,"budget.save");
  useEffect(()=>{setBorradorPlano(Boolean(cargarBorrador(id)));},[id]);
  const editBudget=()=>{if(editable)navigate({s:"budget",v:editable.id,vista:"items",editar:"1"});};

  async function crearPresupuesto() {
    if(!project || busy || creatingBudget)return;
    setCreatingBudget(true);
    try {
      const ws=await send({type:"budget.create",project_id:project.id,title:"Presupuesto de reforma"});
      const nuevo=ws.budgets.filter(b=>b.project_id===project.id).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
      if(project.status==="lead")await send({type:"project.status",id:project.id,status:"estimating"});
      if(nuevo)navigate({s:"budget",p:nuevo.id,v:null,vista:"items",editar:"1"});
      notify("Presupuesto abierto en borrador.");
    }catch(error){notify(error instanceof Error?error.message:"No se ha podido abrir el presupuesto.");}
    finally{setCreatingBudget(false);}
  }
  async function toggleTask(task:Task) {
    if(!canToggle || busy || pendingTask)return;
    setPendingTask(task.id);
    try{await send({type:"task.toggle",id:task.id,status:task.status==="done"?"pending":"done"});}
    catch(error){notify(error instanceof Error?error.message:"No se ha podido actualizar la tarea.");}
    finally{setPendingTask(null);}
  }
  async function cambiarFase(status:"planning"|"active"|"completed",aviso:string) {
    if(!project || busy)return;
    try{await send({type:"project.status",id:project.id,status});notify(aviso);}
    catch(error){notify(error instanceof Error?error.message:"No se ha podido cambiar la fase.");}
  }
  const paso=project?siguientePaso(data,project):null;
  const commandFor:Partial<Record<TipoAccion,Command["type"]>>={presupuesto:"budget.create",editar:"budget.save",cerrar:"budget.issue",aprobar:"budget.approve",planificar:"project.status","iniciar-obra":"project.status",finalizar:"project.status",tareas:"task.create",certificar:"certification.create"};
  const puedePaso=paso?(!commandFor[paso.accion] || can(actor.role,commandFor[paso.accion]!)):false;
  function accionPaso(tipo:TipoAccion) {
    if(!puedePaso)return;
    if(tipo==="presupuesto"){void crearPresupuesto();return;}
    if(tipo==="editar" || tipo==="cerrar" || tipo==="aprobar"){
      const target=budgets.find(b=>b.id===paso?.budget_id) ?? budget;
      const h=target?budgetHistory(target,data.versions):null;
      navigate({s:"budget",p:target?.id,v:h?.current?.id,vista:"items",editar:tipo==="editar" && h?.working?.status==="draft"?"1":null});return;
    }
    if(tipo==="planificar"){void cambiarFase("planning","Proyecto en planificación");return;}
    if(tipo==="iniciar-obra"){void cambiarFase("active","Proyecto en obra");return;}
    if(tipo==="finalizar"){void cambiarFase("completed","Proyecto finalizado");return;}
    if(tipo==="tareas"){setSolicitud("tarea");return;}
    if(tipo==="certificar"){setSolicitud("certificacion");return;}
    if(tipo==="tarea" && paso?.tarea)setAbierta(paso.tarea);
  }
  const tasks=data.tasks.filter(t=>t.project_id===id).sort((a,b)=>a.due_date.localeCompare(b.due_date));
  const pendingTasks=tasks.filter(t=>t.status==="pending"),doneTasks=tasks.filter(t=>t.status==="done");
  const documents=data.documents.filter(d=>d.project_id===id),messages=data.messages.filter(m=>m.project_id===id),purchases=data.purchases.filter(p=>p.project_id===id);
  const activities=data.activities.filter(a=>a.project_id===id);
  const approvedProjectBase=budgets.reduce((sum,b)=>{const v=budgetHistory(b,data.versions).approved;return sum+(v?totals(v.items).base:0);},0);
  const certificationsDraft=data.certifications.filter(c=>c.project_id===id).reduce((sum,c)=>sum+c.amount,0);
  if(!hydrated || loading)return <p className="muted">Cargando el proyecto…</p>;
  if(!project)return <div className="empty"><strong>Proyecto no encontrado</strong><LinkButton href="/proyectos" variant="ghost">Volver a proyectos</LinkButton></div>;
  const progress=projectProgress(data,project.id),meterTone=progressTone({overdue:pendingTasks.filter(t=>t.due_date<localDate()).length,done:project.status==="completed" || progress>=100});
  const planoHref=`/proyectos/${project.id}/plano${budget?`?p=${budget.id}`:""}`,fotosHref=`/proyectos/nueva?proyecto=${project.id}`;
  const aMano=()=>{if(!budget)void crearPresupuesto();else if(editable)editBudget();else{navigate({s:"budget",vista:"items",v:current?.id});}};
  const add=<AddToBudget planoHref={planoHref} visitaHref={fotosHref} haPresupuesto={budgets.length>0} borradorPlano={borradorPlano} onManual={aMano}/>;
  const taskRows=(rows:Task[])=>rows.map(task=><TaskRow key={task.id} task={task} canToggle={canToggle} pending={pendingTask===task.id} showDate compact onToggle={toggleTask} onOpen={setAbierta}/>);
  // Antes de la obra, la tarjeta de avance no dice nada («0 de 0 tareas»): en su lugar, qué falta para poder presupuestar.
  const enObra=project.status==="planning" || project.status==="active" || project.status==="completed" || tasks.length>0;
  const fotosVisita=documents.filter(d=>d.category==="before").length;
  const requisitos=[
    {id:"direccion",label:"Dirección de la obra",hint:project.location || "Falta la dirección",done:Boolean(project.location)},
    {id:"tipo",label:"Tipo de reforma",hint:kindNames[project.kind],done:true},
    {id:"fotos",label:"Fotos del estado actual",hint:fotosVisita?`${fotosVisita} foto${fotosVisita===1?"":"s"}`:"Ninguna todavía",done:fotosVisita>0},
    {id:"presupuesto",label:"Presupuesto abierto",hint:budgets.length?(budgets.length===1?"1 presupuesto":`${budgets.length} presupuestos`):"A mano, desde un plano o desde fotos",done:budgets.length>0}
  ];
  const puedeFase=can(actor.role,"project.status");

  return <div className="page project-workspace">
    <header className="project-head">
      <BackLink fallback="/proyectos" compact>Proyectos</BackLink>
      <div className="project-head-text">
        <h1 className="h1">{project.name}</h1>
        <p className="subtitle"><span className="pl-mono">{project.code}</span>{[project.client_name,project.location].filter(Boolean).map(t=><span key={t}> · {t}</span>)}</p>
      </div>
      <button type="button" className="pill project-phase" data-tone={faseTone(project.status)} aria-haspopup="dialog" title={puedeFase?"Cambiar de fase":"Fase del proyecto"} disabled={!puedeFase} onClick={()=>setSolicitud("estado")}>{projectStatus[project.status]}</button>
      <div className="head-actions">
        {canBudget && <BudgetDoors planoHref={planoHref} fotosHref={fotosHref} onManual={aMano}/>}
        <Button variant="secondary" className="chat-launcher" onClick={()=>navigate({chat:"1"})} aria-haspopup="dialog" aria-expanded={chatAbierto} aria-label="Chat del proyecto"><MessageSquare size={17} aria-hidden="true"/><span className="chat-launcher-text">Chat</span></Button>
        <ProjectMenu project={project} approvedVersion={approved} puedeEstimar={canBudget} onChat={()=>navigate({chat:"1"})} solicitud={solicitud} onAtendida={()=>setSolicitud(null)} planoHref={planoHref} fotosHref={fotosHref} onManual={aMano} borrador={editable}/>
      </div>
    </header>
    <Tabs label="Secciones del proyecto" value={section} onChange={selectSection} options={[{id:"overview",label:"Resumen"},{id:"budget",label:"Presupuesto"},{id:"work",label:"Obra"},{id:"documents",label:"Documentos"},{id:"purchases",label:"Compras"}]}/>

    {section==="overview" && <section className="project-overview" aria-label="Resumen del proyecto">
      {paso && <NextStep paso={paso} busy={busy} allowed={puedePaso} compact onAccion={accionPaso}/>}
      <div className="project-overview-grid">
        {enObra
          ? <button type="button" className="workspace-card overview-card" onClick={()=>selectSection("work")} aria-label={`Obra: ${progress} % · ${doneTasks.length} de ${tasks.length} tareas hechas. Ver tareas y avance`}>
              <span className="overview-kicker"><span>Obra</span><span className="status" data-tone={faseTone(project.status)}>{projectStatus[project.status]}</span></span>
              <strong className="overview-figure pl-mono">{progress} %</strong>
              <Meter value={progress} label={`Avance de ${project.name}`} tone={meterTone}/>
              <span className="muted text-sm">{doneTasks.length} de {tasks.length} tareas hechas</span>
            </button>
          : <section className="workspace-card overview-card" aria-labelledby="para-presupuestar">
              <span className="overview-kicker"><span id="para-presupuestar">Para poder presupuestar</span><span className="muted">{requisitos.filter(r=>r.done).length} de {requisitos.length}</span></span>
              <ul className="overview-checklist">{requisitos.map(r=><li key={r.id} data-done={r.done}><span className="overview-check" aria-hidden="true">{r.done && <Check size={12} strokeWidth={2.6}/>}</span><span><span>{r.label}</span><small className="muted">{r.hint}</small></span></li>)}</ul>
            </section>}
        <button type="button" className="workspace-card overview-card" onClick={()=>selectSection("budget")} aria-label={current?`Presupuesto: ${money(totals(current.items).total)} con IVA. Ver presupuesto y versiones`:"Presupuesto: todavía no hay. Ver opciones para presupuestar"}>
          <span className="overview-kicker"><span>Presupuesto</span>{budgets.length>1 && <span className="muted">{budgets.length} presupuestos</span>}</span>
          {current ? <>
            <strong className="overview-figure pl-mono">{money(totals(current.items).total)}<small>con IVA</small></strong>
            <span className="overview-versions">{approved && <Pill label={`V${approved.number} aprobada`} tone="success"/>}{working && <Pill label={`V${working.number} ${working.status==="draft"?"borrador":"cerrada"}`} tone="warning"/>}{!approved && !working && <Pill label={`V${current.number}`} tone="muted"/>}</span>
            <span className="muted text-sm">{approved && working?`V${working.number} ${signed(totals(working.items).total-totals(approved.items).total)} frente a V${approved.number}`:working?"Pendiente de cerrar y enviar":approved?"Aprobada para obra":budget?.title}</span>
          </> : <>
            <span className="overview-empty">Todavía no hay presupuesto</span>
            <span className="link-inline">Ver opciones para presupuestar</span>
          </>}
        </button>
      </div>
      {pendingTasks.length>0 && <section className="workspace-card"><header><h2>Próximas tareas</h2><span className="muted text-sm">{pendingTasks.length} pendientes</span></header><div>{taskRows(pendingTasks.slice(0,3))}</div>{pendingTasks.length>3 && <Button variant="ghost" onClick={()=>selectSection("work")}>Ver las {pendingTasks.length} pendientes</Button>}</section>}
      {activities.length>0 && <details className="budget-notes"><summary>Actividad reciente del proyecto</summary>{activities.slice(0,5).map(a=><div className="row-doc" key={a.id}><span>{a.text}<small>{a.actor_name} · {dateLabel(a.created_at)}</small></span></div>)}</details>}
    </section>}

    {section==="budget" && <section className="project-budget-section" aria-label="Presupuesto del proyecto">
      {budgets.length>1 && <label className="field"><span>Presupuesto del proyecto</span><select className="workspace-select" value={budget?.id} onChange={e=>navigate({p:e.target.value,v:null,desde:null,hasta:null,editar:null})}>{budgets.map(b=><option value={b.id} key={b.id}>{b.title}</option>)}</select></label>}
      {!budget && <div className="empty"><strong>Abre el primer presupuesto</strong><span className="muted">Elige cómo aportar los trabajos: catálogo, planos o fotos de la visita.</span>{canBudget && <Button variant="primary" disabled={busy || creatingBudget} onClick={crearPresupuesto}><Plus size={17} aria-hidden="true"/>{creatingBudget?"Abriendo…":"Nuevo presupuesto"}</Button>}</div>}
      {!budget && canBudget && add}
      {budget && <BudgetWorkspace key={budget.id} budget={budget} versions={data.versions} onNavigate={patch=>navigate({s:"budget",...patch})} onEdit={editBudget} canEdit={canBudget} adding={add}/>}
    </section>}

    {section==="work" && <section className="project-work-section" aria-label="Tareas y avance"><div className="workspace-section-heading"><div><h2>Tareas y avance</h2><p className="muted">{pendingTasks.length} pendientes · {progress}% completado</p></div>{can(actor.role,"task.create") && <Button variant="primary" onClick={()=>setSolicitud("tarea")}><Plus size={16} aria-hidden="true"/>Nueva tarea</Button>}</div><Meter value={progress} label="Avance ponderado por tarea" tone={meterTone}/>{tasks.length===0 && <p className="workspace-callout">Todavía no hay tareas planificadas.</p>}<div>{taskRows(pendingTasks)}</div>{doneTasks.length>0 && <details className="budget-notes"><summary>Completadas ({doneTasks.length})</summary>{taskRows(doneTasks)}</details>}<details className="budget-notes"><summary>Importes y certificaciones del proyecto</summary><dl className="workspace-facts"><div><dt>Aprobado en todos los presupuestos · sin IVA</dt><dd className="pl-mono">{money(approvedProjectBase)}</dd></div><div><dt>Certificaciones en preparación · sin IVA</dt><dd className="pl-mono">{money(certificationsDraft)}</dd></div></dl>{can(actor.role,"certification.create") && approved && <Button variant="secondary" onClick={()=>setSolicitud("certificacion")}>Preparar certificación</Button>}<p className="muted text-sm">Las certificaciones actuales son borradores; no son facturas emitidas.</p></details></section>}
    {section==="documents" && <DocumentsPanel project={project} documents={documents}/>}
    {section==="purchases" && <PurchasesPanel projectId={project.id} purchases={purchases}/>}
    <TaskDialog task={abierta?data.tasks.find(t=>t.id===abierta.id) ?? null:null} onClose={()=>setAbierta(null)}/>
    {editable && <BudgetEditor open={editando} onClose={()=>navigate({editar:null})} project={project} version={editable} guiaInicial={editable.items.length===0}/>}
    <Drawer open={chatAbierto} onClose={()=>navigate({chat:null})} title={project.name} subtitle={[project.location,project.code].filter(Boolean).join(" · ")}><ChatPanel projectId={project.id} messages={messages}/></Drawer>
  </div>;
}
