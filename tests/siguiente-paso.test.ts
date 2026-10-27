import { describe, it, expect } from "vitest";
import { siguientePaso, queToca } from "@/lib/siguiente-paso";
import { createDemo, demoId } from "@/lib/demo";

const data = createDemo();
const hoy = "2026-10-27";
const proyecto = (id: number) => data.projects.find(p => p.id === demoId(id))!;

describe("Siguiente paso", () => {
  it("sin presupuesto propone abrirlo; con borrador vacío, añadir partidas", () => {
    expect(siguientePaso(data, proyecto(14), hoy)).toMatchObject({ etapa: "visita", accion: "presupuesto" });
    const conVacio = { ...data, budgets: [...data.budgets, { id: "b", organization_id: data.organization_id, project_id: demoId(14), title: "P", approved_version_id: null, created_at: "2026-10-27" }], versions: [...data.versions, { ...data.versions[1], id: "v", budget_id: "b", items: [], status: "draft" as const, number: 1 }] };
    expect(siguientePaso(conVacio, proyecto(14), hoy)).toMatchObject({ etapa: "presupuesto", accion: "editar" });
  });

  it("con borrador con partidas pide cerrarlo; cerrado, aprobarlo", () => {
    expect(siguientePaso(data, proyecto(11), hoy)).toMatchObject({ etapa: "presupuesto", accion: "cerrar" });
    const cerrado = { ...data, versions: data.versions.map(v => (v.budget_id === demoId(51) ? { ...v, status: "issued" as const } : v)) };
    expect(siguientePaso(cerrado, proyecto(11), hoy)).toMatchObject({ etapa: "aprobacion", accion: "aprobar", urgencia: 2 });
  });

  it("en obra señala la tarea atrasada antes que la siguiente", () => {
    const paso = siguientePaso(data, proyecto(10), hoy);
    expect(paso.etapa).toBe("obra");
    expect(paso.accion).toBe("tarea");
    expect(paso.tarea?.id).toBe(demoId(202));
    const sinPendientes = { ...data, tasks: data.tasks.map(t => (t.project_id === demoId(10) ? { ...t, status: "done" as const } : t)) };
    expect(siguientePaso(sinPendientes, proyecto(10), hoy)).toMatchObject({ etapa: "entrega", accion: "certificar" });
  });

  it("planificación sin tareas pide crearlas; con tareas, arrancar la obra", () => {
    expect(siguientePaso(data, proyecto(13), hoy)).toMatchObject({ etapa: "obra", accion: "tareas" });
    const conTareas = { ...data, tasks: [...data.tasks, { ...data.tasks[0], id: "t", project_id: demoId(13) }] };
    expect(siguientePaso(conTareas, proyecto(13), hoy)).toMatchObject({ accion: "iniciar-obra" });
  });

  it("ordena lo que toca por urgencia y deja fuera lo finalizado", () => {
    const lista = queToca(data, hoy);
    expect(lista[0].paso.urgencia).toBeGreaterThanOrEqual(lista[lista.length - 1].paso.urgencia);
    const conFinalizado = { ...data, projects: data.projects.map(p => (p.id === demoId(12) ? { ...p, status: "completed" as const } : p)) };
    expect(queToca(conFinalizado, hoy).some(x => x.project.id === demoId(12))).toBe(false);
  });
});
