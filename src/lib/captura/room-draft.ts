import { z } from "zod";
import { can, applyCommand, itemSchema, type Actor, type Article, type BudgetItem, type Document, type Workspace } from "../domain";
import { roomSurveySchema, createRoomProposal, type RoomSurvey } from "./room-survey";
export type RoomDraft = { project_id:string; revision:number; survey:RoomSurvey; updated_at:string; updated_by_name:string };
export type RoomImport = { id:string; project_id:string; version_id:string; capture_revision:number; survey:RoomSurvey; items:BudgetItem[]; created_at:string; created_by_name:string };
export const roomCaptureRequest=z.discriminatedUnion("action",[
  z.object({action:z.literal("save"),expected_revision:z.number().int().min(0),survey:roomSurveySchema}).strict(),
  z.object({action:z.literal("apply"),capture_revision:z.number().int().positive(),version_id:z.uuid(),expected_revision:z.number().int().min(0),reviewed:z.literal(true),expected_items:z.array(itemSchema).min(1).max(500)}).strict()
]);
export type RoomCaptureRequest=z.infer<typeof roomCaptureRequest>;

export function checkRoomDocuments(survey:RoomSurvey,documents:Document[],organizationId:string) {
  for(const source of survey.sources){
    if(!source.document_id){if(["photo","panorama","video","pdf","cad","lidar","laser_scan"].includes(source.kind))throw new Error("Adjunta el original de cada fuente visual o geométrica al proyecto.");continue;}
    const doc=documents.find(d=>d.id===source.document_id && d.project_id===survey.project_id && d.organization_id===organizationId);
    if(!doc)throw new Error("Una fuente no pertenece a este proyecto.");
    if((["photo","panorama"].includes(source.kind) && !["image/jpeg","image/png","image/webp"].includes(doc.mime_type)) || (source.kind==="pdf" && doc.mime_type!=="application/pdf") || (source.kind==="video" && doc.mime_type!=="video/mp4"))throw new Error("El tipo de la fuente no coincide con su documento.");
  }
}
export function preparedRoomItems(survey:RoomSurvey,organizationId:string,articles:Article[]){
  if(survey.rooms.some(r=>r.measurements.some(m=>m.kind!=="quantity") || r.selections.some(s=>s.kind==="work" && s.intent.formula.kind!=="sum")))throw new Error("Incorpora la geometría desde el flujo de planos; esta captura utiliza cantidades anotadas por zona.");
  const proposal=createRoomProposal(survey,{organization_id:organizationId,articles});
  if(!proposal.complete)throw new Error("Resuelve las cantidades, artículos y preguntas pendientes antes de incorporar las partidas.");
  return proposal.lines.map(line=>line.item!);
}
/** Solo sustituye partidas que todavía coinciden con la última incorporación de la captura. */
export function mergeCapturedItems(existing:BudgetItem[],incoming:BudgetItem[],previous:RoomImport[]){
  for(const item of incoming){const current=existing.find(i=>i.id===item.id);if(!current)continue;
    const last=previous.flatMap(p=>p.items.filter(i=>i.id===item.id)).at(0);
    if(!last || JSON.stringify(itemSchema.parse(current))!==JSON.stringify(itemSchema.parse(last)))throw new Error("Una partida ya se ha editado o no tiene procedencia comprobable. Conserva esa edición y revisa el conflicto antes de continuar.");
  }
  const ids=new Set(incoming.map(i=>i.id));return [...existing.filter(i=>!ids.has(i.id)),...incoming];
}
/** Demostración: captura, presupuesto y procedencia se guardan juntos en un único Workspace. */
export function applyRoomCapture(previous:Workspace,raw:unknown,actor:Actor,projectId:string,now=new Date().toISOString()):Workspace {
  const request=roomCaptureRequest.parse(raw);
  if(!can(actor.role,"budget.save"))throw new Error("Tu perfil no puede preparar presupuestos.");
  if(!previous.projects.some(p=>p.id===projectId))throw new Error("Proyecto no encontrado.");
  const state=structuredClone(previous),draft=state.room_captures?.find(c=>c.project_id===projectId);
  if(request.action==="save"){
    if(request.survey.project_id!==projectId)throw new Error("La captura pertenece a otro proyecto.");
    if(draft?.revision===request.expected_revision+1 && JSON.stringify(draft.survey)===JSON.stringify(request.survey))return state;
    if((draft?.revision ?? 0)!==request.expected_revision)throw new Error("Otra persona ha actualizado la captura. Tu edición se conserva; revisa la guardada antes de continuar.");
    checkRoomDocuments(request.survey,state.documents,state.organization_id);
    const next={project_id:projectId,revision:request.expected_revision+1,survey:request.survey,updated_at:now,updated_by_name:actor.name};
    state.room_captures=[...(state.room_captures ?? []).filter(c=>c.project_id!==projectId),next];return state;
  }
  if(!draft || draft.revision!==request.capture_revision)throw new Error("La captura ha cambiado. Recarga antes de incorporar partidas.");
  const version=state.versions.find(v=>v.id===request.version_id && state.budgets.some(b=>b.id===v.budget_id && b.project_id===projectId));
  if(!version || version.status!=="draft")throw new Error("Elige un borrador abierto de este proyecto.");
  if(state.room_imports?.some(i=>i.version_id===version.id && i.capture_revision===draft.revision))return state;
  checkRoomDocuments(draft.survey,state.documents,state.organization_id);
  const items=preparedRoomItems(draft.survey,state.organization_id,state.articles);
  if(JSON.stringify(items)!==JSON.stringify(request.expected_items))throw new Error("La captura o los precios han cambiado. Revisa el cálculo actualizado.");
  const history=(state.room_imports ?? []).filter(i=>state.versions.some(v=>v.id===i.version_id && v.budget_id===version.budget_id && v.number<=version.number)).sort((a,b)=>{
    const av=state.versions.find(v=>v.id===a.version_id)!,bv=state.versions.find(v=>v.id===b.version_id)!;
    return bv.number-av.number || b.capture_revision-a.capture_revision;
  });
  const merged=mergeCapturedItems(version.items,items,history);
  const next=applyCommand(state,{type:"budget.save",version_id:version.id,expected_revision:request.expected_revision,items:merged,notes:version.notes},actor,now);
  next.room_imports=[...(next.room_imports ?? []),{id:crypto.randomUUID(),project_id:projectId,version_id:version.id,capture_revision:draft.revision,survey:draft.survey,items,created_at:now,created_by_name:actor.name}];return next;
}
