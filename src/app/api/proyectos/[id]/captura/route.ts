import { z } from "zod";
import { can } from "@/lib/domain";
import { roomSurveySchema } from "@/lib/captura/room-survey";
import { checkRoomDocuments, preparedRoomItems, roomCaptureRequest } from "@/lib/captura/room-draft";
import { authenticated, loadWorkspace } from "@/lib/server/workspace";
import { ApiError, body, databaseError, endpoint, json } from "@/lib/server/http";
type Params={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Params){return endpoint(async()=>{
  const id=z.uuid().parse((await params).id),context=await authenticated();
  const {data:project,error:projectError}=await context.supabase.from("projects").select("id").eq("organization_id",context.organizationId).eq("id",id).maybeSingle();
  if(projectError)databaseError(projectError);if(!project)throw new ApiError(404,"Proyecto no encontrado.");
  const snapshotId=new URL(request.url).searchParams.get("incorporacion");
  if(snapshotId){
    const {data,error}=await context.supabase.from("room_capture_imports").select("*").eq("id",z.uuid().parse(snapshotId)).eq("organization_id",context.organizationId).eq("project_id",id).maybeSingle();
    if(error)databaseError(error);if(!data)throw new ApiError(404,"Incorporación no encontrada.");return json({snapshot:data});
  }
  const {data,error}=await context.supabase.from("room_captures").select("*").eq("organization_id",context.organizationId).eq("project_id",id).maybeSingle();
  if(error){if(["42P01","PGRST205"].includes(error.code))return json({available:false,capture:null,imports:[]});databaseError(error);}
  if(data && !roomSurveySchema.safeParse(data.survey).success)throw new ApiError(409,"La captura guardada necesita revisión de soporte. No se ha sustituido su contenido.");
  const {data:imports,error:historyError}=await context.supabase.from("room_capture_imports").select("id,project_id,version_id,capture_revision,created_at,created_by_name").eq("organization_id",context.organizationId).eq("project_id",id).order("created_at",{ascending:false}).order("id").limit(20);
  if(historyError)databaseError(historyError);
  return json({available:true,capture:data,imports:imports ?? []});
});}
export async function POST(request:Request,{params}:Params){return endpoint(async()=>{
  const input=await body(request,roomCaptureRequest),id=z.uuid().parse((await params).id),context=await authenticated();
  if(!can(context.actor.role,"budget.save"))throw new ApiError(403,"Tu perfil no puede preparar presupuestos.");
  const workspace=await loadWorkspace(context);
  if(!workspace.projects.some(p=>p.id===id))throw new ApiError(404,"Proyecto no encontrado.");
  if(input.action==="save"){
    if(input.survey.project_id!==id)throw new ApiError(400,"La captura pertenece a otro proyecto.");
    try{checkRoomDocuments(input.survey,workspace.documents,context.organizationId);}catch(e){throw new ApiError(400,(e as Error).message);}
    const {data,error}=await context.supabase.rpc("save_room_capture",{p_organization_id:context.organizationId,p_project_id:id,p_expected_revision:input.expected_revision,p_survey:input.survey});
    if(error)databaseError(error);return json({capture:data});
  }
  const {data:capture,error:readError}=await context.supabase.from("room_captures").select("*").eq("organization_id",context.organizationId).eq("project_id",id).maybeSingle();
  if(readError)databaseError(readError);
  if(!capture || capture.revision!==input.capture_revision)throw new ApiError(409,"La captura ha cambiado. Recarga antes de incorporar partidas.");
  const survey=roomSurveySchema.parse(capture.survey);
  let items;try{checkRoomDocuments(survey,workspace.documents,context.organizationId);items=preparedRoomItems(survey,context.organizationId,workspace.articles);}catch(e){throw new ApiError(400,(e as Error).message);}
  if(JSON.stringify(items)!==JSON.stringify(input.expected_items))throw new ApiError(409,"La captura o los precios han cambiado. Revisa el cálculo actualizado.");
  const {data,error}=await context.supabase.rpc("apply_room_capture",{p_organization_id:context.organizationId,p_project_id:id,p_capture_revision:input.capture_revision,p_version_id:input.version_id,p_expected_revision:input.expected_revision,p_items:items,p_reviewed:input.reviewed});
  if(error){
    if(error.code==="40001" && error.message?.startsWith("Una partida ya se ha editado"))throw new ApiError(409,"Una partida tiene una edición manual o su origen no se puede comprobar. No se ha sobrescrito; revisa el presupuesto antes de actualizarla.");
    if(error.code==="40001" && error.message?.startsWith("El catálogo ha cambiado"))throw new ApiError(409,"El catálogo ha cambiado. Recarga precios y revisa el cálculo antes de incorporar.");
    databaseError(error);
  }return json({snapshot:data,workspace:await loadWorkspace(context)});
});}
