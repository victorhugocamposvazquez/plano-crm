import { describe, it, expect } from "vitest";
import { primerosPasos, mostrarPrimerosPasos } from "@/lib/primeros-pasos";
import { completarBranding } from "@/lib/branding";
import { createDemo } from "@/lib/demo";

const demo = createDemo();
const vacio = { ...demo, projects: [], articles: [], budgets: [], versions: [], tasks: [], purchases: [], documents: [], messages: [], activities: [], certifications: [] };

describe("Primeros pasos", () => {
  it("con el espacio vacío todo está pendiente y se muestra", () => {
    const pasos = primerosPasos(vacio, completarBranding(null, "GARAL"));
    expect(pasos.every(p => !p.done)).toBe(true);
    expect(mostrarPrimerosPasos(pasos, vacio, false)).toBe(true);
    expect(mostrarPrimerosPasos(pasos, vacio, true)).toBe(false);
  });

  it("marca hechos los pasos según los datos y la identidad", () => {
    const pasos = primerosPasos(demo, completarBranding({ trade_name: "GARAL", tax_id: "B15000000" }));
    expect(pasos.find(p => p.id === "identidad")?.done).toBe(true);
    expect(pasos.find(p => p.id === "catalogo")?.done).toBe(true);
    expect(pasos.find(p => p.id === "proyecto")?.done).toBe(true);
    expect(pasos.find(p => p.id === "presupuesto")?.done).toBe(true);
    expect(mostrarPrimerosPasos(pasos, demo, false)).toBe(false);
  });

  it("deja de mostrarse en una organización con más de tres proyectos aunque falte algo", () => {
    const pasos = primerosPasos(demo, completarBranding(null, "GARAL"));
    expect(pasos.find(p => p.id === "identidad")?.done).toBe(false);
    expect(mostrarPrimerosPasos(pasos, demo, false)).toBe(false);
  });
});
