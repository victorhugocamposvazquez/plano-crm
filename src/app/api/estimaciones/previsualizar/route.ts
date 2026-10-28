import { can } from "@/lib/domain";
import { estimateInputSchema } from "@/lib/captura/schema";
import { createEstimateProposal } from "@/lib/captura/estimate";
import { authenticated, loadWorkspace } from "@/lib/server/workspace";
import { ApiError, body, endpoint, json } from "@/lib/server/http";

/** Previsualización sin persistencia. Los precios siempre proceden del catálogo autorizado. */
export async function POST(request: Request) {
  return endpoint(async()=>{
    const input=await body(request,estimateInputSchema), context=await authenticated();
    if(!can(context.actor.role,"budget.save")) throw new ApiError(403,"Tu perfil no puede preparar presupuestos.");
    const workspace=await loadWorkspace(context);
    if(!workspace.projects.some(p=>p.id===input.project_id && p.organization_id===context.organizationId))
      throw new ApiError(404,"Proyecto no encontrado.");
    for(const source of input.sources) {
      if(source.document_id && !workspace.documents.some(d=>d.id===source.document_id && d.project_id===input.project_id && d.organization_id===context.organizationId))
        throw new ApiError(404,"Una fuente no pertenece a este proyecto.");
    }
    return json({proposal:createEstimateProposal(input,{organization_id:context.organizationId,articles:workspace.articles})});
  });
}
