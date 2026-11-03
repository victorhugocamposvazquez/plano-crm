import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
/** La plantilla Invite envía TokenHash aquí; no se aceptan roles, empresas ni destinos de la URL. */
export async function GET(request:Request){
  const url=new URL(request.url),token=url.searchParams.get("token_hash"),type=url.searchParams.get("type");
  const redirect=(path:string)=>{const response=NextResponse.redirect(new URL(path,url.origin));response.headers.set("Cache-Control","private, no-store");response.headers.set("Referrer-Policy","no-referrer");return response;};
  if(type!=="invite" || !token || !/^[a-zA-Z0-9_-]{20,256}$/.test(token))return redirect("/login?invitacion=no-valida");
  try{
    const supabase=await createClient();const {error}=await supabase.auth.verifyOtp({token_hash:token,type:"invite"});
    if(error)return redirect("/login?invitacion=no-valida");
    return redirect("/");
  }catch{return redirect("/login?invitacion=no-valida");}
}
