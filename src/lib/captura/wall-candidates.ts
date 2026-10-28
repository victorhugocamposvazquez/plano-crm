import { z } from "zod";
import { colorKey,drawingColor,pdfPageSchema,type PdfPath,type RGB } from "./pdf-extraction";
import { polygonArea } from "./geometry";
import type { Point } from "./schema";

export const legendRuleSchema=z.object({
  color:z.tuple([z.number().int().min(0).max(255),z.number().int().min(0).max(255),z.number().int().min(0).max(255)]),
  action:z.enum(["demolish","build","ignore"])
}).strict();
export type LegendRule=z.infer<typeof legendRuleSchema>;
export type WallCandidate={
  id:string;source_path_ids:string[];page:number;action:"demolish"|"build";
  color:RGB;centerline:[Point,Point];thickness_drawing_units:number;
  status:"proposal";geometry:"rectangle"|"triangle_pair";duplicate_path_count:number;reason:string;
};
const distance=(a:Point,b:Point)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const midpoint=(a:Point,b:Point): Point=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);

function rectangleAxis(path:PdfPath) {
  let points=path.points.slice();
  if(distance(points[0],points.at(-1)!)<1e-7) points.pop();
  // Eliminar únicamente vértices intermedios que siguen en la misma dirección.
  let changed=true;
  while(changed && points.length>4) {
    changed=false;
    for(let i=0;i<points.length;i++) {
      const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length];
      const length=distance(a,b)*distance(b,c);
      const dot=(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]);
      if(length>0 && Math.abs(cross(a,b,c))/length<1e-6 && dot>0) {points.splice(i,1);changed=true;break;}
    }
  }
  if(points.length!==4) return null;
  try {polygonArea(points);} catch {return null;}
  const edges=points.map((p,i)=>[points[(i+1)%4][0]-p[0],points[(i+1)%4][1]-p[1]] as Point);
  const lengths=edges.map(v=>Math.hypot(...v));
  if(Math.min(...lengths)<1e-5) return null;
  for(let i=0;i<4;i++) {
    const next=(i+1)%4;
    if(Math.abs(edges[i][0]*edges[next][0]+edges[i][1]*edges[next][1])/(lengths[i]*lengths[next])>0.01) return null;
    if(Math.abs(lengths[i]-lengths[(i+2)%4])/Math.max(lengths[i],lengths[(i+2)%4])>0.02) return null;
  }
  const long=Math.max(...lengths),short=Math.min(...lengths);
  if(long/short<5) return null;
  const offset=lengths[0]>=lengths[1] ? 1 : 0;
  const ends=[midpoint(points[offset],points[(offset+1)%4]),midpoint(points[(offset+2)%4],points[(offset+3)%4])];
  ends.sort((a,b)=>a[0]-b[0] || a[1]-b[1]);
  return {centerline:ends as [Point,Point],thickness:(lengths[offset]+lengths[(offset+2)%4])/2};
}

function trianglePoints(path:PdfPath) {
  const points=path.points.slice();
  if(distance(points[0],points.at(-1)!)<1e-7) points.pop();
  if(points.length!==3) return null;
  try {polygonArea(points);} catch {return null;}
  return points;
}
const pointKey=(p:Point)=>p.map(v=>v.toFixed(4)).join(",");
function longestEdgeKey(points:Point[]) {
  const edges=points.map((p,i)=>({ends:[p,points[(i+1)%3]],length:distance(p,points[(i+1)%3])}));
  edges.sort((a,b)=>b.length-a.length);
  return edges[0].ends.map(pointKey).sort().join("|");
}

