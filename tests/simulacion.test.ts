import { describe, it, expect } from "vitest";
import { cuerpoInteractions, imagenDeRespuesta, mensajeError, pedidoSimulacion, textoSimulacion } from "@/lib/simulacion";
import { interpretarOrden, type Zona } from "@/lib/visita360";
import { createDemo } from "@/lib/demo";

const png = "data:image/jpeg;base64," + "A".repeat(400);
const pedido = pedidoSimulacion.parse({ imagen: png, estancia: "cocina", materiales: [{ nombre: "Tarima laminada roble", superficie: "suelo" }, { nombre: "Pintura blanca", superficie: "pared" }], referencias: [{ nombre: "Tarima laminada roble", imagen: png }] });

describe("Simular una vista con IA", () => {
  it("pide cambiar solo los acabados, con cada material en su sitio y su referencia", () => {
    const t = textoSimulacion(pedido);
    expect(t).toContain('Apply "Tarima laminada roble" to the floor (reference image 2 shows the material)');
    expect(t).toContain('Apply "Pintura blanca" to the walls.');
    expect(t).toContain("Keep exactly the same camera position");
    expect(t).toContain("the cocina");
  });
  it("manda la vista como imagen 1 y las referencias detrás, pidiendo una imagen", () => {
    const c = cuerpoInteractions(pedido, "modelo-x");
    expect(c.model).toBe("modelo-x");
    expect(c.input.map(i => i.type)).toEqual(["text", "image", "image"]);
    expect(c.input[1]).toMatchObject({ mime_type: "image/jpeg", data: "A".repeat(400) });
    expect(c.response_format).toMatchObject({ type: "image" });
  });
  it("rechaza lo que no es una imagen o sobra", () => {
    expect(pedidoSimulacion.safeParse({ ...pedido, imagen: "data:text/html;base64,AAAA" }).success).toBe(false);
    expect(pedidoSimulacion.safeParse({ ...pedido, materiales: [] }).success).toBe(false);
  });
  it("encuentra la imagen de la respuesta en la API nueva y en la antigua, sin confundirla con la enviada", () => {
    const enviada = "B".repeat(300), devuelta = "C".repeat(300);
    expect(imagenDeRespuesta({ id: "int_1", status: "completed", steps: [
      { type: "user_input", content: [{ type: "text", text: "x" }, { type: "image", mime_type: "image/jpeg", data: enviada }] },
      { type: "model_output", status: "done", content: [{ type: "text", text: "Aquí está" }, { type: "image", mime_type: "image/png", data: devuelta }] }
    ] })).toEqual({ mime: "image/png", data: devuelta });
    expect(imagenDeRespuesta({ candidates: [{ content: { parts: [{ text: "ok" }, { inlineData: { mimeType: "image/jpeg", data: devuelta } }] } }] })).toEqual({ mime: "image/jpeg", data: devuelta });
    expect(imagenDeRespuesta({ steps: [{ type: "model_output", content: [{ type: "text", text: "No puedo" }] }] })).toBeNull();
  });
  it("explica los errores de Google en palabras", () => {
    expect(mensajeError(401)).toMatch(/clave/);
    expect(mensajeError(429)).toMatch(/límite/);
  });
  it("entiende «simula» y «¿cómo queda la cocina?» por voz", () => {
    const zonas: Zona[] = [{ id: "cocina", nombre: "Cocina" }];
    const { articles } = createDemo();
    expect(interpretarOrden("simula", articles, zonas)).toEqual({ tipo: "simular", zona: undefined });
    expect(interpretarOrden("¿cómo queda la cocina?", articles, zonas)).toEqual({ tipo: "simular", zona: zonas[0] });
  });
});
