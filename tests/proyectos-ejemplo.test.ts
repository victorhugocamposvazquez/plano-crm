import { describe, it, expect } from "vitest";
import { cargarEjemplos, previsualizar, articulosQueFaltan } from "@/lib/proyectos-ejemplo";
import { createDemo, demoActor } from "@/lib/demo";
import { applyCommand, type Workspace, type Command } from "@/lib/domain";

/** Un espacio de trabajo recién estrenado: organización sin proyectos ni catálogo. */
const vacio = (): Workspace => ({ ...createDemo(), projects: [], articles: [], budgets: [], versions: [], tasks: [], purchases: [], documents: [], messages: [], activities: [], certifications: [] });

describe("Proyectos de ejemplo", () => {
  it("cuenta qué trae cada ejemplo y si ya está", () => {
    const vista = previsualizar(vacio());
    expect(vista).toHaveLength(5);
    expect(vista[0]).toMatchObject({ name: "Vivienda en Monte Alto", status: "active", versiones: 2, tareas: 4, compras: 1, existe: false });
    expect(previsualizar(createDemo()).every(p => p.existe)).toBe(true);
    expect(articulosQueFaltan(vacio())).toHaveLength(8);
    expect(articulosQueFaltan(createDemo())).toHaveLength(0);
  });

  it("carga los cinco por los comandos del dominio: catálogo, estados, V1 aprobada y V2 en borrador, tareas hechas, compras y mensajes", async () => {
    let ws = vacio();
    const send = async (command: Command) => (ws = applyCommand(ws, command, demoActor));
    const r = await cargarEjemplos({ data: ws, send });
    expect(r).toMatchObject({ proyectos: 5, presupuestos: 4, tareas: 8, compras: 2, articulos: 8, errores: [] });
    expect(ws.projects).toHaveLength(5);
    expect(ws.articles).toHaveLength(8);

    const monte = ws.projects.find(p => p.name === "Vivienda en Monte Alto");
    expect(monte?.status).toBe("active");
    const budget = ws.budgets.find(b => b.project_id === monte?.id);
    const versiones = ws.versions.filter(v => v.budget_id === budget?.id).sort((a, b) => a.number - b.number);
    expect(versiones.map(v => v.status)).toEqual(["approved", "draft"]);
    expect(budget?.approved_version_id).toBe(versiones[0].id);
    expect(versiones[0].items).toHaveLength(6);
    expect(versiones[1].items).toHaveLength(7);
    expect(versiones[1].notes).toMatch(/pavimento/);

    expect(ws.tasks).toHaveLength(8);
    expect(ws.tasks.filter(t => t.status === "done")).toHaveLength(3);
    expect(ws.purchases.find(p => p.name === "Placas de yeso laminado")).toMatchObject({ status: "ordered", received_quantity: 40, delivered_quantity: 40 });
    expect(ws.messages.filter(m => m.project_id === monte?.id)).toHaveLength(1);
    expect(ws.projects.find(p => p.name === "Reforma de baño")?.status).toBe("lead");
  });

  it("se puede repetir: lo que ya existe se deja como está", async () => {
    let ws = createDemo();
    const send = async (command: Command) => (ws = applyCommand(ws, command, demoActor));
    const r = await cargarEjemplos({ data: ws, send });
    expect(r).toMatchObject({ proyectos: 0, presupuestos: 0, articulos: 0, errores: [] });
    expect(r.omitidos).toHaveLength(5);
    expect(ws.projects).toHaveLength(5);
  });
});