/** Detector conservador de franjas rellenas. Requiere leyenda explícita; nunca confirma un muro. */
export function proposeWallCandidates(rawPage:unknown,rawRules:unknown) {
  const page=pdfPageSchema.parse(rawPage),rules=z.array(legendRuleSchema).max(100).parse(rawRules);
  const ruleMap=new Map<string,LegendRule>();
  for(const rule of rules) {
    const key=colorKey(rule.color);
    if(ruleMap.has(key)) throw new Error("Cada color debe tener un único significado en esta página.");
    ruleMap.set(key,rule);
  }
  const found=new Map<string,WallCandidate>();
  const skipped={no_rule:0,ignored:0,not_filled:0,unsupported_shape:0,outside_page:0};
  type Triangle={points:Point[];ids:string[];rule:LegendRule};
  const triangles=new Map<string,Triangle>();
  function add(axis:NonNullable<ReturnType<typeof rectangleAxis>>,ids:string[],rule:LegendRule,geometry:WallCandidate["geometry"],duplicates=0) {
    const key=[rule.action,colorKey(rule.color),...axis.centerline.flat().map(v=>v.toFixed(4)),axis.thickness.toFixed(4)].join(":");
    const existing=found.get(key);
    if(existing) {existing.source_path_ids.push(...ids);existing.duplicate_path_count+=ids.length;return;}
    found.set(key,{
      id:`${page.page}:${ids[0]}:${rule.action}`,source_path_ids:ids,page:page.page,action:rule.action as "demolish"|"build",
      color:rule.color,centerline:axis.centerline,thickness_drawing_units:axis.thickness,status:"proposal",geometry,duplicate_path_count:duplicates,
      reason:geometry==="triangle_pair" ? "Franja rectangular reconstruida desde dos triángulos de relleno. Confirmar tabique, encuentros y huecos." :
        "Franja rectangular rellena y alargada. Confirmar que representa un tabique y revisar encuentros y huecos."
    });
  }
  for(const path of page.paths) {
    if(!path.has_fill) {skipped.not_filled++;continue;}
    const color=drawingColor(path.fill),rule=color ? ruleMap.get(colorKey(color)) : undefined;
    if(!rule) {skipped.no_rule++;continue;}
    if(rule.action==="ignore") {skipped.ignored++;continue;}
    if(path.points.some(([x,y])=>x>page.width || y>page.height)) {skipped.outside_page++;continue;}
    const axis=path.closed && rectangleAxis(path);
    if(axis) {add(axis,[path.id],rule,"rectangle");continue;}
    const points=path.closed && trianglePoints(path);
    if(points) {
      const key=[rule.action,colorKey(rule.color),...points.map(pointKey).sort()].join(":");
      const existing=triangles.get(key);
      if(existing) existing.ids.push(path.id); else triangles.set(key,{points,ids:[path.id],rule});
    } else skipped.unsupported_shape++;
  }
  // AutoCAD puede exportar un relleno rectangular como dos triángulos. Solo unir
  // parejas que comparten su diagonal y reconstruyen un rectángulo; no unir por proximidad.
  const edges=new Map<string,Triangle[]>();
  for(const tri of triangles.values()) {
    const key=[tri.rule.action,colorKey(tri.rule.color),longestEdgeKey(tri.points)].join(":");
    edges.set(key,[...(edges.get(key) ?? []),tri]);
  }
  for(const bucket of edges.values()) {
    if(bucket.length!==2) {skipped.unsupported_shape+=bucket.reduce((sum,t)=>sum+t.ids.length,0);continue;}
    const [a,b]=bucket;
    const points=[...new Map([...a.points,...b.points].map(p=>[pointKey(p),p])).values()];
    if(points.length!==4) {skipped.unsupported_shape+=a.ids.length+b.ids.length;continue;}
    const center:Point=[points.reduce((s,p)=>s+p[0],0)/4,points.reduce((s,p)=>s+p[1],0)/4];
    points.sort((a,b)=>Math.atan2(a[1]-center[1],a[0]-center[0])-Math.atan2(b[1]-center[1],b[0]-center[0]));
    const axis=rectangleAxis({id:"joined",points,closed:true});
    const area=polygonArea(points),triArea=polygonArea(a.points)+polygonArea(b.points);
    if(!axis || Math.abs(area-triArea)>Math.max(area,1)*1e-6) {skipped.unsupported_shape+=a.ids.length+b.ids.length;continue;}
    add(axis,[...a.ids,...b.ids],a.rule,"triangle_pair",a.ids.length+b.ids.length-2);
  }
  return {candidates:[...found.values()],skipped,duplicate_paths:[...found.values()].reduce((sum,c)=>sum+c.duplicate_path_count,0),
    limitations:["No detecta muros curvos ni contornos irregulares, ni une tramos contiguos.",
      "Puede proponer otros elementos alargados del plano; requiere revisión.",
      "Un trazo sin relleno no se interpreta como tabique en este detector."]};
}
