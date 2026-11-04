import { describe, it, expect } from "vitest";
import { cantidadDesdeMedidas, describirMedidas, describirSuperficies, faltaPara, interpretarMedidas, superficies } from "@/lib/medidas";
import { interpretarOrden, type Zona } from "@/lib/visita360";
import { createDemo } from "@/lib/demo";

const { articles } = createDemo();
const zonas: Zona[] = [{ id: "cocina", nombre: "Cocina" }, { id: "salon", nombre: "Salón" }];
const art = (code: string) => articles.find(a => a.code === code)!;
const medidas = (t: string) => interpretarMedidas(t, zonas);

describe("Medidas dichas con el láser", () => {
  it("entiende las formas habituales de decirlas", () => {
    expect(medidas("la cocina mide 4 por 3 y 2,6 de alto")).toEqual({ zona: zonas[0], medidas: { largo: 4, ancho: 3, alto: 2.6 } });
    expect(medidas("4,20 x 3,10")?.medidas).toEqual({ largo: 4.2, ancho: 3.1 });
    expect(medidas("el salón mide 5.5 × 4 × 2.7")).toEqual({ zona: zonas[1], medidas: { largo: 5.5, ancho: 4, alto: 2.7 } });
    expect(medidas("altura 2,70")?.medidas).toEqual({ alto: 2.7 });
    expect(medidas("cuatro coma dos por tres y dos sesenta de alto")?.medidas).toEqual({ largo: 4.2, ancho: 3, alto: 2.6 });
    expect(medidas("mide 420 por 310 centímetros")?.medidas).toEqual({ largo: 4.2, ancho: 3.1 });
    expect(medidas("5 de largo y 3 de ancho")?.medidas).toEqual({ largo: 5, ancho: 3 });
  });
  it("cuenta puertas y ventanas como huecos solo en frases de medidas", () => {
    expect(medidas("la cocina mide 4 por 3 con una puerta y dos ventanas")?.medidas).toEqual({ largo: 4, ancho: 3, puertas: 1, ventanas: 2 });
    expect(medidas("tiene una puerta y una ventana")?.medidas).toEqual({ puertas: 1, ventanas: 1 });
    expect(medidas("pon dos puertas")).toBeNull();
    expect(interpretarOrden("pon dos puertas", articles, zonas)).toMatchObject({ tipo: "añadir", quantity: 2 });
  });
  it("no confunde órdenes con medidas", () => {
    expect(medidas("pon tarima en la cocina")).toBeNull();
    expect(medidas("añade 20 metros de tarima")).toBeNull();
    expect(medidas("pinta las paredes, 35 metros cuadrados")).toBeNull();
    expect(medidas("¿cuánto va?")).toBeNull();
  });
});

describe("Superficies que salen de las medidas", () => {
  const m = { largo: 4, ancho: 3, alto: 2.6, puertas: 1, ventanas: 1 };
  it("suelo, techo y paredes menos huecos", () => {
    // Paredes: 14 m × 2,6 = 36,4 − 1,64 − 1,44 = 33,32
    expect(superficies(m)).toEqual({ suelo: 12, techo: 12, paredes: 33.32, perimetro: 14 });
    expect(superficies({ largo: 4, ancho: 3 }).paredes).toBeNull();
  });
  it("cada artículo toma su superficie y los que no van por superficie no se tocan", () => {
    expect(cantidadDesdeMedidas(art("PAV-001"), m)).toBe(12);
    expect(cantidadDesdeMedidas(art("PIN-001"), m)).toBe(33.32);
    expect(cantidadDesdeMedidas(art("CAR-001"), m)).toBeNull();
    expect(cantidadDesdeMedidas(art("ALB-001"), m)).toBeNull();
    expect(cantidadDesdeMedidas({ chapter: "Carpintería", name: "Rodapié lacado", unit: "ml" }, m)).toBe(13.2);
  });
  it("dice qué falta y lo resume", () => {
    expect(faltaPara(art("PIN-001"), { largo: 4, ancho: 3 })).toBe("la altura");
    expect(faltaPara(art("PAV-001"), {})).toBe("el largo y el ancho");
    expect(faltaPara(art("PAV-001"), { largo: 4, ancho: 3 })).toBeNull();
    expect(describirMedidas(m)).toBe("4 × 3 m · 2,6 m de alto · 1 puerta · 1 ventana");
    expect(describirSuperficies(m)).toBe("Suelo 12 m² · paredes 33,32 m² · techo 12 m²");
  });
});
