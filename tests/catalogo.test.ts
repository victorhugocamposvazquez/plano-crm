import { describe, it, expect } from "vitest";
import { eurosACentimos, codigoSugerido, buscarArticulos, agruparPorCapitulo, capitulos } from "@/lib/catalogo";
import { createDemo } from "@/lib/demo";

const { articles } = createDemo();

describe("Catálogo de precios", () => {
  it("convierte euros escritos a la española en céntimos", () => {
    expect(eurosACentimos("49,50")).toBe(4950);
    expect(eurosACentimos("1.250,00 €")).toBe(125000);
    expect(eurosACentimos("49.5")).toBe(4950);
    expect(eurosACentimos("1,005")).toBeNull();
    expect(eurosACentimos("abc")).toBeNull();
    expect(eurosACentimos("")).toBeNull();
  });

  it("sugiere un código correlativo por capítulo", () => {
    expect(codigoSugerido("Pintura", articles)).toBe("PIN-002");
    expect(codigoSugerido("Carpintería", articles)).toBe("CAR-003");
    expect(codigoSugerido("Climatización", articles)).toBe("CLI-001");
  });

  it("busca sin acentos y por cualquier campo", () => {
    expect(buscarArticulos(articles, "albanileria").map(a => a.code)).toEqual(["ALB-001"]);
    expect(buscarArticulos(articles, "puerta lacada")).toHaveLength(1);
    expect(buscarArticulos(articles, "")).toHaveLength(articles.length);
  });

  it("agrupa por capítulo en orden alfabético", () => {
    const grupos = agruparPorCapitulo(articles);
    expect([...grupos.keys()]).toEqual(capitulos(articles));
    expect(grupos.get("Carpintería")!.map(a => a.code)).toEqual(["CAR-001", "CAR-002"]);
  });
});
