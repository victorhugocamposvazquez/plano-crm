import { describe, it, expect } from "vitest";
import { createDemo } from "@/lib/demo";
import { plantaEjemplo as planta } from "@/lib/planta-ejemplo";
import { aplicarPlanta, areaContorno, articuloTuberia, describirEquipos, describirMetros, escenaInstalacion, escenaPlanta, estadoVacio, evaporadores, interpretarPlanta, medicionTuberia, modeloDe, partidasPlanta, recintoDicho, type EstadoPlanta, type OrdenPlanta } from "@/lib/planta3d";

const { articles } = createDemo();
const orden = (frase: string, estado: EstadoPlanta = estadoVacio()) => interpretarPlanta(frase, planta, estado, articles);
const hacer = (frase: string, estado: EstadoPlanta = estadoVacio()) => aplicarPlanta(planta, estado, orden(frase, estado) as OrdenPlanta);
const delPlano = () => hacer("pon lo del plano");

describe("Plano en 3D · planta frigorífica de ejemplo", () => {
  it("la escala cuadra con las superficies rotuladas", () => {
    for (const id of ["camara-01", "camara-02", "camara-03", "camara-04", "almacen-seco"]) {
      const r = planta.recintos.find(x => x.id === id)!;
      expect(Math.abs(areaContorno(planta, r) - r.superficie) / r.superficie).toBeLessThan(0.01);
    }
    // Recintos con pilares, retranqueos o tabiques dentro: el contorno simplificado se queda cerca; la cantidad buena es la rotulada.
    for (const r of planta.recintos.filter(r => r.uso !== "servicio")) expect(Math.abs(areaContorno(planta, r) - r.superficie) / r.superficie).toBeLessThan(0.05);
  });

  it("lleva los 14 evaporadores del plano, cada uno dentro de su recinto", () => {
    expect(planta.equipos).toHaveLength(14);
    expect(planta.equipos.filter(e => e.id.startsWith("BT"))).toHaveLength(8);
    const escena = escenaPlanta(planta), { equipos } = escenaInstalacion(planta, estadoVacio());
    expect(equipos.every(e => !e.puesto)).toBe(true);
    for (const e of planta.equipos) {
      const r = escena.recintos.find(x => x.id === e.recinto)!, c = equipos.find(x => x.id === e.id)!.caja;
      const xs = r.contorno.map(p => p[0]), ys = r.contorno.map(p => p[1]);
      expect(c[0]).toBeGreaterThanOrEqual(Math.min(...xs)); expect(c[2]).toBeLessThanOrEqual(Math.max(...xs));
      expect(c[1]).toBeGreaterThanOrEqual(Math.min(...ys)); expect(c[3]).toBeLessThanOrEqual(Math.max(...ys));
    }
  });

  it("mide la tubería en planta por circuito y por diámetro", () => {
    const m = medicionTuberia(planta);
    expect(m.porDiametro.map(x => x.d)).toEqual(["5/8", "3/4", "1 1/8", "1 3/8", "1 5/8", "2 1/8", "3 1/8"]);
    expect(m.total).toBeCloseTo(m.porDiametro.reduce((s, x) => s + x.metros, 0), 6);
    expect(m.total).toBeCloseTo(Object.values(m.porCircuito).reduce((s, x) => s + x, 0), 6);
    // Montante de 127 puntos: 18,99 m de aspiración de baja a 3 1/8".
    expect(m.porDiametro.at(-1)!.metros).toBeCloseTo(127 * 0.1495, 2);
    // El gas caliente va con dos líneas: el doble que la aspiración de baja, que comparte todos sus tramos.
    expect(m.porCircuito["gas-caliente"]).toBeCloseTo(m.porCircuito["aspiracion-bt"] * 2, 6);
    expect(m.dudas.length).toBeGreaterThan(0);
    // Sin un equipo, su ramal no cuenta.
    const sin = medicionTuberia(planta, new Set(planta.equipos.filter(e => e.id !== "MT04").map(e => e.id)));
    expect(m.total - sin.total).toBeCloseTo(36.8 * 0.1495 * 2, 2);
  });

  it("empareja el plano con el catálogo por modelo y por diámetro", () => {
    expect(evaporadores(articles).map(a => modeloDe(a))).toEqual(["TEWSSC80-1", "TEWSSC80-2", "TEWSSC75-3", "TEWSSC80-4", "TEWSDC50", "TEWSDC45"]);
    expect(articuloTuberia(articles, "1 3/8")?.code).toBe("REF-024");
    expect(articuloTuberia(articles, "3/8")).toBeNull();
  });

  it("entiende recintos dichos de varias maneras", () => {
    const id = (t: string) => recintoDicho(t, planta)?.id;
    expect(id("la cámara tres")).toBe("camara-03");
    expect(id("pon dos evaporadores en la camara 4")).toBe("camara-04");
    expect(id("pasillo uno")).toBe("pasillo-1");
    expect(id("el pasillo de cámaras 2")).toBe("pasillo-2");
    expect(id("en muelles")).toBe("muelles-baja");
    expect(id("muelles zona alta")).toBe("muelles-alta");
    expect(id("la antecámara")).toBe("antecamara");
    expect(id("carga de baterías")).toBe("carga-baterias");
    expect(id("una cámara")).toBeUndefined();
  });

  it("«pon lo del plano» presupuesta evaporadores, tubería y central", () => {
    const e = delPlano(), p = partidasPlanta(planta, e, articles);
    expect(e.equipos).toHaveLength(14);
    expect(p.filter(x => x.grupo === "evaporadores").map(x => [x.description, x.quantity])).toEqual([
      ["Evaporador cúbico de cámara TEWSSC80-2", 2], ["Evaporador cúbico de cámara TEWSSC80-1", 2], ["Evaporador cúbico de cámara TEWSSC75-3", 2], ["Evaporador cúbico de cámara TEWSSC80-4", 2],
      ["Evaporador de plafón de pasillo TEWSDC50", 2], ["Evaporador cúbico de muelle TEWSDC45", 4]]);
    expect(p.filter(x => x.grupo === "tuberia")).toHaveLength(7);
    expect(p.filter(x => x.grupo === "tuberia").every(x => x.unit === "ml" && x.quantity > 0)).toBe(true);
    expect(p.at(-1)).toMatchObject({ grupo: "central", quantity: 1, unit: "ud" });
    // El catálogo de la demostración lleva precios orientativos; sin artículo, precio pendiente y nunca una cifra inventada.
    expect(p.every(x => !x.sinPrecio && x.unit_price > 0 && !x.sinArticulo)).toBe(true);
    expect(partidasPlanta(planta, e, []).every(x => x.sinPrecio && x.unit_price === 0)).toBe(true);
    expect(partidasPlanta(planta, e, [])[0]).toMatchObject({ sinArticulo: true, description: "Evaporador TEWSSC80-2", chapter: "Refrigeración" });
    expect(escenaInstalacion(planta, e).tubos.every(t => t.puesto)).toBe(true);
  });

  it("pone, cambia y quita equipos por orden", () => {
    let e = hacer("pon un evaporador en la cámara 1");
    expect(e.equipos.map(x => [x.id, x.modelo, x.delPlano])).toEqual([["BT03", "TEWSSC80-1", true]]);
    e = hacer("pon tres evaporadores en la cámara uno", e);
    expect(e.equipos.map(x => x.id)).toEqual(["BT03", "BT04", "BT09", "BT10"]);
    expect(e.equipos.at(-1)!.delPlano).toBe(false);
    e = hacer("un TEWSDC45 en muelles", e);
    expect(e.equipos.at(-1)).toMatchObject({ id: "MT03", recinto: "muelles-baja", modelo: "TEWSDC45" });
    e = hacer("pon un plafón en el almacén", e);
    expect(e.equipos.at(-1)).toMatchObject({ id: "MT07", recinto: "almacen-seco", modelo: "TEWSDC50", delPlano: false });
    e = hacer("cambia el BT09 por un TEWSSC80-4", e);
    expect(e.equipos.find(x => x.id === "BT09")!.modelo).toBe("TEWSSC80-4");
    e = hacer("quita el bt 10 y el BT09", e);
    expect(e.equipos.map(x => x.id)).toEqual(["BT03", "BT04", "MT03", "MT07"]);
    e = hacer("quita los equipos de la cámara 1", e);
    expect(e.equipos.map(x => x.id)).toEqual(["MT03", "MT07"]);
    expect(orden("quita el BT01", e)).toMatchObject({ tipo: "aviso" });
    expect(orden("pon un evaporador")).toMatchObject({ tipo: "aviso" });
    expect(hacer("quita todo", delPlano())).toEqual(estadoVacio());
  });

  it("tubería, central, consultas y cámara", () => {
    expect(orden("pon la tubería")).toEqual({ tipo: "tuberia", poner: true });
    expect(orden("quita la central")).toEqual({ tipo: "central", poner: false });
    expect(orden("¿cuántos metros de aspiración de baja?")).toEqual({ tipo: "metros", circuito: "aspiracion-bt" });
    expect(orden("¿cuánta tubería lleva?")).toEqual({ tipo: "metros", circuito: undefined });
    expect(orden("¿qué lleva la cámara 2?")).toEqual({ tipo: "recinto", recinto: "camara-02" });
    expect(orden("entra en la cámara 2")).toEqual({ tipo: "vista", recinto: "camara-02" });
    expect(orden("vista general")).toEqual({ tipo: "vista" });
    expect(orden("gira a la derecha")).toEqual({ tipo: "mover", mover: "right" });
    expect(orden("¿cuánto va?")).toEqual({ tipo: "total" });
    expect(orden("pásalo al presupuesto")).toEqual({ tipo: "incorporar" });
    expect(orden("deshaz")).toEqual({ tipo: "deshacer" });
    expect(orden("hola qué tal")).toBeNull();
    const r = planta.recintos.find(x => x.id === "camara-02")!;
    expect(describirEquipos(planta, estadoVacio(), r)).toContain("El plano marca 2 × TEWSSC80-2 (BT01 y BT02)");
    expect(describirEquipos(planta, delPlano(), r)).toContain("Puestos: 2 × TEWSSC80-2");
    expect(describirMetros(planta, estadoVacio(), "aspiracion-bt")).toMatch(/^\d+,\d m de aspiración de baja en planta/);
  });
});
