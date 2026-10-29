"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Package, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Tabs } from "@/components/ui/tabs";
import { PurchasesPanel } from "@/components/project/purchases-panel";
import { filtros, agruparPorProyecto, resumen, type Filtro } from "@/lib/compras";
import { useQueryState } from "@/lib/use-query-state";

export default function ComprasPage() {
  const { data, loading } = useWorkspace();
  const [filtro, setFiltro] = useQueryState<Filtro>("f", "all");
  const visibles = useMemo(() => data.purchases.filter(p => filtro === "all" || p.status === filtro), [data.purchases, filtro]);
  const grupos = useMemo(() => agruparPorProyecto(data, visibles), [data, visibles]);
  const totales = resumen(data.purchases);

  return (
    <div className="page">
      <div>
        <div className="eyebrow"><Package size={13} strokeWidth={1.8} aria-hidden="true" /><span>{data.organization_name || "Espacio de trabajo"}</span></div>
        <h1 className="h1">Compras y materiales.</h1>
        <p className="subtitle">{loading ? "Cargando…" : `${totales.porPedir} por pedir · ${totales.pedidos} pedidos sin recibir · ${totales.recibidos} recibidos · ${totales.enObra} en obra`}</p>
      </div>

      <Tabs label="Filtrar materiales" value={filtro} onChange={setFiltro} options={filtros.map(f => ({ id: f.id, label: f.label, count: f.id === "all" ? data.purchases.length : data.purchases.filter(p => p.status === f.id).length }))} />

      {!loading && grupos.length === 0 && <div className="empty"><strong>Nada en este filtro</strong><span className="muted text-sm">Los materiales se añaden desde la pestaña Compras de cada proyecto.</span></div>}

      {grupos.map(({ project, items }) => (
        <section key={project.id}>
          <div className="section-label">
            <Link href={`/proyectos/${project.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--pl-ink)", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>{project.name}<ArrowUpRight size={14} strokeWidth={1.6} aria-hidden="true" /></Link>
            <span className="pl-mono">{items.length}</span>
          </div>
          <PurchasesPanel projectId={project.id} purchases={items} showAdd={false} />
        </section>
      ))}
    </div>
  );
}
