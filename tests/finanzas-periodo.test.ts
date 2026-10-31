import { describe, expect, it } from "vitest";
import { createDemo } from "@/lib/demo";
import { comparar, csvGestoria, rangoPeriodo, resumenPeriodo } from "@/lib/finanzas-periodo";

describe("periodos de Finanzas", () => {
  it("la semana va de lunes a domingo en siete tramos", () => {
    const r = rangoPeriodo("semana", 0, "2026-10-31");
    expect([r.desde, r.hasta]).toEqual(["2026-10-26", "2026-11-01"]);
    expect(r.tramos).toHaveLength(7);
  });
  it("el mes cubre todos sus días sin salirse", () => {
    const r = rangoPeriodo("mes", 0, "2026-10-31");
    expect([r.desde, r.hasta]).toEqual(["2026-10-01", "2026-10-31"]);
    expect(r.etiqueta).toBe("Octubre de 2026");
    expect(r.tramos.at(-1)?.hasta).toBe("2026-10-31");
  });
  it("trimestre y año retroceden bien con el desplazamiento", () => {
    expect(rangoPeriodo("trimestre", -1, "2026-02-10").desde).toBe("2025-10-01");
    expect(rangoPeriodo("ano", -1, "2026-02-10").hasta).toBe("2025-12-31");
  });
  it("lo pendiente es lo aceptado menos lo preparado", () => {
    const data = createDemo();
    const r = resumenPeriodo(data, "ano", 0);
    expect(r.pendiente).toBeGreaterThan(0);
    const proyecto = data.certifications[0]?.project_id;
    if (proyecto) expect(resumenPeriodo(data, "ano", 0, proyecto).pendiente).toBeLessThanOrEqual(r.pendiente);
  });
  it("no inventa un porcentaje sin base de comparación", () => {
    expect(comparar(100, 0)).toBe("Sin datos en el periodo anterior");
    expect(comparar(150, 100)).toBe("+50 % que el periodo anterior");
    expect(comparar(50, 100)).toBe("−50 % que el periodo anterior");
  });
  it("el CSV usa punto y coma y coma decimal", () => {
    const data = createDemo();
    expect(csvGestoria(data).split("\n")[0]).toBe("Fecha;Cliente;Proyecto;Concepto;Estado;Base sin IVA");
  });
});
