import { describe, it, expect } from "vitest";
import { buscarMensajes, trozos, participantes, elementosCompartidos } from "@/lib/chat-busqueda";
import { encodeRef } from "@/lib/chat-refs";
import { createDemo, demoId } from "@/lib/demo";
import type { Message } from "@/lib/domain";

const data = createDemo();
const m = (id: string, author: string, body: string, at: string, extra: Partial<Message> = {}): Message => ({ id, organization_id: "o", project_id: demoId(10), body, author_name: author, created_at: at, ...extra });
const msgs = [
  m("1", "Marta", "Revisad el pavimento de la cocina", "2026-10-26T10:00:00Z"),
  m("2", "Alex", `Adjunto ${encodeRef({ type: "d", id: "doc-1", label: "plano.pdf" })} y la ${encodeRef({ type: "v", id: demoId(61), label: "V2 · Presupuesto" })} https://garal.es/obra`, "2026-10-27T10:00:00Z"),
  m("3", "Alex", "Pavimento confirmado", "2026-10-27T11:00:00Z", { deleted_at: "2026-10-27T12:00:00Z" })
];

describe("Búsqueda y elementos del chat", () => {
  it("busca sin acentos ni mayúsculas y deja fuera los borrados", () => {
    expect([...buscarMensajes(msgs, "PAVIMENTO")]).toEqual(["1"]);
    expect([...buscarMensajes(msgs, "presupuesto v2")]).toEqual(["2"]);
    expect(buscarMensajes(msgs, "").size).toBe(0);
  });

  it("resalta las coincidencias en trozos", () => {
    const t = trozos("Revisad el pavimento", "pavi");
    expect(t).toEqual([{ text: "Revisad el ", hit: false }, { text: "pavi", hit: true }, { text: "mento", hit: false }]);
  });

  it("lista participantes con recuento y último mensaje, el más reciente primero", () => {
    const p = participantes(msgs);
    expect(p[0]).toMatchObject({ name: "Alex", mensajes: 2 });
    expect(p[1]).toMatchObject({ name: "Marta", mensajes: 1 });
  });

  it("reúne documentos, referencias y enlaces compartidos sin repetir", () => {
    const con = { ...data, documents: [{ id: "doc-1", organization_id: "o", project_id: demoId(10), name: "plano.pdf", category: "plan" as const, storage_path: "x", mime_type: "application/pdf", size_bytes: 1, created_at: "2026-10-27" }] };
    const c = elementosCompartidos([...msgs, m("4", "Alex", encodeRef({ type: "d", id: "doc-1", label: "plano.pdf" }), "2026-10-27T13:00:00Z")], con);
    expect(c.documentos.map(d => d.id)).toEqual(["doc-1"]);
    expect(c.fotos).toHaveLength(0);
    expect(c.referencias.v).toHaveLength(1);
    expect(c.enlaces).toEqual(["https://garal.es/obra"]);
  });
});
