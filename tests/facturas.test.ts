import { describe, expect, it } from "vitest";
import { createDemo, demoActor, demoId } from "@/lib/demo";
import { applyCommand, can } from "@/lib/domain";
import { estadoFactura, porCobrar, vencimientoPorDefecto } from "@/lib/facturas";
import { construirAvisos } from "@/lib/avisos";

const limpio = () => { const d = createDemo(); d.invoices = []; return d; };
const proyecto = demoId(10);
const nueva = (d = limpio(), base = 10000) => applyCommand(d, { type: "invoice.create", project_id: proyecto, concept: "Prueba", base, vat_rate: 21 }, demoActor);

describe("facturas", () => {
  it("calcula IVA y total y nace sin número", () => {
    const f = nueva().invoices![0];
    expect(f).toMatchObject({ status: "draft", number: null, tax: 2100, total: 12100, client_name: "Cliente de ejemplo 01" });
  });
  it("la serie es correlativa y un borrador borrado no deja hueco", () => {
    let d = nueva();
    d = applyCommand(d, { type: "invoice.delete", id: d.invoices![0].id }, demoActor);
    d = nueva(d); d = applyCommand(d, { type: "invoice.send", id: d.invoices![0].id, due_date: "2099-01-01" }, demoActor);
    d = nueva(d); d = applyCommand(d, { type: "invoice.send", id: d.invoices![1].id, due_date: "2099-01-01" }, demoActor);
    const year = new Date().getFullYear();
    expect(d.invoices!.map(f => f.number)).toEqual([`${year}-0001`, `${year}-0002`]);
  });
  it("una enviada no se edita ni se borra; el cobro se puede deshacer", () => {
    let d = nueva(); const id = d.invoices![0].id;
    d = applyCommand(d, { type: "invoice.send", id, due_date: "2099-01-01" }, demoActor);
    expect(() => applyCommand(d, { type: "invoice.update", id, concept: "Otro" }, demoActor)).toThrow(/no se edita/);
    expect(() => applyCommand(d, { type: "invoice.delete", id }, demoActor)).toThrow(/no se borra/);
    d = applyCommand(d, { type: "invoice.pay", id, paid_on: "2026-10-31" }, demoActor);
    expect(d.invoices![0].status).toBe("paid");
    d = applyCommand(d, { type: "invoice.unpay", id }, demoActor);
    expect(d.invoices![0]).toMatchObject({ status: "sent", paid_on: null });
  });
  it("no envía con el vencimiento en el pasado", () => {
    const d = nueva();
    expect(() => applyCommand(d, { type: "invoice.send", id: d.invoices![0].id, due_date: "2000-01-01" }, demoActor)).toThrow(/anterior a hoy/);
  });
  it("solo oficina y administración", () => {
    expect(["admin", "office", "manager", "site", "viewer"].map(r => can(r as "admin", "invoice.create"))).toEqual([true, true, false, false, false]);
  });
  it("vencida es una enviada fuera de plazo, nunca una cobrada ni un borrador", () => {
    expect(estadoFactura({ status: "sent", due_date: "2026-10-30" }, "2026-10-31")).toBe("vencida");
    expect(estadoFactura({ status: "sent", due_date: "2026-10-31" }, "2026-10-31")).toBe("enviada");
    expect(estadoFactura({ status: "paid", due_date: "2026-10-30" }, "2026-10-31")).toBe("cobrada");
    expect(estadoFactura({ status: "draft", due_date: "2026-10-30" }, "2026-10-31")).toBe("borrador");
  });
  it("lo vencido va primero en lo que hay que cobrar y avisa a la oficina, no a la obra", () => {
    const d = createDemo();
    const orden = porCobrar([{ ...d.invoices![1], id: "b", due_date: "2099-01-01" }, { ...d.invoices![1], id: "a", due_date: "2000-01-01" }]);
    expect(orden.map(f => f.id)).toEqual(["a", "b"]);
    expect(construirAvisos(d, demoActor).some(a => a.tipo === "factura")).toBe(true);
    expect(construirAvisos(d, { ...demoActor, role: "site" }).some(a => a.tipo === "factura")).toBe(false);
  });
  it("vence a 30 días por defecto", () => { expect(vencimientoPorDefecto("2026-10-31")).toBe("2026-11-30"); });
});
