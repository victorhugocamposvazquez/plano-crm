"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { SearchBox } from "@/components/ui/search-box";
import { money, can } from "@/lib/domain";
import { clientes } from "@/lib/resumen";
import { buscarTolerante } from "@/lib/busqueda";
import { iniciales } from "@/lib/pasos";
import { useQueryState } from "@/lib/use-query-state";

/** Clientes tal y como aparecen en los proyectos: todavía no hay ficha de cliente propia en el dominio. */
export default function ClientesPage() {
  const { data, loading, actor } = useWorkspace();
  const [queryParam, setQueryParam] = useQueryState<string>("q", "");
  const [query, setQuery] = useState(queryParam);
  useEffect(() => { const t = setTimeout(() => { if (query !== queryParam) setQueryParam(query); }, 300); return () => clearTimeout(t); }, [query, queryParam, setQueryParam]);
  const lista = useMemo(() => clientes(data), [data]);
  const visibles = useMemo(() => buscarTolerante(lista, query, c => `${c.name} ${c.ubicaciones.join(" ")} ${c.projects.map(p => `${p.name} ${p.code}`).join(" ")}`), [lista, query]);
  const vocabulario = useMemo(() => lista.flatMap(c => [c.name, ...c.ubicaciones, ...c.projects.map(p => p.name)]), [lista]);
  const puedeCrear = can(actor.role, "project.create");

  return (
    <div className="page">
      <div className="pl-head">
        <div><h1 className="pl-title">Clientes</h1><p className="pl-sub">Personas y empresas para las que trabajamos.</p></div>
      </div>
      <SearchBox seccion="clientes" value={query} onChange={setQuery} label="Buscar clientes" placeholder="Busca lo que sea: nombre, calle, proyecto…" count={loading ? undefined : `${visibles.length} ${visibles.length === 1 ? "cliente" : "clientes"}`} vocabulario={vocabulario} />
      {!loading && visibles.length === 0 && <div className="empty"><strong>{query ? `Nada coincide con «${query}»` : "Todavía no hay clientes"}</strong><span className="muted text-sm">{query ? "Prueba con parte del nombre o de la calle." : "Cada cliente aparece aquí con su primer proyecto."}</span>{!query && puedeCrear && <Link href="/proyectos?nuevo=1" className="btn btn-primary">Nuevo proyecto</Link>}</div>}
      {visibles.length > 0 && <div className="pl-card client-rows">
        {visibles.map((c, i) => (
          <Link key={c.id} href={`/clientes/${encodeURIComponent(c.id)}`} className="client-row">
            <span className="avatar avatar-sm" data-color={i % 5} aria-hidden="true">{iniciales(c.name)}</span>
            <span className="client-row-name"><strong>{c.name}</strong><small>{c.ubicaciones.slice(0, 2).join(" · ") || "Sin dirección"}<span className="solo-movil-inline"> · {c.projects.length} {c.projects.length === 1 ? "proyecto" : "proyectos"}{c.activos ? " en marcha" : ""}</span></small></span>
            <span className="client-row-projects">{c.projects.length} {c.projects.length === 1 ? "proyecto" : "proyectos"} · {c.projects[0]?.name}</span>
            <span className="client-row-amount pl-mono">{c.aprobadoTotal ? money(c.aprobadoTotal) : "—"}</span>
            <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" className="muted" />
          </Link>
        ))}
      </div>}
    </div>
  );
}
