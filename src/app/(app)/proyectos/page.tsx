"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Pill } from "@/components/ui/status";
import { SearchBox } from "@/components/ui/search-box";
import { projectProgress, kindNames, money, totals, can, type Workspace } from "@/lib/domain";
import { searchProjects } from "@/lib/search";
import { pasoVisible } from "@/lib/siguiente-paso";
import { iniciales, pasoDe, pasos, quienActua, quienEtiqueta, type Paso, type Quien } from "@/lib/pasos";
import { localDate } from "@/lib/hoy";
import { useQueryState } from "@/lib/use-query-state";
import { NewProjectDialog } from "@/components/project/new-project-dialog";

type Filtro = "all" | Paso;

/** Aceptado con IVA sumando todos los presupuestos del proyecto (la cifra que ve el cliente); null si no hay ninguno. */
function aceptado(data: Workspace, projectId: string) {
  const v = data.budgets.filter(b => b.project_id === projectId).map(b => data.versions.find(x => x.id === b.approved_version_id)).filter(x => x !== undefined);
  return v.length ? v.reduce((sum, x) => sum + totals(x.items).total, 0) : null;
}

const ordenPaso: Record<Paso, number> = { presupuesto: 0, visita: 1, obra: 2, entregado: 3 };

export default function ProyectosPage() {
  const { data, loading, error, actor } = useWorkspace();
  const [filtro, setFiltro] = useQueryState<Filtro>("f", "all");
  const [quien, setQuien] = useQueryState<Quien | "">("quien", "");
  const [queryParam, setQueryParam] = useQueryState<string>("q", "");
  // «?nuevo=1» abre el alta sobre la lista: recargar o volver atrás conserva el contexto.
  const [nuevo, setNuevo] = useQueryState<string>("nuevo", "");
  const [query, setQuery] = useState(queryParam);
  useEffect(() => { const t = setTimeout(() => { if (query !== queryParam) setQueryParam(query); }, 300); return () => clearTimeout(t); }, [query, queryParam, setQueryParam]);
  const hoy = localDate();
  const encontrados = useMemo(() => searchProjects(data, data.projects, query).map(h => h.project), [data, query]);
  const filas = useMemo(() => encontrados.map(project => ({ project, paso: pasoDe(project.status), quien: quienActua(data, project, hoy), siguiente: pasoVisible(data, project, hoy) })), [encontrados, data, hoy]);
  const visibles = filas.filter(f => (filtro === "all" || f.paso === filtro) && (!quien || f.quien === quien)).sort((a, b) => ordenPaso[a.paso] - ordenPaso[b.paso] || a.project.name.localeCompare(b.project.name, "es"));
  const vocabulario = useMemo(() => data.projects.flatMap(p => [p.name, p.client_name, p.location, kindNames[p.kind]]), [data.projects]);
  const cuentaPaso = (id: Filtro) => filas.filter(f => (id === "all" || f.paso === id) && (!quien || f.quien === quien)).length;
  const cuentaQuien = (id: Quien) => filas.filter(f => (filtro === "all" || f.paso === filtro) && f.quien === id).length;
  const puedeCrear = can(actor.role, "project.create");

  return (
    <div className="page">
      <div className="pl-head">
        <div><h1 className="pl-title">Proyectos</h1><p className="pl-sub">Reformas, obra nueva y carpintería, ordenados por el paso en que están.</p></div>
        {puedeCrear && <button type="button" className="btn btn-primary" onClick={() => setNuevo("1")}><Plus size={17} strokeWidth={1.8} aria-hidden="true" />Nuevo proyecto</button>}
      </div>

      {error && <div className="empty" role="alert"><strong>No se ha podido cargar el espacio.</strong><span className="muted text-sm">{error}</span></div>}

      <SearchBox seccion="proyectos" value={query} onChange={setQuery} label="Buscar proyectos" placeholder="Busca lo que sea: proyecto, cliente, calle, paso, qué falta…" count={loading ? undefined : `${visibles.length} ${visibles.length === 1 ? "proyecto" : "proyectos"}`} vocabulario={vocabulario} />

      <div className="list-filters">
        <div className="pl-seg" role="group" aria-label="Filtrar por paso">
          <button type="button" aria-pressed={filtro === "all"} onClick={() => setFiltro("all")}>Todos {cuentaPaso("all")}</button>
          {pasos.map(p => <button key={p.id} type="button" aria-pressed={filtro === p.id} onClick={() => setFiltro(p.id)}>{p.plural} {cuentaPaso(p.id)}</button>)}
        </div>
        <div className="list-filters-who" role="group" aria-label="Filtrar por quién actúa">
          <button type="button" className="who-chip" data-tone="warning" aria-pressed={quien === "te-espera"} onClick={() => setQuien(quien === "te-espera" ? "" : "te-espera")}>Me esperan a mí · {cuentaQuien("te-espera")}</button>
          <button type="button" className="who-chip" data-tone="info" aria-pressed={quien === "cliente"} onClick={() => setQuien(quien === "cliente" ? "" : "cliente")}>Esperando al cliente · {cuentaQuien("cliente")}</button>
          {cuentaQuien("atrasado") > 0 && <button type="button" className="who-chip" data-tone="danger" aria-pressed={quien === "atrasado"} onClick={() => setQuien(quien === "atrasado" ? "" : "atrasado")}>Atrasados · {cuentaQuien("atrasado")}</button>}
        </div>
      </div>

      {visibles.length > 0 && (
        <div className="pl-card project-table">
          <div className="project-row project-row-head" aria-hidden="true"><span>Proyecto</span><span>Paso</span><span>Avance</span><span>Aceptado</span><span>Siguiente paso</span></div>
          {visibles.map(({ project, paso, quien: q, siguiente }) => {
            const avance = projectProgress(data, project.id), importe = aceptado(data, project.id), enObra = paso === "obra" || paso === "entregado";
            return (
              <Link key={project.id} href={`/proyectos/${project.id}`} className="project-row">
                <span className="project-who">
                  <span className="avatar avatar-sm" aria-hidden="true">{iniciales(project.name)}</span>
                  <span className="project-who-text"><strong>{project.name}</strong><small>{[project.client_name, project.location, kindNames[project.kind]].filter(Boolean).join(" · ")}</small></span>
                </span>
                <span className="project-step">{pasos.find(p => p.id === paso)?.label}</span>
                <span className="project-progress" aria-label={enObra ? `Avance ${avance} %` : "Sin avance todavía"}><span className="mini-meter" aria-hidden="true"><span style={{ width: `${enObra ? avance : 0}%` }} /></span><small>{enObra ? `${avance} %` : "—"}</small></span>
                <span className="project-amount pl-mono">{importe !== null ? money(importe) : "—"}</span>
                <span className="project-next"><Pill label={quienEtiqueta[q].label} tone={quienEtiqueta[q].tone} /><small>{siguiente.titulo}</small></span>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && visibles.length === 0 && (
        <div className="empty">
          <strong>{query ? `Nada coincide con «${query}»` : "No hay proyectos en este filtro"}</strong>
          <span className="muted text-sm">{query ? "Prueba con parte de la calle, el apellido del cliente o un material del presupuesto." : "Un proyecto es una obra: con su cliente, su presupuesto y sus tareas."}</span>
          {!query && puedeCrear && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" className="btn btn-primary" onClick={() => setNuevo("1")}>Nuevo proyecto</button><Link href="/proyectos/nueva" className="btn btn-secondary">Empezar con una visita</Link></div>}
        </div>
      )}
      <NewProjectDialog open={nuevo === "1"} onClose={() => setNuevo("")} />
    </div>
  );
}
