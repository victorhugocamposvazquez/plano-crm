import { describe,it,expect } from "vitest";
import { applyCommand,compareVersions,commandSchema,lineTotal,totals,can,projectProgress,type BudgetItem,type Actor } from "@/lib/domain";
import { createDemo,demoActor,demoId } from "@/lib/demo";

const item=(overrides:Partial<BudgetItem>={}):BudgetItem=>({id:demoId(900),chapter:"Pintura",description:"Pintura",quantity:1,unit:"m²",unit_price:1000,adjustment_percent:0,vat_rate:21,inclusion:"included",...overrides});
describe("Importes y comparación",()=>{
  it("redondea en céntimos con aritmética decimal, también en el medio céntimo",()=>{
    expect(lineTotal(item({quantity:1.005,unit_price:100}))).toBe(101);
    expect(lineTotal(item({quantity:4.125,unit_price:235,adjustment_percent:12.25}))).toBe(1088);
  });
  it("excluye alternativas y partidas descartadas del subtotal y del IVA",()=>{
    expect(totals([item(),item({id:demoId(901),inclusion:"optional",unit_price:90000}),item({id:demoId(902),inclusion:"excluded"})])).toEqual({base:1000,tax:210,total:1210});
  });
  it("calcula ajustes sobre el precio base y conserva el catálogo",()=>{
    const line=item({quantity:10,unit_price:2800,adjustment_percent:15});
    expect(lineTotal(line)).toBe(32200);expect(line.unit_price).toBe(2800);
    expect(lineTotal({...line,adjustment_percent:-10})).toBe(25200);
  });
  it("aplica tipos de IVA por partida y redondea cada partida",()=>{
    expect(totals([item({unit_price:101,vat_rate:10}),item({id:demoId(901),unit_price:101,vat_rate:21})])).toEqual({base:202,tax:31,total:233});
  });
  it("detecta cambios de descripción aunque no cambie el precio",()=>{
    const before=createDemo().versions[0],after=structuredClone(before);
    after.items[0].description="Otro acabado";
    expect(compareVersions(before,after)).toMatchObject([{kind:"changed",fields:["description"],delta:0}]);
  });
  it("detecta altas, bajas e inclusión de alternativas",()=>{
    const before=createDemo().versions[0],after=structuredClone(before);
    after.items.shift();after.items[0].inclusion="optional";after.items.push(item());
    expect(compareVersions(before,after).map(c=>c.kind)).toEqual(["removed","changed","added"]);
  });
  it("valida precisión, valores finitos, duplicados e importes máximos",()=>{
    const save={type:"budget.save",version_id:demoId(61),expected_revision:0,items:[item()],notes:""};
    expect(commandSchema.safeParse({...save,items:[item({quantity:1.0001})]}).success).toBe(false);
    expect(commandSchema.safeParse({...save,items:[item({unit_price:NaN})]}).success).toBe(false);
    expect(commandSchema.safeParse({...save,items:[item(),item()]}).success).toBe(false);
    const large=Array.from({length:500},(_,i)=>item({id:demoId(10000+i),quantity:1000000,unit_price:100000000,adjustment_percent:100}));
    expect(commandSchema.safeParse({...save,items:large}).success).toBe(false);
  });
});
describe("Versionado de presupuesto",()=>{
  it("no permite guardar una revisión aprobada",()=>{
    const data=createDemo();expect(()=>applyCommand(data,{type:"budget.save",version_id:demoId(60),expected_revision:1,items:[],notes:""},demoActor)).toThrow("cerrada");
  });
  it("un borrador no sustituye ni modifica la versión aprobada",()=>{
    const data=createDemo(),snapshot=structuredClone(data.versions[0]);
    const next=applyCommand(data,{type:"budget.save",version_id:demoId(61),expected_revision:0,items:[item()],notes:"Actualizado"},demoActor);
    expect(next.versions[0]).toEqual(snapshot);expect(next.budgets[0].approved_version_id).toBe(demoId(60));expect(data.versions[1].draft_revision).toBe(0);
  });
  it("rechaza un guardado obsoleto",()=>{
    const cmd={type:"budget.save" as const,version_id:demoId(61),expected_revision:0,items:[item()],notes:""};
    const next=applyCommand(createDemo(),cmd,demoActor);expect(()=>applyCommand(next,cmd,demoActor)).toThrow("Otra persona");
  });
  it("solo admite un borrador por presupuesto",()=>{
    expect(()=>applyCommand(createDemo(),{type:"budget.revise",version_id:demoId(60),reason:"Cambios"},demoActor)).toThrow("borrador abierto");
  });
  it("exige cerrar la revisión antes de aprobar",()=>{
    expect(()=>applyCommand(createDemo(),{type:"budget.approve",version_id:demoId(61),reference:"Correo de aceptación"},demoActor)).toThrow("cierra");
  });
  it("conserva el contenido y la aprobación anterior al aprobar una nueva",()=>{
    let state=createDemo();const original=structuredClone(state.versions[0].items);
    state=applyCommand(state,{type:"budget.issue",version_id:demoId(61),expected_revision:0},demoActor);
    state=applyCommand(state,{type:"budget.approve",version_id:demoId(61),reference:"Correo del cliente, 26/10"},demoActor);
    expect(state.budgets[0].approved_version_id).toBe(demoId(61));expect(state.versions[0].status).toBe("superseded");expect(state.versions[0].items).toEqual(original);
    expect(state.versions[1].approval_reference).toBe("Correo del cliente, 26/10");
    const revised=applyCommand(state,{type:"budget.revise",version_id:demoId(61),reason:"Cambio de material"},demoActor);
    const next=revised.versions.at(-1)!;expect(next.number).toBe(3);expect(next.items[0].id).toBe(state.versions[1].items[0].id);expect(next.items).not.toBe(state.versions[1].items);
  });
  it("no cierra un presupuesto sin partidas incluidas",()=>{
    let state=createDemo();state=applyCommand(state,{type:"budget.save",version_id:demoId(61),expected_revision:0,items:[item({inclusion:"optional"})],notes:""},demoActor);
    expect(()=>applyCommand(state,{type:"budget.issue",version_id:demoId(61),expected_revision:1},demoActor)).toThrow("partida incluida");
  });
});
describe("Catálogo: editar y eliminar artículos",()=>{
  it("actualiza solo los campos enviados y no repite referencia",()=>{
    const next=applyCommand(createDemo(),{type:"article.update",id:demoId(30),chapter:"Derribos",unit_price:3000},demoActor);
    const a=next.articles.find(x=>x.id===demoId(30))!;expect(a).toMatchObject({code:"DEM-001",chapter:"Derribos",unit_price:3000,name:"Demolición de tabiquería interior"});
    expect(()=>applyCommand(next,{type:"article.update",id:demoId(30),code:"alb-001"},demoActor)).toThrow("referencia");
    expect(()=>applyCommand(next,{type:"article.update",id:demoId(999),name:"X"},demoActor)).toThrow("no encontrado");
    expect(commandSchema.safeParse({type:"article.update",id:demoId(30),unit_price:-5}).success).toBe(false);
  });
  it("elimina el artículo sin tocar los presupuestos y respeta permisos",()=>{
    const state=createDemo(),items=structuredClone(state.versions[0].items);
    const next=applyCommand(state,{type:"article.delete",id:demoId(30)},demoActor);
    expect(next.articles.some(a=>a.id===demoId(30))).toBe(false);expect(next.versions[0].items).toEqual(items);
    expect(can("site","article.update")).toBe(false);expect(can("manager","article.delete")).toBe(true);
  });
});

