import { describe, it, expect } from "vitest";
import { partidaDesdeArticulo, partidaLibre, actualizarPartida, quitarPartida, moverPartida, validarPartidas, partidasPorCapitulo, guiaPorTipo, progresoGuia, resumen } from "@/lib/presupuesto";
import { itemSchema, lineTotal } from "@/lib/domain";
import { createDemo } from "@/lib/demo";

const { articles } = createDemo();

describe("Editor manual de presupuesto", () => {
  it("crea una partida válida desde un artículo con su precio copiado", () => {
    const item = partidaDesdeArticulo(articles[2], 42);
    expect(itemSchema.safeParse(item).success).toBe(true);
    expect(item.unit_price).toBe(articles[2].unit_price);
    expect(item.chapter).toBe("Pavimentos");
    expect(lineTotal(item)).toBe(42 * 4950);
  });

  it("acota cantidad, ajuste y precio a los límites del dominio", () => {
    const base = [partidaLibre("Pintura", "Pintar salón", "m²", 1450)];
    const items = actualizarPartida(actualizarPartida(actualizarPartida(base, base[0].id, { quantity: 12.34567 }), base[0].id, { adjustment_percent: 180 }), base[0].id, { unit_price: 1234.6 });
    expect(items[0].quantity).toBe(12.346);
    expect(items[0].adjustment_percent).toBe(100);
    expect(items[0].unit_price).toBe(1235);
    expect(itemSchema.safeParse(items[0]).success).toBe(true);
  });

  it("detecta partidas sin descripción y respeta las válidas", () => {
    const items = [partidaLibre("Varios", ""), partidaDesdeArticulo(articles[0])];
    const errores = validarPartidas(items);
    expect(errores).toHaveLength(1);
    expect(errores[0].id).toBe(items[0].id);
  });

  it("quita y reordena partidas sin perder ninguna", () => {
    const a = partidaDesdeArticulo(articles[0]), b = partidaDesdeArticulo(articles[1]), c = partidaDesdeArticulo(articles[2]);
    expect(moverPartida([a, b, c], c.id, -1).map(i => i.id)).toEqual([a.id, c.id, b.id]);
    expect(moverPartida([a, b, c], a.id, -1).map(i => i.id)).toEqual([a.id, b.id, c.id]);
    expect(quitarPartida([a, b, c], b.id)).toHaveLength(2);
    expect([...partidasPorCapitulo([a, b, c]).keys()]).toEqual(["Demoliciones", "Albañilería", "Pavimentos"]);
  });

  it("la guía sigue el orden de obra y marca los capítulos cubiertos", () => {
    const pasos = guiaPorTipo("integral");
    expect(pasos[0].chapter).toBe("Demoliciones");
    expect(pasos.at(-1)?.chapter).toBe("Varios");
    expect(guiaPorTipo("carpentry").map(p => p.chapter)).toEqual(["Carpintería", "Pintura", "Varios"]);
    const estado = progresoGuia(pasos, [partidaDesdeArticulo(articles[0])]);
    expect(estado[0].count).toBe(1);
    expect(estado[1].count).toBe(0);
  });

  it("resume base, IVA y recuento de incluidas y alternativas", () => {
    const a = partidaDesdeArticulo(articles[0], 10);
    const b = { ...partidaDesdeArticulo(articles[1], 10), inclusion: "optional" as const };
    const r = resumen([a, b]);
    expect(r.base).toBe(lineTotal(a));
    expect(r.incluidas).toBe(1);
    expect(r.alternativas).toBe(1);
  });
});

import { accionesPresupuesto, describirCambio } from "@/lib/presupuesto";
import { compareVersions } from "@/lib/domain";

describe("Ciclo de vida de la revisión", () => {
  const demo = createDemo();
  const aprobada = demo.versions.find(v => v.id === "00000000-0000-4000-8000-000000000060")!;
  const borrador = demo.versions.find(v => v.id === "00000000-0000-4000-8000-000000000061")!;

  it("ofrece editar y cerrar sobre un borrador con partidas, y solo editar si está vacío", () => {
    expect(accionesPresupuesto(aprobada, borrador, { guardar: true, aprobar: true })).toEqual(["editar", "cerrar"]);
    expect(accionesPresupuesto(undefined, { ...borrador, items: [] }, { guardar: true, aprobar: true })).toEqual(["editar"]);
    expect(accionesPresupuesto(aprobada, borrador, { guardar: false, aprobar: false })).toEqual([]);
  });

  it("sobre una revisión cerrada ofrece aprobar o abrir otra, y sobre la aprobada sola, revisar", () => {
    expect(accionesPresupuesto(aprobada, { ...borrador, status: "issued" }, { guardar: true, aprobar: true })).toEqual(["aprobar", "revisar"]);
    expect(accionesPresupuesto(aprobada, { ...borrador, status: "issued" }, { guardar: true, aprobar: false })).toEqual(["revisar"]);
    expect(accionesPresupuesto(aprobada, undefined, { guardar: true, aprobar: true })).toEqual(["revisar"]);
  });

  it("describe cada cambio campo a campo", () => {
    const cambios = compareVersions(aprobada, borrador);
    const textos = cambios.flatMap(describirCambio);
    expect(textos.some(t => t.startsWith("Cantidad:"))).toBe(true);
    expect(textos.some(t => t.startsWith("Añadida"))).toBe(true);
    expect(textos.every(t => t.length > 0)).toBe(true);
  });
});
