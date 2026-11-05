import { describe, it, expect } from "vitest";
import { aplicarPlantilla, clavesDeNombre, plantillasDisponibles, plantillasTarea, propiaConNombre, sugerirPlantilla, textosDePlantilla } from "@/lib/plantillas-tarea";
import { applyCommand, type TaskTemplate } from "@/lib/domain";
import { createDemo, demoActor } from "@/lib/demo";

describe("Plantillas de subtareas", () => {
  it("sugiere la plantilla por el título de la tarea", () => {
    expect(sugerirPlantilla("Pintar el salón")?.id).toBe("pintar");
    expect(sugerirPlantilla("Demoler el tabique de la cocina")?.id).toBe("demoler");
    expect(sugerirPlantilla("Alicatar el baño")?.id).toBe("alicatar");
    expect(sugerirPlantilla("Poner tarima en el dormitorio")?.id).toBe("tarima");
    expect(sugerirPlantilla("Cambiar enchufes del pasillo")?.id).toBe("electricidad");
    expect(sugerirPlantilla("Cambiar el plato de ducha")?.id).toBe("fontaneria");
    expect(sugerirPlantilla("Replantear con el cliente")).toBeNull();
    expect(sugerirPlantilla("ab")).toBeNull();
  });
  it("añade sus subtareas al final, sin repetir las que ya están", () => {
    const pintar = plantillasTarea.find(p => p.id === "pintar")!;
    const ya = [{ id: "x", text: "Primera mano", done: true }, { id: "y", text: "Mover el sofá", done: false }];
    const l = aplicarPlantilla(ya, pintar);
    expect(l.slice(0, 2)).toEqual(ya);
    expect(l.filter(p => p.text === "Primera mano")).toHaveLength(1);
    expect(l).toHaveLength(2 + pintar.subtareas.length - 1);
    expect(l.at(-1)).toMatchObject({ text: "Retirar protecciones y limpiar", done: false });
    expect(aplicarPlantilla(l, pintar)).toHaveLength(l.length);
  });
  it("cada plantilla trae varias subtareas y su oficio", () => {
    for (const p of plantillasTarea) { expect(p.subtareas.length).toBeGreaterThanOrEqual(5); expect(p.oficio).toBeTruthy(); }
  });
});

describe("Plantillas de la empresa", () => {
  const propia = (name: string, subtasks: string[], trade = "Pintura"): TaskTemplate => ({ id: `t-${name}`, organization_id: "o", name, trade, subtasks, created_by_name: "Pablo", created_at: "", updated_at: "" });
  it("van primero y sustituyen a la de base con el mismo nombre", () => {
    const todas = plantillasDisponibles([propia("pintar paredes", ["Llevar pintura", "Dos manos"]), propia("Cambiar ventanas", ["Desmontar", "Colocar"], "Carpintería")]);
    expect(todas.slice(0, 2).map(p => p.nombre)).toEqual(["Cambiar ventanas", "pintar paredes"]);
    expect(todas.filter(p => p.nombre.toLowerCase() === "pintar paredes")).toHaveLength(1);
    expect(todas).toHaveLength(plantillasTarea.length + 1);
    expect(todas[1].propia?.id).toBe("t-pintar paredes");
    expect(sugerirPlantilla("Pintar los techos", todas)?.propia?.id).toBe("t-pintar paredes");
  });
  it("se sugieren por las palabras de su nombre, no por verbos genéricos", () => {
    const todas = plantillasDisponibles([propia("Cambiar ventanas", ["Desmontar"], "Carpintería"), propia("Pintar fachada", ["Andamio"])]);
    expect(sugerirPlantilla("Ventanas del salón", todas)?.nombre).toBe("Cambiar ventanas");
    expect(sugerirPlantilla("Cambiar enchufes del pasillo", todas)?.id).toBe("electricidad");
    // En empate gana la de la empresa.
    expect(sugerirPlantilla("Pintar la fachada", todas)?.nombre).toBe("Pintar fachada");
    expect(sugerirPlantilla("Pintar el salón", todas)?.id).toBe("pintar");
    expect(clavesDeNombre("De la obra").test("cualquier cosa")).toBe(false);
  });
  it("las subtareas de una tarea se guardan como textos limpios y sin repetir", () => {
    expect(textosDePlantilla([{ id: "a", text: " Andamio ", done: true, assignee: "Lucía" }, { id: "b", text: "andamio", done: false }, { id: "c", text: "  ", done: false }, { id: "d", text: "Lavar", done: false }])).toEqual(["Andamio", "Lavar"]);
    expect(propiaConNombre([propia("Pintar fachada", ["x"])], "pintar fachada ")?.id).toBe("t-Pintar fachada");
  });
});

describe("Comandos de plantillas (demo)", () => {
  it("crea, corrige y borra, sin nombres repetidos y solo si puedes crear tareas", () => {
    let w = createDemo();
    const antes = w.task_templates?.length ?? 0;
    w = applyCommand(w, { type: "template.create", name: "Pintar fachada", trade: "Pintura", subtasks: ["Andamio", "Dos manos"] }, demoActor);
    const t = w.task_templates!.find(x => x.name === "Pintar fachada")!;
    expect(t.created_by_name).toBe(demoActor.name);
    expect(() => applyCommand(w, { type: "template.create", name: "pintar FACHADA", trade: "", subtasks: ["x"] }, demoActor)).toThrow("Ya hay una plantilla con ese nombre.");
    expect(() => applyCommand(w, { type: "template.create", name: "Vacía", trade: "", subtasks: [] }, demoActor)).toThrow();
    w = applyCommand(w, { type: "template.update", id: t.id, subtasks: ["Montar andamio", "Lavar", "Dos manos"] }, demoActor);
    expect(w.task_templates!.find(x => x.id === t.id)!.subtasks).toHaveLength(3);
    expect(() => applyCommand(w, { type: "template.delete", id: t.id }, { ...demoActor, role: "site" })).toThrow();
    w = applyCommand(w, { type: "template.delete", id: t.id }, demoActor);
    expect(w.task_templates).toHaveLength(antes);
    expect(w.activities[0].text).toBe("Plantilla de tarea borrada: Pintar fachada");
  });
});
