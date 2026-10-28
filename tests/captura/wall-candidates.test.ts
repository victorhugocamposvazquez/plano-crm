import { describe,it,expect } from "vitest";
import { proposeWallCandidates } from "../../src/lib/captura/wall-candidates";
import { drawingColor,filledColors,type PdfPage } from "../../src/lib/captura/pdf-extraction";
const page=(): PdfPage=>({page:1,width:500,height:500,coordinate_system:"pdf_points_top_left_rotation_applied",paths:[
  {id:"wall",points:[[20,20],[220,20],[220,24],[20,24]],closed:true,fill:[1,0,0],has_fill:true}
]});
const rules=[{color:[255,0,0],action:"demolish"}];
describe("Propuestas conservadoras de tabiques",()=>{
  it("no asigna significado por rojo o verde sin una leyenda explícita",()=>{
    expect(proposeWallCandidates(page(),[]).candidates).toEqual([]);
    const p=proposeWallCandidates(page(),rules);expect(p.candidates[0]).toMatchObject({action:"demolish",status:"proposal",centerline:[[20,22],[220,22]],thickness_drawing_units:4});
    expect(proposeWallCandidates(page(),[{color:[255,0,0],action:"build"}]).candidates[0].action).toBe("build");
  });
  it("deduplica la misma franja con orden de vértices diferente",()=>{
    const p=page();p.paths.push({...p.paths[0],id:"duplicado",points:[...p.paths[0].points].reverse()});
    const result=proposeWallCandidates(p,rules);expect(result.candidates).toHaveLength(1);expect(result.duplicate_paths).toBe(1);
    expect(result.candidates[0].source_path_ids).toEqual(["wall","duplicado"]);
  });
  it("mantiene separados tramos contiguos, otro grosor y acciones diferentes",()=>{
    const p=page();p.paths.push({...p.paths[0],id:"siguiente",points:[[220,20],[420,20],[420,24],[220,24]]});
    p.paths.push({...p.paths[0],id:"otro_grosor",points:[[20,19],[220,19],[220,25],[20,25]]});
    expect(proposeWallCandidates(p,rules).candidates).toHaveLength(3);
  });
  it("acepta rotación y vértices colineales sin usar la caja envolvente como eje",()=>{
    const p=page();p.paths[0].points=[[10,10],[110,110],[108,112],[8,12]];
    const candidate=proposeWallCandidates(p,rules).candidates[0];expect(candidate.centerline).toEqual([[9,11],[109,111]]);
    p.paths[0].points=[[20,20],[100,20],[220,20],[220,24],[20,24],[20,20]];
    expect(proposeWallCandidates(p,rules).candidates[0].centerline).toEqual([[20,22],[220,22]]);
  });
  it("excluye cuadrados, trazos abiertos, curvas aproximadas, figuras cruzadas y objetos fuera de página",()=>{
    const p=page();p.paths[0].points=[[0,0],[10,0],[10,10],[0,10]];expect(proposeWallCandidates(p,rules).candidates).toHaveLength(0);
    p.paths[0].points=[[20,20],[220,20],[220,24],[20,24]];p.paths[0].closed=false;expect(proposeWallCandidates(p,rules).candidates).toHaveLength(0);
    p.paths[0].closed=true;p.paths[0].points=[[0,0],[100,100],[0,100],[100,0]];expect(proposeWallCandidates(p,rules).candidates).toHaveLength(0);
    p.paths[0].points=[[0,0],[600,0],[600,4],[0,4]];expect(proposeWallCandidates(p,rules).skipped.outside_page).toBe(1);
  });
  it("no cuenta trazos sin relleno y respeta un color ignorado",()=>{
    const p=page();expect(proposeWallCandidates(p,[{color:[255,0,0],action:"ignore"}]).skipped.ignored).toBe(1);
    p.paths[0].has_fill=false;expect(proposeWallCandidates(p,rules).skipped.not_filled).toBe(1);
  });
  it("rechaza leyendas contradictorias e IDs repetidos",()=>{
    expect(()=>proposeWallCandidates(page(),[...rules,{color:[255,0,0],action:"build"}])).toThrow();
    const p=page();p.paths.push(p.paths[0]);expect(()=>proposeWallCandidates(p,rules)).toThrow();
  });
});
describe("Colores de documento",()=>{
  it("normaliza gris, RGB y CMYK básicos y no interpreta patrones",()=>{
    expect(drawingColor([0,1,1,0])).toEqual([255,0,0]);expect(drawingColor(0)).toEqual([0,0,0]);
    expect(drawingColor([1,0,0])).toEqual([255,0,0]);expect(drawingColor("Pattern1")).toBeNull();
    expect(drawingColor(NaN)).toBeNull();expect(drawingColor([2,0,0])).toBeNull();expect(drawingColor([0,0])).toBeNull();
    expect(filledColors(page())[0]).toMatchObject({key:"255,0,0",paths:1});
  });
});

describe("Rellenos triangulados de AutoCAD",()=>{
  const triangulated=(): PdfPage=>({...page(),paths:[
    {id:"tri-1",points:[[20,20],[220,20],[220,24]],closed:true,fill:[1,0,0],has_fill:true},
    {id:"tri-2",points:[[20,20],[220,24],[20,24]],closed:true,fill:[1,0,0],has_fill:true}
  ]});
  it("reconstruye la franja desde dos triángulos sin contar su diagonal",()=>{
    const result=proposeWallCandidates(triangulated(),rules);
    expect(result.candidates).toHaveLength(1);expect(result.duplicate_paths).toBe(0);
    expect(result.candidates[0]).toMatchObject({centerline:[[20,22],[220,22]],geometry:"triangle_pair",source_path_ids:["tri-1","tri-2"]});
  });
  it("deduplica caras repetidas sin perder su procedencia",()=>{
    const p=triangulated();p.paths.push({...p.paths[0],id:"tri-1-duplicado"});
    const result=proposeWallCandidates(p,rules);expect(result.candidates).toHaveLength(1);expect(result.duplicate_paths).toBe(1);
    expect(result.candidates[0].source_path_ids).toHaveLength(3);
  });
  it("no rellena triángulos aislados ni une caras de distinto color o por cercanía",()=>{
    const p=triangulated();p.paths.pop();expect(proposeWallCandidates(p,rules).candidates).toHaveLength(0);
    const other=triangulated();other.paths[1].fill=[0,1,0];
    expect(proposeWallCandidates(other,[...rules,{color:[0,255,0],action:"build"}]).candidates).toHaveLength(0);
    other.paths[1].fill=[1,0,0];other.paths[1].points=[[20.1,20],[220.1,24],[20.1,24]];
    expect(proposeWallCandidates(other,rules).candidates).toHaveLength(0);
  });
});
