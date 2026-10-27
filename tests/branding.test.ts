import { describe, it, expect } from "vitest";
import { completarBranding, validarBranding, textoSobre, normalizarHex, lineasLegales, brandingPorDefecto } from "@/lib/branding";

describe("Identidad de la organización", () => {
  it("rellena huecos con los valores por defecto y usa el nombre de la organización", () => {
    const b = completarBranding({ primary_color: "rojo" }, "GARAL");
    expect(b.trade_name).toBe("GARAL");
    expect(b.primary_color).toBe(brandingPorDefecto.primary_color);
    expect(b.cover_enabled).toBe(false);
    expect(completarBranding({ cover_enabled: "sí" as unknown as boolean }).cover_enabled).toBe(false);
  });

  it("valida nombre, colores y correo", () => {
    const b = completarBranding({ trade_name: "GARAL", email: "obra@garal", accent_color: "#12" });
    const errores = validarBranding({ ...b, accent_color: "#12" });
    expect(errores.some(e => /acento/.test(e))).toBe(true);
    expect(errores.some(e => /correo/.test(e))).toBe(true);
    expect(validarBranding(completarBranding({ trade_name: "GARAL" }))).toEqual([]);
  });

  it("elige texto claro sobre colores oscuros y oscuro sobre claros", () => {
    expect(textoSobre("#101214")).toBe("#FFFFFF");
    expect(textoSobre("#F5F2EC")).toBe("#000000");
    expect(normalizarHex("1f3a5f")).toBe("#1F3A5F");
    expect(normalizarHex("#zzz")).toBeNull();
  });

  it("monta el pie legal solo con lo que hay", () => {
    const b = completarBranding({ trade_name: "GARAL", legal_name: "Garal Reformas SL", tax_id: "B15000000", phone: "981 000 000" });
    expect(lineasLegales(b)).toEqual(["Garal Reformas SL · CIF B15000000", "981 000 000"]);
    expect(lineasLegales(completarBranding({ trade_name: "X" }))).toEqual([]);
  });
});
