import type { Article } from "../../src/lib/domain";
import type { RoomSurvey } from "../../src/lib/captura/room-survey";
import { articles,project,id } from "./fixture";

export const catalogue:Article[]=[...articles,
  {...articles[0],id:id(5),name:"Suelo alternativo",unit_price:6000},
  {...articles[0],id:id(6),name:"Mueble de contexto",unit:"ud",unit_price:200000}
];
export function survey():RoomSurvey {
  return {schema_version:1,project_id:project,scope:"Reformar el suelo de dos zonas",calibrations:[],sources:[
    {id:id(10),kind:"photo",label:"Foto de teléfono",document_id:id(80),phase:"existing",legend:""},
    {id:id(11),kind:"manual",label:"Medidas de la visita",phase:"existing",legend:""},
    {id:id(12),kind:"panorama",label:"Panorámica 360 de la nave",document_id:id(81),phase:"existing",legend:""}
  ],rooms:[{
    id:id(20),label:"Zona de acceso",scope:"Cambiar suelo",source_ids:[id(10),id(11)],
    observations:[{source_id:id(10),note:"Se conserva el mueble"}],
    measurements:[{id:id(30),source_id:id(11),kind:"quantity",label:"Suelo",value:10,unit:"m²",method:"manual",reference:"Medida declarada en la visita"}],
    selections:[{kind:"work",intent:{id:id(40),label:"Cambiar suelo",article_id:id(3),formula:{kind:"sum",measurement_ids:[id(30)]},inclusion:"included",adjustment_percent:0,adjustment_reason:""}},
      {kind:"context",id:id(42),label:"Mueble que se conserva",article_id:id(6),purpose:"existing"}],questions:[]
  },{
    id:id(21),label:"Nave · almacén",scope:"Cambiar suelo",source_ids:[id(12),id(11)],observations:[],
    measurements:[{id:id(31),source_id:id(11),kind:"quantity",label:"Suelo",value:3,unit:"m²",method:"manual",reference:"Medida declarada en la visita"}],
    selections:[{kind:"work",intent:{id:id(41),label:"Cambiar suelo",article_id:id(3),formula:{kind:"sum",measurement_ids:[id(31)]},inclusion:"included",adjustment_percent:0,adjustment_reason:""}}],questions:[]
  }]};
}
