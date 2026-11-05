import { describe, it, expect } from "vitest";
import { applyCommand, type Actor } from "@/lib/domain";
import { createDemo, demoId, demoActor } from "@/lib/demo";
import { enlaceWhatsapp, haceOficio, operariosDe, telefonoE164 } from "@/lib/operarios";
import { calendarioParte, enlaceParte, leerParte, mensajeParte, type Parte } from "@/lib/parte";
import { asignacion, responsableDe } from "@/components/equipo/responsable-field";

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(990000 + ++n).padStart(12, "0")}`;
const run = (ws: ReturnType<typeof createDemo>, c: Parameters<typeof applyCommand>[1], quien: Actor = demoActor) => applyCommand(ws, c, quien, "2026-11-05T10:00:00.000Z", uuid);
const ficha = { phone: "", email: "", company: "", trades: [] as string[], hourly_cost: null, available: true, user_id: null, notes: "" };

describe("Operarios del equipo", () => {
  it("da de alta, asigna a tareas con su nombre y lo mantiene al día", () => {
    let ws = run(createDemo(), { type: "operario.create", ...ficha, name: "Rosa Vidal", phone: "611 22 33 44", trades: ["Demoliciones"] });
    const rosa = ws.operarios!.find(o => o.name === "Rosa Vidal")!;
    ws = run(ws, { type: "task.create", project_id: demoId(10), title: "Derribar tabique", trade: "Demolición", operario_id: rosa.id, due_date: "2026-11-10", weight: 10 });
    let t = ws.tasks.find(x => x.title === "Derribar tabique")!;
    expect(t).toMatchObject({ operario_id: rosa.id, assignee: "Rosa Vidal", assignee_id: null });
    ws = run(ws, { type: "operario.update", id: rosa.id, name: "Rosa Vidal Pena", available: false });
    expect(ws.tasks.find(x => x.id === t.id)!.assignee).toBe("Rosa Vidal Pena");
    ws = run(ws, { type: "operario.delete", id: rosa.id });
    t = ws.tasks.find(x => x.id === t.id)!;
    expect(t).toMatchObject({ operario_id: null, assignee: "Rosa Vidal Pena" });
  });
  it("si el operario tiene cuenta, la tarea también queda a su nombre de usuario; elegir otra persona quita el operario", () => {
    let ws = createDemo();
    const ana = ws.operarios!.find(o => o.user_id === demoId(706))!;
    ws = run(ws, { type: "task.create", project_id: demoId(10), title: "Rodapiés", trade: "Carpintería", operario_id: ana.id, due_date: "2026-11-12", weight: 10 });
    const t = ws.tasks.find(x => x.title === "Rodapiés")!;
    expect(t).toMatchObject({ operario_id: ana.id, assignee_id: demoId(706) });
    ws = run(ws, { type: "task.update", id: t.id, assignee: "Cuadrilla de Ferrer" });
    expect(ws.tasks.find(x => x.id === t.id)).toMatchObject({ operario_id: null, assignee_id: null, assignee: "Cuadrilla de Ferrer" });
  });
  it("rechaza datos que no valen y al equipo de obra", () => {
    expect(() => run(createDemo(), { type: "operario.create", ...ficha, name: "X", phone: "llámame" })).toThrow();
    expect(() => run(createDemo(), { type: "operario.create", ...ficha, name: "X", user_id: demoId(799) })).toThrow("Esa cuenta no pertenece");
    expect(() => run(createDemo(), { type: "task.create", project_id: demoId(10), title: "Y", trade: "Pintura", operario_id: demoId(799), due_date: "2026-11-10", weight: 10 })).toThrow("Ese operario no está");
    expect(() => run(createDemo(), { type: "operario.create", ...ficha, name: "X" }, { ...demoActor, role: "site" })).toThrow();
  });
  it("sabe quién hace cada categoría del catálogo, aunque cambie el plural", () => {
    const ops = createDemo().operarios!;
    expect(operariosDe("Demoliciones", ops).map(o => [o.name, o.available])).toEqual([["Manuel Rey", true], ["Iván Souto", false]]);
    expect(haceOficio({ trades: ["Demolición"] }, "Demoliciones")).toBe(true);
    expect(haceOficio({ trades: ["Pintura"] }, "Pavimentos")).toBe(false);
  });
  it("prepara teléfonos para llamar y WhatsApp", () => {
    expect(telefonoE164("611 22 33 44")).toBe("+34611223344");
    expect(telefonoE164("0034 611-22-33-44")).toBe("+34611223344");
    expect(telefonoE164("+351 912 345 678")).toBe("+351912345678");
    expect(enlaceWhatsapp("611 22 33 44", "Hola qué tal")).toBe("https://wa.me/34611223344?text=Hola%20qu%C3%A9%20tal");
    expect(enlaceWhatsapp("", "Hola")).toBe("https://wa.me/?text=Hola");
  });
  it("guarda y recupera el responsable elegido", () => {
    const data = createDemo();
    expect(asignacion({ valor: `op:${demoId(900)}`, libre: "" })).toEqual({ operario_id: demoId(900) });
    expect(asignacion({ valor: `m:${demoId(705)}`, libre: "" })).toEqual({ assignee_id: demoId(705) });
    expect(asignacion({ valor: "otra", libre: " Ferrer " })).toEqual({ assignee_id: null, assignee: "Ferrer" });
    expect(responsableDe({ assignee: "Manuel Rey", assignee_id: null, operario_id: demoId(900) }, data)).toEqual({ valor: `op:${demoId(900)}`, libre: "" });
    expect(responsableDe({ assignee: "Ferrer", assignee_id: null, operario_id: null }, data)).toEqual({ valor: "otra", libre: "Ferrer" });
  });
});

describe("Parte de trabajo por WhatsApp", () => {
  const parte: Parte = { v: 1, empresa: "GARAL", obra: "Apartamento en el centro", direccion: "Rúa Real 12, 3º, A Coruña", tarea: "Demoler tabique de la cocina", oficio: "Demoliciones", fecha: "2026-11-10", para: "Manuel Rey", contacto: "Dani", telefono: "+34 600 00 00 00", notas: "Llave en portería.\nTrae contenedor.", material: ["Sacos de escombro · 20 ud (en obra)"], enviado: "5 de noviembre, 10:00" };
  it("va entero dentro del enlace y se lee igual, con tildes y saltos de línea", () => {
    const enlace = enlaceParte("https://plano.example", parte);
    expect(enlace.startsWith("https://plano.example/parte#")).toBe(true);
    expect(leerParte(new URL(enlace).hash)).toEqual(parte);
  });
  it("no abre un enlace roto ni uno con datos que no son de un parte", () => {
    expect(leerParte("#roto")).toBeNull();
    expect(leerParte("#" + btoa(JSON.stringify({ v: 2, tarea: "x" })))).toBeNull();
  });
  it("escribe un mensaje que se entiende sin abrir el enlace y un evento de calendario", () => {
    const m = mensajeParte(parte, "https://x/parte#abc");
    expect(m).toContain("Hola Manuel, te envío una tarea de GARAL:");
    expect(m).toContain("• Demoler tabique de la cocina");
    expect(m).toContain("• Martes, 10 de noviembre · Apartamento en el centro");
    expect(m.endsWith("https://x/parte#abc")).toBe(true);
    const ics = calendarioParte(parte);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261110");
    expect(ics).toContain("DTEND;VALUE=DATE:20261111");
    expect(ics).toContain("LOCATION:Rúa Real 12\\, 3º\\, A Coruña");
  });
});
