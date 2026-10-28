import {describe,it,expect} from "vitest";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {readPdfBytes} from "../../src/lib/captura/read-pdf";
import {decodeOperatorPage,type OperatorPage} from "../../src/lib/captura/pdf-operators";
import {proposeWallCandidates} from "../../src/lib/captura/wall-candidates";
const ops=pdfjs.OPS;
const path=(paint:number,coords:number[])=>[paint,[new Float32Array(coords)],new Float32Array([0,0,100,100])];
const rectangle=[0,10,20,1,90,20,1,90,24,1,10,24,4];
const decode=(pairs:[number,unknown][],extra={})=>decodeOperatorPage({page:1,width:100,height:100,viewport:[1,0,0,1,0,0],operators:{fnArray:pairs.map(p=>p[0]),argsArray:pairs.map(p=>p[1])} as OperatorPage,ops,...extra});

/** PDF sintético completo: offsets y tabla xref válidos, sin archivos privados. */
export function syntheticPdf(stream="1 0 0 rg 10 20 80 4 re f",rotate=0) {
  const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>",`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Rotate ${rotate} /Resources << >> /Contents 4 0 R >>`,`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf="%PDF-1.4\n";const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=pdf.length;pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>n.toString().padStart(10,"0")+" 00000 n \n").join("")}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
describe("Operadores PDF: geometría conservada y límites explícitos",()=>{
 it("conserva relleno, dimensiones y orientación, sin usar la caja envolvente como polígono",()=>{
  const r=decode([[ops.setFillRGBColor,["#ff0000"]],[ops.constructPath,path(ops.fill,rectangle)]]);
  expect(r.partial).toBe(false);expect(r.page.paths[0]).toMatchObject({fill:[1,0,0],has_fill:true,closed:true});
  const candidates=proposeWallCandidates(r.page,[{color:[255,0,0],action:"demolish"}]);expect(candidates.candidates).toHaveLength(1);
  expect(candidates.candidates[0].centerline).toEqual([[10,22],[90,22]]);
 });
 it("aplica transformaciones anidadas y restaura colores y matrices",()=>{
  const r=decode([[ops.save,null],[ops.transform,[0.5,0,0,0.5,5,10]],[ops.setFillRGBColor,["#00ff00"]],[ops.constructPath,path(ops.fill,rectangle)],[ops.restore,null],[ops.constructPath,path(ops.fill,rectangle)]]);
  expect(r.page.paths[0].points[0]).toEqual([10,20]);expect(r.page.paths[0].fill).toEqual([0,1,0]);
  expect(r.page.paths[1].points[0]).toEqual([10,20]);expect(r.page.paths[1].fill).toEqual([0,0,0]);
 });
 it("no endereza curvas ni rellena huecos de polígonos compuestos",()=>{
  const curved=[0,10,20,2,20,20,60,24,90,24,4];
  const r=decode([[ops.constructPath,path(ops.fill,curved)],[ops.constructPath,path(ops.eoFill,[...rectangle,...rectangle])]]);
  expect(r.page.paths).toHaveLength(0);expect(r.stats).toMatchObject({curves:1,compoundFills:1});expect(r.partial).toBe(true);
 });
 it("omite trazos fuera del recorte y vuelve a leerlos al restaurar el estado",()=>{
  const r=decode([[ops.save,null],[ops.clip,null],[ops.constructPath,path(ops.endPath,[0,0,0,1,50,0,1,50,50,1,0,50,4])],[ops.constructPath,path(ops.fill,rectangle)],[ops.restore,null],[ops.constructPath,path(ops.fill,rectangle)]]);
  expect(r.page.paths).toHaveLength(1);expect(r.stats.clipped).toBe(1);expect(r.partial).toBe(true);
 });
 it("respeta capas ocultas y rellenos completamente transparentes",()=>{
  const r=decode([[ops.beginMarkedContentProps,["OC",{id:"oculto"}]],[ops.constructPath,path(ops.fill,rectangle)],[ops.endMarkedContent,null],[ops.setGState,[[["ca",0]]]],[ops.constructPath,path(ops.fill,rectangle)]],{isVisible:()=>false});
  expect(r.page.paths).toHaveLength(0);expect(r.stats.hidden).toBe(1);
 });
 it("no ignora recortes irregulares, efectos ni patrones que puedan alterar la geometría visible",()=>{
  const r=decode([[ops.clip,null],[ops.constructPath,path(ops.endPath,[0,0,0,1,100,0,1,50,100,4])],[ops.constructPath,path(ops.fill,rectangle)]]);
  expect(r.page.paths).toHaveLength(0);expect(r.stats.unsupported).toBe(1);expect(r.partial).toBe(true);
 });
});
describe("Lectura directa de PDF",()=>{
 it("lee un PDF real sintético y conserva el SHA256 del archivo original",async()=>{
  const data=syntheticPdf(),expected=Buffer.from(await crypto.subtle.digest("SHA-256",data)).toString("hex");
  const r=await readPdfBytes(data,pdfjs);
  expect(r.extraction.sha256).toBe(expected);expect(r.extraction.pages[0].paths).toHaveLength(1);
  expect(r.extraction.pages[0].paths[0].points[0]).toEqual([10,80]);expect(r.report.partial).toBe(false);
 });
 it("aplica la rotación de página antes de medir o presentar el plano",async()=>{
  const r=await readPdfBytes(syntheticPdf(undefined,90),pdfjs);
  expect(r.extraction.pages[0].paths[0].points[0]).toEqual([20,10]);
 });
 it("un documento sin geometría medible queda pendiente, sin inventar medidas",async()=>{
  const r=await readPdfBytes(syntheticPdf(""),pdfjs);expect(r.report.partial).toBe(true);expect(r.report.warnings.join(" ")).toContain("No se han obtenido trazos medibles");
 });
 it("no convierte una imagen incrustada en geometría medible",async()=>{
  const r=await readPdfBytes(syntheticPdf("q 80 0 0 80 10 10 cm BI /W 1 /H 1 /BPC 8 /CS /RGB /F /AHx ID ff0000> EI Q"),pdfjs);
  expect(r.extraction.pages[0].paths).toHaveLength(0);expect(r.report.stats.images).toBe(1);
  expect(r.report.partial).toBe(true);expect(r.report.warnings.join(" ")).toContain("no se extraen medidas de sus píxeles");
 });
 it("rechaza archivos incorrectos y respeta cancelación previa",async()=>{
  await expect(readPdfBytes(new TextEncoder().encode("esto no es un pdf"),pdfjs)).rejects.toThrow("PDF válido");
  const controller=new AbortController();controller.abort();
  await expect(readPdfBytes(syntheticPdf(),pdfjs,{signal:controller.signal})).rejects.toMatchObject({name:"AbortError"});
 });
});
