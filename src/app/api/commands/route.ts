import { can,commandSchema } from "@/lib/domain";
import { z } from "zod";
import { authenticated,loadWorkspace } from "@/lib/server/workspace";
import { ApiError,endpoint,body,json,databaseError } from "@/lib/server/http";
export async function POST(request:Request) { return endpoint(async()=>{
  const command=await body(request,commandSchema), context=await authenticated();
  if(!can(context.actor.role,command.type)) throw new ApiError(403,"Tu perfil no tiene permiso para esta acción.");
  const requestId=z.uuid().parse(request.headers.get("idempotency-key") || crypto.randomUUID());
  const {error}=await context.supabase.rpc("execute_command",{p_organization_id:context.organizationId,p_command:command,p_request_id:requestId});
  if(error) databaseError(error);
  return json({ workspace:await loadWorkspace(context) });
}); }
