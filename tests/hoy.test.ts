import { describe, it, expect } from "vitest";
import { buildAgenda, buildAlerts, localDate, greeting } from "@/lib/hoy";
import { createDemo, demoId } from "@/lib/demo";

describe("Agenda del día", () => {
  const data = createDemo();
  const today = localDate();

  it("reparte las tareas pendientes en atrasadas, de hoy y próximas sin perder ninguna", () => {
    const agenda = buildAgenda(data, today);
    const pending = data.tasks.filter(t => t.status === "pending");
    const listed = [...agenda.overdue, ...agenda.today, ...agenda.upcoming];
    expect(listed.length).toBeLessThanOrEqual(pending.length);
    expect(agenda.overdue.every(t => t.due_date < today)).toBe(true);
    expect(agenda.today.every(t => t.due_date === today)).toBe(true);
    expect(agenda.upcoming.every(t => t.due_date > today)).toBe(true);
    expect(agenda.today.map(t => t.id)).toContain(demoId(202));
  });

  it("ordena por fecha y, a igual fecha, por peso descendente", () => {
    const agenda = buildAgenda(data, today);
    const dates = agenda.upcoming.map(t => t.due_date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("marca como atrasada una tarea pendiente con fecha anterior y la convierte en aviso", () => {
    const stale = structuredClone(data);
    stale.tasks[0].status = "pending";
    const agenda = buildAgenda(stale, today);
    expect(agenda.overdue.map(t => t.id)).toContain(stale.tasks[0].id);
    const alerts = buildAlerts(stale, today);
    expect(alerts[0].kind).toBe("task");
    expect(alerts[0].tone).toBe("warning");
  });
});

describe("Avisos", () => {
  const data = createDemo();

  it("avisa del borrador con cambios sobre un presupuesto aprobado y del pedido sin recibir", () => {
    const alerts = buildAlerts(data, localDate());
    expect(alerts.some(a => a.kind === "draft" && a.id === `draft-${demoId(61)}`)).toBe(true);
    expect(alerts.some(a => a.kind === "purchase" && a.id === `purchase-${demoId(300)}`)).toBe(true);
  });

  it("no avisa de borradores de presupuestos que aún no tienen versión aprobada", () => {
    const alerts = buildAlerts(data, localDate());
    expect(alerts.filter(a => a.kind === "draft")).toHaveLength(1);
  });

  it("pone las aprobaciones pendientes por delante de los borradores", () => {
    const issued = structuredClone(data);
    issued.versions.find(v => v.id === demoId(62))!.status = "issued";
    const kinds = buildAlerts(issued, localDate()).map(a => a.kind);
    expect(kinds.indexOf("approval")).toBeLessThan(kinds.indexOf("draft"));
  });

  it("saluda según la hora", () => {
    expect(greeting(9)).toBe("Buenos días");
    expect(greeting(16)).toBe("Buenas tardes");
    expect(greeting(23)).toBe("Buenas noches");
  });
});
