"use client";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { applyPlanDraft, planDraftSchema, planSignature, type PlanDraft } from "@/lib/captura/plan-draft";
import { borradorNuevo, cargarBorrador, type Borrador } from "@/lib/plano-flujo";

type Cache={draft:Borrador;base_revision:number;saved_signature:string|null};
const workspaceKey="plano.workspace.v1";
const currentStep=(draft:Borrador):Borrador=>({...draft,paso:draft.paso===3?2:draft.paso===5?4:draft.paso});
/** Una copia local no puede adoptar una revisión remota que no ha leído: evita sobrescrituras al reabrir. */
export function usePlanDraft(projectId:string,budgetId:string|null){
  const {data,mode,actor}=useWorkspace();
  const cacheKey=`plano.plan-capture.${data.organization_id}.${actor.id}.${projectId}`;
  const [initial]=useState(()=>{
    try{
      const raw=localStorage.getItem(cacheKey);
      if(raw){const cache=JSON.parse(raw) as Cache;const draft=planDraftSchema.parse(cache.draft);if(draft.projectId!==projectId || !Number.isInteger(cache.base_revision) || cache.base_revision<0 || !(cache.saved_signature===null || typeof cache.saved_signature==="string"))throw new Error();return {cache:{...cache,draft:currentStep(draft)},error:""};}
      const legacy=cargarBorrador(projectId),parsed=planDraftSchema.safeParse(legacy);
      return {cache:parsed.success?{draft:currentStep(parsed.data),base_revision:0,saved_signature:null}:null,error:legacy && !parsed.success?"La copia anterior necesita revisión de soporte; se conserva en este navegador.":""};
    }catch{return {cache:null,error:"No se ha podido abrir la copia local. Se conserva; carga la guardada en el proyecto para continuar."};}
  });
  const [draft,setDraft]=useState<Borrador>(()=>initial.cache?.draft ?? borradorNuevo(projectId,budgetId));
  const [saved,setSaved]=useState<PlanDraft|null>(null),[base,setBase]=useState(initial.cache?.base_revision ?? 0),[savedSignature,setSavedSignature]=useState<string|null>(initial.cache?.saved_signature ?? null);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[available,setAvailable]=useState(false),[conflict,setConflict]=useState(false),[error,setError]=useState(initial.error),[localError,setLocalError]=useState(initial.error),[ready,setReady]=useState(false);
  const signature=useMemo(()=>planSignature(draft),[draft]);
  const dirty=signature!==savedSignature;
  async function read():Promise<{available:boolean;capture:PlanDraft|null}>{
    if(mode==="demo"){const workspace=JSON.parse(localStorage.getItem(workspaceKey)!);return {available:true,capture:workspace.plan_captures?.find((c:PlanDraft)=>c.project_id===projectId) ?? null};}
    const response=await fetch(`/api/proyectos/${projectId}/planos/borrador`,{cache:"no-store"});const body=await response.json();
    if(!response.ok)throw new Error(body.error || "No se ha podido cargar la preparación.");return body;
  }
  useEffect(()=>{
    let cancelled=false;
    void read().then(result=>{
      if(cancelled)return;setAvailable(result.available);setSaved(result.capture);
      if(initial.cache){
        const remoteSignature=result.capture?planSignature(currentStep(result.capture.draft)):null;
        const localSignature=planSignature(initial.cache.draft);
        if(result.capture && localSignature===initial.cache.saved_signature){setDraft(currentStep(result.capture.draft));setBase(result.capture.revision);setSavedSignature(remoteSignature);}
        else if(result.capture && remoteSignature===localSignature){setBase(result.capture.revision);setSavedSignature(remoteSignature);}
        else setConflict(result.available && (result.capture?.revision ?? 0)!==initial.cache.base_revision);
      }else if(result.capture && !initial.error){setDraft(currentStep(result.capture.draft));setBase(result.capture.revision);setSavedSignature(planSignature(currentStep(result.capture.draft)));}
    }).catch(e=>{if(!cancelled){setError((e as Error).message);setAvailable(false);}}).finally(()=>{if(!cancelled){setLoading(false);setReady(true);}});
    return()=>{cancelled=true;};
  // El componente se remonta al cambiar el proyecto.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[projectId,mode]);
  useEffect(()=>{
    if(!ready || initial.error && localError===initial.error)return;
    try{localStorage.setItem(cacheKey,JSON.stringify({draft,base_revision:base,saved_signature:savedSignature} satisfies Cache));setLocalError("");}
    catch{setLocalError("No cabe la copia local o el navegador ha bloqueado su almacenamiento. Guarda en el proyecto antes de salir.");}
  },[draft,base,savedSignature,cacheKey,ready,initial.error,localError]);
  useEffect(()=>{const before=(event:BeforeUnloadEvent)=>{if(dirty && localError){event.preventDefault();event.returnValue="";}};window.addEventListener("beforeunload",before);return()=>window.removeEventListener("beforeunload",before);},[dirty,localError]);
  async function load(){
    setLoading(true);setError("");
    try{const result=await read();setAvailable(result.available);if(!result.available)throw new Error("El guardado de planos aún no está activado en este entorno.");
      const next=result.capture?currentStep(result.capture.draft):borradorNuevo(projectId,budgetId);
      setSaved(result.capture);setDraft(next);setBase(result.capture?.revision ?? 0);setSavedSignature(result.capture?planSignature(next):null);setConflict(false);setLocalError("");
    }catch(e){setError((e as Error).message);}finally{setLoading(false);}
  }
  async function save(){
    if(saving || loading || !available || conflict)return false;
    setSaving(true);setError("");
    try{
      const input={expected_revision:base,draft};let capture:PlanDraft;
      if(mode==="demo"){
        const workspace=JSON.parse(localStorage.getItem(workspaceKey)!);const next=applyPlanDraft(workspace,input,actor);capture=next.plan_captures!.find(c=>c.project_id===projectId)!;
        localStorage.setItem(workspaceKey,JSON.stringify(next));
      }else{
        const response=await fetch(`/api/proyectos/${projectId}/planos/borrador`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});const body=await response.json();
        if(!response.ok){if(response.status===409)setConflict(true);throw new Error(body.error || "No se ha podido guardar.");}capture=body.capture;
      }
      setSaved(capture);setBase(capture.revision);setSavedSignature(planSignature(capture.draft));return true;
    }catch(e){const message=(e as Error).message;if(message.includes("Otra persona ha actualizado"))setConflict(true);setError(message);return false;}finally{setSaving(false);}
  }
  return {draft,setDraft,saved,dirty,loading,saving,available,conflict,error,localError,save,load};
}
