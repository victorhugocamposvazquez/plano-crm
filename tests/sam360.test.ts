import { describe, it, expect } from "vitest";
import { suavizar, componente } from "@/lib/sam360";
import { direccionVista, enPanoramica, enVista, direccionPanoramica, vistasCubo } from "@/lib/vistas360";

describe("Vistas planas de una foto 360", () => {
  it("ida y vuelta: un píxel de una vista vuelve al mismo sitio", () => {
    for (const v of vistasCubo(256)) for (const [i, j] of [[10, 20], [128, 128], [200, 40]]) {
      const p = enVista(v, direccionVista(v, i, j))!;
      expect(p[0]).toBeCloseTo(i, 3); expect(p[1]).toBeCloseTo(j, 3);
    }
  });
  it("la panorámica y sus direcciones se corresponden", () => {
    const [x, y] = enPanoramica(direccionPanoramica(300.5, 100.5, 1024, 512), 1024, 512);
    expect(x).toBeCloseTo(300.5, 3); expect(y).toBeCloseTo(100.5, 3);
  });
  it("las seis vistas cubren toda la esfera", () => {
    const vistas = vistasCubo(64);
    for (let y = 0; y < 64; y += 3) for (let x = 0; x < 128; x += 3) expect(vistas.some(v => enVista(v, direccionPanoramica(x + 0.5, y + 0.5, 128, 64)))).toBe(true);
  });
});

describe("Etiquetas afinadas", () => {
  it("el filtro de mayoría quita dientes sueltos sin mover el borde", () => {
    const w = 64, h = 32, seg = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) seg[y * w + x] = y < 16 ? 2 : 1;
    seg[17 * w + 10] = 2; seg[14 * w + 30] = 1; // dos dientes
    const s = suavizar(seg, w, h, 2);
    expect(s[17 * w + 10]).toBe(1); expect(s[14 * w + 30]).toBe(2);
    expect(s[15 * w + 5]).toBe(2); expect(s[16 * w + 5]).toBe(1);
  });
  it("tocar el suelo coge su parte conectada, también a través del borde de la imagen", () => {
    const w = 16, h = 8, seg = new Uint8Array(w * h);
    for (let y = 5; y < 8; y++) { seg[y * w + 0] = 1; seg[y * w + 15] = 1; seg[y * w + 8] = 1; }
    const c = componente(seg, w, h, 6 * w, 1);
    expect(c[6 * w + 15]).toBe(1); expect(c[6 * w + 8]).toBe(0);
  });
});
