import { describe, it, expect } from "vitest";
import { loTuyo, resumenOtras } from "@/lib/lo-tuyo";
import { createDemo, demoActor } from "@/lib/demo";
import { menuMovil, puestos, trabajo } from "@/lib/puestos";

const data = createDemo();
/** Un día después del vencimiento de la factura enviada de demo, para que «facturación» vea vencidas con cualquier fecha real. */
const vencimiento = data.invoices?.find(f => f.status === "sent")?.due_date ?? "2026-11-03";
const hoy = (() => { const d = new Date(`${vencimiento}T12:00:00`); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();

describe("Lo tuyo por puesto", () => {
  it("reparte todo lo pendiente sin perder ni repetir nada", () => {
    for (const p of puestos) {
      const { tuyas, otras } = loTuyo(data, demoActor, p, hoy);
      const ids = [...tuyas, ...otras].map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBe(loTuyo(data, demoActor, "direccion", hoy).tuyas.length + loTuyo(data, demoActor, "direccion", hoy).otras.length);
    }
  });
  it("materiales ve los pedidos; facturación, las vencidas; oficina, los presupuestos", () => {
    expect(loTuyo(data, demoActor, "materiales", hoy).tuyas.every(c => c.id.startsWith("c-") || c.id.startsWith("t-"))).toBe(true);
    expect(loTuyo(data, demoActor, "materiales", hoy).tuyas.some(c => c.id.startsWith("c-"))).toBe(true);
    expect(loTuyo(data, demoActor, "facturacion", hoy).tuyas.some(c => c.id.startsWith("f-"))).toBe(true);
    expect(loTuyo(data, demoActor, "oficina", hoy).tuyas.some(c => c.label === "Revisar y enviar" || c.label === "Abrir presupuesto" || c.label === "Añadir partidas")).toBe(true);
    expect(loTuyo(data, demoActor, "oficina", hoy).tuyas.some(c => c.id.startsWith("f-"))).toBe(false);
  });
  it("lo más urgente va primero y una tarea asignada a ti es tuya en cualquier puesto", () => {
    const { tuyas } = loTuyo(data, demoActor, "direccion", hoy);
    for (let i = 1; i < tuyas.length; i++) expect(tuyas[i - 1].urgencia).toBeGreaterThanOrEqual(tuyas[i].urgencia);
    const mia = data.tasks.find(t => t.status === "pending" && t.assignee.startsWith("Alex") && t.due_date <= hoy);
    if (mia) for (const p of puestos) expect(loTuyo(data, demoActor, p, hoy).tuyas.some(c => c.id === `t-${mia.id}`)).toBe(true);
  });
  it("resume lo que espera a otros por quién lo lleva", () => {
    const { otras } = loTuyo(data, demoActor, "equipo", hoy);
    expect(resumenOtras(otras)).toMatch(/\d+ de/);
  });
  it("la barra del móvil respeta el orden de «Tu trabajo»", () => {
    for (const p of puestos) {
      const [a, b] = menuMovil[p], ia = trabajo[p].indexOf(a), ib = trabajo[p].indexOf(b);
      expect(ia).toBeGreaterThan(0);
      if (ib > 0) expect(ia).toBeLessThan(ib);
    }
  });
});
