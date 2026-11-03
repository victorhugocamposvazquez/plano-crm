import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Command } from "@/lib/domain";
import type { AuthContext } from "./workspace";
import { ApiError,databaseError } from "./http";
const manual="El envío de invitaciones no está activado. Administración debe dar de alta la cuenta en Supabase Auth y añadirla al equipo siguiendo docs/equipo.md.";
/** La clave privilegiada se usa solo para Auth; los datos de empresa pasan por el RPC autenticado. */
export async function inviteMember(context:AuthContext,command:Extract<Command,{type:"member.invite"}>,requestId:string){
  if(context.actor.role!=="admin")throw new ApiError(403,"Solo administración puede invitar al equipo.");
  const secret=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(process.env.PLANO_MEMBER_INVITES_ENABLED!=="true" || !secret || !process.env.NEXT_PUBLIC_SUPABASE_URL)throw new ApiError(503,manual);
  const args={p_organization_id:context.organizationId,p_request_id:requestId};
  const {error:prepared}=await context.supabase.rpc("execute_command",{...args,p_command:command});if(prepared)databaseError(prepared);
  const {data:claim,error:claimError}=await context.supabase.rpc("claim_member_invitation",args);
  if(claimError){if(claimError.code==="40001")throw new ApiError(409,"El envío ya se ha iniciado. Administración debe comprobar Auth antes de volver a enviar; no se ha duplicado el correo.");if(claimError.code==="22023")throw new ApiError(409,"La cuenta ya existe. Administración debe revisar el alta a mano; no se han cambiado sus permisos.");databaseError(claimError);}
  if(claim.status==="sent")return;
  let userId=claim.user_id;
  if(claim.send){
    const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,secret,{auth:{autoRefreshToken:false,persistSession:false}});
    try {
      const {data,error}=await admin.auth.admin.inviteUserByEmail(command.email);
      if(error || !data.user)throw new Error("Envío sin confirmar");
      userId=data.user.id;
    } catch {
      throw new ApiError(503,"No se ha confirmado la invitación. Administración debe revisar el envío en Auth. La solicitud se conserva y no se reenviará automáticamente.");
    }
  }
  if(!userId)throw new ApiError(409,"La invitación necesita revisión de administración.");
  const {error}=await context.supabase.rpc("complete_member_invitation",{...args,p_user_id:userId});
  if(error)throw new ApiError(409,"Auth ha iniciado la invitación, pero falta confirmar el alta del equipo. Reintenta la misma solicitud o consulta a administración; no se reenviará el correo.");
}
