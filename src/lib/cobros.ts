import { budgetHistory } from "./budget-history";
import { projectProgress, totals, type Project, type Workspace } from "./domain";
import { facturasDe, sumaBase } from "./facturas";

/**
 * Lo que ya se puede facturar de un proyecto: lo aceptado por el avance de la obra, menos lo facturado y lo ya preparado para cobrar.
 * Es la misma regla que enseña la pestaña Cobros de la ficha; aquí para listarlo en Finanzas y en Hoy. Importes sin IVA.
 */
export function facturableAhora(data: Workspace, projectId: string): { importe: number; progress: number; aceptado: number } {
  const approved = data.budgets.filter(b => b.project_id === projectId).map(b => budgetHistory(b, data.versions).approved).find(Boolean);
  if (!approved) return { importe: 0, progress: 0, aceptado: 0 };
  const base = totals(approved.items).base, progress = projectProgress(data, projectId);
  const facturas = facturasDe(data, projectId);
  const sinFactura = data.certifications.filter(c => c.project_id === projectId && !facturas.some(f => f.certification_id === c.id));
  const segunAvance = Math.round((base * progress) / 100);
  return { importe: Math.max(0, segunAvance - sumaBase(facturas) - sinFactura.reduce((s, c) => s + c.amount, 0)), progress, aceptado: base };
}

/** Proyectos con algo que facturar ya, el mayor importe primero. */
export function puedesFacturarYa(data: Workspace): { project: Project; importe: number; progress: number }[] {
  return data.projects
    .filter(p => p.status !== "completed")
    .map(project => ({ project, ...facturableAhora(data, project.id) }))
    .filter(x => x.importe > 0)
    .sort((a, b) => b.importe - a.importe);
}
