import { describe, it, expect } from "vitest";
import { veSeccion } from "@/lib/navegacion";

describe("Navegación por perfil", () => {
  it("el equipo de obra no ve presupuestos, catálogo, finanzas ni configuración, pero sí compras y documentos", () => {
    expect(veSeccion("site", "/presupuestos")).toBe(false);
    expect(veSeccion("site", "/catalogo")).toBe(false);
    expect(veSeccion("site", "/finanzas")).toBe(false);
    expect(veSeccion("site", "/clientes")).toBe(false);
    expect(veSeccion("site", "/configuracion/identidad")).toBe(false);
    expect(veSeccion("site", "/compras")).toBe(true);
    expect(veSeccion("site", "/documentos")).toBe(true);
    expect(veSeccion("site", "/proyectos")).toBe(true);
  });
  it("jefe de obra y consulta ven todo menos la configuración; oficina y administración, todo", () => {
    expect(veSeccion("manager", "/presupuestos")).toBe(true);
    expect(veSeccion("manager", "/configuracion/importar")).toBe(false);
    expect(veSeccion("viewer", "/finanzas")).toBe(true);
    expect(veSeccion("viewer", "/configuracion/ejemplos")).toBe(false);
    expect(veSeccion("office", "/configuracion/identidad")).toBe(true);
    expect(veSeccion("admin", "/catalogo")).toBe(true);
  });
});
