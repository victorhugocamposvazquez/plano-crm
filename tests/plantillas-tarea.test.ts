import { describe, it, expect } from "vitest";
import { aplicarPlantilla, plantillasTarea, sugerirPlantilla } from "@/lib/plantillas-tarea";

describe("Plantillas de subtareas", () => {
  it("sugiere la plantilla por el título de la tarea", () => {
    expect(sugerirPlantilla("Pintar el salón")?.id).toBe("pintar");
    expect(sugerirPlantilla("Demoler el tabique de la cocina")?.id).toBe("demoler");
    expect(sugerirPlantilla("Alicatar el baño")?.id).toBe("alicatar");
    expect(sugerirPlantilla("Poner tarima en el dormitorio")?.id).toBe("tarima");
    expect(sugerirPlantilla("Cambiar enchufes del pasillo")?.id).toBe("electricidad");
    expect(sugerirPlantilla("Cambiar el plato de ducha")?.id).toBe("fontaneria");
    expect(sugerirPlantilla("Replantear con el cliente")).toBeNull();
    expect(sugerirPlantilla("ab")).toBeNull();
  });
  it("añade sus subtareas al final, sin repetir las que ya están", () => {
    const pintar = plantillasTarea.find(p => p.id === "pintar")!;
    const ya = [{ id: "x", text: "Primera mano", done: true }, { id: "y", text: "Mover el sofá", done: false }];
    const l = aplicarPlantilla(ya, pintar);
    expect(l.slice(0, 2)).toEqual(ya);
    expect(l.filter(p => p.text === "Primera mano")).toHaveLength(1);
    expect(l).toHaveLength(2 + pintar.subtareas.length - 1);
    expect(l.at(-1)).toMatchObject({ text: "Retirar protecciones y limpiar", done: false });
    expect(aplicarPlantilla(l, pintar)).toHaveLength(l.length);
  });
  it("cada plantilla trae varias subtareas y su oficio", () => {
    for (const p of plantillasTarea) { expect(p.subtareas.length).toBeGreaterThanOrEqual(5); expect(p.oficio).toBeTruthy(); }
  });
});
