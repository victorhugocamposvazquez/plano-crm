import { describe,it,expect } from "vitest";
import { createRoomProposal,replaceRoomArticle,roomSurveySchema } from "../../src/lib/captura/room-survey";
import { catalogue,survey } from "./room-fixture";
import { organization,id } from "./fixture";

const calculate=(input:unknown)=>createRoomProposal(input,{organization_id:organization,articles:catalogue});
describe("Presupuesto por estancia, fuentes y catálogo",()=>{
  it("separa las cantidades de cada zona y no cobra el contexto visual",()=>{
    const p=calculate(survey());expect(p.priced_subtotal.base).toBe(65000);expect(p.complete).toBe(true);
    expect(p.lines.map(l=>[l.room_label,l.item?.quantity])).toEqual([["Zona de acceso",10],["Nave · almacén",3]]);
    expect(p.rooms[0].context[0]).toMatchObject({priced:false,article_available:true});
    expect(p.persisted).toBe(false);expect(p.review_required).toBe(true);
  });
  it("cambia un artículo sin mutar el original ni la medida y recalcula solo su estancia",()=>{
    const original=survey(),copy=structuredClone(original),next=replaceRoomArticle(original,id(20),id(40),id(5));
    expect(original).toEqual(copy);expect(next.rooms[0].measurements).toEqual(copy.rooms[0].measurements);
    expect(next.rooms[0].selections[0]).toMatchObject({intent:{id:id(40),formula:{measurement_ids:[id(30)]}}});
    const p=calculate(next);expect(p.priced_subtotal.base).toBe(75000);expect(p.rooms[1].priced_subtotal.base).toBe(15000);
  });
  it("bloquea una sustitución incompatible sin convertir m² a unidades",()=>{
    const p=calculate(replaceRoomArticle(survey(),id(20),id(40),id(6)));
    expect(p.complete).toBe(false);expect(p.priced_subtotal.base).toBe(15000);
    expect(p.lines[0].item).toBeNull();expect(p.lines[0].issues[0].code).toBe("article_unit_mismatch");
  });
  it("impide utilizar precios de otra organización o enviados en la selección",()=>{
    const input=replaceRoomArticle(survey(),id(20),id(40),id(90));
    const p=createRoomProposal(input,{organization_id:organization,articles:[...catalogue,{...catalogue[0],id:id(90),organization_id:id(99),unit_price:1}]});
    expect(p.lines[0].issues[0].code).toBe("missing_article");
    const tampered=survey();Object.assign(tampered.rooms[0].selections[0],{unit_price:1});
    expect(roomSurveySchema.safeParse(tampered).success).toBe(false);
  });
  it("cambiar decoración no cambia el precio ni necesita una cantidad ficticia",()=>{
    const p=calculate(replaceRoomArticle(survey(),id(20),id(42),id(5)));
    expect(p.priced_subtotal.base).toBe(65000);expect(p.rooms[0].context[0].article_id).toBe(id(5));
  });
  it("capturar solo el contexto nunca presenta un presupuesto completo de cero euros",()=>{
    const input=survey();for(const room of input.rooms)room.selections=room.selections.filter(s=>s.kind==="context");
    const p=calculate(input);expect(p.lines).toEqual([]);expect(p.priced_subtotal.base).toBe(0);expect(p.complete).toBe(false);
    expect(p.rooms[0].context).toHaveLength(1);
  });
  it("no usa una medición de otra estancia aunque comparta el plano o instrumento",()=>{
    const input=survey(),s=input.rooms[0].selections[0];if(s.kind==="work")s.intent.formula={kind:"sum",measurement_ids:[id(31)]};
    const p=calculate(input);expect(p.lines[0].issues[0].code).toBe("missing_measurement");expect(p.priced_subtotal.base).toBe(15000);
  });
  it.each(["photo","panorama"] as const)("una fuente %s no justifica una medición métrica",kind=>{
    const input=survey();input.sources[0].kind=kind;
    Object.assign(input.rooms[0].measurements[0],{source_id:id(10),method:"metric_export"});
    const p=calculate(input);expect(p.lines[0].issues[0].code).toBe("unsupported_measurement");
    Object.assign(input.rooms[0].measurements[0],{method:"visual_estimate"});
    const visual=calculate(input);expect(visual.has_visual_quantities).toBe(true);
    expect(visual.lines[0].warnings.join(" ")).toContain("no son mediciones verificadas");
  });
  it("las fotos sin medidas dejan la partida pendiente; no adivina superficie ni precio completo",()=>{
    const input=survey();input.rooms[0].measurements=[];
    const p=calculate(input);expect(p.lines[0].issues[0].code).toBe("missing_measurement");expect(p.complete).toBe(false);
    input.rooms[0].source_ids=[];input.rooms[0].observations=[];
    expect(calculate(input).lines[0].issues[0].code).toBe("missing_source");
  });
  it("mantiene visibles preguntas necesarias aunque ya haya partidas calculadas",()=>{
    const input=survey();input.rooms[0].questions=[{id:id(60),question:"¿Hay ascensor para retirar escombros?",required:true,answer:""}];
    const p=calculate(input);expect(p.complete).toBe(false);expect(p.rooms[0].pending_questions).toHaveLength(1);expect(p.priced_subtotal.base).toBe(65000);
    input.rooms[0].questions[0].answer="Sí, comprobado en la visita";expect(calculate(input).complete).toBe(true);
  });
  it("conserva las fórmulas calibradas procedentes de un plano",()=>{
    const input=survey();input.sources[0].kind="pdf";
    input.calibrations=[{id:id(70),source_id:id(10),page:1,start:[0,0],end:[100,0],distance_m:5,reference:"Cota de 5 m"}];
    input.rooms[0].measurements=[{id:id(30),source_id:id(10),kind:"plan_area",label:"Suelo",calibration_id:id(70),page:1,points:[[0,0],[100,0],[100,40],[0,40]]}];
    const p=calculate(input);expect(p.lines[0].item?.quantity).toBe(10);expect(p.lines[0].measurements[0].basis).toBe("calibrated_geometry");
  });
  it("rechaza IDs duplicados, fuentes ajenas y sustituciones fuera de la estancia",()=>{
    const input=survey();input.rooms[1].measurements[0].id=id(30);expect(roomSurveySchema.safeParse(input).success).toBe(false);
    const other=survey();other.rooms[0].source_ids=[id(12)];expect(roomSurveySchema.safeParse(other).success).toBe(false);
    expect(()=>replaceRoomArticle(survey(),id(21),id(40),id(5))).toThrow("esa estancia");
  });
});
