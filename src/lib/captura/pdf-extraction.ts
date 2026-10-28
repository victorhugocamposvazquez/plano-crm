import { z } from "zod";
import { pointSchema } from "./schema";

const colorSchema=z.union([z.number().finite(),z.array(z.number().finite()).max(4),z.string().max(100),z.null()]).optional();
export const pdfPathSchema=z.object({
  id:z.string().min(1).max(120),points:z.array(pointSchema).min(2).max(500),closed:z.boolean(),
  stroke:colorSchema,fill:colorSchema,has_stroke:z.boolean().optional(),has_fill:z.boolean().optional(),
  line_width:z.number().finite().nonnegative().max(1000).nullable().optional()
});
export const pdfPageSchema=z.object({
  page:z.number().int().positive(),width:z.number().positive().max(100000),height:z.number().positive().max(100000),
  coordinate_system:z.literal("pdf_points_top_left_rotation_applied"),paths:z.array(pdfPathSchema).max(50000)
}).superRefine((page,ctx)=>{
  if(new Set(page.paths.map(p=>p.id)).size!==page.paths.length)
    ctx.addIssue({code:"custom",path:["paths"],message:"Hay identificadores de trazado repetidos."});
});
export const pdfExtractionSchema=z.object({
  schema_version:z.literal(1),kind:z.literal("pdf_geometry"),sha256:z.string().regex(/^[a-f0-9]{64}$/),
  pages:z.array(pdfPageSchema).min(1).max(200)
}).superRefine((value,ctx)=>{
  if(new Set(value.pages.map(p=>p.page)).size!==value.pages.length)
    ctx.addIssue({code:"custom",path:["pages"],message:"Hay páginas repetidas."});
});
export type PdfPath=z.infer<typeof pdfPathSchema>;
export type PdfPage=z.infer<typeof pdfPageSchema>;
export type PdfExtraction=z.infer<typeof pdfExtractionSchema>;
export type RGB=[number,number,number];

/** Colores de los originales: gris, RGB y CMYK básicos. Los patrones quedan sin interpretar. */
export function drawingColor(value: PdfPath["fill"]): RGB | null {
  const c=typeof value==="number" ? [value] : value;
  if(!Array.isArray(c) || ![1,3,4].includes(c.length) || c.some(v=>!Number.isFinite(v) || v<0 || v>1)) return null;
  const rgb: number[]=c.length===1 ? [c[0],c[0],c[0]] : c.length===3 ? c :
    [1-Math.min(1,c[0]+c[3]),1-Math.min(1,c[1]+c[3]),1-Math.min(1,c[2]+c[3])];
  return rgb.map(v=>Math.round(v*255)) as RGB;
}
export const colorKey=(color: RGB)=>color.join(",");
export const colorCss=(color: RGB)=>`rgb(${color.join(" ")})`;
export function filledColors(page: PdfPage) {
  const groups=new Map<string,{key:string;color:RGB;paths:number}>();
  for(const path of page.paths) {
    const color=path.has_fill && drawingColor(path.fill); if(!color) continue;
    const key=colorKey(color),group=groups.get(key);
    if(group) group.paths++; else groups.set(key,{key,color,paths:1});
  }
  return [...groups.values()].sort((a,b)=>b.paths-a.paths || a.key.localeCompare(b.key));
}
