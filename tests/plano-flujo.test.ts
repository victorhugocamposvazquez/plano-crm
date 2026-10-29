import { describe, it, expect } from "vitest";
import { samplePlan } from "@/lib/captura/sample-plan";
import { createDemo, demoId } from "@/lib/demo";
import type { PdfExtraction } from "@/lib/captura/pdf-extraction";
import { borradorNuevo, añadirPlano, quitarPlano, usoSugerido, planoParaMedir, mismaHoja, confirmarEscalaCompartida, cambiarPagina, escalaDe, planosSinEscala, paredes, resumenParedes, nombreColor, colores, puntoCercano, asegurarIds, sugerirArticulo, trabajos, cantidadTrabajo, entradaMotor, propuesta, coincidencias, fusionar, type Borrador } from "@/lib/plano-flujo";

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
  b = confirmarEscalaCompartida(b, b.planos[0].id); b = confirmarEscalaCompartida(b, b.planos[1].id);
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

  it("una sola medida vale tras confirmar la misma escala; los demás planos piden la suya", () => {
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
    expect(ps.map(p => [p.estado, Number(p.longitud.toFixed(8)), p.plano])).toEqual([["nueva", 2.4, "Plano Pladur.pdf"], ["tira", 4, "Plano Demolición.pdf"]]);
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
    expect(entrada.intents).toHaveLength(3);
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
    expect(r.lineas.find(l => l.trabajo.id === "demoler")?.cantidad).toBe(10.4);
    expect(r.lineas.find(l => l.trabajo.id === "levantar")?.item).toBeNull();
    const existentes = data.versions.find(v => v.id === demoId(60))!.items;
    const pares = coincidencias(existentes, r.items);
    expect(fusionar(existentes, r.items, {}, pares)).toHaveLength(existentes.length + r.items.length);
    expect(fusionar(existentes, r.items, Object.fromEntries(pares.map(p => [p.nuevo.id, "añadir"])), pares)).toHaveLength(existentes.length + r.items.length);
  });
  it("dos PDF A4 no comparten escala automáticamente y cambiar la referencia anula la confirmación", () => {
    const b = listo();
    b.planos[0].escalaConfirmada = undefined;
    expect(mismaHoja(b.planos[0], b.planos[2])).toBe(true);
    expect(escalaDe(b, b.planos[0])).toBeNull();
    expect(propuesta(b, paredes(b), data.articles, data.organization_id)).toHaveProperty("error");
    const confirmado = confirmarEscalaCompartida(b, b.planos[0].id);
    expect(escalaDe(confirmado, confirmado.planos[0])).toBeCloseTo(0.02, 10);
    confirmado.medida = { ...confirmado.medida, metros: "4,6" };
    expect(escalaDe(confirmado, confirmado.planos[0])).toBeNull();
    expect(escalaDe(confirmado, confirmado.planos[2])).toBeCloseTo(0.01, 10);
  });

  it("cambiar la página o el archivo invalida la medida compartida y la propia", () => {
    const b = listo();
    b.planos[0].extraction = { ...b.planos[0].extraction, pages: [...b.planos[0].extraction.pages, { ...b.planos[0].extraction.pages[0], page: 2 }] };
    const otra = cambiarPagina(b, b.planos[0].id, 2);
    expect(escalaDe(otra, otra.planos[0])).toBeNull();
    expect(escalaDe(otra, otra.planos[1])).toBeCloseTo(0.02, 10);
    b.planos[0].extraction = { ...b.planos[0].extraction, sha256: "f".repeat(64) };
    expect(escalaDe(b, b.planos[0])).toBeNull();
    const propia = cambiarPagina({ ...b, planos: b.planos.map((p, i) => i === 0 ? { ...p, medida: { start: [0, 0], end: [100, 0], metros: "1" } } : p) }, b.planos[0].id, 2);
    expect(propia.planos[0].medida).toBeNull();
  });

  it("descuenta huecos distintos por estado y por las dos caras al pintar", () => {
    const b = listo(); b.huecos = "2"; b.huecosDemolicion = "1";
    const r = propuesta(b, paredes(b), data.articles, data.organization_id);
    if ("error" in r) throw new Error(r.error);
    expect(r.lineas.map(l => [l.trabajo.id, l.cantidad])).toEqual([["demoler", 9.4], ["levantar", 4.24], ["acabar", 8.48]]);
    expect(r.base).toBe(r.items.reduce((s, i) => s + Math.round(i.quantity * i.unit_price), 0));
  });

  it("los huecos se descuentan del conjunto, aunque superen el área de la pared más larga", () => {
    const b = listo(), ps = paredes(b);
    const w = ps.find(p => p.estado === "nueva")!;
    const varias = [...ps, { ...w, id: w.id + ":segunda", centerline: [[0, 0], [100, 0]] as [[number, number], [number, number]], longitud: 2 }];
    const conIds = asegurarIds(b, varias); conIds.huecos = "7";
    const r = propuesta(conIds, varias, data.articles, data.organization_id);
    if ("error" in r) throw new Error(r.error);
    expect(r.lineas.find(l => l.trabajo.id === "levantar")?.cantidad).toBe(4.44);
    expect(r.lineas.find(l => l.trabajo.id === "acabar")?.cantidad).toBe(8.88);
    expect(r.pendientes).toBe(0);
  });

  it("el subtotal coincide con las partidas guardadas al sumar longitudes sin redondeos por pared", () => {
    const b = listo(), ps = paredes(b), w = ps.find(p => p.estado === "nueva")!;
    const muchas = Array.from({ length: 7 }, (_, i) => ({ ...w, id: w.id + i, centerline: [[0, 0], [33.333, 0]] as [[number, number], [number, number]], longitud: 0.66666 }));
    const conIds = asegurarIds(b, muchas); conIds.altura = "2,617";
    const r = propuesta(conIds, muchas, data.articles, data.organization_id);
    if ("error" in r) throw new Error(r.error);
    expect(r.lineas.find(l => l.trabajo.id === "levantar")?.cantidad).toBe(12.213);
    expect(r.base).toBe(r.items.reduce((s, i) => s + Math.round(i.quantity * i.unit_price), 0));
  });

  it("no oculta alturas inválidas ni huecos negativos o no numéricos", () => {
    for (const patch of [{ altura: "0" }, { altura: "-2" }, { huecos: "-1" }, { huecos: "desconocido" }]) {
      const b = { ...listo(), ...patch };
      expect(propuesta(b, paredes(b), data.articles, data.organization_id)).toHaveProperty("error");
    }
  });

  it("un mismo precio no identifica un mismo artículo y sustituir exige una decisión", () => {
    const original = data.versions.find(v => v.id === demoId(60))!.items[0];
    const diferente = { ...original, id: demoId(999), description: "Trabajo distinto al mismo precio", quantity: 7 };
    expect(coincidencias([original], [diferente])).toEqual([]);
    const nuevo = { ...diferente, description: original.description, inclusion: "included" as const, adjustment_percent: 0 };
    const par = coincidencias([original], [nuevo]);
    expect(fusionar([original], [nuevo], {}, par)).toHaveLength(2);
    expect(fusionar([original], [nuevo], { [nuevo.id]: "sustituir" }, par)).toEqual([{ ...nuevo, id: original.id }]);
  });

  it("una partida existente no se sustituye dos veces y el mismo PDF no duplica paredes", () => {
    const original = data.versions.find(v => v.id === demoId(60))!.items[0];
    const nuevos = [{ ...original, id: demoId(998), quantity: 3 }, { ...original, id: demoId(999), quantity: 5 }];
    const pares = coincidencias([original], nuevos);
    expect(pares).toHaveLength(1);
    expect(fusionar([original], nuevos, { [nuevos[0].id]: "sustituir" }, pares).map(i => i.quantity)).toEqual([3, 5]);
    const b = listo();
    expect(añadirPlano(b, { nombre: "El mismo plano con otro nombre.pdf", extraction: b.planos[0].extraction })).toBe(b);
  });

});
