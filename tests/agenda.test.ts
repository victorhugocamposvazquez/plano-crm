import { describe, it, expect } from "vitest";
import { lunesDe, diasDeSemana, sumarDias, porDia, atrasadasAntesDe, cargaSemanal, filtrar, tareasConProyecto, oficios, personas } from "@/lib/agenda";
import { createDemo } from "@/lib/demo";
import { localDate } from "@/lib/hoy";

describe("Agenda de oficios", () => {
  const data = createDemo();
  const tareas = tareasConProyecto(data);
  const hoy = localDate();
  const lunes = lunesDe(hoy);

  it("calcula el lunes de la semana y sus siete días", () => {
    expect(lunesDe("2026-10-26")).toBe("2026-10-26"); // lunes
    expect(lunesDe("2026-10-30")).toBe("2026-10-26"); // viernes
    expect(lunesDe("2026-11-01")).toBe("2026-10-26"); // domingo
    expect(diasDeSemana("2026-10-26")).toHaveLength(7);
    expect(diasDeSemana("2026-10-26")[6]).toBe("2026-11-01");
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("reparte las tareas por día con las pendientes primero", () => {
    const dias = porDia(tareas, lunes);
    expect([...dias.keys()]).toEqual(diasDeSemana(lunes));
    const hoyLista = dias.get(hoy) ?? [];
    const estados = hoyLista.map(t => t.status);
    expect(estados.indexOf("done") === -1 || estados.indexOf("done") >= estados.lastIndexOf("pending")).toBe(true);
  });

  it("detecta tareas pendientes anteriores a la semana", () => {
    const stale = structuredClone(data);
    stale.tasks[0].status = "pending"; // vencía hace días
    expect(atrasadasAntesDe(tareasConProyecto(stale), lunes).map(t => t.id)).toContain(stale.tasks[0].id);
    expect(atrasadasAntesDe(tareas, lunes).every(t => t.due_date < lunes)).toBe(true);
  });

  it("resume la carga semanal por oficio y por persona", () => {
    const porOficio = cargaSemanal(tareas, lunes, "trade");
    const total = porOficio.reduce((s, c) => s + c.pendientes, 0);
    expect(total).toBe(tareas.filter(t => t.status === "pending" && t.due_date >= lunes && t.due_date <= sumarDias(lunes, 6)).length);
    expect(cargaSemanal(tareas, lunes, "assignee").every(c => c.clave)).toBe(true);
  });

  it("filtra por oficio y persona y lista los valores existentes", () => {
    expect(filtrar(tareas, { oficio: "Carpintería", persona: "" }).every(t => t.trade === "Carpintería")).toBe(true);
    expect(filtrar(tareas, { oficio: "", persona: "Dani" }).every(t => t.assignee === "Dani")).toBe(true);
    expect(oficios(data.tasks)).toContain("Coordinación");
    expect(personas(data.tasks)).toContain("Marta");
  });
});
