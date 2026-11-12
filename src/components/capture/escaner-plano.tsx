"use client";
import { useEffect, useRef } from "react";
import type { PlanoLeido } from "@/lib/planta-lector";

export type PasoLectura = { texto: string; estado: "hecho" | "ahora" | "luego" };

/** Recorta la hoja a la zona dibujada: los percentiles dejan fuera el marco y el cajetín. */
function zona(plano: PlanoLeido): [number, number, number, number] {
  const xs: number[] = [], ys: number[] = [], salto = Math.max(1, Math.floor(plano.trazos.length / 4000));
  for (let i = 0; i < plano.trazos.length; i += salto) { xs.push(plano.trazos[i].p[0]); ys.push(plano.trazos[i].p[1]); }
  if (xs.length < 20) return [0, 0, plano.ancho, plano.alto];
  xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
  const q = (v: number[], f: number) => v[Math.min(v.length - 1, Math.floor(v.length * f))];
  const x0 = q(xs, 0.03), x1 = q(xs, 0.97), y0 = q(ys, 0.03), y1 = q(ys, 0.97), mx = (x1 - x0) * 0.08, my = (y1 - y0) * 0.08;
  return [x0 - mx, y0 - my, x1 + mx, y1 + my];
}

/**
 * Espera de la conversión: el plano en 2D visto como por una cámara térmica mientras un haz lo recorre y Plano va diciendo qué hace.
 * Un solo dibujo en un lienzo 2D y un haz animado con CSS (solo `transform`): pesa poco y va igual en un móvil.
 */
export function EscanerPlano({ plano, pasos }: { plano: PlanoLeido | null; pasos: PasoLectura[] }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = lienzo.current, c = el?.getContext("2d");
    if (!el || !c || !plano) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = el.clientWidth * dpr, h = el.clientHeight * dpr;
    el.width = w; el.height = h; c.clearRect(0, 0, w, h);
    const [x0, y0, x1, y1] = zona(plano), k = Math.min(w / (x1 - x0), h / (y1 - y0)), ox = (w - (x1 - x0) * k) / 2 - x0 * k, oy = (h - (y1 - y0) * k) / 2 - y0 * k;
    c.globalCompositeOperation = "lighter"; c.lineCap = "round";
    // Muros y dibujo en rojo apagado, de una sola pasada; lo que el plano trae en color (equipos y tuberías), encendido.
    const vivos = new Map<string, Path2D>(), gris = new Path2D();
    for (const t of plano.trazos) {
      const [r, g, b] = t.color, croma = Math.max(r, g, b) - Math.min(r, g, b);
      let via = gris;
      if (croma >= 0.3) { const tono = `rgb(${Math.round(120 + r * 135)} ${Math.round(90 + g * 165)} ${Math.round(90 + b * 165)})`; via = vivos.get(tono) ?? new Path2D(); vivos.set(tono, via); }
      else if (r > 0.86) continue;
      via.moveTo(t.p[0] * k + ox, t.p[1] * k + oy);
      for (let i = 2; i < t.p.length; i += 2) via.lineTo(t.p[i] * k + ox, t.p[i + 1] * k + oy);
    }
    c.strokeStyle = "rgb(190 52 30 / 0.6)"; c.lineWidth = Math.max(1, dpr * 0.7); c.stroke(gris);
    c.lineWidth = Math.max(1.5, dpr * 1.3);
    for (const [tono, via] of vivos) { c.strokeStyle = tono; c.stroke(via); }
  }, [plano]);
  const ahora = pasos.find(p => p.estado === "ahora")?.texto ?? "";
  return <div className="p3d-escaner">
    <canvas ref={lienzo} aria-hidden="true" data-visto={plano ? true : undefined} />
    <i className="p3d-haz" aria-hidden="true" />
    <ol className="p3d-pasos" aria-hidden="true">{pasos.map(p => <li key={p.texto} data-estado={p.estado}>{p.texto}</li>)}</ol>
    <span className="sr-only" role="status">{ahora}</span>
  </div>;
}
