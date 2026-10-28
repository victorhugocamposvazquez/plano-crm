import { describe,it,expect } from "vitest";
import { createEstimateProposal } from "../../src/lib/captura/estimate";
import { polygonArea,polylineLength } from "../../src/lib/captura/geometry";
import { articles,fixture,id,organization } from "./fixture";
const run=(input:unknown=fixture(),catalogue=articles)=>createEstimateProposal(input,{organization_id:organization,articles:catalogue});

describe("Medición y propuesta trazable",()=>{
  it("convierte un rectángulo calibrado de 5 × 4 m a 20 m² y usa precios en céntimos",()=>{
    const p=run(); expect(p.lines[0].item?.quantity).toBe(20);
    expect(p.priced_subtotal).toEqual({base:100000,tax:21000,total:121000});
    expect(p).toMatchObject({status:"proposal",complete:true,review_required:true,persisted:false});
    expect(p.lines[0].measurements[0]).toMatchObject({source_id:id(10),calibration_id:id(20),basis:"calibrated_geometry"});
  });
  it("no modifica la entrada ni el catálogo y conserva los IDs para comparar versiones",()=>{
    const input=fixture(),before=structuredClone(input),catalogue=structuredClone(articles);
    const first=run(input),second=run(input);expect(first).toEqual(second);
    expect(first.lines[0].item?.id).toBe(input.intents[0].id);expect(input).toEqual(before);expect(articles).toEqual(catalogue);
  });
  it("no presupone escala ni reutiliza la de otro plano o página",()=>{
    const input=fixture();input.calibrations=[]; expect(run(input).lines[0].issues[0].code).toBe("missing_calibration");
    const other=fixture();other.calibrations[0].page=2;expect(run(other).lines[0].issues[0].code).toBe("calibration_mismatch");
    other.calibrations[0].page=1;other.calibrations[0].source_id=id(99);expect(run(other).lines[0].issues[0].code).toBe("calibration_mismatch");
  });
  it("rechaza una referencia de escala de longitud nula",()=>{
    const input=fixture();input.calibrations[0].end=[0,0];expect(run(input).lines[0].issues[0].code).toBe("invalid_geometry");
  });
  it("calcula superficie neta de pared descontando huecos sin redondeos intermedios",()=>{
    const input=fixture();input.sources.push({id:id(11),kind:"laser_measure",label:"Distanciómetro",phase:"existing",legend:""});
    input.measurements=[
      {id:id(30),source_id:id(11),kind:"quantity",label:"Longitud",value:4,unit:"ml",method:"laser",reference:"Medida en visita"},
      {id:id(31),source_id:id(11),kind:"quantity",label:"Altura",value:2.5,unit:"ml",method:"laser",reference:"Medida en visita"},
      {id:id(32),source_id:id(10),kind:"plan_area",label:"Puerta",page:1,calibration_id:id(20),points:[[0,0],[20,0],[20,40],[0,40]]}
    ];
    input.intents[0].article_id=id(4);input.intents[0].formula={kind:"wall_area",length_id:id(30),height_id:id(31),opening_ids:[id(32)]};
    expect(run(input).lines[0].item?.quantity).toBe(8);
    if(input.measurements[0].kind!=="quantity") throw new Error("Fixture inválido"); input.measurements[0].value=0.1;expect(run(input).lines[0].issues[0].code).toBe("invalid_quantity");
  });
  it("suma varias paredes y descuenta los huecos antes de aplicar dos caras",()=>{
    const input=fixture();input.sources.push({id:id(11),kind:"manual",label:"Medidas declaradas",phase:"proposed",legend:""});
    input.measurements=[
      {id:id(30),source_id:id(11),kind:"quantity",label:"Pared A",value:2,unit:"ml",method:"manual",reference:"Visita"},
      {id:id(31),source_id:id(11),kind:"quantity",label:"Pared B",value:3,unit:"ml",method:"manual",reference:"Visita"},
      {id:id(32),source_id:id(11),kind:"quantity",label:"Altura",value:2.5,unit:"ml",method:"manual",reference:"Visita"},
      {id:id(33),source_id:id(11),kind:"quantity",label:"Huecos",value:8,unit:"m²",method:"manual",reference:"Una cara"}
    ];
    input.intents[0].article_id=id(4);
    input.intents[0].formula={kind:"wall_area",length_ids:[id(30),id(31)],height_id:id(32),opening_ids:[id(33)],faces:2};
    const p=run(input);expect(p.lines[0].item?.quantity).toBe(9);expect(p.lines[0].measurements).toHaveLength(4);
    const f=input.intents[0].formula;
    f.length_ids=[id(30),id(30)];expect(run(input).lines[0].issues[0].code).toBe("duplicate_measurement");
    f.length_ids=[id(30),id(99)];expect(run(input).lines[0].issues[0].code).toBe("missing_measurement");
    f.length_ids=[id(30),id(33)];expect(run(input).lines[0].issues[0].code).toBe("unit_mismatch");
    f.length_ids=[id(30)];expect(run(input).lines[0].issues[0].code).toBe("invalid_quantity");
  });
  it("requiere una sola forma de declarar las longitudes",()=>{
    const input=fixture();
    for(const formula of [
      {kind:"wall_area",height_id:id(31),opening_ids:[]},
      {kind:"wall_area",length_id:id(30),length_ids:[id(30)],height_id:id(31),opening_ids:[]},
      {kind:"wall_area",length_ids:[],height_id:id(31),opening_ids:[]},
      {kind:"wall_area",length_ids:[id(30)],height_id:id(31),opening_ids:[],faces:3}
    ]) expect(()=>run({...input,intents:[{...input.intents[0],formula}]})).toThrow();
  });
  it("bloquea conversiones de unidades y referencias repetidas",()=>{
    const input=fixture();input.intents[0].formula={kind:"sum",measurement_ids:[id(30),id(30)]};
    expect(run(input).lines[0].issues[0].code).toBe("duplicate_measurement");
    expect(run(fixture(),[{...articles[0],unit:"ud"}]).lines[0].issues[0].code).toBe("article_unit_mismatch");
  });
  it("una panorámica no se convierte en medición métrica por declararlo en la petición",()=>{
    const input=fixture();input.sources[0].kind="panorama";
    input.measurements=[{id:id(30),source_id:id(10),kind:"quantity",label:"Suelo",value:20,unit:"m²",method:"metric_export",reference:"Foto 360"}];
    expect(run(input).lines[0].issues[0].code).toBe("unsupported_measurement");
    if(input.measurements[0].kind!=="quantity") throw new Error("Fixture inválido"); input.measurements[0].method="visual_estimate";
    const p=run(input);expect(p.lines[0].status).toBe("calculated");expect(p.lines[0].measurements[0].basis).toBe("visual_estimate");
    expect(p.lines[0].warnings.join(" ")).toContain("no son mediciones verificadas");
  });
  it("admite medidas declaradas de un escáner profesional sin fingir lectura de E57",()=>{
    const input=fixture();input.sources[0].kind="laser_scan";
    input.measurements=[{id:id(30),source_id:id(10),kind:"quantity",label:"Suelo",value:20,unit:"m²",method:"metric_export",reference:"Exportación del levantamiento, estancia A"}];
    expect(run(input).lines[0].measurements[0].basis).toBe("declared_measurement");
  });
  it("una medida dictada conserva su condición de medida declarada",()=>{
    const input=fixture();input.sources[0].kind="voice";
    input.measurements=[{id:id(30),source_id:id(10),kind:"quantity",label:"Suelo",value:20,unit:"m²",method:"reported",reference:"El técnico dicta veinte metros cuadrados"}];
    const p=run(input);expect(p.lines[0].measurements[0].basis).toBe("declared_measurement");
    expect(p.lines[0].warnings.join(" ")).toContain("no verifica el instrumento");
  });
  it("no inventa precios de artículos ausentes o de otra organización",()=>{
    expect(run(fixture(),[])).toMatchObject({complete:false,priced_subtotal:{base:0,total:0},pending_line_ids:[id(40)]});
    expect(run(fixture(),[{...articles[0],organization_id:id(99)}]).lines[0].issues[0].code).toBe("missing_article");
  });
  it("separa el subtotal calculado de las partidas sin resolver y de las opcionales",()=>{
    const input=fixture();input.intents.push({...input.intents[0],id:id(41),article_id:null});
    let p=run(input);expect(p.complete).toBe(false);expect(p.priced_subtotal.base).toBe(100000);
    input.intents[0].inclusion="optional";p=run(input);expect(p.priced_subtotal.base).toBe(0);expect(p.lines[0].item?.quantity).toBe(20);
  });
  it("exige motivo para ajustes y aplica el ajuste sobre el precio base del catálogo",()=>{
    const input=fixture();input.intents[0].adjustment_percent=10;expect(()=>run(input)).toThrow();
    input.intents[0].adjustment_reason="Acceso difícil";const p=run(input);
    expect(p.priced_subtotal.base).toBe(110000);expect(p.lines[0].item?.unit_price).toBe(5000);
  });
  it("rechaza campos extra, valores no finitos, exceso de líneas e IDs repetidos",()=>{
    expect(()=>run({...fixture(),approved:true})).toThrow();
    const input=fixture();input.measurements.push(input.measurements[0]);expect(()=>run(input)).toThrow();
    expect(()=>run({...fixture(),intents:Array.from({length:501},(_,n)=>({...fixture().intents[0],id:id(n+100)}))})).toThrow();
    const nan=fixture();nan.calibrations[0].distance_m=NaN;expect(()=>run(nan)).toThrow();
  });
});
describe("Geometría sin supuestos sobre contornos",()=>{
  it("mide un polígono cóncavo en ambos sentidos y admite el cierre explícito",()=>{
    const points: [number,number][]=[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]];
    expect(polygonArea(points)).toBe(7);expect(polygonArea([...points].reverse())).toBe(7);expect(polygonArea([...points,points[0]])).toBe(7);
    expect(polylineLength([[0,0],[3,4],[6,4]])).toBe(8);
  });
  it("rechaza contornos cruzados, degenerados y segmentos solapados",()=>{
    expect(()=>polygonArea([[0,0],[4,4],[0,4],[4,0]])).toThrow();
    expect(()=>polygonArea([[0,0],[1,0],[2,0]])).toThrow();
    expect(()=>polygonArea([[0,0],[4,0],[2,0],[2,4],[0,4]])).toThrow();
    expect(()=>polylineLength([[0,0],[0,0]])).toThrow();
  });
});
