import { describe, it, expect } from "vitest";
import { facturableAhora, puedesFacturarYa } from "@/lib/cobros";
import { createDemo, demoId } from "@/lib/demo";

const data = createDemo();

describe("Lo que ya se puede facturar", () => {
  it("coincide con la regla de la pestaña Cobros: aceptado por el avance, menos facturado y preparado", () => {
    const { importe, progress } = facturableAhora(data, demoId(10));
    expect(progress).toBe(40);
    expect(importe).toBe(83780);
  });
  it("sin presupuesto aceptado no hay nada que facturar", () => {
    expect(facturableAhora(data, demoId(14)).importe).toBe(0);
  });
  it("lista solo los proyectos con importe, el mayor primero", () => {
    const lista = puedesFacturarYa(data);
    expect(lista.every(x => x.importe > 0)).toBe(true);
    for (let i = 1; i < lista.length; i++) expect(lista[i - 1].importe).toBeGreaterThanOrEqual(lista[i].importe);
    expect(lista.some(x => x.project.id === demoId(10))).toBe(true);
  });
});
