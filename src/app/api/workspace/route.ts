import { authenticated,loadWorkspace } from "@/lib/server/workspace";
import { endpoint,json } from "@/lib/server/http";
export async function GET() { return endpoint(async()=>{ const context=await authenticated(); return json({ workspace:await loadWorkspace(context),actor:context.actor }); }); }
