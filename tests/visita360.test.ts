import { describe, it, expect } from "vitest";
import { interpretarOrden, partidasDe, buscarArticulo, cantidadPorDefecto } from "@/lib/visita360";
import { createDemo, demoId } from "@/lib/demo";

const { articles } = createDemo();
const nombre = (texto: string) => { const o = interpretarOrden(texto, articles); return o && "article" in o ? o.article.name : o?.tipo ?? null; };

describe("Órdenes de la visita 360", () => {
  it("entiende cantidad, unidad y artículo dichos como en obra", () => {
    const o = interpretarOrden("añade 20 metros de tarima", articles);
    expect(o).toMatchObject({ tipo: "añadir", quantity: 20, aproximada: false });
    expect(o && "article" in o ? o.article.code : "").toBe("PAV-001");
    expect(interpretarOrden("pon dos puertas aquí", articles)).toMatchObject({ tipo: "añadir", quantity: 2 });
    expect(interpretarOrden("pintar las paredes, 35 metros cuadrados", articles)).toMatchObject({ tipo: "añadir", quantity: 35 });
    expect(interpretarOrden("quiero tres puntos de luz", articles)).toMatchObject({ tipo: "añadir", quantity: 3 });
    expect(nombre("tirar este tabique")).toBe("Demolición de tabiquería interior");
    expect(nombre("un armario empotrado")).toBe("Armario a medida con distribución interior");
  });
  it("sin cantidad pone una por defecto y la marca como aproximada", () => {
    const o = interpretarOrden("pon tarima en el suelo", articles);
    expect(o).toMatchObject({ tipo: "añadir", aproximada: true, quantity: cantidadPorDefecto("m²") });
  });
  it("entiende quitar, total, incorporar, deshacer y cambiar de estancia", () => {
    expect(nombre("quita la pintura")).toBe("Preparación y pintura de paredes");
    expect(interpretarOrden("¿cuánto va?", articles)).toEqual({ tipo: "total" });
    expect(interpretarOrden("pásalo al presupuesto", articles)).toEqual({ tipo: "incorporar" });
    expect(interpretarOrden("deshaz lo último", articles)).toEqual({ tipo: "deshacer" });
    expect(interpretarOrden("cambia a la casa vacía", articles)).toMatchObject({ tipo: "cambiar" });
  });
  it("no inventa artículos ni órdenes", () => {
    expect(interpretarOrden("hola buenos días", articles)).toBeNull();
    expect(interpretarOrden("añade veinte metros de mármol de carrara", articles)).toBeNull();
    expect(buscarArticulo("", articles)).toBeNull();
  });
  it("el ticket suma las cantidades del mismo artículo", () => {
    const items = partidasDe([
      { id: "a", article_id: demoId(32), quantity: 10, yaw: 0, pitch: 0, origen: "voz", aproximada: false },
      { id: "b", article_id: demoId(32), quantity: 5.5, yaw: 1, pitch: 0, origen: "toque", aproximada: false },
      { id: "c", article_id: demoId(33), quantity: 1, yaw: 2, pitch: 0, origen: "toque", aproximada: false }
    ], articles);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ quantity: 15.5, unit: "m²", inclusion: "included" });
  });
});
