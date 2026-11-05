import { can,commandSchema } from "@/lib/domain";
import { inviteMember } from "@/lib/server/member-invitation";
import { z } from "zod";
import { authenticated,loadWorkspace } from "@/lib/server/workspace";
import { ApiError,endpoint,body,json,databaseError } from "@/lib/server/http";
export async function POST(request:Request) { return endpoint(async()=>{
  const command=await body(request,commandSchema), context=await authenticated();
  if(!can(context.actor.role,command.type)) throw new ApiError(403,"Tu perfil no tiene permiso para esta acción.");
  if(command.type==="member.invite" && !request.headers.get("idempotency-key"))throw new ApiError(400,"La invitación necesita una clave de solicitud para evitar duplicados.");
  const requestId=z.uuid().parse(request.headers.get("idempotency-key") || crypto.randomUUID());
  if(command.type==="member.invite")await inviteMember(context,command,requestId);
  else { const {error}=await context.supabase.rpc("execute_command",{p_organization_id:context.organizationId,p_command:command,p_request_id:requestId});
  if(error) {
    const known=["La persona no pertenece a esta empresa.","La empresa debe conservar al menos una persona administradora.","No puedes quitarte a ti mismo del equipo.","Datos de equipo no válidos.","Persona no encontrada."];
    // Los avisos del almacén explican qué hacer («Solo hay 6 en almacén.»): se enseñan tal cual.
    const almacen=[/^Solo hay [\d.,]+ en almacén\.$/,/^El artículo se mide en [^:]{1,10}: el pedido también\.$/,/^Este artículo no se guarda en almacén\.$/,/^Indica una cantidad (válida|mayor que cero)\.$/,/^Artículo no encontrado\.$/,
      // Y los de la ficha de operarios.
      /^Ese operario no está en el equipo\.$/,/^Esa cuenta no pertenece a esta empresa\.$/,/^El teléfono solo admite números, espacios, «\+» y guiones\.$/,/^El correo no es válido\.$/,/^Escribe el nombre del operario\.$/,/^Operario no encontrado\.$/,/^Parte no encontrado\.$/,/^Datos del parte no válidos\.$/,/^Envío no encontrado\.$/,/^Datos del envío no válidos\.$/,/^Ese punto ya no está en la lista\.$/,/^La lista admite hasta 50 puntos\.$/,/^Cada punto de la lista lleva un texto de hasta 300 caracteres\.$/,/^La descripción es demasiado larga\.$/,/^Tarea no encontrada\.$/];
    if(known.includes(error.message ?? "") || almacen.some(r=>r.test(error.message ?? "")))throw new ApiError(error.code==="P0002"?404:400,error.message!);
    databaseError(error);
  } }
  const workspace=await loadWorkspace(context),me=workspace.members?.find(m=>m.user_id===context.actor.id);
  return json({ workspace, actor:me?{id:me.user_id,name:me.display_name,role:me.role,position:me.position}:context.actor });
}); }
