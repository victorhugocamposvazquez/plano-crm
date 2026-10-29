import { budgetHistory } from "./budget-history";
import { totals, type Budget, type BudgetVersion, type Document, type Project, type Workspace } from "./domain";

/**
 * Vistas transversales (todos los proyectos a la vez): presupuestos, clientes, documentos y finanzas.
 * Solo agrupa y suma lo que ya hay en el espacio; los importes son base sin IVA salvo que se diga.
 */

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/* ---------- Presupuestos ---------- */

export type FiltroPresupuesto = "all" | "review" | "approved" | "empty";
export const filtrosPresupuesto: { id: FiltroPresupuesto; label: string }[] = [
  { id: "all", label: "Todos" }, { id: "review", label: "En revisión" }, { id: "approved", label: "Aprobados" }, { id: "empty", label: "Sin partidas" }
];

export type FilaPresupuesto = {
  project: Project; budget: Budget; approved?: BudgetVersion; working?: BudgetVersion; latest: BudgetVersion;
  approvedBase: number; workingBase: number; delta: number; updated_at: string;
  estado: "empty" | "draft" | "issued" | "approved" | "changes";
};

export function filasPresupuesto(data: Workspace): FilaPresupuesto[] {
  const out: FilaPresupuesto[] = [];
  for (const budget of data.budgets) {
    const project = data.projects.find(p => p.id === budget.project_id);
    const versions = data.versions.filter(v => v.budget_id === budget.id).sort((a, b) => b.number - a.number);
    if (!project || !versions.length) continue;
    const { approved, working } = budgetHistory(budget, versions);
    const approvedBase = approved ? totals(approved.items).base : 0;
    const workingBase = working ? totals(working.items).base : 0;
    const estado: FilaPresupuesto["estado"] = approved && working ? "changes" : approved ? "approved" : working?.status === "issued" ? "issued" : working && working.items.length ? "draft" : "empty";
    out.push({ project, budget, approved, working, latest: versions[0], approvedBase, workingBase, delta: approved && working ? workingBase - approvedBase : 0, updated_at: versions.map(v => v.updated_at).sort().at(-1) ?? budget.created_at, estado });
  }
  return out.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function filtrarPresupuestos(filas: FilaPresupuesto[], filtro: FiltroPresupuesto) {
  if (filtro === "all") return filas;
  if (filtro === "review") return filas.filter(f => f.estado === "draft" || f.estado === "issued" || f.estado === "changes");
  if (filtro === "approved") return filas.filter(f => f.estado === "approved" || f.estado === "changes");
  return filas.filter(f => f.estado === "empty");
}

export const estadoPresupuesto: Record<FilaPresupuesto["estado"], string> = {
  empty: "Sin partidas", draft: "Borrador", issued: "Revisión cerrada · por aprobar", approved: "Aprobado para obra", changes: "Aprobado · cambios en preparación"
};

/* ---------- Clientes ---------- */

export type Cliente = { id: string; name: string; projects: Project[]; activos: number; aprobado: number; enRevision: number; ubicaciones: string[]; ultimo: string };

/** Los clientes salen del nombre escrito en cada proyecto (sin entidad propia todavía): se agrupan sin acentos ni mayúsculas. */
export function clientes(data: Workspace): Cliente[] {
  const map = new Map<string, Cliente>();
  const filas = filasPresupuesto(data);
  for (const p of data.projects) {
    const key = norm(p.client_name) || "sin-cliente";
    const c = map.get(key) ?? { id: key, name: p.client_name || "Sin cliente", projects: [], activos: 0, aprobado: 0, enRevision: 0, ubicaciones: [], ultimo: p.created_at };
    c.projects.push(p);
    if (p.status === "active" || p.status === "planning") c.activos++;
    for (const f of filas.filter(f => f.project.id === p.id)) { c.aprobado += f.approvedBase; c.enRevision += f.working && !f.approved ? f.workingBase : 0; if (f.updated_at > c.ultimo) c.ultimo = f.updated_at; }
    if (p.location && !c.ubicaciones.includes(p.location)) c.ubicaciones.push(p.location);
    if (p.created_at > c.ultimo) c.ultimo = p.created_at;
    map.set(key, c);
  }
  return [...map.values()].sort((a, b) => b.ultimo.localeCompare(a.ultimo));
}

export function buscarClientes(lista: Cliente[], query: string) {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return lista;
  return lista.filter(c => { const texto = norm(`${c.name} ${c.ubicaciones.join(" ")} ${c.projects.map(p => `${p.name} ${p.code}`).join(" ")}`); return terms.every(t => texto.includes(t)); });
}

/* ---------- Documentos ---------- */

export type FilaDocumento = { document: Document; project: Project };

export function documentos(data: Workspace, category: Document["category"] | "" = ""): FilaDocumento[] {
  return data.documents
    .filter(d => !category || d.category === category)
    .flatMap(d => { const project = data.projects.find(p => p.id === d.project_id); return project ? [{ document: d, project }] : []; })
    .sort((a, b) => b.document.created_at.localeCompare(a.document.created_at));
}

export function documentosPorProyecto(filas: FilaDocumento[]) {
  const map = new Map<string, { project: Project; items: Document[] }>();
  for (const f of filas) map.set(f.project.id, { project: f.project, items: [...(map.get(f.project.id)?.items ?? []), f.document] });
  return [...map.values()];
}

/* ---------- Finanzas ---------- */

export type FilaFinanzas = { project: Project; aprobado: number; certificado: number; pendiente: number; enRevision: number; comprasPendientes: number };
export type Finanzas = { aprobadoEnCurso: number; enRevision: number; certificado: number; pendienteCertificar: number; ivaAprobado: number; filas: FilaFinanzas[] };

/** Base aprobada por proyecto frente a lo certificado (borradores) y lo que queda; las facturas y cobros llegarán con el dominio. */
export function finanzas(data: Workspace): Finanzas {
  const filasP = filasPresupuesto(data);
  const filas: FilaFinanzas[] = data.projects.map(project => {
    const mine = filasP.filter(f => f.project.id === project.id);
    const aprobado = mine.reduce((s, f) => s + f.approvedBase, 0);
    const enRevision = mine.reduce((s, f) => s + (f.working ? f.workingBase : 0), 0);
    const certificado = data.certifications.filter(c => c.project_id === project.id).reduce((s, c) => s + c.amount, 0);
    const comprasPendientes = data.purchases.filter(p => p.project_id === project.id && (p.status === "planned" || p.status === "ordered")).length;
    return { project, aprobado, certificado, pendiente: Math.max(0, aprobado - certificado), enRevision, comprasPendientes };
  }).filter(f => f.aprobado || f.enRevision || f.certificado).sort((a, b) => b.aprobado - a.aprobado || b.enRevision - a.enRevision);
  const enCurso = filas.filter(f => f.project.status === "active" || f.project.status === "planning");
  const ivaAprobado = filasP.filter(f => f.approved && (f.project.status === "active" || f.project.status === "planning")).reduce((s, f) => s + totals(f.approved!.items).tax, 0);
  return {
    aprobadoEnCurso: enCurso.reduce((s, f) => s + f.aprobado, 0),
    enRevision: filas.reduce((s, f) => s + f.enRevision, 0),
    certificado: filas.reduce((s, f) => s + f.certificado, 0),
    pendienteCertificar: enCurso.reduce((s, f) => s + f.pendiente, 0),
    ivaAprobado, filas
  };
}
