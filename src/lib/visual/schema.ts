import { z } from "zod";
import { itemSchema } from "../domain";
const id=z.uuid();
const text=z.string().trim().min(1).max(500);
const rgb=z.tuple([z.number().int().min(0).max(255),z.number().int().min(0).max(255),z.number().int().min(0).max(255)]);
export const visualAssetSchema=z.object({
  id,organization_id:id,article_id:id,revision:text,representation:z.literal("generic_demo"),
  kind:z.enum(["wood","stone","resin","paint","mineral","cabinet","rack"]),color:rgb,
  dimensions_m:z.tuple([z.number().positive().max(100),z.number().positive().max(100),z.number().positive().max(100)]).optional()
}).strict();
const measurement=z.object({id,quantity:z.number().positive().max(1000000).multipleOf(0.001),unit:z.enum(["m²","ml","ud","h","global"]),reference:text}).strict();
const slot=z.object({id,label:text,category:z.enum(["floor","wall","furnishing"]),measurement_id:id,allowed_asset_ids:z.array(id).min(1).max(100)}).strict();
const object=z.object({id,slot_id:id.nullable(),kind:z.enum(["furnishing","existing_column"]),position_m:z.tuple([z.number().finite(),z.number().finite(),z.number().finite()])}).strict();
export const spatialSceneSchema=z.object({
  id,organization_id:id,project_id:id,label:text,space_kind:z.enum(["residential","industrial","retail","office","other"]),
  source:z.object({kind:z.literal("synthetic"),reference:text}).strict(),
  dimensions_m:z.object({width:z.number().positive().max(200),depth:z.number().positive().max(200),height:z.number().positive().max(30)}).strict(),
  measurements:z.array(measurement).max(500),slots:z.array(slot).min(1).max(500),objects:z.array(object).max(500),
  nonvisual_items:z.array(itemSchema).max(100)
}).strict().superRefine((s,ctx)=>{
  for(const field of ["measurements","slots","objects","nonvisual_items"] as const)
    if(new Set(s[field].map(v=>v.id)).size!==s[field].length) ctx.addIssue({code:"custom",path:[field],message:"Hay identificadores duplicados."});
  if(new Set([...s.slots,...s.nonvisual_items].map(v=>v.id)).size!==s.slots.length+s.nonvisual_items.length)
    ctx.addIssue({code:"custom",path:["slots"],message:"Una partida visual y otra sin objeto comparten identificador."});
  for(const object of s.objects) {
    if(object.kind==="furnishing" && !object.slot_id || object.kind==="existing_column" && object.slot_id!==null)
      ctx.addIssue({code:"custom",path:["objects"],message:"Los artículos requieren vínculo y los elementos existentes deben quedar fuera del presupuesto visual."});
    if(object.slot_id && !s.slots.some(slot=>slot.id===object.slot_id && slot.category==="furnishing"))
      ctx.addIssue({code:"custom",path:["objects"],message:"El objeto no tiene una elección de mobiliario válida."});
  }
});
export const sceneSelectionSchema=z.record(id,id);
export type VisualAsset=z.infer<typeof visualAssetSchema>;
export type SpatialScene=z.infer<typeof spatialSceneSchema>;
export type SceneSelection=z.infer<typeof sceneSelectionSchema>;
