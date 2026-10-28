import { describe, it, expect } from "vitest";
import { comandos, interpretar, sugerir } from "@/lib/chat-comandos";
import { createDemo, demoId } from "@/lib/demo";

const data = createDemo();
const projectId = demoId(10);

describe("Atajos del chat", () => {
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

  it("el último presupuesto responde con importes y accesos", () => {
    const r = interpretar("/presupuesto")!.comando.ejecutar({ data, projectId, argumento: "" });
    expect(r.titulo).toMatch(/^V2/);
    expect(r.lineas.some(l => /base/.test(l))).toBe(true);
    expect(r.acciones.some(a => a.kind === "presupuesto" && a.versionId)).toBe(true);
    expect(r.acciones.some(a => a.kind === "href" && a.href.startsWith("/imprimir/"))).toBe(true);
  });

  it("tareas y compras listan lo pendiente del proyecto", () => {
    const t = interpretar("tareas pendientes")!.comando.ejecutar({ data, projectId, argumento: "" });
    expect(t.titulo).toMatch(/pendientes/);
    expect(t.acciones.every(a => a.kind === "tarea")).toBe(true);
    const c = interpretar("/compras")!.comando.ejecutar({ data, projectId, argumento: "" });
    expect(c.lineas[0]).toMatch(/Placas de yeso/);
  });

  it("sugiere atajos mientras se escribe", () => {
    expect(sugerir("/pre").map(c => c.id)).toEqual(["presupuesto"]);
    expect(sugerir("ultimo").map(c => c.id)).toContain("presupuesto");
    expect(sugerir("").length).toBeGreaterThan(3);
    expect(comandos.every(c => c.formas[0].startsWith("/"))).toBe(true);
  });
});
