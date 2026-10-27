import { describe, it, expect } from "vitest";
import { applyCommand, can } from "@/lib/domain";
import { createDemo, demoActor, demoId } from "@/lib/demo";

const data = createDemo();
const tarea = data.tasks.find(t => t.id === demoId(202))!;

describe("Editar y eliminar tareas", () => {
  it("actualiza solo los campos enviados", () => {
    const out = applyCommand(data, { type: "task.update", id: tarea.id, due_date: "2026-11-03", assignee: "Dani" }, demoActor);
    const t = out.tasks.find(x => x.id === tarea.id)!;
    expect(t.due_date).toBe("2026-11-03");
    expect(t.assignee).toBe("Dani");
    expect(t.title).toBe(tarea.title);
    expect(t.weight).toBe(tarea.weight);
    expect(out.activities[0].text).toMatch(/Tarea actualizada/);
  });

  it("valida fecha y peso igual que al crear", () => {
    expect(() => applyCommand(data, { type: "task.update", id: tarea.id, due_date: "mañana" } as never, demoActor)).toThrow();
    expect(() => applyCommand(data, { type: "task.update", id: tarea.id, weight: 0 }, demoActor)).toThrow();
  });

  it("elimina la tarea y el avance del proyecto se recalcula", () => {
    const out = applyCommand(data, { type: "task.delete", id: tarea.id }, demoActor);
    expect(out.tasks.some(t => t.id === tarea.id)).toBe(false);
    expect(() => applyCommand(out, { type: "task.delete", id: tarea.id }, demoActor)).toThrow(/no encontrada/);
  });

  it("el equipo de obra puede completar pero no editar ni eliminar", () => {
    expect(can("site", "task.toggle")).toBe(true);
    expect(can("site", "task.update")).toBe(false);
    expect(can("site", "task.delete")).toBe(false);
    expect(can("manager", "task.update")).toBe(true);
  });
});
