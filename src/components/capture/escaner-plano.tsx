"use client";
import { useEffect, useRef } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FaseLectura, Lectura } from "./plano-en-3d";
import type { PlanoLeido } from "@/lib/planta-lector";
import { pintarTrazos } from "@/lib/visual/lamina-plano";

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
    pintarTrazos(c, plano, k, ox, oy, dpr);
  }, [plano]);
  const ahora = pasos.find(p => p.estado === "ahora")?.texto ?? "";
  return <div className="p3d-escaner">
    <canvas ref={lienzo} aria-hidden="true" data-visto={plano ? true : undefined} />
    <i className="p3d-haz" aria-hidden="true" />
    <ol className="p3d-pasos" aria-hidden="true">{pasos.map(p => <li key={p.texto} data-estado={p.estado}>{p.texto}</li>)}</ol>
    <span className="sr-only" role="status">{ahora}</span>
  </div>;
}

const fases: FaseLectura[] = ["abrir", "texto", "trazos", "medir"];
/** La lectura de un plano dentro del escenario: el escáner mientras se lee, o el aviso si no se puede (plano sin texto incluido). */
export function LecturaPlano({ lectura, alElegir, alCerrar }: { lectura: Lectura; alElegir: (file: File) => void; alCerrar?: () => void }) {
  if (lectura.fase !== "error") {
    const ahora = fases.indexOf(lectura.fase);
    const pasos: PasoLectura[] = ["Abriendo el plano", lectura.rotulos ? `Leyendo rótulos: ${lectura.rotulos} textos` : "Leyendo rótulos", "Recogiendo los trazos del dibujo", "Buscando muros y midiendo recintos"].map((texto, i) => ({ texto, estado: i < ahora ? "hecho" : i === ahora ? "ahora" : "luego" }));
    return <EscanerPlano plano={lectura.plano} pasos={pasos} />;
  }
  return <div className="p3d-aviso" role="alert">
    <TriangleAlert size={22} strokeWidth={1.6} aria-hidden="true" />
    <strong>{lectura.sinTexto ? "Este plano viene sin texto" : "No se ha podido leer el plano"}</strong>
    <p>{lectura.sinTexto ? `Los rótulos de «${lectura.archivo}» están dibujados como trazos, no escritos, y Plano no puede leerlos. Por ahora solo se convierten planos con texto: pide el PDF exportado desde el programa de dibujo, no impreso ni escaneado.` : lectura.error}</p>
    <div>
      <label className="btn btn-primary"><span>Elegir otro plano</span><input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) alElegir(f); }} /></label>
      {alCerrar && <Button variant="secondary" onClick={alCerrar}>Cerrar</Button>}
    </div>
  </div>;
}
