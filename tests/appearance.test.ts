import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { appearanceBootScript } from "@/lib/appearance";

describe("Preferencias antes del primer pintado", () => {
  it("ejecuta JavaScript válido y restaura tema y letra sin depender de la hidratación", () => {
    const dataset: Record<string,string> = {};
    runInNewContext(appearanceBootScript, {
      document: { documentElement: { dataset } },
      localStorage: { getItem: (key:string) => key === "plano.theme" ? "dark" : "large" },
    });
    expect(dataset).toEqual({ theme: "dark", text: "large" });
  });

  it("conserva el tema del sistema y el tamaño normal con preferencias desconocidas", () => {
    const dataset = {};
    runInNewContext(appearanceBootScript, {
      document: { documentElement: { dataset } }, localStorage: { getItem: () => "desconocido" },
    });
    expect(dataset).toEqual({});
  });

  it("no impide abrir la página si el navegador bloquea el almacenamiento", () => {
    expect(() => runInNewContext(appearanceBootScript, {
      document: { documentElement: { dataset: {} } },
      localStorage: { getItem: () => { throw new Error("Almacenamiento bloqueado"); } },
    })).not.toThrow();
  });
});
