import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireConfiguration } from "@/lib/server/workspace";
import { ApiError,endpoint,body,json,databaseError } from "@/lib/server/http";
const schema=z.object({email:z.email().max(254),password:z.string().min(1).max(1024)});
export async function POST(request:Request) { return endpoint(async()=>{
  const input=await body(request,schema);requireConfiguration();const supabase=await createClient();
  const {data,error}=await supabase.auth.signInWithPassword(input);
  if(error || !data.user) throw new ApiError(401,"No se ha podido iniciar sesión. Revisa el correo y la contraseña.");
  const {data:member,error:memberError}=await supabase.from("organization_members").select("organization_id").eq("user_id",data.user.id).limit(1);
  if(memberError || !member?.length) { await supabase.auth.signOut({scope:"local"}); if(memberError) databaseError(memberError); throw new ApiError(403,"Tu cuenta no tiene acceso a PLANO. Contacta con administración."); }
  return json({ok:true,redirect:"/obras"});
}); }
