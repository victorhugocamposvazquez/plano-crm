import { z } from "zod";
import { can } from "@/lib/domain";
import { checkPlanDocuments, planDraftSchema, planSaveRequest } from "@/lib/captura/plan-draft";
import { authenticated, loadWorkspace } from "@/lib/server/workspace";
import { ApiError, body, databaseError, endpoint, json } from "@/lib/server/http";
type Params={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Params){return endpoint(async()=>{
  const id=z.uuid().parse((await params).id),context=await authenticated();
  const {data:project,error:projectError}=await context.supabase.from("projects").select("id").eq("organization_id",context.organizationId).eq("id",id).maybeSingle();
  if(projectError)databaseError(projectError);if(!project)throw new ApiError(404,"Proyecto no encontrado.");
  const {data,error}=await context.supabase.from("plan_captures").select("*").eq("organization_id",context.organizationId).eq("project_id",id).maybeSingle();
  if(error){if(["42P01","PGRST205"].includes(error.code))return json({available:false,capture:null});databaseError(error);}
  if(data && (!planDraftSchema.safeParse(data.draft).success || data.draft.projectId!==id))throw new ApiError(409,"La preparación guardada necesita revisión de soporte. Su contenido se conserva.");
  return json({available:true,capture:data});
});}
export async function POST(request:Request,{params}:Params){return endpoint(async()=>{
  const input=await body(request,planSaveRequest),id=z.uuid().parse((await params).id),context=await authenticated();
  if(!can(context.actor.role,"budget.save"))throw new ApiError(403,"Tu perfil no puede preparar presupuestos.");
  if(input.draft.projectId!==id)throw new ApiError(400,"La preparación pertenece a otro proyecto.");
  const workspace=await loadWorkspace(context);
  if(!workspace.projects.some(p=>p.id===id))throw new ApiError(404,"Proyecto no encontrado.");
  if(input.draft.budgetId && !workspace.budgets.some(b=>b.id===input.draft.budgetId && b.project_id===id))throw new ApiError(400,"El presupuesto pertenece a otro proyecto.");
  try{checkPlanDocuments(input.draft,workspace.documents,context.organizationId);}catch(e){throw new ApiError(400,(e as Error).message);}
  if(new TextEncoder().encode(JSON.stringify(input.draft)).length>1500000)throw new ApiError(413,"La lectura es demasiado grande para guardarla en el proyecto. Tu copia local se conserva.");
  const {data,error}=await context.supabase.rpc("save_plan_capture",{p_organization_id:context.organizationId,p_project_id:id,p_expected_revision:input.expected_revision,p_draft:input.draft});
  if(error)databaseError(error);return json({capture:data});
});}
