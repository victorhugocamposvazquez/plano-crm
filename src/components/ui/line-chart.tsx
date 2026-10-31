"use client";
import { useId, useState } from "react";

export type LineSeries = { id: string; label: string; color: string; values: number[] };

/** Curva suave (Catmull-Rom a Bézier) de borde a borde; los controles no bajan de la línea base. */
export function curva(points: [number, number][], base: number) {
  if (!points.length) return "";
  if (points.length === 1) return `M0 ${points[0][1]}L100 ${points[0][1]}`;
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] ?? p2;
    const c1y = Math.min(base, p1[1] + (p2[1] - p0[1]) / 6), c2y = Math.min(base, p2[1] - (p3[1] - p1[1]) / 6);
    d += `C${p1[0] + (p2[0] - p0[0]) / 6} ${c1y} ${p2[0] - (p3[0] - p1[0]) / 6} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Máximo redondo para las guías: 1, 2 o 5 por potencia de diez. */
export function techo(valor: number) {
  if (valor <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(valor)), n = valor / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const W = 100, H = 100;

/** Gráfico de líneas sin librería: un solo eje, guías discontinuas y cruz con tooltip al pasar por encima. */
export function LineChart({ labels, series, format, formatAxis, ariaLabel }: { labels: string[]; series: LineSeries[]; format: (v: number) => string; formatAxis: (v: number) => string; ariaLabel: string }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const max = techo(Math.max(0, ...series.flatMap(s => s.values)));
  const guias = [1, 0.75, 0.5, 0.25, 0].map(f => f * max);
  const x = (i: number) => (labels.length < 2 ? W / 2 : (i / (labels.length - 1)) * W), y = (v: number) => H - (v / max) * H;
  return (
    <div className="line-chart" role="img" aria-label={ariaLabel}>
      <div className="line-chart-plot" onMouseLeave={() => setHover(null)}>
        {guias.map(g => <div key={g} className="line-chart-grid" style={{ top: `${y(g)}%` }}><span>{formatAxis(g)}</span></div>)}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>{series.map(s => <linearGradient key={s.id} id={`${id}-${s.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity="0.16" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient>)}</defs>
          {series.map(s => { const d = curva(s.values.map((v, i) => [x(i), y(v)]), H); return <g key={s.id}><path d={`${d}L${W} ${H}L0 ${H}Z`} fill={`url(#${id}-${s.id})`} /><path d={d} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" /></g>; })}
        </svg>
        {hover !== null && <>
          <div className="line-chart-cross" style={{ left: `${x(hover)}%` }} />
          {series.map(s => <span key={s.id} className="line-chart-dot" style={{ left: `${x(hover)}%`, top: `${y(s.values[hover])}%`, background: s.color }} />)}
          <div className="line-chart-tip" data-flip={x(hover) > 60 || undefined} style={{ left: `${x(hover)}%` }}>
            <strong>{labels[hover]}</strong>
            {series.map(s => <div key={s.id}><span><i style={{ background: s.color }} />{s.label}</span><span className="pl-mono">{format(s.values[hover])}</span></div>)}
          </div>
        </>}
        <div className="line-chart-hits">{labels.map((l, i) => <div key={`${l}-${i}`} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />)}</div>
      </div>
      <div className="line-chart-labels" aria-hidden="true">{labels.map((l, i) => <span key={`${l}-${i}`} style={{ left: `${x(i)}%` }} data-edge={i === 0 ? "start" : i === labels.length - 1 ? "end" : undefined}>{l}</span>)}</div>
    </div>
  );
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  const puntos = values.map((v, i): [number, number] => [values.length < 2 ? 50 : (i / (values.length - 1)) * 100, 28 - (v / max) * 24]);
  return <svg className="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d={curva(puntos, 28)} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>;
}
