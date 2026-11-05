import { describe, it, expect } from "vitest";
import { createDemo } from "@/lib/demo";
import { aplicar3d, aspectos, cantidades, candidatos, colorDicho, elementoDe, escena3d, estadoInicial, interpretar3d, partidas3d, type Orden3d } from "@/lib/espacio3d";

const { articles } = createDemo();
const nombre = (o: Orden3d | null) => o && o.tipo === "poner" ? o.article.name : null;

describe("Propuesta en 3D con el catálogo", () => {
  it("reparte el catálogo en suelo, paredes y mobiliario, sin confundir placas ni tabiques", () => {
    expect(candidatos(articles, "suelo").map(a => a.code)).toEqual(["PAV-001", "PAV-002", "PAV-003"]);
    expect(candidatos(articles, "paredes").map(a => a.code)).toEqual(["PIN-001", "PIN-002"]);
    expect(candidatos(articles, "mueble").map(a => a.code)).toEqual(["CAR-002", "CAR-003", "EQU-001"]);
    expect(elementoDe({ chapter: "Materiales", name: "Placa de yeso laminado 13 mm", unit: "m²" })).toBeNull();
  });

  it("entiende qué poner y dónde, con el artículo del catálogo", () => {
    expect(nombre(interpretar3d("pon porcelánico en el suelo", articles))).toBe("Porcelánico imitación piedra con colocación");
    expect(nombre(interpretar3d("cambia el suelo a resina", articles))).toBe("Pavimento de resina continuo con imprimación");
    expect(nombre(interpretar3d("pon tarima", articles))).toBe("Tarima laminada con instalación");
    expect(interpretar3d("pinta las paredes de verde salvia", articles)).toMatchObject({ tipo: "poner", elemento: "paredes", color: "verde salvia", article: { code: "PIN-001" } });
    expect(interpretar3d("pon dos estanterías", articles)).toMatchObject({ tipo: "poner", elemento: "mueble", unidades: 2, article: { code: "EQU-001" } });
    expect(interpretar3d("un armario en nogal", articles)).toMatchObject({ tipo: "poner", elemento: "mueble", color: "nogal", article: { code: "CAR-002" } });
  });

  it("entiende color solo, medidas, espacio, cámara y lo demás", () => {
    expect(interpretar3d("las paredes en gris perla", articles)).toMatchObject({ tipo: "color", elemento: "paredes", color: "gris perla" });
    expect(interpretar3d("mide 6 por 4 y 3 de alto", articles)).toMatchObject({ tipo: "medidas", medidas: { largo: 6, ancho: 4, alto: 3 } });
    expect(interpretar3d("vamos a la nave", articles)).toEqual({ tipo: "espacio", espacio: "nave" });
    expect(interpretar3d("entra", articles)).toEqual({ tipo: "vista", vista: "inside" });
    expect(interpretar3d("gira a la izquierda", articles)).toEqual({ tipo: "mover", mover: "left" });
    expect(interpretar3d("enséñame el suelo", articles)).toEqual({ tipo: "vista", vista: "focus", elemento: "suelo" });
    expect(interpretar3d("quita el mueble", articles)).toEqual({ tipo: "quitar", elemento: "mueble" });
    expect(interpretar3d("¿cuánto va?", articles)).toEqual({ tipo: "total" });
    expect(interpretar3d("pásalo al presupuesto", articles)).toEqual({ tipo: "incorporar" });
    expect(interpretar3d("hola qué tal", articles)).toBeNull();
    expect(colorDicho("de azul marino")?.nombre).toBe("azul marino");
  });

  it("calcula con las medidas, no con el dibujo, y pone el precio del catálogo", () => {
    let e = estadoInicial("local");
    for (const frase of ["pon porcelánico en el suelo", "pinta las paredes de beige", "pon dos muebles auxiliares"]) e = aplicar3d(e, interpretar3d(frase, articles)!, articles);
    expect(cantidades(e)).toEqual({ suelo: 12, paredes: 36.2, mueble: 2 });
    const p = partidas3d(e, articles);
    expect(p.map(i => [i.description, i.quantity, i.unit_price])).toEqual([
      ["Porcelánico imitación piedra con colocación", 12, 5600],
      ["Preparación y pintura de paredes, color beige", 36.2, 1450],
      ["Mueble auxiliar de 120 cm montado", 2, 88000]
    ]);
    e = aplicar3d(e, { tipo: "medidas", medidas: { largo: 6, ancho: 4, alto: 3 } }, articles);
    expect(cantidades(e)).toEqual({ suelo: 24, paredes: 57, mueble: 2 });
  });

  it("dibuja tantas piezas como caben y cambia el color sin cambiar el artículo", () => {
    let e = aplicar3d(estadoInicial("local"), interpretar3d("pon seis estanterías", articles)!, articles);
    const looks = aspectos(e, articles);
    expect(escena3d(e, looks.mueble).objects.filter(o => o.kind === "furnishing")).toHaveLength(2);
    const n = aplicar3d(e, { tipo: "color", elemento: "mueble", color: "antracita" }, articles);
    expect(n.mueble).toMatchObject({ article_id: e.mueble!.article_id, color: "antracita", unidades: 6 });
    expect(aplicar3d(n, { tipo: "deshacer" }, articles)).toBe(n);
  });

  it("al cambiar de espacio vuelve a sus medidas de ejemplo y conserva lo elegido", () => {
    const e = aplicar3d(estadoInicial("local"), interpretar3d("pon resina en el suelo", articles)!, articles);
    const nave = aplicar3d(e, { tipo: "espacio", espacio: "nave" }, articles);
    expect(nave.dims).toEqual({ largo: 12, ancho: 8, alto: 5 });
    expect(cantidades(nave)).toMatchObject({ suelo: 96, paredes: 200 });
    expect(nave.suelo?.article_id).toBe(e.suelo?.article_id);
  });
});
