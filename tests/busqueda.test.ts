import { describe, expect, it } from "vitest";
import { buscarTolerante, chipsConsulta, coincidePalabra, leerConsulta, quitarTermino } from "@/lib/busqueda";

describe("búsqueda tolerante", () => {
  it("entiende errores de una o dos letras y transposiciones", () => {
    expect(coincidePalabra("mosiaco", "mosaico")).toBe(true);
    expect(coincidePalabra("tarmia", "tarima")).toBe(true);
    expect(coincidePalabra("azuleho", "azulejo")).toBe(true);
  });
  it("trata singular y plural como lo mismo", () => {
    expect(coincidePalabra("azulejos", "azulejo")).toBe(true);
    expect(coincidePalabra("azulejo", "azulejos")).toBe(true);
  });
  it("los números solo coinciden por el principio de la palabra", () => {
    expect(coincidePalabra("05", "05")).toBe(true);
    expect(coincidePalabra("05", "005")).toBe(false);
    expect(buscarTolerante(["Cliente 05", "PL-005"], "05", x => x)).toEqual(["Cliente 05"]);
  });
  it("quita las palabras vacías y los acentos", () => {
    expect(leerConsulta("Mármol de la cocina").terminos).toEqual(["marmol", "cocina"]);
    expect(buscarTolerante(["Encimera de mármol"], "marmol", x => x)).toHaveLength(1);
  });
  it("no confunde palabras cortas", () => {
    expect(coincidePalabra("sol", "sal")).toBe(false);
  });
  it("«en stock» se entiende como un filtro y no como un término", () => {
    expect(leerConsulta("azulejos en stock")).toEqual({ terminos: ["azulejos"], soloStock: true });
  });
  it("explica la corrección que ha aplicado", () => {
    expect(chipsConsulta("mosiaco blanco", ["Mosaico blanco"])).toEqual([{ termino: "mosiaco", correccion: "mosaico" }, { termino: "blanco", correccion: null }]);
  });
  it("quita un término de la consulta", () => {
    expect(quitarTermino("mosaico blanco", "blanco")).toBe("mosaico");
  });
});
