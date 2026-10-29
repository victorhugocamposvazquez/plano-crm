"use client";
import { useMemo } from "react";
import Link from "next/link";
import { FileText, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Tabs } from "@/components/ui/tabs";
import { Status, type Tone } from "@/components/ui/status";
import { money, dateLabel } from "@/lib/domain";
import { filasPresupuesto, filtrarPresupuestos, filtrosPresupuesto, estadoPresupuesto, type FiltroPresupuesto, type FilaPresupuesto } from "@/lib/resumen";
import { useQueryState } from "@/lib/use-query-state";

const tono: Record<FilaPresupuesto["estado"], Tone> = { empty: "muted", draft: "ink", issued: "warning", approved: "success", changes: "blue" };
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
          <Link key={f.budget.id} href={`/proyectos/${f.project.id}?s=budget&p=${f.budget.id}`} className="row-budget">
            <span style={{ minWidth: 0 }}>
              <strong>{f.project.name}{data.budgets.filter(b => b.project_id === f.project.id).length > 1 ? ` · ${f.budget.title}` : ""}</strong>
              <small>{[f.project.client_name, f.project.location, `V${f.latest.number} · ${dateLabel(f.updated_at)}`].filter(Boolean).join(" · ")}</small>
              <span className="row-budget-status"><Status label={estadoPresupuesto[f.estado]} tone={tono[f.estado]} /></span>
            </span>
            <span className="row-budget-amounts">
              {f.approved && <span><small>Aprobado</small><strong className="pl-mono">{money(f.approvedTotal)}</strong></span>}
              {f.working && f.working.items.length > 0 && <span><small>{f.approved ? `V${f.working.number} · diferencia` : "En revisión"}</small><strong className="pl-mono" style={f.approved ? { color: f.deltaTotal >= 0 ? "var(--pl-warning)" : "var(--pl-success)" } : undefined}>{f.approved ? signed(f.deltaTotal) : money(f.workingTotal)}</strong></span>}
              {f.estado === "empty" && <span><small>Sin partidas</small><strong className="pl-mono muted">—</strong></span>}
            </span>
            <ArrowUpRight size={16} strokeWidth={1.6} aria-hidden="true" className="muted" />
          </Link>
        ))}
      </div>

      <p className="muted text-xs">Importes con IVA, los que ve el cliente.</p>
    </div>
  );
}
