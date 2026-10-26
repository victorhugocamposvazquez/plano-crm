import { z } from "zod";
import { can } from "@/lib/domain";
import { authenticated } from "@/lib/server/workspace";
import { ApiError,endpoint,body,json,databaseError } from "@/lib/server/http";
const schema=z.object({ project_id:z.uuid(),name:z.string().trim().min(1).max(500),category:z.enum(["plan","contract","technical","before","during","after","other"]),mime_type:z.enum(["application/pdf","image/jpeg","image/png","image/webp","video/mp4"]),size_bytes:z.number().int().positive().max(52428800) });
export async function POST(request:Request) { return endpoint(async()=>{
  const input=await body(request,schema), context=await authenticated();
  if(!can(context.actor.role,"document.add")) throw new ApiError(403,"Tu perfil no puede adjuntar archivos.");
  const {data:project,error}=await context.supabase.from("projects").select("id").eq("id",input.project_id).eq("organization_id",context.organizationId).maybeSingle();
  if(error) databaseError(error); if(!project) throw new ApiError(404,"Proyecto no encontrado.");
  const path=`${context.organizationId}/${input.project_id}/${crypto.randomUUID()}`;
  const {data,error:uploadError}=await context.supabase.storage.from("project-files").createSignedUploadUrl(path,{upsert:false});
  if(uploadError || !data) throw new ApiError(503,"No se ha podido preparar la subida del archivo.");
  return json({path,token:data.token});
}); }
