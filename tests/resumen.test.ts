import { describe, it, expect } from "vitest";
import { filasPresupuesto, filtrarPresupuestos, clientes, buscarClientes, documentos, documentosPorProyecto, finanzas } from "@/lib/resumen";
import { totals } from "@/lib/domain";
import { createDemo, demoId } from "@/lib/demo";

const data = createDemo();

describe("Vistas transversales", () => {
  it("lista un presupuesto por ámbito con su estado y la diferencia en base", () => {
    const filas = filasPresupuesto(data);
    expect(filas).toHaveLength(data.budgets.length);
    const monteAlto = filas.find(f => f.project.id === demoId(10))!;
    expect(monteAlto.estado).toBe("changes");
    expect(monteAlto.approvedBase).toBe(totals(data.versions.find(v => v.id === demoId(60))!.items).base);
    expect(monteAlto.delta).toBe(monteAlto.workingBase - monteAlto.approvedBase);
    expect(filtrarPresupuestos(filas, "approved").every(f => f.approved)).toBe(true);
    expect(filtrarPresupuestos(filas, "review").some(f => f.project.id === demoId(10))).toBe(true);
    expect(filtrarPresupuestos(filas, "empty")).toHaveLength(0);
  });

  it("agrupa clientes por nombre sin acentos y suma lo aprobado", () => {
    const lista = clientes({ ...data, projects: [...data.projects, { ...data.projects[0], id: "x1", code: "PL-099", client_name: "cliente DE ejemplo 01", location: "Otra calle" }] });
    const c = lista.find(c => c.name === "Cliente de ejemplo 01")!;
    expect(c.projects).toHaveLength(2);
    expect(c.ubicaciones).toContain("Otra calle");
    expect(c.aprobado).toBeGreaterThan(0);
    expect(buscarClientes(lista, "otra calle").map(c => c.name)).toEqual(["Cliente de ejemplo 01"]);
    expect(buscarClientes(lista, "")).toHaveLength(lista.length);
  });

  it("lista documentos con su proyecto y los agrupa", () => {
    const con = { ...data, documents: [
      { id: "d1", organization_id: data.organization_id, project_id: demoId(10), name: "plano.pdf", category: "plan" as const, storage_path: "a", mime_type: "application/pdf", size_bytes: 10, created_at: "2026-10-20T10:00:00Z" },
      { id: "d2", organization_id: data.organization_id, project_id: demoId(12), name: "antes.jpg", category: "before" as const, storage_path: "b", mime_type: "image/jpeg", size_bytes: 10, created_at: "2026-10-21T10:00:00Z" }
    ] };
    const filas = documentos(con);
    expect(filas.map(f => f.document.id)).toEqual(["d2", "d1"]);
    expect(documentos(con, "plan")).toHaveLength(1);
    expect(documentosPorProyecto(filas)).toHaveLength(2);
  });

  it("resume finanzas en base sin IVA por proyecto", () => {
    const f = finanzas(data);
    const monteAlto = f.filas.find(r => r.project.id === demoId(10))!;
    expect(monteAlto.aprobado).toBe(1584450);
    expect(monteAlto.pendiente).toBe(monteAlto.aprobado - monteAlto.certificado);
    expect(f.aprobadoEnCurso).toBeGreaterThanOrEqual(monteAlto.aprobado);
    expect(f.filas.every(r => r.aprobado || r.enRevision || r.certificado)).toBe(true);
  });
});
