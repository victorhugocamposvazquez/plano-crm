import { describe, expect, it } from "vitest";
import { avisosVisibles, construirAvisos, type Aviso } from "@/lib/avisos";
import { createDemo, demoActor, demoId } from "@/lib/demo";

const base = () => { const d = createDemo(); d.messages = []; d.tasks = []; d.invoices = []; return d; };
const msg = (body: string, author = "Dani · Demo", extra = {}) => ({ id: demoId(900), organization_id: "o", project_id: demoId(10), body, author_name: author, created_at: "2026-10-30T10:00:00Z", ...extra });
const tarea = (due: string, assignee = "Alex", extra = {}) => ({ id: demoId(901), organization_id: "o", project_id: demoId(10), title: "Pedir placa", trade: "Compras", assignee, due_date: due, status: "pending" as const, weight: 10, ...extra });

describe("avisos", () => {
  it("una mención a mi nombre avisa; la mía propia o a otro no", () => {
    const d = base(); d.messages = [msg("@Alex mañana nos quedamos sin placa")];
    expect(construirAvisos(d, demoActor, "2026-10-31").map(a => a.tipo)).toEqual(["mencion"]);
    d.messages = [msg("@Alexia mira esto")]; expect(construirAvisos(d, demoActor, "2026-10-31")).toEqual([]);
    d.messages = [msg("@Alex yo mismo", demoActor.name)]; expect(construirAvisos(d, demoActor, "2026-10-31")).toEqual([]);
  });
  it("un mensaje borrado no avisa", () => {
    const d = base(); d.messages = [msg("@Alex hola", "Dani · Demo", { deleted_at: "2026-10-30T11:00:00Z" })];
    expect(construirAvisos(d, demoActor, "2026-10-31")).toEqual([]);
  });
  it("las tareas atrasadas las ve quien las tiene y la oficina; el resto, no", () => {
    const d = base(); d.tasks = [tarea("2026-10-20", "Dani")];
    expect(construirAvisos(d, demoActor, "2026-10-31").map(a => a.tipo)).toEqual(["atrasada"]);
    expect(construirAvisos(d, { ...demoActor, role: "site" }, "2026-10-31")).toEqual([]);
  });
  it("avisa de mis tareas de hoy y de mañana, no de las de pasado", () => {
    const d = base(); d.tasks = [tarea("2026-11-01")];
    expect(construirAvisos(d, demoActor, "2026-10-31").map(a => a.texto)[0]).toMatch(/^mañana/);
    d.tasks = [tarea("2026-11-02")]; expect(construirAvisos(d, demoActor, "2026-10-31")).toEqual([]);
  });
  it("el menú enseña todos los sin leer y completa con leídos hasta tres", () => {
    const lista: Aviso[] = ["a", "b", "c", "d", "e"].map(id => ({ id, tipo: "mencion", quien: "Dani", texto: "", cuando: "2026-10-30", href: "/" }));
    expect(avisosVisibles(lista, new Set()).map(a => a.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(avisosVisibles(lista, new Set(["a", "b", "c"])).map(a => a.id)).toEqual(["a", "d", "e"]);
    expect(avisosVisibles(lista, new Set(["a", "b", "c", "d", "e"])).map(a => a.id)).toEqual(["a", "b", "c"]);
  });
});
