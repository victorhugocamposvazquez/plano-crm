"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Euro, Image as ImageIcon, MessageCircle, MessageSquare, Package, Plus, Receipt, Users } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { BackLink } from "@/components/ui/back-link";
import { TaskDialog } from "@/components/project/task-dialog";
import { useQueryPatch } from "@/lib/use-query-state";
import { useWorkspace } from "@/components/workspace-provider";
import { Tabs } from "@/components/ui/tabs";
import { Button, LinkButton } from "@/components/ui/button";
import { Meter, progressTone } from "@/components/ui/status";
import { localDate } from "@/lib/hoy";
import { DocumentsPanel } from "@/components/project/documents-panel";
import { ChatPanel } from "@/components/project/chat-panel";
import { PurchasesPanel } from "@/components/project/purchases-panel";
import { BudgetEditor } from "@/components/project/budget-editor";
import { BudgetWorkspace } from "@/components/project/budget-workspace";
import { CobrosPanel } from "@/components/project/cobros-panel";
import { ProjectMenu } from "@/components/project/project-menu";
import { ProjectStepper } from "@/components/project/project-stepper";
import { ResponseDialog } from "@/components/project/response-dialog";
import { SendDialog } from "@/components/project/send-dialog";
import { WorkPanel } from "@/components/project/work-panel";
import { AddToBudget } from "@/components/plan/add-to-budget";
import { cargarBorrador } from "@/lib/plano-flujo";
import { budgetHistory, versionState } from "@/lib/budget-history";
import { emitidas, facturasDe, sumaBase, vencidas } from "@/lib/facturas";
import { marcarVisto, sinLeerPorProyecto } from "@/lib/chat-visto";
import { pasoVisible, type TipoAccion } from "@/lib/siguiente-paso";
import { pasoDe, pasos, quienActua, quienEtiqueta, textoMovimiento, tituloPaso } from "@/lib/pasos";
import { veSeccion } from "@/lib/navegacion";
import { claveCliente } from "@/lib/resumen";
import { projectProgress, projectStatus, money, totals, dateLabel, kindNames, can, purchaseStatus, type Task, type Command } from "@/lib/domain";
import "@/styles/project-workspace.css";

type Section = "overview" | "budget" | "work" | "purchases" | "documents" | "cobros";
const sections:Section[]=["overview","budget","work","purchases","documents","cobros"];
const subscribe=()=>()=>{},clientSnapshot=()=>true,serverSnapshot=()=>false;
const haceDias=(iso:string)=>{const d=Math.round((Date.now()-new Date(iso).getTime())/864e5);return d<=0?"hoy":d===1?"hace 1 día":`hace ${d} días`;};

