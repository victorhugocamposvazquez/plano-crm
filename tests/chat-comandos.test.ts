import { describe, it, expect } from "vitest";
import { comandos, accesosRapidos, interpretar, sugerir } from "@/lib/chat-comandos";
import { createDemo, demoId } from "@/lib/demo";

const data = createDemo();
const projectId = demoId(10);
const abrir = (texto: string) => { const c = interpretar(texto)!; return c.comando.abrir({ data, projectId, argumento: c.argumento }); };

describe("Consultas del chat", () => {
  it("entiende la forma con barra y la frase escrita tal cual, con acentos o sin ellos", () => {
    expect(interpretar("/presupuesto")?.comando.id).toBe("presupuesto");
    expect(interpretar("Ver último presupuesto")?.comando.id).toBe("presupuesto");
    expect(interpretar("¿qué falta?")?.comando.id).toBe("tareas");
    expect(interpretar("Hola equipo, mañana a las 8")).toBeNull();
  });

  it("separa el argumento en los atajos que lo admiten", () => {
    expect(interpretar("/buscar tarima roble")).toMatchObject({ argumento: "tarima roble" });
    expect(interpretar("/presupuesto algo")).toBeNull();
  });

  it("cada consulta abre una vista encima del chat, nunca una navegación", () => {
    expect(abrir("/presupuesto")).toMatchObject({ kind: "presupuesto" });
    expect(abrir("ver aprobado")).toMatchObject({ kind: "presupuesto" });
    expect(abrir("/pdf")).toMatchObject({ kind: "pdf" });
    expect(abrir("tareas pendientes")).toEqual({ kind: "tareas" });
    expect(abrir("/compras")).toEqual({ kind: "compras" });
    expect(abrir("/buscar tarima")).toEqual({ kind: "buscar", query: "tarima" });
    expect(abrir("/buscar")).toMatchObject({ kind: "aviso" });
  });

  it("el último presupuesto es la revisión más reciente (V2 en el demo)", () => {
    const v = abrir("/presupuesto");
    expect(v.kind === "presupuesto" && data.versions.find(x => x.id === v.versionId)?.number).toBe(2);
  });

  it("avisa en vez de abrir algo vacío cuando no hay aprobado", () => {
    const sinAprobado = { ...data, budgets: data.budgets.map(b => ({ ...b, approved_version_id: null })) };
    expect(interpretar("/aprobado")!.comando.abrir({ data: sinAprobado, projectId, argumento: "" })).toMatchObject({ kind: "aviso" });
  });

  it("sugiere atajos mientras se escribe y expone los accesos rápidos", () => {
    expect(sugerir("/pre").map(c => c.id)).toEqual(["presupuesto"]);
    expect(sugerir("ultimo").map(c => c.id)).toContain("presupuesto");
    expect(sugerir("").length).toBeGreaterThan(3);
    expect(comandos.every(c => c.formas[0].startsWith("/"))).toBe(true);
    expect(accesosRapidos.map(c => c.id)).toEqual(["presupuesto", "tareas", "compras", "documentos", "cliente", "estado"]);
  });
});
