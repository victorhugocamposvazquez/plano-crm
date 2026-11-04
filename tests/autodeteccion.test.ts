import { describe, it, expect } from "vitest";
import { alturaTechoEstimada, areaMascara, comprimir, descomprimir, detectar, estimarLimites, pitchFila, pixelDe, prepararLab, regionDesde, retocar, segmentar, type Imagen } from "@/lib/autodeteccion";

/**
 * Habitación sintética de 4 × 3 m y 2,6 m de alto, con la cámara a 1,5 m en el centro:
 * suelo de madera, paredes amarillas, techo blanco y una ventana azul de 1 × 1 m en una pared.
 */
function habitacion(w = 512, h = 256): Imagen {
  const data = new Uint8ClampedArray(w * h * 4), cam = 1.5, alto = 2.6, mx = 2, mz = 1.5;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w, th = ((y + 0.5) / h) * Math.PI, phi = u * 2 * Math.PI;
    const dx = Math.cos(phi) * Math.sin(th), dy = Math.cos(th), dz = Math.sin(phi) * Math.sin(th);
    // Primera superficie que corta el rayo.
    const t = [dy < 0 ? -cam / dy : Infinity, dy > 0 ? (alto - cam) / dy : Infinity, Math.abs(dx) > 1e-9 ? mx / Math.abs(dx) : Infinity, Math.abs(dz) > 1e-9 ? mz / Math.abs(dz) : Infinity];
    const k = t.indexOf(Math.min(...t)), P = [dx * t[k], dy * t[k], dz * t[k]];
    let c = [205, 170, 70];
    if (k === 0) c = [150, 105, 65]; else if (k === 1) c = [245, 245, 240];
    else if (k === 2 && P[0] > 0 && Math.abs(P[2]) < 0.5 && P[1] > -0.5 && P[1] < 0.5) c = [80, 140, 210];
    const i = (y * w + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
  }
  return { data, w, h };
}

describe("Detección automática en una foto 360", () => {
  const img = habitacion(), L = prepararLab(img), { w, h } = img;
  const suelo = { bits: detectar(L, w, h, "suelo"), w, h };
  it("encuentra el suelo y lo mide (4 × 3 = 12 m²)", () => {
    expect(areaMascara(suelo, "suelo")).toBeGreaterThan(10.5);
    expect(areaMascara(suelo, "suelo")).toBeLessThan(13.5);
    // Nada por encima del horizonte.
    for (let i = 0; i < w * h; i++) if (suelo.bits[i]) expect(pitchFila((i / w) | 0, h)).toBeLessThan(0);
  });
  it("encuentra el techo y mide lo mismo que el suelo", () => {
    const techo = { bits: detectar(L, w, h, "techo"), w, h };
    expect(areaMascara(techo, "techo")).toBeGreaterThan(10.5);
    expect(areaMascara(techo, "techo")).toBeLessThan(13.5);
  });
  it("encuentra las paredes, deja fuera la ventana y mide aproximadamente su superficie", () => {
    const paredes = { bits: detectar(L, w, h, "pared"), w, h };
    const ventana = pixelDe({ yaw: Math.atan2(2, 0), pitch: 0 }, w, h);
    expect(paredes.bits[ventana]).toBe(0);
    // Perímetro 14 m × 2,6 m = 36,4 m², menos 1 m² de ventana.
    const a = areaMascara(paredes, "pared", 1.5, 2.6, suelo);
    expect(a).toBeGreaterThan(30);
    expect(a).toBeLessThan(40);
  });
  it("un toque quita o añade una zona entera", () => {
    const paredes = { bits: detectar(L, w, h, "pared"), w, h };
    const ventana = pixelDe({ yaw: Math.atan2(2, 0), pitch: 0 }, w, h);
    const conVentana = retocar(L, paredes, ventana, "pared");
    expect(conVentana[ventana]).toBe(1);
    const pared = pixelDe({ yaw: Math.atan2(2, 0) + 0.6, pitch: 0.1 }, w, h);
    const sinPared = retocar(L, { bits: conVentana, w, h }, pared, "pared");
    expect(sinPared[pared]).toBe(0);
    expect(sinPared[ventana]).toBe(1);
  });
  it("estima la altura del techo con el rodapié y la moldura (2,6 m)", () => {
    expect(alturaTechoEstimada(estimarLimites(L, w, h), w, h)).toBeGreaterThan(2.35);
    expect(alturaTechoEstimada(estimarLimites(L, w, h), w, h)).toBeLessThan(2.85);
  });
  it("tocar una pared selecciona solo esa pared", () => {
    const seg = segmentar(L, w, h), todas = detectar(L, w, h, "pared", seg);
    const una = regionDesde(L, w, h, pixelDe({ yaw: Math.atan2(0, 1.5), pitch: 0.2 }, w, h), "pared", seg);
    const nUna = una.reduce((s, v) => s + v, 0), nTodas = todas.reduce((s, v) => s + v, 0);
    expect(nUna).toBeGreaterThan(0);
    expect(nUna).toBeLessThan(nTodas);
  });
  it("la máscara se guarda comprimida sin perder nada", () => {
    const texto = comprimir(suelo.bits);
    expect(texto.length).toBeLessThan(w * h / 8);
    expect(descomprimir(texto, w * h)).toEqual(suelo.bits);
  });
});
