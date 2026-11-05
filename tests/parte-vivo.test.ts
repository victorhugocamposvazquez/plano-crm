import { describe, it, expect } from "vitest";
import { applyCommand, type Actor } from "@/lib/domain";
import { createDemo, demoId, demoActor } from "@/lib/demo";
import { enlaceVivo, estadoEnvio, parteFoto, parteHecho, parteMensaje, tokenValido, vistaParte } from "@/lib/parte-vivo";

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(880000 + ++n).padStart(12, "0")}`;
const ahora = "2026-11-05T10:00:00.000Z";
const run = (ws: ReturnType<typeof createDemo>, c: Parameters<typeof applyCommand>[1], quien: Actor = demoActor) => applyCommand(ws, c, quien, ahora, uuid);
const snapshot = { direccion: "Rúa Real 12, 3º", notas: "Llave en portería", contacto: "Dani", telefono: "600 99 88 77", para: "Manuel Rey", material: ["Sacos · 20 ud"] };

function conParte() {
  const ws0 = createDemo(), tarea = ws0.tasks.find(t => t.status === "pending")!;
  const ws = run(ws0, { type: "parte.create", id: demoId(950), task_id: tarea.id, operario_id: demoId(900), snapshot });
  return { ws, tarea, token: ws.task_shares!.find(s => s.id === demoId(950))!.token };
}

describe("Parte vivo por WhatsApp", () => {
  it("crea un enlace con token largo y aleatorio, y el equipo de obra no puede", () => {
    const { token } = conParte();
    expect(tokenValido(token)).toBe(true);
    expect(enlaceVivo("https://plano.example/", token)).toBe(`https://plano.example/p/${token}`);
    const tarea = createDemo().tasks[0];
    expect(() => run(createDemo(), { type: "parte.create", id: demoId(951), task_id: tarea.id, snapshot }, { ...demoActor, role: "site" })).toThrow();
  });
  it("enseña la tarea al día, sin el cliente", () => {
    const { ws, tarea, token } = conParte();
    const v = vistaParte(ws, token, ahora);
    expect(v).toMatchObject({ estado: "ok", tarea: tarea.title, direccion: "Rúa Real 12, 3º", para: "Manuel Rey", hecha: false });
    const cliente = ws.projects.find(p => p.id === tarea.project_id)!.client_name;
    expect(JSON.stringify(v)).not.toContain(cliente);
    expect(vistaParte(ws, "a".repeat(64), ahora)).toEqual({ estado: "no_valido" });
    expect(vistaParte(ws, token, "2026-12-31T00:00:00.000Z")).toEqual({ estado: "no_valido" });
  });
  it("marca hecha la tarea y lo cuenta en el chat, una sola vez", () => {
    const { ws, tarea, token } = conParte();
    const a = parteHecho(ws, token, "Quedan dos sacos.", ahora, uuid);
    expect(a.tasks.find(t => t.id === tarea.id)!.status).toBe("done");
    const mensajes = a.messages.filter(m => m.author_name === "Manuel Rey · por enlace");
    expect(mensajes.map(m => m.body)).toEqual([`Hecho: ${tarea.title}\nQuedan dos sacos.`]);
    expect(parteHecho(a, token, "", ahora, uuid).messages.length).toBe(a.messages.length);
    expect(estadoEnvio(a.task_shares!.find(s => s.token === token)!, ahora).texto).toBe("Hecha por el operario");
  });
  it("lleva los mensajes al chat con límite, y las fotos a Planos y fotos", () => {
    const { ws, tarea, token } = conParte();
    let w = parteMensaje(ws, token, "  ¿Dejo el escombro en el portal?  ", ahora, uuid);
    expect(w.messages.at(-1)).toMatchObject({ project_id: tarea.project_id, body: "¿Dejo el escombro en el portal?", author_name: "Manuel Rey · por enlace" });
    expect(() => parteMensaje(w, token, "   ", ahora, uuid)).toThrow("Escribe el mensaje.");
    w = parteFoto(w, token, { path: `${w.organization_id}/${tarea.project_id}/x`, mime: "image/jpeg", size: 120000, nombre: "Antes" }, ahora, uuid);
    expect(w.documents.at(-1)).toMatchObject({ name: `Antes · ${tarea.title}`, category: "during" });
    expect(vistaParte(w, token, ahora)).toMatchObject({ fotos: 1, mensajes: 1 });
    expect(() => parteFoto(w, token, { path: "y", mime: "application/pdf", size: 10, nombre: "" }, ahora, uuid)).toThrow("Solo fotos");
  });
  it("anulado, deja de funcionar", () => {
    const { ws, token } = conParte();
    const w = run(ws, { type: "parte.revoke", id: demoId(950) });
    expect(vistaParte(w, token, ahora)).toEqual({ estado: "no_valido" });
    expect(() => parteMensaje(w, token, "hola", ahora, uuid)).toThrow("ya no es válido");
    expect(estadoEnvio(w.task_shares![0], ahora).texto).toBe("Anulado");
  });
});
