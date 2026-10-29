import { pdfPageSchema, type PdfPage, type PdfPath } from "./pdf-extraction";
import type { Point } from "./schema";

type Matrix=[number,number,number,number,number,number];
type Bounds=[number,number,number,number];
type Color=[number,number,number]|null;
type State={matrix:Matrix;fill:Color;stroke:Color;lineWidth:number;clip:Bounds;unsupportedClip:boolean;fillAlpha:number;strokeAlpha:number;unsupportedEffect:boolean};
export type PdfReadStats={paths:number;curves:number;compoundFills:number;clipped:number;unsupported:number;images:number;hidden:number};
export type OperatorPage={fnArray:number[];argsArray:unknown[]};
function matrix(raw:unknown):Matrix {
  const a=Array.from(raw as ArrayLike<number>);
  if(a.length!==6 || a.some(n=>!Number.isFinite(n))) throw new Error("El PDF contiene una transformación no válida.");
  return a as Matrix;
}
const multiply=(a:Matrix,b:Matrix):Matrix=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const transform=(a:Matrix,x:number,y:number):Point=>[a[0]*x+a[2]*y+a[4],a[1]*x+a[3]*y+a[5]];
const bounds=(ps:Point[]):Bounds=>[Math.min(...ps.map(p=>p[0])),Math.min(...ps.map(p=>p[1])),Math.max(...ps.map(p=>p[0])),Math.max(...ps.map(p=>p[1]))];
const intersect=(a:Bounds,b:Bounds):Bounds=>[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])];
const inside=(p:Point,b:Bounds)=>p[0]>=b[0]-0.001 && p[0]<=b[2]+0.001 && p[1]>=b[1]-0.001 && p[1]<=b[3]+0.001;
function color(raw:unknown):Color {
  if(typeof raw!=="string" || !/^#[0-9a-f]{6}$/i.test(raw)) return null;
  return [1,3,5].map(i=>parseInt(raw.slice(i,i+2),16)/255) as [number,number,number];
}
function rectangular(points:Point[]) {
  const ps=points.length>1 && Math.hypot(points[0][0]-points.at(-1)![0],points[0][1]-points.at(-1)![1])<0.001?points.slice(0,-1):points;
  if(ps.length!==4) return null;
  const b=bounds(ps),corners=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]];
  return corners.every(p=>ps.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<0.001))?b:null;
}

