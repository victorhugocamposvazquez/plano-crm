import { describe, it, expect } from "vitest";
import { bloquesDeTexto, leerPlanta, PlanoSinRecintos, PlanoSinTexto, rotulos, type PlanoLeido, type TextoPlano, type TrazoPlano } from "@/lib/planta-lector";
import { medicionTuberia } from "@/lib/planta3d";

// Plano sintético a 0,1 m por punto: dos cámaras de 20 × 15 m y 10 × 15 m separadas por un muro, y un pasillo abierto por un lado.
const gris = [0.67, 0.67, 0.67] as const, verde = [0, 0.9, 0] as const, azul = [0, 0, 1] as const, rojo = [1, 0, 0] as const;
const caja = (x0: number, y0: number, x1: number, y1: number, color: readonly [number, number, number], grosor = 0.38): TrazoPlano => ({ p: [x0, y0, x1, y0, x1, y1, x0, y1, x0, y0], color, grosor });
const linea = (x0: number, y0: number, x1: number, y1: number, color: readonly [number, number, number], grosor = 0.24): TrazoPlano => ({ p: [x0, y0, x1, y1], color, grosor });
const texto = (lineas: string[], x: number, y: number, h = 3): TextoPlano[] => lineas.map((t, i) => ({ t, x, y: y + i * h * 1.4, w: t.length * h * 0.5, h }));
const tubo = (y: number, color: readonly [number, number, number]) => [linea(120, y, 420, y, color), linea(120, y + 0.2, 420, y + 0.2, color)];
function plano(conTexto = true): PlanoLeido {
  const trazos = [
    caja(100, 100, 300, 250, gris), caja(302, 100, 402, 250, gris),
    linea(100, 260, 402, 260, gris, 0.38), linea(100, 260, 100, 300, gris, 0.38), linea(100, 300, 402, 300, gris, 0.38), // Pasillo sin cerrar por la derecha.
    caja(180, 230, 210, 240, verde), linea(185, 232, 205, 238, verde, 0.38),
    ...tubo(254, azul), ...tubo(254.6, rojo), ...tubo(255, rojo)
  ];
  const textos = !conTexto ? [] : [
    ...texto(["Cámara 01", "S: 300,00 m²", "h: 9,65 m", "Tª: -25°C"], 170, 150), ...texto(["Cámara 02", "S: 150,00 m²", "h: 8,00 m", "Tª: +5°C/+8°C"], 330, 140),
    ...texto(["Pasillo", "S: 120,00 m²", "h: 4,40 m"], 200, 275),
    ...texto(["EQUIPO BT01", "TEWSSC80-2"], 170, 215, 2), ...texto(['CO2 A_BT = Ø1 3/8"', 'CO2GC1.1 = Ø1 1/8"', 'CO2GC1.2 = Ø1 1/8"'], 200, 262.5, 1.5)
  ];
  return { ancho: 595, alto: 842, textos, trazos };
}

describe("Lector de plantas", () => {
  it("avisa cuando el plano viene sin texto y no sigue", async () => {
    await expect(leerPlanta(plano(false))).rejects.toBeInstanceOf(PlanoSinTexto);
    await expect(leerPlanta(plano(false))).rejects.toThrow(/sin texto/);
  });
  it("avisa cuando hay texto pero ningún recinto rotulado con superficie", async () => {
    await expect(leerPlanta({ ...plano(), textos: texto(["Planta baja", "E: 1/200"], 50, 50) })).rejects.toBeInstanceOf(PlanoSinRecintos);
  });
  it("junta trozos en líneas y líneas en rótulos, también en vertical", () => {
    const b = bloquesDeTexto([{ t: "Cámara", x: 10, y: 10, w: 9, h: 3 }, { t: "01", x: 20, y: 10, w: 3, h: 3 }, { t: "S: 12,50 m²", x: 10, y: 14, w: 16, h: 3 }, { t: "Lejos", x: 200, y: 10, w: 8, h: 3 },
      { t: "Pasillo", x: 400, y: 300, w: 10, h: 3, vertical: true }, { t: "S: 52,81 m²", x: 404, y: 300, w: 16, h: 3, vertical: true }]);
    expect(b.map(x => x.lineas)).toEqual([["Cámara 01", "S: 12,50 m²"], ["Lejos"], ["Pasillo", "S: 52,81 m²"]]);
    const r = rotulos(b);
    expect(r.recintos.map(x => [x.nombre, x.superficie])).toEqual([["Cámara 01", 12.5], ["Pasillo", 52.81]]);
    expect(b[2].caja[0]).toBeLessThan(404); expect(b[2].caja[3]).toBeLessThanOrEqual(300);
  });
  it("levanta los recintos con su altura, temperatura y uso, y deduce la escala de las superficies", async () => {
    const { planta, informe } = await leerPlanta(plano(), "Nave de prueba");
    expect(planta.id).toBe("nave-de-prueba");
    expect(planta.escala).toBeGreaterThan(0.098); expect(planta.escala).toBeLessThan(0.102);
    const de = (id: string) => planta.recintos.find(r => r.id === id)!, ajuste = (id: string) => informe.recintos.find(r => r.id === id)!.ajuste;
    expect(["camara-01", "camara-02", "pasillo"].map(de).map(r => [r.id, r.superficie, r.alto, r.uso])).toEqual([["camara-01", 300, 9.65, "congelado"], ["camara-02", 150, 8, "refrigerado"], ["pasillo", 120, 4.4, "servicio"]]);
    expect(de("camara-02").temp).toEqual([5, 8]);
    expect(["camara-01", "camara-02", "pasillo"].map(ajuste)).toEqual(["medido", "medido", "estimado"]);
    const c1 = de("camara-01").contorno, xs = c1.map(p => p[0]), ys = c1.map(p => p[1]);
    expect(Math.min(...xs)).toBeCloseTo(100, 0); expect(Math.max(...xs)).toBeCloseTo(300, 0); expect(Math.min(...ys)).toBeCloseTo(100, 0); expect(Math.max(...ys)).toBeCloseTo(250, 0);
    // El pasillo no cierra: cuadrado con su superficie rotulada, y se dice.
    const p = de("pasillo").contorno; expect((p[1][0] - p[0][0]) * planta.escala).toBeCloseTo(Math.sqrt(120), 0);
    expect(informe.avisos.join(" ")).toMatch(/1 de 3 recintos no cierran/);
  });
  it("empareja el rótulo del equipo con su símbolo y lo coloca en su recinto", async () => {
    const { planta, informe } = await leerPlanta(plano());
    expect(planta.equipos).toEqual([{ id: "BT01", recinto: "camara-01", modelo: "TEWSSC80-2", clase: "cubico", caja: [180, 230, 210, 240] }]);
    expect(informe.equiposSinSimbolo).toEqual([]);
  });
  it("mide la tubería por circuito y le pone el diámetro del rótulo más cercano", async () => {
    const { planta, informe } = await leerPlanta(plano()), m = medicionTuberia(planta);
    expect(m.porCircuito["aspiracion-bt"]).toBeCloseTo(30, 0);
    expect(m.porCircuito["gas-caliente"]).toBeCloseTo(60, 0); // Dos tubos de gas caliente pegados.
    expect(m.porCircuito.liquido).toBe(0);
    expect(m.porDiametro.map(d => d.d).sort()).toEqual(["1 1/8", "1 3/8"]);
    expect(informe.metrosTuberia).toBeCloseTo(90, 0);
    expect(informe.avisos.join(" ")).toMatch(/color del trazo/);
  });
});
