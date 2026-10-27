import { describe, it, expect } from "vitest";
import { applyCommand, demoActorFor } from "./helpers-mensajes";
import { createDemo, demoActor, demoId } from "@/lib/demo";

describe("Editar y borrar mensajes", () => {
  const data = createDemo();
  const mio = applyCommand(data, { type: "message.send", project_id: demoId(10), body: "Hola equipo" }, demoActor);
  const msg = mio.messages.find(m => m.body === "Hola equipo")!;

  it("el autor edita su mensaje y queda marcado como editado", () => {
    const out = applyCommand(mio, { type: "message.edit", id: msg.id, body: "Hola a todos" }, demoActor);
    const m = out.messages.find(x => x.id === msg.id)!;
    expect(m.body).toBe("Hola a todos");
    expect(m.edited_at).toBeTruthy();
  });

  it("otra persona no puede editarlo, pero oficina sí puede borrarlo", () => {
    const otra = demoActorFor("Marta · Demo", "manager");
    expect(() => applyCommand(mio, { type: "message.edit", id: msg.id, body: "x" }, otra)).toThrow(/escribió/);
    expect(() => applyCommand(mio, { type: "message.delete", id: msg.id }, otra)).toThrow(/borrarlo/);
    const oficina = demoActorFor("Paula · Oficina", "office");
    const out = applyCommand(mio, { type: "message.delete", id: msg.id }, oficina);
    const m = out.messages.find(x => x.id === msg.id)!;
    expect(m.deleted_at).toBeTruthy();
    expect(m.body).toBe("");
  });

  it("un mensaje borrado ya no se puede editar", () => {
    const borrado = applyCommand(mio, { type: "message.delete", id: msg.id }, demoActor);
    expect(() => applyCommand(borrado, { type: "message.edit", id: msg.id, body: "x" }, demoActor)).toThrow(/no encontrado/);
  });
});

describe("Reacciones", () => {
  const data = createDemo();
  const msg = data.messages[0];
  it("añade y quita la reacción de quien la pulsa, sin tocar las de otros", () => {
    const otra = demoActorFor("Marta · Demo", "manager");
    let out = applyCommand(data, { type: "message.react", id: msg.id, emoji: "👍" }, demoActor);
    out = applyCommand(out, { type: "message.react", id: msg.id, emoji: "👍" }, otra);
    expect(out.messages.find(m => m.id === msg.id)!.reactions).toEqual({ "👍": [demoActor.name, otra.name] });
    out = applyCommand(out, { type: "message.react", id: msg.id, emoji: "👍" }, demoActor);
    expect(out.messages.find(m => m.id === msg.id)!.reactions).toEqual({ "👍": [otra.name] });
    out = applyCommand(out, { type: "message.react", id: msg.id, emoji: "👍" }, otra);
    expect(out.messages.find(m => m.id === msg.id)!.reactions).toEqual({});
  });
  it("rechaza emojis fuera del conjunto", () => {
    expect(() => applyCommand(data, { type: "message.react", id: msg.id, emoji: "🦄" } as never, demoActor)).toThrow();
  });
});