/** Lee solo contornos lineales. Las curvas y los recortes complejos se declaran, nunca se aproximan a metros. */
export function decodeOperatorPage(input:{page:number;width:number;height:number;viewport:readonly number[];operators:OperatorPage;ops:Record<string,number>;isVisible?:(group:unknown)=>boolean}) {
  const {ops,operators}=input;
  if(operators.fnArray.length>250000) throw new Error("Este plano es demasiado complejo para la lectura rápida. Divide el PDF por hojas.");
  let state:State={matrix:matrix(input.viewport),fill:[0,0,0],stroke:[0,0,0],lineWidth:1,clip:[0,0,input.width,input.height],unsupportedClip:false,fillAlpha:1,strokeAlpha:1,unsupportedEffect:false};
  const stack:State[]=[],visibility:boolean[]=[true],paths:PdfPath[]=[];
  const stats:PdfReadStats={paths:0,curves:0,compoundFills:0,clipped:0,unsupported:0,images:0,hidden:0};
  let pendingClip=false;
  const save=()=>{if(stack.length>=100)throw new Error("El PDF contiene demasiados niveles de dibujo.");stack.push({...state,matrix:[...state.matrix],clip:[...state.clip]});};
  const restore=()=>{const previous=stack.pop();if(!previous)throw new Error("El estado gráfico del PDF está incompleto.");state=previous;pendingClip=false;};
  const fills=new Set([ops.fill,ops.eoFill,ops.fillStroke,ops.eoFillStroke,ops.closeFillStroke,ops.closeEOFillStroke]);
  const strokes=new Set([ops.stroke,ops.closeStroke,ops.fillStroke,ops.eoFillStroke,ops.closeFillStroke,ops.closeEOFillStroke]);
  function applyBox(raw:unknown) {
    const b=Array.from(raw as ArrayLike<number>);if(b.length!==4 || b.some(n=>!Number.isFinite(n))) {state.unsupportedClip=true;return;}
    const ps=[transform(state.matrix,b[0],b[1]),transform(state.matrix,b[2],b[1]),transform(state.matrix,b[2],b[3]),transform(state.matrix,b[0],b[3])];
    const rect=rectangular(ps);if(rect)state.clip=intersect(state.clip,rect);else state.unsupportedClip=true;
  }
  for(let index=0;index<operators.fnArray.length;index++) {
    const fn=operators.fnArray[index],args=(operators.argsArray[index] ?? []) as unknown[];
    if(fn===ops.save) {save();continue;}
    if(fn===ops.restore) {restore();continue;}
    if(fn===ops.transform) {state.matrix=multiply(state.matrix,matrix(args));continue;}
    if(fn===ops.setFillRGBColor) {state.fill=color(args[0]);continue;}
    if(fn===ops.setStrokeRGBColor) {state.stroke=color(args[0]);continue;}
    if(fn===ops.setFillTransparent) {state.fill=null;continue;}
    if(fn===ops.setStrokeTransparent) {state.stroke=null;continue;}
    if(fn===ops.setFillColorN) {state.fill=null;stats.unsupported++;continue;}
    if(fn===ops.setStrokeColorN) {state.stroke=null;stats.unsupported++;continue;}
    if(fn===ops.setLineWidth) {state.lineWidth=Number(args[0]);continue;}
    if(fn===ops.setGState) {
      for(const [key,value] of args[0] as [string,unknown][]) {
        if(key==="ca")state.fillAlpha=Number(value);
        if(key==="CA")state.strokeAlpha=Number(value);
        if(key==="SMask" && value!==false || key==="BM" && value!=="source-over")state.unsupportedEffect=true;
      }continue;
    }
    if(fn===ops.beginMarkedContent || fn===ops.beginMarkedContentProps) {
      if(visibility.length>100)throw new Error("El PDF contiene demasiadas capas anidadas.");
      visibility.push(visibility.at(-1)! && (args[0]!=="OC" || Boolean(input.isVisible?.(args[1]))));continue;
    }
    if(fn===ops.endMarkedContent) {if(visibility.length<=1)throw new Error("Las capas del PDF están incompletas.");visibility.pop();continue;}
    if(fn===ops.paintFormXObjectBegin || fn===ops.beginGroup) {
      save();const group=fn===ops.beginGroup?args[0] as {matrix?:number[];bbox?:number[];smask?:unknown}:null;
      const m=group?group.matrix:args[0];if(m)state.matrix=multiply(state.matrix,matrix(m));
      const b=group?group.bbox:args[1];if(b)applyBox(b);
      if(group?.smask)state.unsupportedEffect=true;continue;
    }
    if(fn===ops.paintFormXObjectEnd || fn===ops.endGroup) {restore();continue;}
    if(fn===ops.clip || fn===ops.eoClip) {pendingClip=true;continue;}
    if([ops.paintImageXObject,ops.paintInlineImageXObject,ops.paintImageMaskXObject,ops.paintImageXObjectRepeat,ops.paintImageMaskXObjectRepeat,ops.paintInlineImageXObjectGroup].includes(fn)) {if(visibility.at(-1))stats.images++;continue;}
    if(fn===ops.rawFillPath || fn===ops.shadingFill) {stats.unsupported++;continue;}
    if(fn!==ops.constructPath) continue;
    const paint=Number(args[0]),data=(args[1] as [ArrayLike<number>|null])?.[0];
    if(!data) {if(pendingClip){state.unsupportedClip=true;pendingClip=false;}continue;}
    const contours:{points:Point[];closed:boolean;curve:boolean}[]=[];
    let current:{points:Point[];closed:boolean;curve:boolean}|null=null;
    for(let i=0;i<data.length;) {
      const op=data[i++];
      if(op===0) {current={points:[],closed:false,curve:false};contours.push(current);}
      if(!current)throw new Error("El PDF contiene un trazado sin punto inicial.");
      if(op===0 || op===1) {
        const x=data[i++],y=data[i++];if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error("El PDF contiene coordenadas no válidas.");
        current.points.push(transform(state.matrix,x,y));
      } else if(op===2 || op===3) {current.curve=true;i+=op===2?6:4;}
      else if(op===4) current.closed=true;
      else throw new Error("El PDF contiene una instrucción de dibujo no compatible.");
      if(current.points.length>500)throw new Error("Un contorno supera el límite de la lectura rápida.");
    }
    if(pendingClip) {
      const rect=contours.length===1 && !contours[0].curve?rectangular(contours[0].points):null;
      if(rect)state.clip=intersect(state.clip,rect);else state.unsupportedClip=true;
      pendingClip=false;
    }
    if(paint===ops.endPath) continue;
    if(!visibility.at(-1)) {stats.hidden++;continue;}
    const hasFill=fills.has(paint) && state.fillAlpha>0,hasStroke=strokes.has(paint) && state.strokeAlpha>0;
    if(!hasFill && !hasStroke) continue;
    if(hasFill && contours.length>1) {stats.compoundFills++;continue;}
    for(let c=0;c<contours.length;c++) {
      const contour=contours[c];
      if(contour.curve) {stats.curves++;continue;}
      if(state.unsupportedClip || state.unsupportedEffect) {stats.unsupported++;continue;}
      if(contour.points.length<2)continue;
      if(!contour.points.every(p=>inside(p,state.clip))) {stats.clipped++;continue;}
      const points=contour.points.map(([x,y])=>[Math.max(0,Math.min(input.width,x)),Math.max(0,Math.min(input.height,y))] as Point);
      const fill=hasFill?state.fill:null,stroke=hasStroke?state.stroke:null;
      if(!fill && !stroke) {stats.unsupported++;continue;}
      paths.push({id:`p${input.page}:op${index}:c${c}`,points,closed:contour.closed || Boolean(fill),fill,stroke,has_fill:Boolean(fill),has_stroke:Boolean(stroke),
        line_width:Math.min(1000,Math.max(0,state.lineWidth*Math.sqrt(Math.abs(state.matrix[0]*state.matrix[3]-state.matrix[1]*state.matrix[2]))))});
      if(paths.length>12000)throw new Error("Este plano tiene demasiados trazos para la vista rápida. Divide la hoja o usa un plano simplificado.");
    }
  }
  stats.paths=paths.length;
  const page:PdfPage=pdfPageSchema.parse({page:input.page,width:input.width,height:input.height,coordinate_system:"pdf_points_top_left_rotation_applied",paths});
  return {page,stats,partial:stats.curves+stats.compoundFills+stats.clipped+stats.unsupported>0};
}

