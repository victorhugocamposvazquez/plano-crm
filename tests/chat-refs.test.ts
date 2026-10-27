import { describe, it, expect } from "vitest";
import { encodeRef, parseMessage, plainText, referenciables, filtrarReferencias, destinoRef } from "@/lib/chat-refs";
import { createDemo, demoId } from "@/lib/demo";

describe("Referencias en el chat", () => {
  const data = createDemo();
  const projectId = demoId(10);

  it("codifica y vuelve a leer una referencia dentro del texto", () => {
    const body = `Revisad ${encodeRef({ type: "v", id: demoId(61), label: "V2 · Presupuesto de reforma" })} antes del viernes`;
    const parts = parseMessage(body);
    expect(parts).toHaveLength(3);
    expect(parts[1]).toEqual({ kind: "ref", ref: { type: "v", id: demoId(61), label: "V2 · Presupuesto de reforma" } });
    expect(plainText(body)).toBe("Revisad V2 · Presupuesto de reforma antes del viernes");
  });

  it("limpia caracteres que romperían la marca en la etiqueta", () => {
    expect(encodeRef({ type: "d", id: "x", label: "plano [v2] | final" })).toBe("[[d:x|plano v2 final]]");
  });

  it("ignora marcas mal formadas y texto normal", () => {
    expect(parseMessage("sin referencias [[z:1|no]] ni [[v:1]]")).toEqual([{ kind: "text", text: "sin referencias [[z:1|no]] ni [[v:1]]" }]);
  });

  it("lista lo referenciable de un proyecto, con la revisión más reciente primero", () => {
    const opciones = referenciables(data, projectId);
    const versiones = opciones.filter(o => o.type === "v");
    expect(versiones[0].label.startsWith("V2")).toBe(true);
    expect(versiones[1].hint).toMatch(/aprobada para obra/);
    expect(opciones.some(o => o.type === "t")).toBe(true);
    expect(opciones.some(o => o.type === "c")).toBe(true);
    expect(filtrarReferencias(opciones, "demolic").every(o => /demolic/i.test(`${o.label} ${o.hint}`))).toBe(true);
  });

  it("resuelve el destino sin salir de la ficha", () => {
    expect(destinoRef({ type: "v", id: demoId(61), label: "V2" }, data, projectId)).toEqual({ href: `/proyectos/${projectId}?s=budget&p=${demoId(50)}` });
    expect(destinoRef({ type: "t", id: demoId(202), label: "t" }, data, projectId)).toEqual({ task: demoId(202) });
    expect(destinoRef({ type: "c", id: demoId(300), label: "c" }, data, projectId)).toEqual({ href: `/proyectos/${projectId}?s=purchases` });
  });
});
