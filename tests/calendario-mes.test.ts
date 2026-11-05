import { describe, it, expect } from "vitest";
import { ajustar, casillasMes, diaSemana, fechaCampo, fueraDeRango, sumarMeses, tituloMes } from "@/lib/calendario-mes";

describe("Calendario de los campos de fecha", () => {
  it("pinta 6 semanas empezando en lunes", () => {
    const c = casillasMes("2026-11-05");
    expect(c).toHaveLength(42);
    expect(c[0]).toBe("2026-10-26");
    expect(diaSemana(c[0])).toBe(0);
    expect(c).toContain("2026-11-30");
    expect(c[41]).toBe("2026-12-06");
  });
  it("cambia de mes sin saltarse el último día", () => {
    expect(sumarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(sumarMeses("2026-12-15", 1)).toBe("2027-01-15");
    expect(sumarMeses("2026-03-31", -1)).toBe("2026-02-28");
  });
  it("respeta los límites y escribe la fecha en español", () => {
    expect(fueraDeRango("2026-11-04", "2026-11-05")).toBe(true);
    expect(ajustar("2026-11-01", "2026-11-05")).toBe("2026-11-05");
    expect(tituloMes("2026-11-05")).toBe("Noviembre de 2026");
    expect(fechaCampo("2026-11-05", "2026-11-05")).toMatch(/^Hoy · jue, 5 nov 2026$/);
    expect(fechaCampo("2026-11-06", "2026-11-05")).toMatch(/^Mañana · /);
  });
});
