"use client";
import { useMemo } from "react";
import Link from "next/link";
import { FileText, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Tabs } from "@/components/ui/tabs";
import { money, totals } from "@/lib/domain";
import { filasPresupuesto, filtrarPresupuestos, filtrosPresupuesto, type FiltroPresupuesto, type FilaPresupuesto } from "@/lib/resumen";
import { useQueryState } from "@/lib/use-query-state";
import { BudgetVersionIdentity } from "@/components/project/budget-version-identity";

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
        <div className="eyebrow"><FileText size={13} strokeWidth={1.8} aria-hidden="true" /><span>{data.organization_name || "Espacio de trabajo"}</span></div>
        <h1 className="h1">Presupuestos.</h1>
        <p className="subtitle">{loading ? "Cargando…" : `${filas.length} presupuestos · ${enRevision} en revisión · ${money(aprobado)} aprobados en total, con IVA`}</p>
      </div>

      <Tabs label="Filtrar presupuestos" value={filtro} onChange={setFiltro} options={filtrosPresupuesto.map(f => ({ id: f.id, label: f.label, count: filtrarPresupuestos(filas, f.id).length }))} />

      {!loading && visibles.length === 0 && <div className="empty"><strong>Nada en este filtro</strong><span className="muted text-sm">Los presupuestos se abren desde la ficha de cada proyecto o desde la estimación en la visita.</span></div>}

      <div style={{ borderTop: visibles.length ? "var(--pl-hairline) solid var(--pl-line)" : undefined }}>
        {visibles.map(f => (
          <Link key={f.budget.id} href={`/proyectos/${f.project.id}?s=budget&p=${f.budget.id}&v=${f.latest.id}`} className="row-budget budget-list-row">
            <span style={{ minWidth: 0 }}>
              <strong>{f.project.name}{data.budgets.filter(b => b.project_id === f.project.id).length > 1 ? ` · ${f.budget.title}` : ""}</strong>
              <small>{[f.project.client_name, f.project.location].filter(Boolean).join(" · ")}</small>
              <BudgetVersionIdentity version={f.latest} currentId={f.latest.id} approvedId={f.approved?.id}/>
            </span>
            <span className="row-budget-amounts">
              <span><small>Actual · V{f.latest.number} · con IVA</small><strong className="pl-mono">{f.latest.items.length?money(totals(f.latest.items).total):"Sin partidas"}</strong></span>
              {f.approved && f.approved.id!==f.latest.id && <span><small>Para obra · V{f.approved.number} · con IVA</small><strong className="pl-mono">{money(f.approvedTotal)}</strong></span>}
              {f.approved && f.working && <small>Diferencia: {signed(f.deltaTotal)} con IVA</small>}
            </span>
            <ArrowUpRight size={16} strokeWidth={1.6} aria-hidden="true" className="muted" />
          </Link>
        ))}
      </div>

      <p className="muted text-xs">Importes con IVA, los que ve el cliente.</p>
    </div>
  );
}
