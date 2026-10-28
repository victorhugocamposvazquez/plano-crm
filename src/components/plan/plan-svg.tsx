"use client";
import type { MouseEvent } from "react";
import { drawingColor, colorCss, type PdfPage } from "@/lib/captura/pdf-extraction";
import type { Point } from "@/lib/captura/schema";
import type { Pared } from "@/lib/plano-flujo";

/**
 * El plano tal cual viene del PDF (trazos y rellenos), con las paredes propuestas y la medida de escala encima.
 * Tocar el dibujo devuelve coordenadas de página; tocar una pared devuelve su id.
 */
export function PlanSvg({ page, paredes = [], seleccionada, medida, onPick, onPared, label }: {
  page: PdfPage; paredes?: Pared[]; seleccionada?: string | null;
  medida?: { start: Point | null; end: Point | null; metros?: string };
  onPick?: (p: Point) => void; onPared?: (id: string) => void; label: string;
}) {
  const g = Math.max(page.width, page.height) / 320;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  function click(e: MouseEvent<SVGSVGElement>) {
    if (!onPick) return;
    const m = e.currentTarget.getScreenCTM(); if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    onPick([clamp(p.x, page.width), clamp(p.y, page.height)]);
  }
  const { start, end } = medida ?? { start: null, end: null };
  return (
    <svg viewBox={`0 0 ${page.width} ${page.height}`} className="plan-svg" data-picking={onPick ? "true" : undefined} onClick={click} role="img" aria-label={label}>
      <rect width={page.width} height={page.height} fill="#ffffff" />
      {page.paths.map(p => {
        const pts = p.points.map(q => q.join(",")).join(" ");
        const fill = p.has_fill ? drawingColor(p.fill) : null;
        if (fill) return <polygon key={p.id} points={pts} fill={colorCss(fill)} fillOpacity={0.4} stroke={p.has_stroke ? "#2a3540" : "none"} strokeWidth={g * 0.4} />;
        return <polyline key={p.id} points={p.closed ? `${pts} ${p.points[0].join(",")}` : pts} fill="none" stroke="#2a3540" strokeWidth={g * 0.55} strokeLinecap="round" strokeLinejoin="round" />;
      })}
      {paredes.map(w => (
        <line key={w.id} x1={w.centerline[0][0]} y1={w.centerline[0][1]} x2={w.centerline[1][0]} y2={w.centerline[1][1]} className="plan-wall" data-estado={w.estado} data-descartada={w.descartada || undefined} data-seleccionada={w.id === seleccionada || undefined} strokeWidth={g * (w.id === seleccionada ? 3.2 : 2.4)} strokeLinecap="round" onClick={e => { if (!onPared) return; e.stopPropagation(); onPared(w.id); }}><title>{w.nombre}{w.longitud ? ` · ${w.longitud} m` : ""}</title></line>
      ))}
      {start && end && <line x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} className="plan-measure" strokeWidth={g * 1.2} />}
      {start && <circle cx={start[0]} cy={start[1]} r={g * 2.6} className="plan-measure-dot" />}
      {end && <circle cx={end[0]} cy={end[1]} r={g * 2.6} className="plan-measure-dot" />}
      {start && end && medida?.metros && <text x={(start[0] + end[0]) / 2} y={(start[1] + end[1]) / 2 - g * 4} className="plan-measure-label" fontSize={g * 7} textAnchor="middle">{medida.metros} m</text>}
    </svg>
  );
}
