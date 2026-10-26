import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireConfiguration } from "@/lib/server/workspace";
import { ApiError,endpoint,body,json } from "@/lib/server/http";
export async function POST(request:Request) { return endpoint(async()=>{ await body(request,z.object({}));requireConfiguration();const {error}=await (await createClient()).auth.signOut({scope:"local"});if(error) throw new ApiError(503,"No se ha podido cerrar la sesión. Inténtalo de nuevo.");return json({ok:true,redirect:"/login"}); }); }
