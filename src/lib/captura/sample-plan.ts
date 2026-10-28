import type { PdfExtraction } from "./pdf-extraction";
/** Geometría ficticia para probar el laboratorio; no procede de un expediente de GARAL. */
export const samplePlan: PdfExtraction={
  schema_version:1,kind:"pdf_geometry",sha256:"c".repeat(64),pages:[{
    page:1,width:500,height:300,coordinate_system:"pdf_points_top_left_rotation_applied",paths:[
      {id:"perimetro",closed:true,points:[[20,20],[480,20],[480,280],[20,280]],stroke:[0.15,0.15,0.15],fill:null,has_stroke:true,has_fill:false,line_width:1.5},
      {id:"demoler-a",closed:true,points:[[20,100],[220,100],[220,104],[20,104]],fill:[1,0,0],stroke:null,has_fill:true,has_stroke:false},
      {id:"demoler-a-duplicado",closed:true,points:[[220,104],[220,100],[20,100],[20,104]],fill:[1,0,0],stroke:null,has_fill:true,has_stroke:false},
      {id:"construir-b",closed:true,points:[[300,20],[304,20],[304,140],[300,140]],fill:[0,0.7,0],stroke:null,has_fill:true,has_stroke:false},
      {id:"mesa",closed:true,points:[[350,190],[410,190],[410,240],[350,240]],fill:[0.85,0.85,0.85],stroke:[0.3,0.3,0.3],has_fill:true,has_stroke:true,line_width:1}
    ]
  }]
};
