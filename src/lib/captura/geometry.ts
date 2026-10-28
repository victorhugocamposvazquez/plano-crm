import type { Point } from "./schema";

export class MeasurementError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
const fail = (message: string): never => { throw new MeasurementError("invalid_geometry", message); };
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cross = (a: Point, b: Point, c: Point) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const epsilon = 1e-8;
const onSegment = (a: Point, b: Point, p: Point) => Math.abs(cross(a,b,p)) < epsilon &&
  p[0] >= Math.min(a[0],b[0])-epsilon && p[0] <= Math.max(a[0],b[0])+epsilon &&
  p[1] >= Math.min(a[1],b[1])-epsilon && p[1] <= Math.max(a[1],b[1])+epsilon;
function intersects(a: Point,b: Point,c: Point,d: Point) {
  const abC=cross(a,b,c), abD=cross(a,b,d), cdA=cross(c,d,a), cdB=cross(c,d,b);
  return (abC*abD < 0 && cdA*cdB < 0) || onSegment(a,b,c) || onSegment(a,b,d) || onSegment(c,d,a) || onSegment(c,d,b);
}
export function metersPerDrawingUnit(start: Point, end: Point, meters: number) {
  const span = distance(start,end);
  if (span < epsilon || !Number.isFinite(meters) || meters <= 0) fail("La referencia de escala debe tener longitud positiva.");
  return meters/span;
}
export function polylineLength(points: Point[]) {
  if (points.length < 2) fail("Selecciona al menos dos puntos.");
  let total=0;
  for(let i=1;i<points.length;i++) {
    const segment=distance(points[i-1],points[i]);
    if(segment < epsilon) fail("La línea contiene puntos consecutivos repetidos.");
    total+=segment;
  }
  return total;
}
/** Polígono simple: no contornos cruzados, huecos implícitos ni áreas por caja envolvente. */
export function polygonArea(raw: Point[]) {
  const points = raw.length > 1 && distance(raw[0],raw[raw.length-1]) < epsilon ? raw.slice(0,-1) : raw;
  const n=points.length;
  if(n<3) fail("Selecciona un contorno de al menos tres puntos.");
  for(let i=0;i<n;i++) {
    const a=points[i], b=points[(i+1)%n], c=points[(i+2)%n];
    if(distance(a,b)<epsilon) fail("El contorno contiene puntos repetidos.");
    if(Math.abs(cross(a,b,c))<epsilon && (b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1])<0)
      fail("El contorno retrocede sobre un segmento.");
    for(let j=i+1;j<n;j++) {
      if(j===i+1 || (i===0 && j===n-1)) continue;
      if(intersects(a,b,points[j],points[(j+1)%n])) fail("El contorno se cruza o se toca a sí mismo.");
    }
  }
  const area=Math.abs(points.reduce((sum,a,i)=>{const b=points[(i+1)%n];return sum+a[0]*b[1]-b[0]*a[1];},0))/2;
  if(area<epsilon) fail("El contorno no tiene superficie.");
  return area;
}