export default function ProyectoPage() {
  const hydrated=useSyncExternalStore(subscribe,clientSnapshot,serverSnapshot);
  const {id}=useParams<{id:string}>(),params=useSearchParams(),navigate=useQueryPatch();
  const {data,loading,actor,busy,send,notify}=useWorkspace();
  const requested=params.get("s") as Section|null;
  const section:Section=requested && sections.includes(requested)?requested:params.get("editar")==="1"?"budget":"overview";
  const selectSection=(s:Section)=>navigate({s:s==="overview"?null:s,editar:null,accion:null});
  const budgetId=params.get("p"),chatAbierto=params.get("chat")==="1",accion=params.get("accion");
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
  const mensajes=data.messages.filter(m=>m.project_id===id);
  useEffect(()=>{if(chatAbierto)marcarVisto(id);},[chatAbierto,id,mensajes.length]);
  const [sinLeerChat,setSinLeerChat]=useState(0);
  useEffect(()=>{const contar=()=>setSinLeerChat(sinLeerPorProyecto(data.messages,actor.name).get(id) ?? 0);contar();window.addEventListener("plano:chat-visto",contar);return()=>window.removeEventListener("plano:chat-visto",contar);},[data.messages,actor.name,id]);
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
    try{await send({type:"task.toggle",id:task.id,status:task.status==="done"?"pending":"done"});notify(task.status==="done"?`Reabierta: ${task.title}`:`Completada: ${task.title}`,{label:"Deshacer",run:()=>send({type:"task.toggle",id:task.id,status:task.status})});}
    catch(error){notify(error instanceof Error?error.message:"No se ha podido actualizar la tarea.");}
    finally{setPendingTask(null);}
  }
  async function moverAManana(task:Task) {
    const siguiente=new Date(`${localDate()}T12:00:00`);siguiente.setDate(siguiente.getDate()+1);
    try{await send({type:"task.update",id:task.id,due_date:localDate(siguiente)});notify(`«${task.title}» pasa a mañana`,{label:"Deshacer",run:()=>send({type:"task.update",id:task.id,due_date:task.due_date})});}
    catch(error){notify(error instanceof Error?error.message:"No se ha podido mover la tarea.");}
  }
  async function cambiarFase(status:"planning"|"active"|"completed",aviso:string) {
    if(!project || busy)return;
    try{await send({type:"project.status",id:project.id,status});notify(aviso);}
    catch(error){notify(error instanceof Error?error.message:"No se ha podido cambiar la fase.");}
  }
  const paso=project?pasoVisible(data,project,localDate()):null;
  const commandFor:Partial<Record<TipoAccion,Command["type"]>>={presupuesto:"budget.create",editar:"budget.save",cerrar:"budget.issue",aprobar:"budget.approve",planificar:"project.status","iniciar-obra":"project.status",finalizar:"project.status",tareas:"task.create",certificar:"certification.create"};
  const puedePaso=paso?(!commandFor[paso.accion] || can(actor.role,commandFor[paso.accion]!)):false;
  function accionPaso(tipo:TipoAccion) {
    if(!puedePaso)return;
    if(tipo==="presupuesto"){void crearPresupuesto();return;}
    if(tipo==="editar" || tipo==="cerrar" || tipo==="aprobar"){
      const target=budgets.find(b=>b.id===paso?.budget_id) ?? budget;
      const h=target?budgetHistory(target,data.versions):null;
      navigate({s:"budget",p:target?.id,v:h?.current?.id,vista:"items",editar:tipo==="editar" && h?.working?.status==="draft"?"1":null,accion:tipo==="cerrar"?"enviar":tipo==="aprobar"?"respuesta":null});return;
    }
    if(tipo==="planificar"){void cambiarFase("planning","Proyecto en planificación");return;}
    if(tipo==="iniciar-obra"){void cambiarFase("active","Proyecto en obra");return;}
    if(tipo==="finalizar"){void cambiarFase("completed","Proyecto entregado");return;}
    if(tipo==="tareas"){setSolicitud("tarea");return;}
    if(tipo==="certificar"){selectSection("cobros");return;}
    if(tipo==="tarea" && paso?.tarea)setAbierta(paso.tarea);
  }
  const tasks=data.tasks.filter(t=>t.project_id===id).sort((a,b)=>a.due_date.localeCompare(b.due_date));
  const pendingTasks=tasks.filter(t=>t.status==="pending"),doneTasks=tasks.filter(t=>t.status==="done");
  const documents=data.documents.filter(d=>d.project_id===id),purchases=data.purchases.filter(p=>p.project_id===id),cobros=data.certifications.filter(c=>c.project_id===id),facturas=facturasDe(data,id);
  const activities=data.activities.filter(a=>a.project_id===id);
  if(!hydrated || loading)return <p className="muted">Cargando el proyecto…</p>;
  if(!project)return <div className="empty"><strong>Proyecto no encontrado</strong><LinkButton href="/proyectos" variant="ghost">Volver a proyectos</LinkButton></div>;
  const hoy=localDate();
  const progress=projectProgress(data,project.id),meterTone=progressTone({overdue:pendingTasks.filter(t=>t.due_date<hoy).length,done:project.status==="completed" || progress>=100});
  const planoHref=`/proyectos/${project.id}/plano${budget?`?p=${budget.id}`:""}`,fotosHref=`/proyectos/nueva?proyecto=${project.id}`;
  const aMano=()=>{if(!budget)void crearPresupuesto();else if(editable)editBudget();else{navigate({s:"budget",vista:"items",v:current?.id});}};
  const enObra=project.status==="planning" || project.status==="active" || project.status==="completed" || tasks.length>0;
  const fotosVisita=documents.filter(d=>d.category==="before").length;
  const requisitos=[
    {id:"direccion",label:"Dirección de la obra",hint:project.location || "Falta la dirección",done:Boolean(project.location)},
    {id:"tipo",label:"Tipo de reforma",hint:kindNames[project.kind],done:true},
    {id:"fotos",label:"Fotos del estado actual",hint:fotosVisita?`${fotosVisita} foto${fotosVisita===1?"":"s"}`:"Ninguna todavía",done:fotosVisita>0},
    {id:"presupuesto",label:"Presupuesto abierto",hint:budgets.length?(budgets.length===1?"1 presupuesto":`${budgets.length} presupuestos`):"A mano, desde un plano o desde fotos",done:budgets.length>0}
  ];
  const puedeFase=can(actor.role,"project.status"),veClientes=veSeccion(actor.role,"/clientes");
  const quien=quienActua(data,project,hoy),etiqueta=quienEtiqueta[quien];
  const baseAceptada=approved?totals(approved.items).base:0,cobrado=sumaBase(facturas.filter(f=>f.status==="paid")),facturado=sumaBase(emitidas(facturas)),facturasVencidas=vencidas(facturas,hoy).length;
  const sinPedir=purchases.filter(p=>p.status==="planned").length,esperando=purchases.filter(p=>p.status==="ordered"),enObraMat=purchases.filter(p=>p.status==="delivered").length;
  const materialTitulo=!purchases.length?"Sin materiales":esperando.length?"Esperando proveedor":sinPedir?`${sinPedir} por pedir`:enObraMat===purchases.length?"Todo en obra":purchaseStatus.received;
  const materialDetalle=esperando[0]?`${esperando[0].name} · llegan ${esperando[0].received_quantity} de ${esperando[0].quantity} ${esperando[0].unit}`:purchases.length?`${purchases.length} material${purchases.length===1?"":"es"} en la lista`:"Salen de las partidas aceptadas";
  const tocaHoy=pendingTasks.find(t=>t.due_date<=hoy);
  const enviada=history?.working?.status==="issued"?history.working:undefined;
  const recordatorio=enviada?`Hola. ¿Has podido ver el presupuesto de ${project.name} (V${enviada.number}, ${money(totals(enviada.items).total)} con IVA)? Dime si tienes cualquier duda.`:"";
  const verSiguiente=paso && paso.accion!=="ninguna";
  const shownParam=history?.versions.find(v=>v.id===params.get("v"));
  // Tras enviarla sigue siendo la misma versión: el diálogo necesita seguir montado para enseñar el último paso.
  const versionEnviar=shownParam ?? working;
  const anteriorEnviada=history?.versions.find(v=>v.status==="issued" && (!approved || v.number>approved.number) && v.id!==versionEnviar?.id);

  return <div className="page project-workspace" data-seccion={section}>
    <button type="button" className="phone-back ficha-subback" onClick={()=>selectSection("overview")}><ChevronLeft size={18} strokeWidth={1.8} aria-hidden="true"/>{project.name}</button>
    <header className="ficha-head">
      <BackLink fallback="/proyectos" compact>Proyectos</BackLink>
      <div className="ficha-title">
        <div className="ficha-name"><h1 className="pl-title">{project.name}</h1><span className="kind-tag">{kindNames[project.kind]}</span></div>
        <p className="pl-sub">{veClientes?<Link href={`/clientes/${encodeURIComponent(claveCliente(project.client_name))}`} className="ficha-client">{project.client_name}</Link>:project.client_name}{[project.location,project.code].filter(Boolean).map(t=><span key={t}> · {t}</span>)}</p>
        <ol className="step-bars" aria-label="Camino del proyecto">{pasos.map((p,i)=>{const actual=pasos.findIndex(x=>x.id===pasoDe(project.status));return <li key={p.id} data-state={project.status==="completed" || i<actual?"done":i===actual?"current":"todo"}>{p.label}</li>;})}</ol>
      </div>
      <div className="ficha-tools">
        <ProjectStepper status={project.status} progress={progress} onCambiar={puedeFase?()=>setSolicitud("estado"):undefined}/>
        <button type="button" className="pill ficha-phase" data-tone={project.status==="completed"?"success":pasoDe(project.status)==="obra"?"info":"muted"} disabled={!puedeFase} aria-haspopup="dialog" aria-label={`Fase del proyecto: ${projectStatus[project.status]}. Cambiar de fase`} onClick={()=>setSolicitud("estado")}>{pasos.find(p=>p.id===pasoDe(project.status))?.label}</button>
        <ProjectMenu project={project} approvedVersion={approved} puedeEstimar={canBudget} onChat={()=>navigate({chat:"1"})} solicitud={solicitud} onAtendida={()=>setSolicitud(null)} planoHref={planoHref} fotosHref={fotosHref} onManual={aMano} borrador={editable}/>
      </div>
    </header>
    <Tabs label="Secciones del proyecto" value={section} onChange={selectSection} options={[
      {id:"overview",label:"Resumen"},
      {id:"budget",label:"Presupuesto",dot:working?.status==="draft"?"warning":working?.status==="issued"?"info":undefined},
      {id:"work",label:"Obra",hint:enObra?`${progress} %`:undefined,dot:pendingTasks.some(t=>t.due_date<hoy)?"danger":undefined},
      {id:"purchases",label:"Materiales",dot:esperando.length?"info":sinPedir?"warning":undefined},
      {id:"documents",label:"Planos y fotos",hint:documents.length?String(documents.length):undefined},
      {id:"cobros",label:"Cobros",dot:vencidas(facturasDe(data,id),hoy).length?"danger":undefined}
    ]}/>

    {section==="overview" && <section className="ficha-resumen ficha-enter" aria-label="Resumen del proyecto">
      {verSiguiente && paso && <section className="first-card" data-tone={etiqueta.tone==="success"?"warning":etiqueta.tone} aria-label="Siguiente paso">
        <div className="first-card-kicker kicker-split"><span>Siguiente paso · {quien==="cliente"?"en manos del cliente":quien==="atrasado"?"va atrasado":"te toca a ti"}</span>{enviada && <span>{haceDias(enviada.updated_at)}</span>}</div>
        <div className="first-card-body">
          <div><strong>{tituloPaso(paso.titulo)}</strong><p>{enviada && approved && enviada.id!==approved.id?<><span className="pl-mono">{money(totals(enviada.items).total)}</span> con IVA · {totals(enviada.items).total>=totals(approved.items).total?"sube":"baja"} <span className="pl-mono">{money(Math.abs(totals(enviada.items).total-totals(approved.items).total))}</span> sobre lo aceptado. </>:null}{paso.detalle}</p></div>
          <div className="first-card-actions">
            {enviada && paso.accion==="aprobar" && <a className="btn btn-secondary" href={`https://wa.me/?text=${encodeURIComponent(recordatorio)}`} target="_blank" rel="noopener"><MessageCircle size={16} strokeWidth={1.7} aria-hidden="true"/>Recordar por WhatsApp</a>}
            {puedePaso ? <Button variant="primary" data-accent="orange" disabled={busy} onClick={()=>accionPaso(paso.accion)}>{paso.label}</Button> : <span className="muted text-sm">Lo completa otro perfil.</span>}
          </div>
        </div>
      </section>}
      <nav className="pl-card ficha-list" aria-label="Apartados del proyecto">
        {[
          {id:"budget" as const,icon:Euro,tone:"warning",label:"Presupuesto",hint:current?`V${current.number} · ${versionState(current,approved?.id)} · ${history?.versions.length} ${history?.versions.length===1?"versión":"versiones"}`:"Todavía no hay",valor:current?money(totals(current.items).total):"",actual:Boolean(current)},
          {id:"work" as const,icon:Check,tone:"success",label:"Obra",hint:tasks.length?`${progress} % · ${doneTasks.length} de ${tasks.length} tareas hechas`:"Todavía sin tareas"},
          {id:"purchases" as const,icon:Package,tone:"danger",label:"Materiales",hint:materialDetalle},
          {id:"documents" as const,icon:ImageIcon,tone:"muted",label:"Planos y fotos",hint:documents.length?`${documents.length} archivo${documents.length===1?"":"s"}`:"Sin archivos"},
          {id:"cobros" as const,icon:Receipt,tone:"info",label:"Cobros",hint:approved?(facturasVencidas?`${facturasVencidas} ${facturasVencidas===1?"factura vencida":"facturas vencidas"}`:`Cobrado · ${money(facturado)} facturado, sin IVA`):"Cuando el cliente acepte",valor:approved||facturas.length?money(cobrado):""}
        ].map(a=>{const Icon=a.icon;return <button key={a.id} type="button" className="ficha-list-row" onClick={()=>selectSection(a.id)}>
          <span className="ficha-list-icon" data-tone={a.tone}><Icon size={17} strokeWidth={1.8} aria-hidden="true"/></span>
          <span className="ficha-list-text"><strong>{a.label}{a.actual && <span className="pulse-dot" aria-hidden="true"/>}</strong><small>{a.hint}</small></span>
          {a.valor && <span className="pl-mono ficha-list-value">{a.valor}</span>}
          <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" className="muted"/>
        </button>;})}
        {veClientes && <Link href={`/clientes/${encodeURIComponent(claveCliente(project.client_name))}`} className="ficha-list-row">
          <span className="ficha-list-icon" data-tone="info"><Users size={17} strokeWidth={1.8} aria-hidden="true"/></span>
          <span className="ficha-list-text"><strong>Cliente</strong><small>{project.client_name}</small></span>
          <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" className="muted"/>
        </Link>}
      </nav>
      <div className="ficha-cards">
        <button type="button" className="pl-card ficha-card" onClick={()=>selectSection("budget")} aria-label={current?`Presupuesto: ${money(totals((approved??current).items).total)} con IVA. Ver presupuesto y versiones`:"Presupuesto: todavía no hay. Ver opciones para presupuestar"}>
          <span>Presupuesto</span>
          {current ? <>
            <strong className="pl-mono">{money(totals((approved??current).items).total)}</strong>
            <span className="ficha-card-chips">
              {approved && <span className="mini-chip" data-tone="success">Aceptado V{approved.number}</span>}
              {history?.versions.filter(v=>v.status==="issued" && v.id===working?.id).map(v=><span key={v.id} className="mini-chip" data-tone="info">Enviado V{v.number}</span>)}
              {editable && <span className="mini-chip" data-tone="warning">Borrador V{editable.number}</span>}
            </span>
          </> : <><strong className="ficha-card-text">Todavía no hay</strong><small>Ver opciones para presupuestar</small></>}
        </button>
        {enObra
          ? <button type="button" className="pl-card ficha-card" onClick={()=>selectSection("work")} aria-label={`Obra: ${progress} %, ${doneTasks.length} de ${tasks.length} tareas hechas. Ver tareas y avance`}>
              <span>Obra</span>
              <strong className="pl-mono">{progress} %</strong>
              <Meter value={progress} label={`Avance de ${project.name}`} tone={meterTone}/>
              <small>{doneTasks.length} de {tasks.length} tareas{pendingTasks[0]?` · siguiente ${pendingTasks[0].due_date===hoy?"hoy":dateLabel(pendingTasks[0].due_date)}`:""}</small>
            </button>
          : <section className="pl-card ficha-card ficha-check" aria-labelledby="para-presupuestar">
              <span id="para-presupuestar">Para poder presupuestar · {requisitos.filter(r=>r.done).length} de {requisitos.length}</span>
              <ul className="overview-checklist">{requisitos.map(r=><li key={r.id} data-done={r.done}><span className="overview-check" aria-hidden="true">{r.done && <Check size={12} strokeWidth={2.6}/>}</span><span><span>{r.label}</span><small className="muted">{r.hint}</small></span></li>)}</ul>
            </section>}
        <button type="button" className="pl-card ficha-card" onClick={()=>selectSection("purchases")} aria-label={`Materiales: ${materialTitulo}. Ver materiales`}>
          <span>Materiales</span>
          <strong className="ficha-card-text" data-tone={esperando.length?"info":undefined}>{materialTitulo}</strong>
          <small>{materialDetalle}</small>
        </button>
        <button type="button" className="pl-card ficha-card" onClick={()=>selectSection("cobros")} aria-label={`Cobros: ${money(cobrado)} cobrados. Ver cobros y facturas`}>
          <span>Cobros</span>
          <strong className={approved||facturas.length?"pl-mono":"ficha-card-text"}>{approved||facturas.length?money(cobrado):"Sin cobros"}</strong>
          <small>{facturasVencidas>0?<span className="danger">{facturasVencidas} {facturasVencidas===1?"factura vencida":"facturas vencidas"}</span>:approved?<>de <span className="pl-mono">{money(baseAceptada)}</span> aceptados · <span className="pl-mono">{money(facturado)}</span> facturados, sin IVA</>:"Cuando el cliente acepte el presupuesto"}</small>
        </button>
      </div>
      <div className="ficha-two">
        {tocaHoy
          ? <section className="pl-card today-task" data-late={tocaHoy.due_date<hoy||undefined} aria-label="Lo de hoy">
              <div className="today-task-head"><strong>{tocaHoy.due_date<hoy?`Atrasada desde el ${dateLabel(tocaHoy.due_date)}`:"Hoy · te toca a ti"}</strong><span>cuenta un {tocaHoy.weight} %</span></div>
              <button type="button" className="today-task-title" onClick={()=>setAbierta(tocaHoy)} aria-haspopup="dialog">{tocaHoy.title}</button>
              <div className="today-task-actions">
                {canToggle && <Button disabled={busy} onClick={()=>toggleTask(tocaHoy)}><Check size={15} strokeWidth={2} aria-hidden="true"/>Hecha</Button>}
                {can(actor.role,"task.update") && <Button disabled={busy} onClick={()=>moverAManana(tocaHoy)}>Mañana</Button>}
              </div>
            </section>
          : <section className="pl-card today-task" data-calm aria-label="Tareas"><div className="today-task-head"><strong>Tareas</strong></div><p className="muted text-sm" style={{margin:0}}>{pendingTasks.length?`La siguiente es «${pendingTasks[0].title}», el ${dateLabel(pendingTasks[0].due_date)}.`:"No hay tareas pendientes."}</p>{can(actor.role,"task.create") && <div className="today-task-actions"><Button onClick={()=>setSolicitud("tarea")}><Plus size={15} strokeWidth={1.8} aria-hidden="true"/>Nueva tarea</Button></div>}</section>}
        <section className="pl-card moves" aria-label="Últimos movimientos">
          <strong>Últimos movimientos</strong>
          {activities.length===0 && <p className="muted text-sm">Aún no hay movimientos.</p>}
          {activities.slice(0,4).map(a=><p key={a.id}><span>{dateLabel(a.created_at)}</span> · {a.actor_name} · {textoMovimiento(a.text)}</p>)}
        </section>
      </div>
    </section>}

    {section==="budget" && <section className="project-budget-section ficha-enter" aria-label="Presupuesto del proyecto">
      {budgets.length>1 && <label className="field"><span>Presupuesto del proyecto</span><select className="workspace-select" value={budget?.id} onChange={e=>navigate({p:e.target.value,v:null,desde:null,hasta:null,editar:null})}>{budgets.map(b=><option value={b.id} key={b.id}>{b.title}</option>)}</select></label>}
      {!budget && <div className="empty"><strong>Abre el primer presupuesto</strong><span className="muted">Elige cómo aportar los trabajos: catálogo, planos o fotos de la visita.</span>{canBudget && <Button variant="primary" disabled={busy || creatingBudget} onClick={crearPresupuesto}><Plus size={17} aria-hidden="true"/>{creatingBudget?"Abriendo…":"Nuevo presupuesto"}</Button>}</div>}
      {!budget && canBudget && <AddToBudget planoHref={planoHref} visitaHref={fotosHref} haPresupuesto={false} borradorPlano={borradorPlano} onManual={aMano}/>}
      {budget && <BudgetWorkspace key={budget.id} project={project} budget={budget} versions={data.versions} onNavigate={patch=>navigate({s:"budget",...patch})} onEdit={editBudget} canEdit={canBudget} planoHref={planoHref} fotosHref={fotosHref}/>}
    </section>}

    {section==="work" && <div className="ficha-enter"><WorkPanel projectId={project.id} tasks={tasks} progress={progress} meterTone={meterTone==="warning"?"warning":"success"} approved={approved} onNueva={()=>setSolicitud("tarea")} onAbrir={setAbierta} onToggle={toggleTask} pendiente={pendingTask}/></div>}
    {section==="purchases" && <div className="ficha-enter"><PurchasesPanel projectId={project.id} purchases={purchases} approvedLabel={approved?`V${approved.number}`:undefined}/></div>}
    {section==="documents" && <div className="ficha-enter"><DocumentsPanel project={project} documents={documents}/></div>}
    {section==="cobros" && <div className="ficha-enter"><CobrosPanel projectId={project.id} cobros={cobros} facturas={facturas} approved={approved} progress={progress}/></div>}
    <button type="button" className="ficha-fab" onClick={()=>navigate({chat:"1"})} aria-label={sinLeerChat?`Chat, ${sinLeerChat} sin leer`:"Chat"} aria-haspopup="dialog"><MessageSquare size={18} strokeWidth={1.8} aria-hidden="true"/>Chat{sinLeerChat>0 && <span className="avatar-count">{sinLeerChat}</span>}</button>
    <TaskDialog task={abierta?data.tasks.find(t=>t.id===abierta.id) ?? null:null} onClose={()=>setAbierta(null)}/>
    {editable && <BudgetEditor open={editando} onClose={()=>navigate({editar:null})} project={project} version={editable} guiaInicial={editable.items.length===0}/>}
    {versionEnviar && <SendDialog open={accion==="enviar"} onClose={()=>navigate({accion:null})} project={project} version={versionEnviar} approved={approved} previousSent={anteriorEnviada}/>}
    {enviada && <ResponseDialog open={accion==="respuesta"} onClose={()=>navigate({accion:null})} project={project} version={enviada} approved={approved} onNuevaVersion={v=>navigate({s:"budget",v,vista:"items",accion:null})}/>}
    <Drawer floating open={chatAbierto} onClose={()=>navigate({chat:null})} title={`Chat · ${project.name}`}><ChatPanel projectId={project.id} messages={mensajes} title={project.name} subtitle={project.location || project.code} onClose={()=>navigate({chat:null})}/></Drawer>
  </div>;
}
