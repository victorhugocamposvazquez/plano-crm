import { z } from "zod";
import { authenticated } from "@/lib/server/workspace";
import { ApiError,endpoint,json,databaseError } from "@/lib/server/http";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) { return endpoint(async()=>{
  const id=z.uuid().parse((await params).id),context=await authenticated();
  const {data:document,error}=await context.supabase.from("documents").select("storage_path,name").eq("id",id).eq("organization_id",context.organizationId).maybeSingle();
  if(error) databaseError(error); if(!document) throw new ApiError(404,"Documento no encontrado.");
  const {data,error:urlError}=await context.supabase.storage.from("project-files").createSignedUrl(document.storage_path,60,{download:document.name});
  if(urlError || !data) throw new ApiError(503,"No se ha podido preparar la descarga.");
  return json({url:data.signedUrl,expires_in:60});
}); }
