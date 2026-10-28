import type { Article,BudgetItem } from "../domain";
import type { SpatialScene,VisualAsset,SceneSelection } from "./schema";
export const visualId=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
export const visualOrganization=visualId(1);
const article=(n:number,code:string,name:string,chapter:string,unit:string,unit_price:number):Article=>({id:visualId(n),organization_id:visualOrganization,code,name,chapter,unit,unit_price,vat_rate:21});
/** Tarifas y productos inventados; no son el catálogo ni los precios de GARAL. */
export const visualArticles=[
  article(10,"DEMO-S01","Pavimento de madera clara instalado","Pavimentos","m²",4500),
  article(11,"DEMO-S02","Pavimento de piedra instalado","Pavimentos","m²",6500),
  article(12,"DEMO-P01","Pintura clara con preparación","Acabados","m²",1600),
  article(13,"DEMO-P02","Revestimiento mineral con aplicación","Acabados","m²",3100),
  article(14,"DEMO-M01","Mueble auxiliar de 80 cm montado","Equipamiento","ud",52000),
  article(15,"DEMO-M02","Mueble auxiliar de 120 cm montado","Equipamiento","ud",88000),
  article(16,"DEMO-N01","Pavimento de resina instalado","Pavimentos","m²",3200),
  article(17,"DEMO-N02","Pavimento de resina reforzada instalado","Pavimentos","m²",4200),
  article(18,"DEMO-N03","Pintura de nave con aplicación","Acabados","m²",1200),
  article(19,"DEMO-N04","Revestimiento de nave con aplicación","Acabados","m²",1900),
  article(20,"DEMO-E01","Estantería modular montada","Equipamiento","ud",74000),
  article(21,"DEMO-E02","Estantería reforzada montada","Equipamiento","ud",108000)
];
const asset=(n:number,article:number,kind:VisualAsset["kind"],color:VisualAsset["color"],dimensions_m?:VisualAsset["dimensions_m"]):VisualAsset=>({
  id:visualId(n),organization_id:visualOrganization,article_id:visualId(article),kind,color,dimensions_m,revision:"demo-1",representation:"generic_demo"
});
export const visualAssets=[
  asset(110,10,"wood",[184,153,112]),asset(111,11,"stone",[188,184,174]),
  asset(112,12,"paint",[232,228,214]),asset(113,13,"mineral",[186,192,182]),
  asset(114,14,"cabinet",[186,149,102],[0.8,0.85,0.48]),asset(115,15,"cabinet",[103,75,53],[1.2,0.85,0.5]),
  asset(116,16,"resin",[152,160,165]),asset(117,17,"resin",[113,130,125]),
  asset(118,18,"paint",[223,226,222]),asset(119,19,"mineral",[170,181,186]),
  asset(120,20,"rack",[77,97,111],[2,2.5,0.8]),asset(121,21,"rack",[48,69,82],[2.4,3,1])
];
const work=(n:number,unit_price:number):BudgetItem=>({id:visualId(n),chapter:"Preparación",description:"Protección del espacio y preparación general · ejemplo",quantity:1,unit:"global",unit_price,adjustment_percent:0,vat_rate:21,inclusion:"included"});
function makeScene(industrial:boolean):SpatialScene {
  const base=industrial?300:200;
  return {id:visualId(base),organization_id:visualOrganization,project_id:visualId(base+1),label:industrial?"Nave de ejemplo":"Local de ejemplo",space_kind:industrial?"industrial":"retail",
    source:{kind:"synthetic",reference:"Espacio ficticio preparado para probar navegación y presupuesto; no procede de fotos o planos reales."},
    dimensions_m:industrial?{width:12,depth:8,height:5}:{width:4,depth:3,height:2.8},
    measurements:[
      {id:visualId(base+10),quantity:industrial?96:12,unit:"m²",reference:"Superficie sintética de suelo: ancho por fondo del ejemplo."},
      {id:visualId(base+11),quantity:industrial?188:36.2,unit:"m²",reference:industrial?"Superficie sintética: perímetro por altura, menos portón de 12 m².":"Superficie sintética: perímetro por altura, menos 3 m² de huecos."},
      {id:visualId(base+12),quantity:industrial?2:1,unit:"ud",reference:"Unidades expresamente elegidas para el ejemplo; no se cuentan objetos del visor."}
    ],
    slots:[
      {id:visualId(base+20),label:"Suelo",category:"floor",measurement_id:visualId(base+10),allowed_asset_ids:[visualId(industrial?116:110),visualId(industrial?117:111)]},
      {id:visualId(base+21),label:"Paredes",category:"wall",measurement_id:visualId(base+11),allowed_asset_ids:[visualId(industrial?118:112),visualId(industrial?119:113)]},
      {id:visualId(base+22),label:industrial?"Estanterías":"Mueble auxiliar",category:"furnishing",measurement_id:visualId(base+12),allowed_asset_ids:[visualId(industrial?120:114),visualId(industrial?121:115)]}
    ],
    objects:industrial ? [
      {id:visualId(base+30),slot_id:visualId(base+22),kind:"furnishing",position_m:[-3,0,-2.8]},
      {id:visualId(base+31),slot_id:visualId(base+22),kind:"furnishing",position_m:[2.8,0,-2.8]},
      {id:visualId(base+32),slot_id:null,kind:"existing_column",position_m:[-4,0,1]}
    ]:[{id:visualId(base+30),slot_id:visualId(base+22),kind:"furnishing",position_m:[0.8,0,-1.12]}],
    nonvisual_items:[work(base+40,industrial?60000:15000)]
  };
}
export const demoScenes=[makeScene(false),makeScene(true)];
export function initialSceneSelection(scene:SpatialScene):SceneSelection {return Object.fromEntries(scene.slots.map(s=>[s.id,s.allowed_asset_ids[0]]));}
