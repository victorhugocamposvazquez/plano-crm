import { describe, it, expect } from "vitest";
import { buscarGlobal, agruparResultados } from "@/lib/buscador";
import { createDemo } from "@/lib/demo";
import { searchProjects, matchesTerm } from "@/lib/search";

const data = createDemo();

describe("Búsqueda de proyectos por inicio de palabra", () => {
  it("«cliente 05» no arrastra el proyecto cuyo código contiene 05", () => {
    const hits = searchProjects(data, data.projects, "cliente 05");
    expect(hits.map(h => h.project.client_name)).toEqual(["Cliente de ejemplo 05"]);
    expect(searchProjects(data, data.projects, "pl-005").map(h => h.project.code)).toEqual(["PL-005"]);
    expect(searchProjects(data, data.projects, "cli").length).toBe(data.projects.length);
    expect(matchesTerm("pl-005 carpinteria a medida", "05")).toBe(false);
    expect(matchesTerm("cliente de ejemplo 05", "05")).toBe(true);
  });
});

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
