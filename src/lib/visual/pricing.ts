import { z } from "zod";
import { itemSchema,lineTotal,totals,type Article,type BudgetItem } from "../domain";
import { sceneSelectionSchema,spatialSceneSchema,visualAssetSchema,type SceneSelection } from "./schema";

/** El catálogo aporta el precio; los objetos dibujados nunca generan cantidades facturables. */
export function priceScene(raw:{scene:unknown;selection:unknown;assets:unknown;articles:Article[];organization_id:string}) {
  const scene=spatialSceneSchema.parse(raw.scene),selection=sceneSelectionSchema.parse(raw.selection);
  const assets=z.array(visualAssetSchema).max(1000).parse(raw.assets);
  if(scene.organization_id!==raw.organization_id) throw new Error("La escena no pertenece a esta organización.");
  if(Object.keys(selection).some(key=>!scene.slots.some(s=>s.id===key))) throw new Error("La selección contiene una elección ajena a la escena.");
  const catalogue=new Map(raw.articles.filter(a=>a.organization_id===raw.organization_id).map(a=>[a.id,a]));
  if(new Set(assets.map(a=>a.id)).size!==assets.length) throw new Error("Hay recursos visuales duplicados.");
  const warnings:string[]=[];
  const links: {slot_id:string;asset_id:string;asset_revision:string;article_id:string;measurement_id:string;reference:string}[]=[];
  const items:BudgetItem[]=scene.slots.map(slot=>{
    const assetId=selection[slot.id];
    if(!assetId || !slot.allowed_asset_ids.includes(assetId)) throw new Error("Selecciona una alternativa permitida para cada elemento.");
    const asset=assets.find(a=>a.id===assetId && a.organization_id===raw.organization_id);
    const article=asset && catalogue.get(asset.article_id);
    if(!asset || !article) throw new Error("El recurso o el artículo no pertenece al catálogo autorizado.");
    const fits=slot.category==="furnishing" ? ["cabinet","rack"].includes(asset.kind) :
      slot.category==="floor" ? ["wood","stone","resin"].includes(asset.kind) : ["paint","mineral"].includes(asset.kind);
    if(!fits || slot.category==="furnishing" && !asset.dimensions_m) throw new Error("El recurso visual no es compatible con esta elección.");
    const measurement=scene.measurements.find(m=>m.id===slot.measurement_id);
    if(!measurement || measurement.unit!==article.unit) throw new Error("La medición no corresponde a la unidad del artículo.");
    if(slot.category==="furnishing" && measurement.unit==="ud" && scene.objects.filter(o=>o.slot_id===slot.id).length!==measurement.quantity)
      warnings.push(`Revisa ${slot.label}: las unidades declaradas no coinciden con las instancias visibles. El precio conserva la medición declarada.`);
    links.push({slot_id:slot.id,asset_id:asset.id,asset_revision:asset.revision,article_id:article.id,measurement_id:measurement.id,reference:measurement.reference});
    return itemSchema.parse({id:slot.id,chapter:article.chapter,description:`${article.name} · ${slot.label}`,quantity:measurement.quantity,unit:article.unit,
      unit_price:article.unit_price,adjustment_percent:0,vat_rate:article.vat_rate,inclusion:"included"});
  });
  items.push(...scene.nonvisual_items.map(item=>({...item})));
  z.number().max(Number.MAX_SAFE_INTEGER/1.3).parse(items.reduce((s,i)=>s+lineTotal(i),0));
  return {scene_id:scene.id,source:scene.source,items,links,warnings,amounts:totals(items),status:"local_proposal" as const,review_required:true as const,persisted:false as const};
}
export function selectSceneAsset(raw:{scene:unknown;selection:unknown;slot_id:string;asset_id:string}):SceneSelection {
  const scene=spatialSceneSchema.parse(raw.scene),selection=sceneSelectionSchema.parse(raw.selection);
  const slot=scene.slots.find(s=>s.id===raw.slot_id);
  if(!slot?.allowed_asset_ids.includes(raw.asset_id)) throw new Error("Esa alternativa no está disponible para este elemento.");
  return {...selection,[raw.slot_id]:raw.asset_id};
}
