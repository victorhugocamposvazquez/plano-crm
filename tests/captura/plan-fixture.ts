import { createDemo,demoId } from "@/lib/demo";
import { borradorNuevo,añadirPlano,confirmarEscalaCompartida } from "@/lib/plano-flujo";
import { samplePlan } from "@/lib/captura/sample-plan";
export function planFixture(){
  const workspace=createDemo(),project=workspace.projects[0],docId=demoId(900);
  workspace.documents.push({id:docId,organization_id:workspace.organization_id,project_id:project.id,name:"Plano sintético.pdf",category:"plan",mime_type:"application/pdf",size_bytes:100,storage_path:"prueba" ,created_at:"2026-11-02T10:00:00Z"});
  let draft=añadirPlano(borradorNuevo(project.id,null),{nombre:"Demolicion.pdf",documentId:docId,extraction:samplePlan});
  draft=añadirPlano(draft,{nombre:"Cotas.pdf",documentId:docId,extraction:{...samplePlan,sha256:"b".repeat(64)}});
  draft.medida={start:[20,20],end:[480,20],metros:"9,2",planoId:draft.planos[1].id};
  draft=confirmarEscalaCompartida(draft,draft.planos[0].id);draft.paso=4;
  return {workspace,draft};
}
