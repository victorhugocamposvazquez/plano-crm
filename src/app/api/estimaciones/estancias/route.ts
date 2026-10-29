import { can } from "@/lib/domain";
import { roomSurveySchema, createRoomProposal } from "@/lib/captura/room-survey";
import { authenticated, loadWorkspace } from "@/lib/server/workspace";
import { ApiError, body, endpoint, json } from "@/lib/server/http";

/** Contrato para captura por estancia. Reutiliza los precios autorizados; ninguna escritura ni análisis externo. */
export async function POST(request:Request) {
  return endpoint(async()=>{
    const input=await body(request,roomSurveySchema),context=await authenticated();
    if(!can(context.actor.role,"budget.save"))throw new ApiError(403,"Tu perfil no puede preparar presupuestos.");
    const workspace=await loadWorkspace(context);
    if(!workspace.projects.some(p=>p.id===input.project_id && p.organization_id===context.organizationId))throw new ApiError(404,"Proyecto no encontrado.");
    for(const source of input.sources) {
      if(!source.document_id) {
        if(["photo","panorama","video","pdf","cad","lidar","laser_scan"].includes(source.kind))throw new ApiError(400,"Adjunta el original de cada fuente visual o geométrica al proyecto.");
        continue;
      }
      const doc=workspace.documents.find(d=>d.id===source.document_id && d.project_id===input.project_id && d.organization_id===context.organizationId);
      if(!doc)throw new ApiError(404,"Una fuente no pertenece a este proyecto.");
      if((["photo","panorama"].includes(source.kind) && !["image/jpeg","image/png","image/webp"].includes(doc.mime_type)) || (source.kind==="pdf" && doc.mime_type!=="application/pdf") || (source.kind==="video" && doc.mime_type!=="video/mp4"))
        throw new ApiError(400,"El tipo de la fuente no coincide con su documento.");
    }
    return json({proposal:createRoomProposal(input,{organization_id:context.organizationId,articles:workspace.articles})});
  });
}
