import { describe, it, expect } from "vitest";
import { applyCommand, type Actor } from "@/lib/domain";
import { createDemo, demoId, demoActor } from "@/lib/demo";
import { progresoLista, textoProgreso } from "@/lib/lista-tarea";
import { parteCheck, vistaParte } from "@/lib/parte-vivo";

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(770000 + ++n).padStart(12, "0")}`;
const ahora = "2026-11-05T10:00:00.000Z";
const run = (ws: ReturnType<typeof createDemo>, c: Parameters<typeof applyCommand>[1], quien: Actor = demoActor) => applyCommand(ws, c, quien, ahora, uuid);

describe("Tareas con descripción y lista de comprobación", () => {
  it("crea la tarea con su descripción y su lista, dando id a los puntos nuevos", () => {
    const ws = run(createDemo(), { type: "task.create", project_id: demoId(10), title: "Demoler tabique", trade: "Demoliciones", due_date: "2026-11-10", weight: 10, description: "  Ojo con la bajante.  ", checklist: [{ id: "a1", text: " Proteger suelo " }, { text: "Retirar escombro", done: true }] });
    const t = ws.tasks.find(x => x.title === "Demoler tabique")!;
    expect(t.description).toBe("Ojo con la bajante.");
    expect(t.checklist!.map(p => [p.text, p.done])).toEqual([["Proteger suelo", false], ["Retirar escombro", true]]);
    expect(t.checklist![0].id).toBe("a1");
    expect(t.checklist![1].id).toBeTruthy();
    expect(textoProgreso(t.checklist)).toBe("1 de 2");
  });
  it("cada punto se marca por separado, también el equipo de obra, que no puede editar la tarea", () => {
    let ws = createDemo();
    const t = ws.tasks.find(x => x.id === demoId(202))!;
    expect(progresoLista(t.checklist)).toEqual({ hechos: 1, total: 4 });
    const obra = { ...demoActor, role: "site" } as Actor;
    ws = run(ws, { type: "task.check", id: t.id, item_id: "rep-2", done: true }, obra);
    expect(progresoLista(ws.tasks.find(x => x.id === t.id)!.checklist)).toEqual({ hechos: 2, total: 4 });
    expect(ws.activities[0].text).toBe("Punto hecho en «Replantear tabiquería con el electricista»: Marcar tabiques nuevos en el suelo");
    expect(() => run(ws, { type: "task.update", id: t.id, description: "x" }, obra)).toThrow();
    expect(() => run(ws, { type: "task.check", id: t.id, item_id: "no-existe", done: true })).toThrow("Ese punto ya no está");
  });
  it("editar la lista conserva lo marcado y rechaza puntos vacíos o demasiados", () => {
    let ws = createDemo();
    const t = ws.tasks.find(x => x.id === demoId(202))!;
    ws = run(ws, { type: "task.update", id: t.id, checklist: [...t.checklist!, { text: "Barrer" }] });
    const l = ws.tasks.find(x => x.id === t.id)!.checklist!;
    expect(l).toHaveLength(5); expect(l[0].done).toBe(true); expect(l[4]).toMatchObject({ text: "Barrer", done: false });
    expect(() => run(ws, { type: "task.update", id: t.id, checklist: [{ text: "   " }] })).toThrow();
    expect(() => run(ws, { type: "task.update", id: t.id, checklist: Array.from({ length: 51 }, (_, i) => ({ text: `p${i}` })) })).toThrow();
    expect(progresoLista([])).toBeNull();
  });
  it("el operario ve la descripción y la lista en su enlace y puede marcarla", () => {
    let ws = createDemo();
    ws = run(ws, { type: "parte.create", id: demoId(960), task_id: demoId(202), snapshot: { direccion: "", notas: "", contacto: "", telefono: "", para: "", material: [] } });
    const token = ws.task_shares![0].token;
    const v = vistaParte(ws, token, ahora);
    expect(v).toMatchObject({ estado: "ok", descripcion: expect.stringContaining("tabiques nuevos") });
    if (v.estado !== "ok") throw new Error();
    expect(v.lista).toHaveLength(4);
    ws = parteCheck(ws, token, "rep-3", true, ahora);
    expect(ws.tasks.find(x => x.id === demoId(202))!.checklist!.find(p => p.id === "rep-3")!.done).toBe(true);
    expect(() => parteCheck(ws, token, "otro", true, ahora)).toThrow("Ese punto ya no está");
  });
});