describe("Permisos y seguimiento",()=>{
  it("el equipo de obra no modifica precios y el jefe no aprueba",()=>{
    expect(can("site","budget.save")).toBe(false);expect(can("manager","budget.approve")).toBe(false);expect(can("viewer","message.send")).toBe(false);
    const actor:Actor={...demoActor,role:"site"};expect(()=>applyCommand(createDemo(),{type:"budget.revise",version_id:demoId(60),reason:"Cambio"},actor)).toThrow("permiso");
  });
  it("no permite certificar otro proyecto ni superar la base aprobada",()=>{
    const state=createDemo(),amount=totals(state.versions[0].items).base;
    const command={type:"certification.create" as const,project_id:demoId(10),budget_version_id:demoId(60),title:"Primer tramo",amount};
    expect(()=>applyCommand(state,{...command,project_id:demoId(11)},demoActor)).toThrow("vigente");
    const next=applyCommand(state,command,demoActor);
    expect(()=>applyCommand(next,{...command,amount:1},demoActor)).toThrow("supera");
  });
  it("controla entregas parciales y no confunde recepción con instalación",()=>{
    const state=createDemo(),id=demoId(300);
    expect(()=>applyCommand(state,{type:"purchase.update",id,status:"ordered",received_quantity:30,delivered_quantity:40},demoActor)).toThrow("cantidades");
    expect(()=>applyCommand(state,{type:"purchase.update",id,status:"delivered",received_quantity:40,delivered_quantity:40},demoActor)).toThrow("estado");
    expect(applyCommand(state,{type:"purchase.update",id,status:"ordered",received_quantity:60,delivered_quantity:40},demoActor).purchases[0].received_quantity).toBe(60);
  });
  it("el progreso refleja tareas ponderadas, no cobros",()=>{expect(projectProgress(createDemo(),demoId(10))).toBe(40);});
});
