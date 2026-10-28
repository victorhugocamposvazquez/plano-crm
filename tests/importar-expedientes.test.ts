import { describe, it, expect } from "vitest";
import { leerPaquete, planificar, resumen, claveArchivo, ejecutar, type Paquete } from "@/lib/importar-expedientes";

const valido = (raw: unknown) => (leerPaquete(raw) as { paquete: Paquete }).paquete;
import { createDemo, demoActor } from "@/lib/demo";
import { applyCommand, type Workspace, type Command } from "@/lib/domain";

const paquete = {
  schema_version: 1, origen: "prueba",
  proyectos: [
    { name: "Reforma integral · Cliente Uno", client_name: "Cliente Uno", location: "", kind: "integral", presupuestos: [
      { title: "Presupuesto 01 Cliente Uno", items: [
        { chapter: "Demolición", description: "Demolición de tabiquerías según plano.", quantity: 1, unit: "global", unit_price: 1237500, vat_rate: 21, adjustment_percent: 0, inclusion: "included" },
        { chapter: "Opción 01 - Pulido", description: "Acuchillado y barnizado.", quantity: 1, unit: "global", unit_price: 158600, vat_rate: 21, adjustment_percent: 0, inclusion: "optional" }
      ], notes: "Importado de «Presupuesto 01.pdf»." }
    ], documentos: [{ path: "HUGO/Reforma Integral/CLIENTE UNO/Plano.pdf", name: "Plano.pdf", category: "plan", mime: "application/pdf", size: 10 }, { path: "HUGO/Reforma Integral/CLIENTE UNO/Video.mp4", name: "Video.mp4", category: "before", mime: "video/mp4", size: 10 }], omitidos: ["Grande.mp4 (80 MB)"] },
    { name: "Vivienda en Monte Alto", client_name: "Cliente de ejemplo 01", location: "", kind: "integral", presupuestos: [], documentos: [] }
  ]
};

describe("Importar expedientes", () => {
  it("valida el paquete y explica en llano si no vale", () => {
    expect("paquete" in leerPaquete(paquete)).toBe(true);
    const malo = leerPaquete({ schema_version: 2 });
    expect("error" in malo && malo.error).toMatch(/formato/);
  });

  it("planifica: los proyectos que ya existen se omiten y se cuentan los archivos que faltan", () => {
    const data = createDemo();
    const plan = planificar(valido(paquete), data, new Set([claveArchivo("Descargas/HUGO/Reforma Integral/CLIENTE UNO/Plano.pdf")]));
    expect(plan.map(p => p.estado)).toEqual(["nuevo", "existe"]);
    expect(plan[0].archivosFaltan).toEqual(["Video.mp4"]);
    expect(resumen(plan)).toMatchObject({ nuevos: 1, existentes: 1, presupuestos: 1, partidas: 2, documentos: 1, faltan: 1 });
    expect(claveArchivo("HUGO/Reforma Integral/CLIENTE UNO/Plano.pdf")).toBe("cliente uno/plano.pdf");
    expect(claveArchivo("X/Demolicio\u0301n.pdf")).toBe(claveArchivo("X/Demolici\u00f3n.pdf"));
    expect(claveArchivo("Descargas/HUGO/Reforma Integral/CLIENTE UNO/Plano.pdf")).toBe(claveArchivo("archivos/HUGO/Reforma Integral/CLIENTE UNO/Plano.pdf"));
  });

  it("ejecuta por los comandos del dominio: proyecto, presupuesto V1 con partidas y notas, documentos y estado", async () => {
    let ws: Workspace = createDemo();
    const send = async (c: Command) => { ws = applyCommand(ws, c, demoActor); return ws; };
    const subidos: string[] = [];
    const archivos = new Map<string, File>([[claveArchivo("HUGO/Reforma Integral/CLIENTE UNO/Plano.pdf"), new File([new Uint8Array(10)], "Plano.pdf", { type: "application/pdf" })]]);
    const plan = planificar(valido(paquete), ws, new Set(archivos.keys()));
    const r = await ejecutar(plan, { data: ws, send, upload: async (f, pid) => { subidos.push(`${pid}:${f.name}`); }, archivos, uuid: (() => { let n = 0; return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`; })() });
    expect(r).toMatchObject({ proyectos: 1, presupuestos: 1, documentos: 1, errores: [] });
    expect(r.omitidos).toHaveLength(3);
    const p = ws.projects.find(x => x.client_name === "Cliente Uno")!;
    expect(p.status).toBe("estimating");
    const b = ws.budgets.find(x => x.project_id === p.id)!;
    const v = ws.versions.find(x => x.budget_id === b.id)!;
    expect(b.title).toBe("Presupuesto 01 Cliente Uno");
    expect(v.items.map(i => [i.chapter, i.inclusion])).toEqual([["Demolición", "included"], ["Opción 01 - Pulido", "optional"]]);
    expect(v.notes).toMatch(/Importado/);
    expect(subidos).toEqual([`${p.id}:Plano.pdf`]);
  });
});
