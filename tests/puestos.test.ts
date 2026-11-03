import { describe, it, expect } from "vitest";
import { menuMovil, permisoPorDefecto, puestoPorDefecto, puestos, seccionInicial, seccionesDelPuesto, trabajo, esPuesto } from "@/lib/puestos";

describe("Puestos", () => {
  it("cada permiso tiene un puesto por defecto y cada puesto un permiso orientativo", () => {
    expect(puestoPorDefecto("admin")).toBe("direccion");
    expect(puestoPorDefecto("office")).toBe("oficina");
    expect(puestoPorDefecto("manager")).toBe("jefe-obra");
    expect(puestoPorDefecto("site")).toBe("equipo");
    for (const p of puestos) expect(permisoPorDefecto[p]).toBeTruthy();
  });
  it("el menú del móvil tiene dos destinos distintos por puesto y ninguno es Hoy ni Más", () => {
    for (const p of puestos) {
      const [a, b] = menuMovil[p];
      expect(a).not.toBe(b);
      expect([a, b]).not.toContain("/");
      expect([a, b]).not.toContain("/mas");
    }
    expect(menuMovil.materiales[0]).toBe("/compras");
    expect(menuMovil.facturacion[0]).toBe("/finanzas");
  });
  it("«Tu trabajo» empieza en Hoy y la ficha abre en la sección del puesto", () => {
    for (const p of puestos) {
      expect(trabajo[p][0]).toBe("/");
      expect(seccionesDelPuesto[p][0]).toBe(seccionInicial[p]);
    }
    expect(seccionInicial["jefe-obra"]).toBe("work");
    expect(seccionInicial.facturacion).toBe("cobros");
    expect(seccionInicial.materiales).toBe("purchases");
  });
  it("solo acepta puestos conocidos", () => {
    expect(esPuesto("tienda")).toBe(true);
    expect(esPuesto("gerente")).toBe(false);
    expect(esPuesto(null)).toBe(false);
  });
});
