import { describe, it, expect } from "vitest";
import { samplePlan } from "@/lib/captura/sample-plan";
import { createDemo, demoId } from "@/lib/demo";
import type { PdfExtraction } from "@/lib/captura/pdf-extraction";
import { borradorNuevo, añadirPlano, quitarPlano, usoSugerido, planoParaMedir, mismaHoja, escalaDe, planosSinEscala, paredes, resumenParedes, nombreColor, colores, puntoCercano, asegurarIds, sugerirArticulo, trabajos, cantidadTrabajo, entradaMotor, propuesta, coincidencias, fusionar, type Borrador } from "@/lib/plano-flujo";

const data = createDemo();
const projectId = demoId(10);
// Dos planos de la misma hoja: el de demolición solo trae el relleno rojo; el de obra nueva, el verde.
const soloColor = (nombre: string, rgb: [number, number, number], sha: string): PdfExtraction => ({ ...samplePlan, sha256: sha.repeat(64), pages: [{ ...samplePlan.pages[0], paths: samplePlan.pages[0].paths.filter(p => !p.has_fill || JSON.stringify(p.fill) === JSON.stringify(rgb) || p.id === "mesa") }] });
function listo(): Borrador {
  let b = borradorNuevo(projectId, null);
  b = añadirPlano(b, { nombre: "Plano Demolición.pdf", extraction: soloColor("demo", [1, 0, 0], "a") });
  b = añadirPlano(b, { nombre: "Plano Pladur.pdf", extraction: soloColor("pladur", [0, 0.7, 0], "b") });
  b = añadirPlano(b, { nombre: "Plano Cotas.pdf", extraction: { ...samplePlan, sha256: "c".repeat(64) } });
  // 460 unidades de ancho son 9,20 m: cada unidad, 2 cm. Se mide en el plano de cotas y vale para los otros dos.
  b.medida = { start: [20, 20], end: [480, 20], metros: "9,2", planoId: b.planos[2].id };
  b.trabajos.demoler.articleId = demoId(30); b.trabajos.levantar.articleId = demoId(31);
  b.trabajos.acabar = { activo: true, articleId: demoId(34) };
  return asegurarIds(b, paredes(b));
}

describe("Presupuestar desde varios planos", () => {
  it("sugiere el uso por el nombre y elige el de cotas para medir", () => {
    expect(["Plano_Demoliciones.pdf", "Carmen Guedella Plano Pladur 01.pdf", "Plano_Cotas.pdf", "Plano Areas 01.pdf", "Plano Climatización 01.pdf", "Plano_Estado_Actual.pdf"].map(usoSugerido)).toEqual(["demolicion", "obra_nueva", "cotas", "areas", "instalaciones", "otro"]);
    const b = listo();
    expect(planoParaMedir(b)?.nombre).toBe("Plano Cotas.pdf");
    expect(mismaHoja(b.planos[0], b.planos[2])).toBe(true);
  });

  it("una sola medida vale para los planos de la misma hoja; los de otra hoja piden la suya", () => {
    const b = listo();
    expect(b.planos.map(p => escalaDe(b, p)?.toFixed(3))).toEqual(["0.020", "0.020", "0.020"]);
    const otra = añadirPlano(b, { nombre: "Plano Pladur anexo.pdf", extraction: { ...samplePlan, sha256: "d".repeat(64), pages: [{ ...samplePlan.pages[0], width: 800 }] } });
    expect(planosSinEscala(otra).map(p => p.nombre)).toEqual(["Plano Pladur anexo.pdf"]);
    otra.planos[3].medida = { start: [20, 20], end: [120, 20], metros: "2" };
    expect(planosSinEscala(otra)).toEqual([]);
    expect(quitarPlano(b, b.planos[2].id).medida.planoId).toBeNull();
  });

  it("las paredes salen del plano que toca: se tira lo del de demolición, es nuevo lo del de obra nueva", () => {
    const b = listo(); const ps = paredes(b);
    expect(ps.map(p => [p.estado, p.longitud, p.plano])).toEqual([["nueva", 2.4, "Plano Pladur.pdf"], ["tira", 4, "Plano Demolición.pdf"]]);
    expect(resumenParedes(ps)).toMatchObject({ tira: { n: 1, metros: 4 }, nueva: { n: 1, metros: 2.4 } });
    expect(nombreColor([255, 0, 0])).toBe("rojo");
    expect(colores(samplePlan.pages[0]).map(c => [c.nombre, c.neutro])).toEqual([["rojo", false], ["verde", false], ["gris", true]]);
    expect(puntoCercano(samplePlan.pages[0], [22, 18], 10)).toEqual([20, 20]);
  });

  it("sugiere artículos por trabajo y anticipa la cantidad", () => {
    expect(sugerirArticulo(data.articles, trabajos[0])?.code).toBe("DEM-001");
    expect(sugerirArticulo(data.articles, trabajos[1])?.code).toBe("ALB-001");
    const ps = paredes(listo());
    expect(cantidadTrabajo(trabajos[0], ps, 2.6, 0, "m²")).toBe(10.4);
    expect(cantidadTrabajo(trabajos[2], ps, 2.6, 0, "m²")).toBe(12.48);
  });

  it("el motor recibe una fuente y una escala por plano y la propuesta agrupa por trabajo con sus planos", () => {
    const b = listo(); const ps = paredes(b);
    const entrada = entradaMotor(b, ps, data.articles)!;
    expect(entrada.sources.filter(s => s.kind === "pdf")).toHaveLength(2);
    expect(entrada.calibrations).toHaveLength(2);
    expect(entrada.intents).toHaveLength(4);
    const r = propuesta(b, ps, data.articles, data.organization_id);
    if ("error" in r) throw new Error(r.error);
    expect(r.pendientes).toBe(0);
    expect(r.lineas.map(l => [l.trabajo.id, l.cantidad, l.planos])).toEqual([["demoler", 10.4, ["Plano Demolición.pdf"]], ["levantar", 6.24, ["Plano Pladur.pdf"]], ["acabar", 12.48, ["Plano Pladur.pdf"]]]);
    expect(r.base).toBe(10.4 * 2800 + 6.24 * 5400 + 12.48 * 1450);
  });

  it("descuenta huecos una vez, deja pendiente sin artículo y fusiona con lo existente", () => {
    const b = listo(); b.huecos = "2"; b.trabajos.levantar.articleId = null;
    const ps = paredes(b);
    const r = propuesta(b, ps, data.articles, data.organization_id);
    if ("error" in r) throw new Error(r.error);
    expect(r.lineas.find(l => l.trabajo.id === "demoler")?.cantidad).toBe(8.4);
    expect(r.lineas.find(l => l.trabajo.id === "levantar")?.item).toBeNull();
    const existentes = data.versions.find(v => v.id === demoId(60))!.items;
    const pares = coincidencias(existentes, r.items);
    expect(fusionar(existentes, r.items, {}, pares)).toHaveLength(existentes.length + r.items.length - pares.length);
    expect(fusionar(existentes, r.items, Object.fromEntries(pares.map(p => [p.nuevo.id, "añadir"])), pares)).toHaveLength(existentes.length + r.items.length);
  });
});
