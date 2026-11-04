import { describe, it, expect } from "vitest";
import { interpretarOrden, partidasDe, buscarArticulo, cantidadPorDefecto, esFoto360, proporcion360, muestra, type Zona } from "@/lib/visita360";
import { createDemo, demoId } from "@/lib/demo";

const { articles } = createDemo();
const zonas: Zona[] = [{ id: "cocina", nombre: "Cocina" }, { id: "salon", nombre: "Salón" }, { id: "bano", nombre: "Baño" }];
const orden = (texto: string) => interpretarOrden(texto, articles, zonas);
const nombre = (texto: string) => { const o = orden(texto); return o && "article" in o ? o.article.name : o?.tipo ?? null; };

describe("Órdenes de la visita 360", () => {
  it("entiende cantidad, unidad y artículo dichos como en obra", () => {
    const o = orden("añade 20 metros de tarima");
    expect(o).toMatchObject({ tipo: "añadir", quantity: 20 });
    expect(o && "article" in o ? o.article.code : "").toBe("PAV-001");
    expect(orden("pon dos puertas aquí")).toMatchObject({ tipo: "añadir", quantity: 2 });
    expect(orden("pintar las paredes, 35 metros cuadrados")).toMatchObject({ tipo: "añadir", quantity: 35 });
    expect(orden("quiero tres puntos de luz")).toMatchObject({ tipo: "añadir", quantity: 3 });
    expect(nombre("tirar este tabique")).toBe("Demolición de tabiquería interior");
    expect(nombre("un armario empotrado")).toBe("Armario a medida con distribución interior");
  });
  it("lleva cada orden a la estancia dicha, aunque se diga «solamente»", () => {
    expect(orden("pon tarima en la cocina solamente")).toMatchObject({ tipo: "añadir", quantity: null, zona: { id: "cocina" } });
    expect(orden("pinta las paredes del salón")).toMatchObject({ tipo: "añadir", zona: { id: "salon" } });
    expect(orden("quita la tarima de la cocina")).toMatchObject({ tipo: "quitar", zona: { id: "cocina" } });
    expect(orden("pon una puerta aquí")).toMatchObject({ tipo: "añadir", zona: undefined });
    expect(orden("vamos al baño")).toEqual({ tipo: "cambiar", zona: { id: "bano", nombre: "Baño" } });
  });
  it("sin cantidad no la inventa: sale de las medidas de la estancia o se pone una por defecto", () => {
    expect(orden("pon tarima en el suelo")).toMatchObject({ tipo: "añadir", quantity: null });
    expect(cantidadPorDefecto("m²")).toBe(10);
  });
  it("entiende total, incorporar y deshacer", () => {
    expect(orden("¿cuánto va?")).toEqual({ tipo: "total" });
    expect(orden("pásalo al presupuesto")).toEqual({ tipo: "incorporar" });
    expect(orden("deshaz lo último")).toEqual({ tipo: "deshacer" });
  });
  it("no inventa artículos ni órdenes", () => {
    expect(orden("hola buenos días")).toBeNull();
    expect(orden("añade veinte metros de mármol de carrara")).toBeNull();
    expect(buscarArticulo("", articles)).toBeNull();
  });
});

describe("Dónde va cada material", () => {
  it("cada material sabe en qué superficie de la estancia va", () => {
    const por = (code: string) => muestra(articles.find(a => a.code === code)!).superficie;
    expect(por("PAV-001")).toBe("suelo");
    expect(por("PIN-001")).toBe("pared");
    expect(por("ALB-001")).toBe("pared");
    expect(por("CAR-001")).toBe("pared");
    expect(por("ELE-001")).toBeUndefined();
  });
});

describe("Ticket de la visita", () => {
  it("una partida por artículo y estancia, con la estancia en la descripción", () => {
    const items = partidasDe([
      { id: "a", article_id: demoId(32), quantity: 10, yaw: 0, pitch: 0, origen: "voz", aproximada: false, foto: "cocina" },
      { id: "b", article_id: demoId(32), quantity: 5.5, yaw: 1, pitch: 0, origen: "toque", aproximada: true, foto: "cocina" },
      { id: "c", article_id: demoId(32), quantity: 20, yaw: 1, pitch: 0, origen: "toque", aproximada: false, foto: "salon" },
      { id: "d", article_id: demoId(33), quantity: 1, yaw: 2, pitch: 0, origen: "toque", aproximada: false, foto: "cocina" }
    ], articles, zonas);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ quantity: 15.5, unit: "m²", zona: "Cocina", aproximada: true });
    expect(items[0].description).toMatch(/ · Cocina$/);
    expect(items[1]).toMatchObject({ quantity: 20, zona: "Salón" });
  });
  it("reconoce las fotos 360 del proyecto por nombre y proporción", () => {
    expect(esFoto360({ name: "360 · Cocina.jpg", mime_type: "image/jpeg" })).toBe(true);
    expect(esFoto360({ name: "Cocina.jpg", mime_type: "image/jpeg" })).toBe(false);
    expect(proporcion360(8192, 4096)).toBe(true);
    expect(proporcion360(4000, 3000)).toBe(false);
  });
});
