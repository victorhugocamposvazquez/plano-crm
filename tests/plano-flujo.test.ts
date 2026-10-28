import { describe, it, expect } from "vitest";
import { samplePlan } from "@/lib/captura/sample-plan";
import { createDemo, demoId } from "@/lib/demo";
import { borradorNuevo, paredes, resumenParedes, escala, nombreColor, colores, puntoCercano, asegurarIds, sugerirArticulo, trabajos, cantidadTrabajo, entradaMotor, propuesta, coincidencias, fusionar, type Borrador } from "@/lib/plano-flujo";

const data = createDemo();
const projectId = demoId(10);
function listo(): Borrador {
  const b = borradorNuevo(projectId, null);
  b.extraction = samplePlan; b.nombre = "ejemplo.pdf";
  // El perímetro del ejemplo mide 460 unidades de ancho; si son 9,20 m, cada unidad son 2 cm.
  b.medida = { start: [20, 20], end: [480, 20], metros: "9,2" };
  b.leyenda = { "255,0,0": "tira", "0,179,0": "nueva" };
  b.trabajos.demoler.articleId = demoId(30); b.trabajos.levantar.articleId = demoId(31);
  b.trabajos.acabar = { activo: true, articleId: demoId(34) };
  return asegurarIds(b, paredes(b));
}

describe("Presupuestar desde un plano", () => {
  it("nombra los colores en llano y propone la escala desde una medida", () => {
    expect(nombreColor([255, 0, 0])).toBe("rojo");
    expect(nombreColor([0, 179, 0])).toBe("verde");
    expect(nombreColor([217, 217, 217])).toBe("gris");
    const page = samplePlan.pages[0];
    expect(colores(page).map(c => c.nombre)).toEqual(["rojo", "verde", "gris"]);
    expect(escala(listo())).toBeCloseTo(0.02, 6);
    expect(puntoCercano(page, [22, 18], 10)).toEqual([20, 20]);
  });

  it("convierte la leyenda en paredes con longitud en metros y resume lo que se tira y lo nuevo", () => {
    const ps = paredes(listo());
    expect(ps.map(p => [p.estado, p.longitud])).toEqual([["nueva", 2.4], ["tira", 4]]);
    expect(resumenParedes(ps)).toMatchObject({ tira: { n: 1, metros: 4 }, nueva: { n: 1, metros: 2.4 } });
    const sinLeyenda = { ...listo(), leyenda: {} };
    expect(paredes(sinLeyenda)).toEqual([]);
  });

  it("sugiere artículos del catálogo por trabajo y anticipa la cantidad", () => {
    expect(sugerirArticulo(data.articles, trabajos[0])?.code).toBe("DEM-001");
    expect(sugerirArticulo(data.articles, trabajos[1])?.code).toBe("ALB-001");
    expect(sugerirArticulo(data.articles, trabajos[2])?.code).toBe("PIN-001");
    const ps = paredes(listo());
    expect(cantidadTrabajo(trabajos[0], ps, 2.6, 0, "m²")).toBe(10.4);
    expect(cantidadTrabajo(trabajos[2], ps, 2.6, 0, "m²")).toBe(12.48);
    expect(cantidadTrabajo(trabajos[1], ps, 2.6, 0, "ml")).toBe(2.4);
  });

  it("construye una entrada válida para el motor de Codex y agrupa su respuesta en una partida por trabajo", () => {
    const b = listo(); const ps = paredes(b);
    const entrada = entradaMotor(b, ps, data.articles)!;
    expect(entrada.sources[0]).toMatchObject({ kind: "pdf", sha256: samplePlan.sha256 });
    expect(entrada.intents).toHaveLength(4); // demoler ×1, levantar ×1, pintar ×2 caras
    const r = propuesta(b, ps, data.articles, data.organization_id);
    if ("error" in r) throw new Error(r.error);
    expect(r.pendientes).toBe(0);
    expect(r.lineas.map(l => [l.trabajo.id, l.cantidad])).toEqual([["demoler", 10.4], ["levantar", 6.24], ["acabar", 12.48]]);
    expect(r.items.map(i => i.description)).toEqual(["Demolición de tabiquería interior", "Tabique de placa de yeso laminado", "Preparación y pintura de paredes"]);
    expect(r.base).toBe(10.4 * 2800 + 6.24 * 5400 + 12.48 * 1450);
  });

  it("descuenta los huecos una sola vez y deja pendiente el trabajo sin artículo", () => {
    const b = listo(); b.huecos = "2"; b.trabajos.levantar.articleId = null;
    const ps = paredes(b);
    const r = propuesta(b, ps, data.articles, data.organization_id);
    if ("error" in r) throw new Error(r.error);
    expect(r.lineas.find(l => l.trabajo.id === "demoler")?.cantidad).toBe(8.4);
    const levantar = r.lineas.find(l => l.trabajo.id === "levantar")!;
    expect(levantar.item).toBeNull();
    expect(levantar.pendientes[0]).toMatch(/artículo/);
    expect(r.pendientes).toBe(1);
  });

  it("detecta partidas que ya estaban y fusiona sustituyendo o añadiendo", () => {
    const b = listo(); const ps = paredes(b);
    const r = propuesta(b, ps, data.articles, data.organization_id);
    if ("error" in r) throw new Error(r.error);
    const existentes = data.versions.find(v => v.id === demoId(60))!.items;
    const pares = coincidencias(existentes, r.items);
    expect(pares.map(p => p.nuevo.description)).toContain("Demolición de tabiquería interior");
    const sustituido = fusionar(existentes, r.items, {}, pares);
    expect(sustituido).toHaveLength(existentes.length + r.items.length - pares.length);
    expect(sustituido.find(i => i.description === "Demolición de tabiquería interior")?.quantity).toBe(10.4);
    const añadido = fusionar(existentes, r.items, Object.fromEntries(pares.map(p => [p.nuevo.id, "añadir"])), pares);
    expect(añadido).toHaveLength(existentes.length + r.items.length);
  });
});
