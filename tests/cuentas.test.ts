import { describe, expect, it } from "vitest";
import { altaCuenta } from "@/lib/cuentas";

describe("Alta de cuenta", () => {
  it("acepta nombre, correo, contraseña, puesto y permiso", () => {
    expect(altaCuenta.parse({ name: " Marta ", email: "Marta@Garal.es", password: "obra-2026", position: "oficina", role: "office" })).toMatchObject({ name: "Marta", email: "marta@garal.es", role: "office" });
  });
  it("rechaza una contraseña corta y un permiso inventado", () => {
    expect(altaCuenta.safeParse({ name: "Marta", email: "marta@garal.es", password: "corta", position: "oficina", role: "office" }).success).toBe(false);
    expect(altaCuenta.safeParse({ name: "Marta", email: "marta@garal.es", password: "obra-2026", position: "oficina", role: "jefe" }).success).toBe(false);
  });
});
