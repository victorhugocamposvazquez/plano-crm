import { describe, it, expect } from "vitest";
import { buscarGlobal, agruparResultados } from "@/lib/buscador";
import { createDemo } from "@/lib/demo";

const data = createDemo();

describe("Buscador global", () => {
  it("sin consulta ofrece acciones y pantallas", () => {
    const r = buscarGlobal(data, "");
    expect(r.some(x => x.grupo === "Acciones")).toBe(true);
    expect(r.some(x => x.grupo === "Pantallas")).toBe(true);
  });

  it("encuentra proyectos por calle, clientes por nombre y artículos por código sin acentos", () => {
    expect(buscarGlobal(data, "monte alto").some(r => r.grupo === "Proyectos" && r.titulo === "Vivienda en Monte Alto")).toBe(true);
    expect(buscarGlobal(data, "ejemplo 02").some(r => r.grupo === "Clientes")).toBe(true);
    expect(buscarGlobal(data, "pav-001").some(r => r.grupo === "Artículos")).toBe(true);
    expect(buscarGlobal(data, "fontaneria").some(r => r.grupo === "Artículos")).toBe(true);
  });

  it("encuentra acciones y pantallas por su nombre y agrupa en orden", () => {
    const r = buscarGlobal(data, "importar");
    expect(r.some(x => x.id === "a-importar")).toBe(true);
    const grupos = agruparResultados(buscarGlobal(data, "monte alto"));
    expect(grupos[0].grupo).toBe("Proyectos");
  });
});
