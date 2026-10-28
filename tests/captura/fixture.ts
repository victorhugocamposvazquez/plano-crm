import type { Article } from "../../src/lib/domain";
import type { EstimateInput } from "../../src/lib/captura/schema";
export const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
export const organization=id(1), project=id(2);
export const articles: Article[]=[
  {id:id(3),organization_id:organization,code:"SUE-TEST",name:"Suelo de prueba",chapter:"Pavimentos",unit:"m²",unit_price:5000,vat_rate:21},
  {id:id(4),organization_id:organization,code:"DEM-TEST",name:"Demolición de prueba",chapter:"Demoliciones",unit:"m²",unit_price:2800,vat_rate:21}
];
export function fixture(): EstimateInput {
  return {
    schema_version:1,project_id:project,scope:"Cambiar el suelo de la estancia de prueba.",
    sources:[{id:id(10),kind:"pdf",label:"Plano sintético",phase:"existing",legend:""}],
    calibrations:[{id:id(20),source_id:id(10),page:1,start:[0,0],end:[100,0],distance_m:5,reference:"Cota comprobada de 5 m"}],
    measurements:[{id:id(30),source_id:id(10),label:"Suelo",kind:"plan_area",page:1,calibration_id:id(20),points:[[0,0],[100,0],[100,80],[0,80]]}],
    intents:[{id:id(40),label:"Cambiar suelo",article_id:id(3),formula:{kind:"sum",measurement_ids:[id(30)]},inclusion:"included",adjustment_percent:0,adjustment_reason:""}]
  };
}
