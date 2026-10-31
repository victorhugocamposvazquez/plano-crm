"use client";
import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { versionMoment, versionState } from "@/lib/budget-history";
import { useWorkspace } from "@/components/workspace-provider";
import { Tabs } from "@/components/ui/tabs";
import { money, totals } from "@/lib/domain";
import { filasPresupuesto, filtrarPresupuestos, filtrosPresupuesto, type FiltroPresupuesto, type FilaPresupuesto } from "@/lib/resumen";
import { useQueryState } from "@/lib/use-query-state";

const signed = (cents: number) => `${cents < 0 ? "−" : "+"}${money(Math.abs(cents))}`;

/** Todos los presupuestos de la empresa, un renglón por ámbito; cada uno abre su ficha con la revisión seleccionada. */
export default function PresupuestosPage() {
  const { data, loading } = useWorkspace();
  const [filtro, setFiltro] = useQueryState<FiltroPresupuesto>("f", "all");
  const filas = useMemo(() => filasPresupuesto(data), [data]);
  const visibles = useMemo(() => filtrarPresupuestos(filas, filtro), [filas, filtro]);
  const aprobado = filas.reduce((s, f) => s + f.approvedTotal, 0);
  const enRevision = filtrarPresupuestos(filas, "review").length;

  return (
    <div className="page">
      <div>
        <h1 className="pl-title">Todos los presupuestos</h1>
        <p className="subtitle">{loading ? "Cargando…" : `${filas.length} presupuestos · ${enRevision} en curso · ${money(aprobado)} aceptados en total, con IVA`}</p>
      </div>

      <Tabs label="Filtrar presupuestos" value={filtro} onChange={setFiltro} options={filtrosPresupuesto.map(f => ({ id: f.id, label: f.label, count: filtrarPresupuestos(filas, f.id).length }))} />

      {!loading && visibles.length === 0 && <div className="empty"><strong>Nada en este filtro</strong><span className="muted text-sm">Los presupuestos se abren desde la ficha de cada proyecto o desde la estimación en la visita.</span></div>}

      {visibles.length > 0 && <div className="pl-card budget-rows">
        {visibles.map(f => (
          <Link key={f.budget.id} href={`/proyectos/${f.project.id}?s=budget&p=${f.budget.id}&v=${f.latest.id}`} className="budget-row">
            <span className="budget-row-name"><strong>{f.project.name}{data.budgets.filter(b => b.project_id === f.project.id).length > 1 ? ` · ${f.budget.title}` : ""}</strong><small>{[f.project.client_name, f.project.location].filter(Boolean).join(" · ")}</small></span>
            <span className="budget-row-state"><span className="mini-chip" data-tone={f.latest.id === f.approved?.id ? "success" : f.latest.status === "issued" ? "info" : "warning"}>V{f.latest.number} · {versionState(f.latest, f.approved?.id)}</span><small>{versionMoment(f.latest)}</small></span>
            <span className="budget-row-amount"><strong className="pl-mono">{f.latest.items.length ? money(totals(f.latest.items).total) : "Sin partidas"}</strong>{f.approved && f.approved.id !== f.latest.id && <small>{signed(f.deltaTotal)} sobre la V{f.approved.number} aceptada</small>}</span>
            <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" className="muted" />
          </Link>
        ))}
      </div>}

      <p className="muted text-xs">Importes con IVA, los que ve el cliente.</p>
    </div>
  );
}
