import type { Article, Document } from "../domain";
import { unitSchema } from "./schema";
import type { RoomSurvey } from "./room-survey";
export type Room=RoomSurvey["rooms"][number];
export function newRoom(label="Zona 1"):Room{return {id:crypto.randomUUID(),label,scope:"",source_ids:[],observations:[],measurements:[],selections:[],questions:[]};}
export function newRoomSurvey(projectId:string):RoomSurvey{return {schema_version:1,project_id:projectId,scope:"Estimación de reforma por estancias",sources:[],calibrations:[],rooms:[newRoom()]};}
export function attachRoomDocument(survey:RoomSurvey,roomId:string,doc:Document,kind:"photo"|"panorama"){
  const room=survey.rooms.find(r=>r.id===roomId);if(!room)throw new Error("Zona no encontrada.");
  let source=survey.sources.find(s=>s.document_id===doc.id && s.kind===kind);
  if(!source){source={id:crypto.randomUUID(),kind,label:doc.name,document_id:doc.id,phase:"existing",legend:""};survey.sources.push(source);}
  if(!room.source_ids.includes(source.id))room.source_ids.push(source.id);
}
export function addRoomWork(survey:RoomSurvey,roomId:string,article:Article){
  const room=survey.rooms.find(r=>r.id===roomId)!;
  room.selections.push({kind:"work",intent:{id:crypto.randomUUID(),label:article.name,article_id:article.id,formula:{kind:"sum",measurement_ids:[crypto.randomUUID()]},inclusion:"included",adjustment_percent:0,adjustment_reason:""}});
}
export function setRoomQuantity(survey:RoomSurvey,roomId:string,selectionId:string,value:number|null,method:"manual"|"laser"|"visual_estimate",articleUnit:Article["unit"]){
  const room=survey.rooms.find(r=>r.id===roomId)!,selection=room.selections.find(s=>s.kind==="work" && s.intent.id===selectionId);
  if(!selection || selection.kind!=="work" || selection.intent.formula.kind!=="sum")throw new Error("Esta medición se edita desde su plano de origen.");
  const measurementId=selection.intent.formula.measurement_ids[0],old=room.measurements.find(m=>m.id===measurementId);
  room.measurements=room.measurements.filter(m=>m.id!==measurementId);
  if(value===null)return;
  const sourceKind=method==="laser"?"laser_measure":"manual";
  let source=survey.sources.find(s=>s.kind===sourceKind && !s.document_id);
  if(!source){source={id:crypto.randomUUID(),kind:sourceKind,label:method==="laser"?"Medidas anotadas con láser":"Cantidades anotadas en la visita",phase:"existing",legend:""};survey.sources.push(source);}
  if(!room.source_ids.includes(source.id))room.source_ids.push(source.id);
  // Al cambiar el artículo se conserva la unidad medida; una incompatibilidad queda bloqueada.
  room.measurements.push({id:measurementId,source_id:source.id,kind:"quantity",label:selection.intent.label,value,unit:old?.kind==="quantity"?old.unit:unitSchema.parse(articleUnit),method,reference:method==="visual_estimate"?"Aproximación visual indicada por el usuario":"Cantidad anotada por el usuario; instrumento no verificado"});
}
