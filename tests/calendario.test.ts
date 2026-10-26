import { describe, it, expect } from "vitest";
import { primerDiaMes, sumarMeses, rejillaMes, porDiaDelMes, etiquetaMes, tareasConProyecto } from "@/lib/agenda";
import { createDemo } from "@/lib/demo";

describe("Calendario mensual", () => {
  it("construye una rejilla de seis semanas que empieza en lunes y marca los días del mes", () => {
    const rejilla = rejillaMes("2026-10-15");
    expect(rejilla).toHaveLength(6);
    expect(rejilla.every(s => s.length === 7)).toBe(true);
    expect(rejilla[0][0].iso).toBe("2026-09-28"); // el 1 de octubre de 2026 es jueves
    expect(rejilla[0][3]).toEqual({ iso: "2026-10-01", enMes: true });
    expect(rejilla[0][0].enMes).toBe(false);
    expect(rejilla.flat().filter(d => d.enMes)).toHaveLength(31);
  });

  it("navega entre meses y los etiqueta en español", () => {
    expect(primerDiaMes("2026-10-26")).toBe("2026-10-01");
    expect(sumarMeses("2026-10-26", 1)).toBe("2026-11-01");
    expect(sumarMeses("2026-01-31", 1)).toBe("2026-02-01");
    expect(etiquetaMes("2026-10-26")).toMatch(/Octubre de 2026/i);
  });

  it("agrupa por día solo las tareas visibles en la rejilla", () => {
    const data = createDemo();
    const tareas = tareasConProyecto(data);
    const mes = tareas[0].due_date;
    const map = porDiaDelMes(tareas, mes);
    const rejilla = rejillaMes(mes).flat().map(d => d.iso);
    expect([...map.keys()].every(k => rejilla.includes(k))).toBe(true);
    expect([...map.values()].reduce((s, l) => s + l.length, 0)).toBe(tareas.filter(t => rejilla.includes(t.due_date)).length);
  });
});
