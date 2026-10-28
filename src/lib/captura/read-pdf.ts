import { pdfExtractionSchema, type PdfExtraction } from "./pdf-extraction";
import { decodeOperatorPage, type PdfReadStats } from "./pdf-operators";
type PdfModule=Pick<typeof import("pdfjs-dist"),"getDocument"|"OPS"|"AnnotationMode">;
export type PdfReadReport={pages:number;partial:boolean;stats:PdfReadStats;warnings:string[]};
export type PdfReadResult={extraction:PdfExtraction;report:PdfReadReport};
const aborted=()=>new DOMException("Lectura cancelada","AbortError");

/** El original se identifica antes de transferir sus bytes al trabajador de PDF.js. Sin servicios externos. */
export async function readPdfBytes(data:Uint8Array,pdfjs:PdfModule,options:{signal?:AbortSignal;onProgress?:(page:number,total:number)=>void}={}):Promise<PdfReadResult> {
  if(data.byteLength===0 || data.byteLength>50*1024*1024)throw new Error("El PDF debe tener contenido y ocupar como máximo 50 MB.");
  if(options.signal?.aborted)throw aborted();
  const header=new TextDecoder().decode(data.subarray(0,1024));
  if(!header.includes("%PDF-"))throw new Error("El archivo no contiene un PDF válido.");
  const digest=await crypto.subtle.digest("SHA-256",new Uint8Array(data));
  const sha256=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,"0")).join("");
  if(options.signal?.aborted)throw aborted();
  const task=pdfjs.getDocument({data,stopAtErrors:true,disableFontFace:true,useWasm:false,enableXfa:false});
  let password=false,timedOut=false;
  task.onPassword=()=>{password=true;void task.destroy();};
  const cancel=()=>{void task.destroy();};options.signal?.addEventListener("abort",cancel,{once:true});
  const timeout=setTimeout(()=>{timedOut=true;cancel();},45000);
  try {
    const doc=await task.promise;
    if(doc.numPages>20)throw new Error("La lectura rápida admite hasta 20 páginas. Divide este expediente por planos.");
    const layers=await doc.getOptionalContentConfig({intent:"display"});
    const pages:PdfExtraction["pages"]=[],stats:PdfReadStats={paths:0,curves:0,compoundFills:0,clipped:0,unsupported:0,images:0,hidden:0};
    for(let n=1;n<=doc.numPages;n++) {
      if(options.signal?.aborted)throw aborted();
      const page=await doc.getPage(n),viewport=page.getViewport({scale:1});
      try {
        const operators=await page.getOperatorList({intent:"display",annotationMode:pdfjs.AnnotationMode.DISABLE});
        const decoded=decodeOperatorPage({page:n,width:viewport.width,height:viewport.height,viewport:viewport.transform,operators,ops:pdfjs.OPS,
          isVisible:group=>layers.isVisible(group as Parameters<typeof layers.isVisible>[0])});
        pages.push(decoded.page);for(const key of Object.keys(stats) as (keyof PdfReadStats)[])stats[key]+=decoded.stats[key];
        if(stats.paths>50000)throw new Error("El PDF supera el límite de trazos de la lectura rápida. Divide el expediente por hojas.");
        options.onProgress?.(n,doc.numPages);
      } finally {page.cleanup();}
    }
    const warnings:string[]=[];
    if(stats.curves)warnings.push(`${stats.curves} contornos curvos sin medición automática.`);
    if(stats.compoundFills)warnings.push(`${stats.compoundFills} rellenos con varios contornos pendientes de interpretar.`);
    if(stats.clipped)warnings.push(`${stats.clipped} trazos recortados omitidos para no medir partes invisibles.`);
    if(stats.unsupported)warnings.push(`${stats.unsupported} elementos o efectos de dibujo no compatibles.`);
    if(!stats.paths)warnings.push("No se han obtenido trazos medibles. Si es un escaneo o una imagen, hace falta otra fuente de medidas.");
    if(stats.images)warnings.push("El PDF contiene imágenes: no se extraen medidas de sus píxeles.");
    return {extraction:pdfExtractionSchema.parse({schema_version:1,kind:"pdf_geometry",sha256,pages}),report:{pages:pages.length,stats,partial:stats.curves+stats.compoundFills+stats.clipped+stats.unsupported>0 || stats.paths===0,warnings}};
  } catch(error) {
    if(options.signal?.aborted)throw aborted();
    if(password)throw new Error("El PDF está protegido. Sube una copia sin contraseña para leer el plano.");
    if(timedOut)throw new Error("La lectura ha tardado demasiado. Prueba con una hoja del plano o un PDF más sencillo.");
    throw error;
  } finally {clearTimeout(timeout);options.signal?.removeEventListener("abort",cancel);await task.destroy();}
}
