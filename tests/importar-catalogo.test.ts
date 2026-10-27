import { describe, it, expect } from "vitest";
import { parsearCSV, detectarMapeo, tieneCabecera, filasAArticulos, resumenImportacion, aCSV, ejemploCSV } from "@/lib/importar-catalogo";
import { commandSchema } from "@/lib/domain";
import { createDemo } from "@/lib/demo";

const { articles } = createDemo();

describe("Importación del catálogo", () => {
  it("parsea CSV con punto y coma, comillas y saltos dentro de comillas", () => {
    const filas = parsearCSV('Capítulo;Descripción;Unidad;Precio\nPintura;"Pintura ""lisa""\nen dos manos";m2;"7,20"\n');
    expect(filas).toHaveLength(2);
    expect(filas[1][1]).toBe('Pintura "lisa"\nen dos manos');
    expect(parsearCSV("a,b,c\n1,2,3")[1]).toEqual(["1", "2", "3"]);
    expect(parsearCSV("a\tb\n1\t2")[1]).toEqual(["1", "2"]);
  });

  it("reconoce las columnas por la cabecera y, sin cabecera, por el orden habitual", () => {
    const filas = parsearCSV(ejemploCSV);
    expect(tieneCabecera(filas)).toBe(true);
    expect(detectarMapeo(filas)).toEqual({ chapter: 0, name: 1, unit: 2, price: 3, vat: 4, code: 5 });
    expect(detectarMapeo([["Pintura", "Pintar", "m2", "7,20"]])).toEqual({ chapter: 0, name: 1, unit: 2, price: 3 });
  });

  it("convierte filas en comandos válidos, sugiere código y marca duplicados y errores", () => {
    const filas = parsearCSV(`${ejemploCSV}\nPavimentos;Tarima laminada con instalación;m²;49,50;21;PAV-001\nFontanería;Grifo;unidadx;12,00;21;\nPintura;Sin precio;m²;;21;`);
    const out = filasAArticulos(filas, detectarMapeo(filas), articles);
    const r = resumenImportacion(out);
    expect(r.validas).toBe(3);
    expect(r.duplicadas).toBe(1);
    expect(r.conErrores).toBe(2);
    expect(out[1].comando?.code).toMatch(/^ALB-\d{3}$/);
    expect(out.filter(f => f.comando).every(f => commandSchema.safeParse(f.comando).success)).toBe(true);
    expect(out[4].errores[0]).toMatch(/unidad/);
    expect(out[5].errores[0]).toMatch(/precio/);
  });

  it("no genera el mismo código sugerido dos veces en el mismo archivo", () => {
    const filas = parsearCSV("Capítulo;Descripción;Unidad;Precio\nPintura;Uno;m²;1,00\nPintura;Dos;m²;2,00");
    const out = filasAArticulos(filas, detectarMapeo(filas), articles);
    expect(out[0].comando?.code).not.toBe(out[1].comando?.code);
  });

  it("exporta un CSV que se vuelve a importar sin pérdidas", () => {
    const csv = aCSV(articles);
    const filas = parsearCSV(csv);
    expect(filas).toHaveLength(articles.length + 1);
    const out = filasAArticulos(filas, detectarMapeo(filas), []);
    expect(resumenImportacion(out).validas).toBe(articles.length);
    expect(out[0].comando?.unit_price).toBe(articles.find(a => a.code === out[0].comando?.code)?.unit_price);
  });
});
