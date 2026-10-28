import { describe,it,expect } from "vitest";
import { measurementFromPdfPath } from "../../src/lib/captura/pdf-path";
import { createEstimateProposal } from "../../src/lib/captura/estimate";
import { fixture,id,organization,articles } from "./fixture";
const make=()=>{
  const input=fixture(),sha256="a".repeat(64);
  return {source:{...input.sources[0],sha256},calibration:input.calibrations[0],
    extraction:{schema_version:1,kind:"pdf_geometry",sha256,pages:[{page:1,width:300,height:200,coordinate_system:"pdf_points_top_left_rotation_applied",
      paths:[{id:"p1-o0-s0",points:[[0,0],[100,0],[100,80],[0,80]],closed:true}]}]},
    page:1,path_id:"p1-o0-s0",measurement_id:id(30),label:"Suelo",kind:"plan_area" as const};
};
describe("Puente entre extracción PDF y propuesta",()=>{
  it("lleva un trazado seleccionado a 20 m² y conserva su referencia",()=>{
    const options=make(),measurement=measurementFromPdfPath(options),input=fixture();
    input.sources=[options.source];input.measurements=[measurement];
    const result=createEstimateProposal(input,{organization_id:organization,articles});
    expect(result.lines[0].item?.quantity).toBe(20);expect(result.measurement_inputs[0]).toMatchObject({path_id:"p1-o0-s0"});
  });
  it("rechaza otro archivo, contornos abiertos y puntos fuera de página",()=>{
    let options=make();options.source.sha256="b".repeat(64);expect(()=>measurementFromPdfPath(options)).toThrow(/PDF/);
    options=make();options.extraction.pages[0].paths[0].closed=false;expect(()=>measurementFromPdfPath(options)).toThrow(/abierto/);
    options=make();options.extraction.pages[0].paths[0].points[0]=[999,0];expect(()=>measurementFromPdfPath(options)).toThrow(/fuera/);
  });
  it("incluye el segmento de cierre al medir el perímetro",()=>{
    const options=make(),input=fixture();
    input.measurements=[measurementFromPdfPath({...options,kind:"plan_length"})];
    const result=createEstimateProposal(input,{organization_id:organization,articles:[{...articles[0],unit:"ml"}]});
    expect(result.lines[0].item?.quantity).toBe(18);
  });
});
