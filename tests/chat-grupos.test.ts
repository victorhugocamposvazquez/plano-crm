import { describe, it, expect } from "vitest";
import { agruparMensajes, iniciales, tonoAutor } from "@/lib/chat-grupos";
import type { Message } from "@/lib/domain";

const m = (id: string, author: string, at: string): Message => ({ id, organization_id: "o", project_id: "p", body: id, author_name: author, created_at: at });

describe("Agrupación del chat", () => {
  it("junta mensajes seguidos del mismo autor en cinco minutos y separa el resto", () => {
    const grupos = agruparMensajes([
      m("1", "Marta", "2026-10-27T10:00:00Z"), m("2", "Marta", "2026-10-27T10:03:00Z"), m("3", "Alex", "2026-10-27T10:04:00Z"),
      m("4", "Marta", "2026-10-27T10:20:00Z"), m("5", "Marta", "2026-10-28T09:00:00Z")
    ], "Alex");
    expect(grupos.map(g => g.items.length)).toEqual([2, 1, 1, 1]);
    expect(grupos[1].mine).toBe(true);
    expect(grupos[3].day).toBe("2026-10-28");
  });

  it("ordena por fecha aunque lleguen desordenados", () => {
    const grupos = agruparMensajes([m("b", "Marta", "2026-10-27T10:05:00Z"), m("a", "Marta", "2026-10-27T10:00:00Z")], "x");
    expect(grupos[0].items.map(i => i.id)).toEqual(["a", "b"]);
  });

  it("saca iniciales y un tono estable por autor", () => {
    expect(iniciales("Marta · Demo")).toBe("MD");
    expect(iniciales("")).toBe("·");
    expect(tonoAutor("Marta")).toBe(tonoAutor("Marta"));
    expect([1, 2, 3, 4, 5]).toContain(tonoAutor("Alex"));
  });
});
