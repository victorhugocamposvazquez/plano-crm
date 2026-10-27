import { describe, it, expect } from "vitest";
import { capitulosDocumento, alternativas, excluidas, numeroDocumento, desgloseIva, estadoDocumento } from "@/lib/documento-presupuesto";
import { totals } from "@/lib/domain";
import { createDemo, demoId } from "@/lib/demo";

const data = createDemo();
const v2 = data.versions.find(v => v.id === demoId(61))!;

describe("Documento de presupuesto", () => {
  it("agrupa solo las partidas incluidas por capítulo y suma lo mismo que el dominio", () => {
    const caps = capitulosDocumento(v2.items);
    expect(caps.every(c => c.items.every(i => i.inclusion === "included"))).toBe(true);
    expect(caps.reduce((s, c) => s + c.subtotal, 0)).toBe(totals(v2.items).base);
    expect(alternativas(v2.items).length + excluidas(v2.items).length + caps.reduce((s, c) => s + c.items.length, 0)).toBe(v2.items.length);
  });

  it("numera el documento con código, ámbito y revisión", () => {
    expect(numeroDocumento({ code: "PL-001" }, { number: 2 })).toBe("PL-001 · V2");
    expect(numeroDocumento({ code: "PL-001" }, { number: 1 }, 2)).toBe("PL-001-2 · V1");
  });

  it("desglosa el IVA por tipo y cuadra con el total", () => {
    const d = desgloseIva(v2.items);
    expect(d.reduce((s, x) => s + x.cuota, 0)).toBe(totals(v2.items).tax);
    expect(d.reduce((s, x) => s + x.base, 0)).toBe(totals(v2.items).base);
  });

  it("etiqueta el borrador como no válido y la aprobada como aprobada", () => {
    expect(estadoDocumento(v2)).toMatch(/Borrador/);
    expect(estadoDocumento({ ...v2, status: "approved" })).toBe("Aprobado para obra");
  });
});
