import { z } from "zod";
import { can, type Actor, type Document, type Workspace } from "../domain";
import { pointSchema } from "./schema";
import { pdfExtractionSchema } from "./pdf-extraction";
import type { Borrador } from "../plano-flujo";

const text=z.string().max(100), reference=z.string().min(1).max(240);
const measure=z.object({start:pointSchema.nullable(),end:pointSchema.nullable(),metros:text});
const ids=z.record(reference,z.uuid()).refine(value=>Object.keys(value).length<=10000);
const stats=z.object({paths:z.number().int().nonnegative(),curves:z.number().int().nonnegative(),compoundFills:z.number().int().nonnegative(),clipped:z.number().int().nonnegative(),unsupported:z.number().int().nonnegative(),images:z.number().int().nonnegative(),hidden:z.number().int().nonnegative()});
const work=z.object({activo:z.boolean(),articleId:z.uuid().nullable()});
export const planDraftSchema=z.object({
  version:z.literal(2),projectId:z.uuid(),budgetId:z.uuid().nullable(),paso:z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5)]),
  planos:z.array(z.object({id:z.uuid(),nombre:z.string().min(1).max(500),documentId:z.uuid().nullable(),extraction:pdfExtractionSchema,page:z.number().int().positive(),
    uso:z.enum(["demolicion","obra_nueva","cotas","areas","instalaciones","otro"]),medida:measure.nullable(),ignorados:z.array(text).max(1000),escalaConfirmada:z.string().max(2000).optional(),
    lectura:z.object({pages:z.number().int().positive(),partial:z.boolean(),stats,warnings:z.array(z.string().max(1000)).max(100)}).optional()
  })).max(20),
  medida:measure.extend({planoId:z.uuid().nullable()}),noParedes:z.array(reference).max(10000),altura:text,huecos:text,huecosDemolicion:text.optional(),
  trabajos:z.object({demoler:work,levantar:work,acabar:work}),
  ids:z.object({manual:z.uuid(),altura:z.uuid(),huecos:z.uuid(),sources:ids,calibrations:ids,paredes:ids,intents:ids,items:ids})
}).superRefine((draft,ctx)=>{
  if(new Set(draft.planos.map(p=>p.id)).size!==draft.planos.length)ctx.addIssue({code:"custom",message:"Hay planos repetidos."});
  if(draft.medida.planoId && !draft.planos.some(p=>p.id===draft.medida.planoId))ctx.addIssue({code:"custom",message:"Falta el plano de referencia."});
  for(const [i,plan] of draft.planos.entries())if(!plan.extraction.pages.some(p=>p.page===plan.page))ctx.addIssue({code:"custom",path:["planos",i,"page"],message:"La página elegida no existe."});
});
export const planSaveRequest=z.object({expected_revision:z.number().int().nonnegative().max(2147483646),draft:planDraftSchema});
export type PlanSaveRequest=z.infer<typeof planSaveRequest>;
export type PlanDraft={project_id:string;revision:number;draft:Borrador;updated_at:string;updated_by_name:string};
/** Compara contenido sin depender del orden de las propiedades de JSONB. */
export function planSignature(draft:Borrador):string{
  return JSON.stringify(draft,(_key,value)=>value && typeof value==="object" && !Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
}
export function checkPlanDocuments(draft:Borrador,documents:Document[],organizationId:string){
  for(const plan of draft.planos){
    if(!plan.documentId)throw new Error("Adjunta el PDF original al proyecto antes de guardar esta preparación. Los ejemplos y las lecturas técnicas se conservan solo en este navegador.");
    if(!documents.some(d=>d.id===plan.documentId && d.organization_id===organizationId && d.project_id===draft.projectId && d.mime_type==="application/pdf"))throw new Error("Un PDF no pertenece a este proyecto o no está disponible.");
  }
}
export function applyPlanDraft(workspace:Workspace,input:PlanSaveRequest,actor:Actor,now=new Date().toISOString()):Workspace{
  if(!can(actor.role,"budget.save"))throw new Error("Tu perfil no puede preparar presupuestos.");
  const {draft,expected_revision}=planSaveRequest.parse(input);
  if(!workspace.projects.some(p=>p.id===draft.projectId))throw new Error("Proyecto no encontrado.");
  if(draft.budgetId && !workspace.budgets.some(b=>b.id===draft.budgetId && b.project_id===draft.projectId))throw new Error("El presupuesto pertenece a otro proyecto.");
  checkPlanDocuments(draft,workspace.documents,workspace.organization_id);
  if(new TextEncoder().encode(JSON.stringify(draft)).length>1500000)throw new Error("La lectura es demasiado grande para guardarla en el proyecto. Tu copia local se conserva.");
  const previous=workspace.plan_captures?.find(c=>c.project_id===draft.projectId);
  if(previous && previous.revision===expected_revision+1 && planSignature(previous.draft)===planSignature(draft))return workspace;
  if((previous?.revision ?? 0)!==expected_revision)throw new Error("Otra persona ha actualizado la preparación. Tu edición se conserva; carga la guardada para revisarla.");
  const capture:PlanDraft={project_id:draft.projectId,revision:expected_revision+1,draft,updated_at:now,updated_by_name:actor.name};
  return {...workspace,plan_captures:[...(workspace.plan_captures ?? []).filter(c=>c.project_id!==draft.projectId),capture]};
}
