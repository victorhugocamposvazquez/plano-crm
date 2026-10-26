"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Plus, ArrowUpRight, FileText, Search, X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Tabs } from "@/components/ui/tabs";
import { ProjectStatus, Meter } from "@/components/ui/status";
import { projectProgress, projectStatus, money, totals, dateLabel, type Project, type Workspace } from "@/lib/domain";
import { searchProjects } from "@/lib/search";

type Filter = "all" | "active" | "estimating" | "completed";
const filters: { id: Filter; label: string; match: (p: Project) => boolean }[] = [
  { id: "all", label: "Todas", match: () => true },
  { id: "active", label: "En obra", match: p => p.status === "active" || p.status === "planning" },
  { id: "estimating", label: "Presupuestando", match: p => p.status === "lead" || p.status === "estimating" },
  { id: "completed", label: "Finalizadas", match: p => p.status === "completed" }
];

/** Base aprobada (sin IVA) sumando todos los presupuestos de la obra; null si ninguno está aprobado. */
function approvedAmount(data: Workspace, projectId: string) {
  const approved = data.budgets.filter(b => b.project_id === projectId).map(b => data.versions.find(v => v.id === b.approved_version_id)).filter(v => v !== undefined);
  return approved.length ? approved.reduce((sum, v) => sum + totals(v.items).base, 0) : null;
}

export default function ObrasPage() {
  const { data, loading, error } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const hits = useMemo(() => searchProjects(data, data.projects.filter(filters.find(f => f.id === filter)!.match), query), [data, filter, query]);
  const projects = hits.map(h => h.project);
  const matchedIn = (id: string) => hits.find(h => h.project.id === id)?.matchedIn ?? [];
  const activeCount = data.projects.filter(p => p.status === "active").length;
  const inProgressAmount = data.projects.filter(p => p.status === "active").reduce((sum, p) => sum + (approvedAmount(data, p.id) ?? 0), 0);
  const lastVersion = [...data.versions].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const lastProject = lastVersion && data.projects.find(p => p.id === data.budgets.find(b => b.id === lastVersion.budget_id)?.project_id);

  return (
    <div className="page">
      <div>
        <div className="eyebrow"><FileText size={13} strokeWidth={1.8} aria-hidden="true" /><span>{data.organization_name || "Espacio de trabajo"}</span></div>
        <div className="page-head">
          <h1 className="h1">Tus proyectos.</h1>
          <Link href="/proyectos/nueva" className="btn btn-icon" aria-label="Nueva visita" title="Nueva visita"><Plus size={19} strokeWidth={1.55} aria-hidden="true" /></Link>
        </div>
        <p className="subtitle">
          {loading ? "Cargando el espacio de trabajo…" : `${data.projects.length} proyectos · ${activeCount} en obra · ${money(inProgressAmount)} aprobados en curso, sin IVA`}
        </p>
      </div>

      {error && <div className="empty" role="alert"><strong>No se ha podido cargar el espacio.</strong><span className="muted text-sm">{error}</span></div>}

      <label className="search">
        <Search size={16} strokeWidth={1.8} aria-hidden="true" />
        <input type="search" className="search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por calle, cliente, partida, proveedor…" aria-label="Buscar proyectos" autoComplete="off" />
        {query && <button type="button" className="search-clear" aria-label="Borrar búsqueda" onClick={() => setQuery("")}><X size={15} strokeWidth={1.8} aria-hidden="true" /></button>}
      </label>

      <Tabs label="Filtrar proyectos" value={filter} onChange={setFilter} options={filters.map(f => ({ id: f.id, label: f.label, count: searchProjects(data, data.projects.filter(f.match), query).length }))} />

      <div>
        <div className="row-head"><span>Proyecto</span><span>Cliente</span><span>Fase</span><span>Avance</span><span style={{ textAlign: "right" }}>Aprobado · sin IVA</span><span>Estado</span></div>
        {projects.map(project => {
          const progress = projectProgress(data, project.id);
          const amount = approvedAmount(data, project.id);
          return (
            <Link key={project.id} href={`/proyectos/${project.id}`} className="row-project">
              <span className="row-main">
                <span className="row-icon"><Building2 size={16} strokeWidth={1.6} aria-hidden="true" /></span>
                <span className="row-text">
                  <span className="row-title">{project.name}</span>
                  <span className="row-meta">
                    <span>{projectStatus[project.status]}</span>
                    <span>{project.client_name}</span>
                    <span>{project.location}</span>
                    {amount !== null && <span className="pl-mono">{money(amount)}</span>}
                    {query && matchedIn(project.id).length > 0 && <span className="warning">coincide en {matchedIn(project.id).join(", ")}</span>}
                  </span>
                </span>
              </span>
              <span className="row-cols">
                <span style={{ minWidth: 0 }}>{project.client_name}<small className="muted" style={{ display: "block", fontSize: "var(--pl-text-xs)" }}>{project.location}{query && matchedIn(project.id).length > 0 ? ` · coincide en ${matchedIn(project.id).join(", ")}` : ""}</small></span>
                <span>{projectStatus[project.status]}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ flex: 1 }}><Meter value={progress} label={`Avance de ${project.name}`} /></span><span className="row-value">{progress}%</span></span>
                <span className="row-value" style={{ color: "var(--pl-ink)" }}>{amount !== null ? money(amount) : "—"}</span>
                <ProjectStatus status={project.status} />
              </span>
              <span className="row-value row-value-mobile">{progress}%</span>
            </Link>
          );
        })}
        {!loading && projects.length === 0 && (
          <div className="empty" style={{ marginTop: 16 }}>
            <strong>{query ? `Nada coincide con «${query}»` : "No hay proyectos en este filtro"}</strong>
            <span className="muted text-sm">{query ? "Prueba con parte de la calle, el apellido del cliente o un material del presupuesto." : "Los proyectos nuevos entran desde una visita o desde «Nueva obra»."}</span>
          </div>
        )}
      </div>

      {lastVersion && lastProject && (
        <div>
          <div className="section-label"><span>Último presupuesto tocado</span><ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" /></div>
          <Link href={`/proyectos/${lastProject.id}`} className="row-doc">
            <FileText size={19} strokeWidth={1.55} aria-hidden="true" className="muted" />
            <span>V{lastVersion.number} · {lastVersion.change_reason}<small>{lastProject.name} · {dateLabel(lastVersion.updated_at)} · {lastVersion.created_by_name}</small></span>
          </Link>
        </div>
      )}
    </div>
  );
}
