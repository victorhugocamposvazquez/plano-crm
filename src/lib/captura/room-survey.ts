import { z } from "zod";
import { lineTotal, totals, type Article } from "../domain";
import { createEstimateProposal, type ProposalLine } from "./estimate";
import { calibrationSchema, captureSourceSchema, intentSchema, measurementSchema } from "./schema";

const id=z.uuid(), label=z.string().trim().min(1).max(500);
const selectionSchema=z.discriminatedUnion("kind",[
  z.object({kind:z.literal("work"),intent:intentSchema}).strict(),
  z.object({kind:z.literal("context"),id,label,article_id:id.nullable(),purpose:z.enum(["existing","decoration"])}).strict()
]);
const questionSchema=z.object({id,question:label,required:z.boolean(),answer:z.string().trim().max(2000).default("")}).strict();
export const roomSurveySchema=z.object({
  schema_version:z.literal(1),project_id:id,scope:z.string().trim().min(1).max(5000),
  sources:z.array(captureSourceSchema).max(100),calibrations:z.array(calibrationSchema).max(100),
  rooms:z.array(z.object({
    id,label,scope:z.string().trim().max(5000),source_ids:z.array(id).max(100),
    observations:z.array(z.object({source_id:id,note:z.string().trim().min(1).max(2000)}).strict()).max(100),
    measurements:z.array(measurementSchema).max(500),selections:z.array(selectionSchema).max(500),
    questions:z.array(questionSchema).max(100)
  }).strict()).min(1).max(50)
}).strict().superRefine((input,ctx)=>{
  const unique=(values:string[],path:(string|number)[])=>{
    if(new Set(values).size!==values.length)ctx.addIssue({code:"custom",path,message:"Hay identificadores repetidos."});
  };
  unique(input.sources.map(s=>s.id),["sources"]);unique(input.calibrations.map(c=>c.id),["calibrations"]);unique(input.rooms.map(r=>r.id),["rooms"]);
  unique(input.rooms.flatMap(r=>r.measurements.map(m=>m.id)),["rooms"]);
  unique(input.rooms.flatMap(r=>r.selections.map(s=>s.kind==="work"?s.intent.id:s.id)),["rooms"]);
  if(input.rooms.reduce((n,r)=>n+r.measurements.length,0)>500 || input.rooms.reduce((n,r)=>n+r.selections.length,0)>500)
    ctx.addIssue({code:"custom",path:["rooms"],message:"La propuesta admite hasta 500 mediciones y 500 selecciones en total."});
  const sourceIds=new Set(input.sources.map(s=>s.id));
  input.rooms.forEach((room,index)=>{
    unique(room.source_ids,["rooms",index,"source_ids"]);unique(room.questions.map(q=>q.id),["rooms",index,"questions"]);
    const allowed=new Set(room.source_ids);
    if(room.source_ids.some(id=>!sourceIds.has(id)))ctx.addIssue({code:"custom",path:["rooms",index,"source_ids"],message:"Hay una fuente que no existe en la captura."});
    if(room.measurements.some(m=>!allowed.has(m.source_id)) || room.observations.some(o=>!allowed.has(o.source_id)))
      ctx.addIssue({code:"custom",path:["rooms",index],message:"Las observaciones y medidas deben proceder de fuentes de esta estancia."});
  });
});
export type RoomSurvey=z.infer<typeof roomSurveySchema>;
export type RoomProposalLine=ProposalLine & {room_id:string;room_label:string};

/** Fotos y 360 son evidencia visual; solo las mediciones y fórmulas determinan cantidades. No guarda ni aprueba. */
export function createRoomProposal(raw:unknown,context:{organization_id:string;articles:Article[]}) {
  const input=roomSurveySchema.parse(raw);
  const articles=new Map(context.articles.filter(a=>a.organization_id===context.organization_id).map(a=>[a.id,a]));
  const rooms=input.rooms.map(room=>{
    const work=room.selections.flatMap(s=>s.kind==="work"?[s.intent]:[]);
    // Resolver por estancia impide usar accidentalmente la medición de otra habitación.
    const proposal=work.length && room.source_ids.length?createEstimateProposal({schema_version:1,project_id:input.project_id,
      scope:room.scope || input.scope,sources:input.sources.filter(s=>room.source_ids.includes(s.id)),
      calibrations:input.calibrations.filter(c=>room.source_ids.includes(c.source_id)),measurements:room.measurements,intents:work},context):null;
    const resolved:ProposalLine[]=proposal?.lines ?? work.map(intent=>({id:intent.id,label:intent.label,status:"blocked",item:null,
      article_id:intent.article_id,measurements:[],warnings:[],issues:[{code:"missing_source",message:"Adjunta una fuente o añade una medida declarada para esta estancia."}]}));
    const lines:RoomProposalLine[]=resolved.map(line=>({...line,room_id:room.id,room_label:room.label}));
    const pendingQuestions=room.questions.filter(q=>q.required && !q.answer);
    const contextSelections=room.selections.flatMap(s=>s.kind==="context"?[{...s,article_available:s.article_id!==null && articles.has(s.article_id),priced:false as const}]:[]);
    return {id:room.id,label:room.label,scope:room.scope,source_ids:room.source_ids,observations:room.observations,
      measurement_inputs:room.measurements,selections:room.selections,questions:room.questions,pending_questions:pendingQuestions,lines,context:contextSelections,
      priced_subtotal:totals(lines.flatMap(l=>l.item?[l.item]:[])),
      pricing_complete:lines.every(l=>l.status==="calculated"),
      has_visual_quantities:lines.some(l=>l.measurements.some(m=>m.basis==="visual_estimate"))};
  });
  const lines=rooms.flatMap(r=>r.lines),items=lines.flatMap(l=>l.item?[l.item]:[]);
  z.number().max(Number.MAX_SAFE_INTEGER/1.3,"El subtotal supera el límite seguro de cálculo.").parse(items.reduce((n,i)=>n+lineTotal(i),0));
  const priced_subtotal=totals(items);
  return {schema_version:1 as const,project_id:input.project_id,scope:input.scope,status:"proposal" as const,
    sources:input.sources,calibrations:input.calibrations,rooms,lines,priced_subtotal,
    complete:lines.length>0 && rooms.every(r=>r.pricing_complete && r.pending_questions.length===0),
    pending_line_ids:lines.filter(l=>l.status==="blocked").map(l=>l.id),
    has_visual_quantities:rooms.some(r=>r.has_visual_quantities),review_required:true as const,persisted:false as const,
    limitations:["El subtotal solo cubre los trabajos con medición y artículo resueltos; no es el precio completo de la obra.",
      "Las fotos de teléfono y las panorámicas 360 no proporcionan escala métrica por sí solas.",
      "Las observaciones y respuestas son declaradas, no verificadas por este servicio.",
      "No se ejecuta análisis de imágenes ni reconstrucción 3D en esta previsualización."]};
}

/** Sustitución inmutable: conserva alcance, cantidades, procedencia e IDs. El motor comprueba la nueva unidad y precio. */
export function replaceRoomArticle(raw:unknown,roomId:string,selectionId:string,articleId:string|null):RoomSurvey {
  const input=roomSurveySchema.parse(raw),room=input.rooms.find(r=>r.id===roomId);
  const selection=room?.selections.find(s=>(s.kind==="work"?s.intent.id:s.id)===selectionId);
  if(!selection)throw new Error("La selección no pertenece a esa estancia.");
  const next=id.nullable().parse(articleId);
  if(selection.kind==="work")selection.intent.article_id=next;else selection.article_id=next;
  return input;
}
