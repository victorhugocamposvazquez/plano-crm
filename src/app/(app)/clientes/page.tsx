"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, Search, X, ArrowUpRight, MapPin } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { ProjectStatus } from "@/components/ui/status";
import { money } from "@/lib/domain";
import { clientes, buscarClientes } from "@/lib/resumen";
import { useQueryState } from "@/lib/use-query-state";

/** Clientes tal y como aparecen en los proyectos: todavía no hay ficha de cliente propia en el dominio. */
export default function ClientesPage() {
  const { data, loading } = useWorkspace();
  const [queryParam, setQueryParam] = useQueryState<string>("q", "");
  const [query, setQuery] = useState(queryParam);
  useEffect(() => { const t = setTimeout(() => { if (query !== queryParam) setQueryParam(query); }, 300); return () => clearTimeout(t); }, [query, queryParam, setQueryParam]);
  const lista = useMemo(() => clientes(data), [data]);
  const visibles = useMemo(() => buscarClientes(lista, query), [lista, query]);
  const enObra = lista.filter(c => c.activos > 0).length;

  return (
    <div className="page">
      <div>
        <div className="eyebrow"><Users size={13} strokeWidth={1.8} aria-hidden="true" /><span>{data.organization_name || "Espacio de trabajo"}</span></div>
        <h1 className="h1">Clientes.</h1>
        <p className="subtitle">{loading ? "Cargando…" : `${lista.length} clientes · ${enObra} con obra en marcha · ${money(lista.reduce((s, c) => s + c.aprobado, 0))} aprobados, sin IVA`}</p>
      </div>

      <label className="search">
        <Search size={16} strokeWidth={1.8} aria-hidden="true" />
        <input type="search" className="search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre, calle o proyecto…" aria-label="Buscar clientes" autoComplete="off" />
        {query && <button type="button" className="search-clear" aria-label="Borrar búsqueda" onClick={() => setQuery("")}><X size={15} strokeWidth={1.8} aria-hidden="true" /></button>}
      </label>

      {!loading && visibles.length === 0 && <div className="empty"><strong>{query ? `Nada coincide con «${query}»` : "Todavía no hay clientes"}</strong><span className="muted text-sm">{query ? "Prueba con parte del nombre o de la calle." : "Aparecen al dar de alta el primer proyecto."}</span></div>}

      <div className="client-list">
        {visibles.map(c => (
          <article key={c.id} className="client-card zone">
            <header>
              <span style={{ minWidth: 0 }}>
                <strong className="client-name">{c.name}</strong>
                {c.ubicaciones.length > 0 && <small className="muted"><MapPin size={12} strokeWidth={1.8} aria-hidden="true" />{c.ubicaciones.slice(0, 2).join(" · ")}{c.ubicaciones.length > 2 ? ` · +${c.ubicaciones.length - 2}` : ""}</small>}
              </span>
              <Link href={`/proyectos?q=${encodeURIComponent(c.name)}`} className="btn btn-ghost" style={{ height: 32 }}>Ver en proyectos<ArrowUpRight size={14} strokeWidth={1.7} aria-hidden="true" /></Link>
            </header>
            <dl className="client-facts">
              <div><dt>Proyectos</dt><dd className="pl-mono">{c.projects.length}{c.activos ? <small className="muted"> · {c.activos} en marcha</small> : null}</dd></div>
              <div><dt>Aprobado</dt><dd className="pl-mono">{c.aprobado ? money(c.aprobado) : "—"}</dd></div>
              <div><dt>En revisión</dt><dd className="pl-mono">{c.enRevision ? money(c.enRevision) : "—"}</dd></div>
            </dl>
            <ul className="client-projects">
              {c.projects.map(p => <li key={p.id}><Link href={`/proyectos/${p.id}`}><span>{p.name}</span><ProjectStatus status={p.status} /></Link></li>)}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
