import type { PlanoLeido } from "../planta-lector";
import { coloresCircuito, type Planta } from "../planta3d";

/** El plano en 2D pintado en un lienzo, con aspecto de cámara térmica. `caja` es la zona que cubre, en puntos del plano. */
export type Lamina = { lienzo: HTMLCanvasElement; caja: [number, number, number, number] };
const tintaMuro = "rgb(190 52 30 / 0.6)";

/** Los trazos del PDF: muros y dibujo en rojo apagado, de una pasada; lo que el plano trae en color (equipos y tuberías), encendido. */
export function pintarTrazos(c: CanvasRenderingContext2D, plano: PlanoLeido, k: number, ox: number, oy: number, grueso: number) {
  c.globalCompositeOperation = "lighter"; c.lineCap = "round";
  const vivos = new Map<string, Path2D>(), gris = new Path2D();
  for (const t of plano.trazos) {
    const [r, g, b] = t.color, croma = Math.max(r, g, b) - Math.min(r, g, b);
    let via = gris;
    if (croma >= 0.3) { const tono = `rgb(${Math.round(120 + r * 135)} ${Math.round(90 + g * 165)} ${Math.round(90 + b * 165)})`; via = vivos.get(tono) ?? new Path2D(); vivos.set(tono, via); }
    else if (r > 0.86) continue;
    via.moveTo(t.p[0] * k + ox, t.p[1] * k + oy);
    for (let i = 2; i < t.p.length; i += 2) via.lineTo(t.p[i] * k + ox, t.p[i + 1] * k + oy);
  }
  c.strokeStyle = tintaMuro; c.lineWidth = Math.max(1, grueso * 0.7); c.stroke(gris);
  c.lineWidth = Math.max(1.5, grueso * 1.3);
  for (const [tono, via] of vivos) { c.strokeStyle = tono; c.stroke(via); }
  c.globalCompositeOperation = "source-over";
}

/**
 * La lámina sobre la que arranca la conversión: el dibujo original si se acaba de leer un PDF, o el plano rehecho con lo que se sabe de la planta
 * (contornos, equipos, trazado de tuberías). Sin rótulos: los pone la escena a medida que el haz reconoce cada recinto.
 */
export function laminaDePlanta(planta: Planta, plano?: PlanoLeido | null): Lamina {
  const ps = planta.recintos.flatMap(r => r.contorno), xs = ps.map(p => p[0]), ys = ps.map(p => p[1]);
  const mx = (Math.max(...xs) - Math.min(...xs)) * 0.07, my = (Math.max(...ys) - Math.min(...ys)) * 0.07;
  const caja: Lamina["caja"] = [Math.min(...xs) - mx, Math.min(...ys) - my, Math.max(...xs) + mx, Math.max(...ys) + my];
  const k = 1536 / Math.max(caja[2] - caja[0], caja[3] - caja[1]), lienzo = document.createElement("canvas");
  lienzo.width = Math.ceil((caja[2] - caja[0]) * k); lienzo.height = Math.ceil((caja[3] - caja[1]) * k);
  const c = lienzo.getContext("2d")!, ox = -caja[0] * k, oy = -caja[1] * k, X = (x: number) => x * k + ox, Y = (y: number) => y * k + oy;
  if (plano?.trazos.length) pintarTrazos(c, plano, k, ox, oy, 2);
  else {
    c.lineJoin = "round"; c.strokeStyle = "rgb(214 70 42)"; c.lineWidth = 3;
    for (const r of planta.recintos) { c.beginPath(); r.contorno.forEach(([x, y], i) => i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))); c.closePath(); c.stroke(); }
    c.lineWidth = 2.5;
    for (const t of planta.tramos) t.lineas.forEach((l, i) => {
      const [r, g, b] = coloresCircuito[l.c]; c.strokeStyle = `rgb(${r} ${g} ${b})`; c.beginPath();
      t.puntos.forEach(([x, y], j) => j ? c.lineTo(X(x) + i * 3, Y(y) + i * 3) : c.moveTo(X(x) + i * 3, Y(y) + i * 3)); c.stroke();
    });
    c.strokeStyle = "rgb(120 255 120)"; c.lineWidth = 2.5;
    for (const e of planta.equipos) { c.strokeRect(X(e.caja[0]), Y(e.caja[1]), (e.caja[2] - e.caja[0]) * k, (e.caja[3] - e.caja[1]) * k); c.beginPath(); c.moveTo(X(e.caja[0]), Y(e.caja[1])); c.lineTo(X(e.caja[2]), Y(e.caja[3])); c.stroke(); }
  }
  return { lienzo, caja };
}
