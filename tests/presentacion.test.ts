import { describe, it, expect } from "vitest";
import { completarPresentacion, validarPresentacion, tienePresentacion, presentacionVacia } from "@/lib/presentacion";

describe("Presentación por presupuesto", () => {
  it("rellena huecos y descarta tipos raros", () => {
    const p = completarPresentacion({ intro: "Hola", cover_title: 3 as unknown as string });
    expect(p.intro).toBe("Hola");
    expect(p.cover_title).toBe("");
    expect(p.client_logo_data_url).toBe("");
  });

  it("sabe si hay algo personalizado", () => {
    expect(tienePresentacion(completarPresentacion(null))).toBe(false);
    expect(tienePresentacion({ ...presentacionVacia, client_logo_data_url: "data:image/png;base64,AAA" })).toBe(true);
  });

  it("limita tamaños", () => {
    expect(validarPresentacion({ ...presentacionVacia, intro: "x".repeat(1300) })).toHaveLength(1);
    expect(validarPresentacion({ ...presentacionVacia, client_logo_data_url: "x".repeat(500_000) })).toHaveLength(1);
    expect(validarPresentacion(presentacionVacia)).toEqual([]);
  });
});
