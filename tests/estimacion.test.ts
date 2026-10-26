import { describe, it, expect } from "vitest";
import { partidasDesdeLineas, rangoEstimacion, articuloPara, trabajosRapidos, notasDeVisita, type Linea } from "@/lib/estimacion";
import { itemSchema, totals } from "@/lib/domain";
import { createDemo, demoId } from "@/lib/demo";

const { articles } = createDemo();
const linea = (overrides: Partial<Linea> = {}): Linea => ({ id: demoId(950), article_id: demoId(32), quantity: 42, adjustment_percent: 0, motivo: "", ...overrides });

describe("Estimación rápida", () => {
  it("convierte líneas en partidas válidas para budget.save con el precio del catálogo", () => {
    const [item] = partidasDesdeLineas([linea()], articles);
    expect(itemSchema.safeParse(item).success).toBe(true);
    expect(item.unit_price).toBe(4950);
    expect(item.chapter).toBe("Pavimentos");
    expect(item.inclusion).toBe("included");
  });

  it("descarta cantidades a cero y artículos desconocidos", () => {
    expect(partidasDesdeLineas([linea({ quantity: 0 }), linea({ id: demoId(951), article_id: "no-existe" })], articles)).toHaveLength(0);
  });

  it("aplica el ajuste y añade el motivo a la descripción", () => {
    const [item] = partidasDesdeLineas([linea({ adjustment_percent: 15, motivo: "sin ascensor" })], articles);
    expect(item.adjustment_percent).toBe(15);
    expect(item.description).toContain("sin ascensor");
    expect(totals([item]).base).toBeGreaterThan(totals(partidasDesdeLineas([linea()], articles)).base);
  });

  it("limita cantidades a tres decimales y porcentajes a dos, como exige el dominio", () => {
    const [item] = partidasDesdeLineas([linea({ quantity: 12.34567, adjustment_percent: 7.777 })], articles);
    expect(itemSchema.safeParse(item).success).toBe(true);
    expect(item.quantity).toBe(12.346);
    expect(item.adjustment_percent).toBe(7.78);
  });

  it("calcula una horquilla simétrica alrededor del total", () => {
    const items = partidasDesdeLineas([linea()], articles);
    const rango = rangoEstimacion(items, 0.15);
    expect(rango.total).toBe(totals(items).total);
    expect(rango.minTotal).toBeLessThan(rango.total);
    expect(rango.maxTotal).toBeGreaterThan(rango.total);
    expect(rango.maxTotal - rango.total).toBeCloseTo(rango.total - rango.minTotal, -1);
  });

  it("cada trabajo rápido encuentra un artículo en el catálogo de demostración", () => {
    for (const trabajo of trabajosRapidos) expect(articuloPara(trabajo, articles)).not.toBeNull();
  });

  it("las notas dejan claro que es una estimación y qué queda por comprobar", () => {
    const notas = notasDeVisita("cambiar suelo y pintar", ["Acceso y ascensor"], "26 oct", 0.15);
    expect(notas).toMatch(/Estimación orientativa/);
    expect(notas).toMatch(/±15 %/);
    expect(notas).toMatch(/Pendiente de comprobar: Acceso y ascensor/);
  });
});
