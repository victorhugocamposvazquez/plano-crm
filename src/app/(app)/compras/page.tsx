"use client";
import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Tabs } from "@/components/ui/tabs";
import { PurchasesPanel } from "@/components/project/purchases-panel";
import { filtros, agruparPorProyecto, resumen, type Filtro } from "@/lib/compras";
import { useQueryState } from "@/lib/use-query-state";
import type { Purchase } from "@/lib/domain";

/* Lo que toca hacer, en el orden en que se hace: recibir lo pedido, pedir lo que falta, llevar a obra lo recibido. */
const tareas: { id: string; label: string; de: (p: Purchase) => boolean }[] = [
  { id: "recibir", label: "Pedido, por recibir", de: p => p.status === "ordered" },
  { id: "pedir", label: "Por pedir", de: p => p.status === "planned" },
  { id: "llevar", label: "En almacén, sin llevar a obra", de: p => p.status === "received" && p.delivered_quantity < p.received_quantity }
];

export default function ComprasPage() {
  const { data, loading } = useWorkspace();
  const [vista, setVista] = useQueryState<"hacer" | "proyecto">("vista", "hacer");
  const [filtro, setFiltro] = useQueryState<Filtro>("f", "all");
  const porHacer = useMemo(() => tareas.map(t => ({ ...t, grupos: agruparPorProyecto(data, data.purchases.filter(t.de)) })), [data]);
  const enObra = useMemo(() => agruparPorProyecto(data, data.purchases.filter(p => p.status === "delivered" || (p.status === "received" && p.delivered_quantity >= p.received_quantity))), [data]);
  const nadaQueHacer = porHacer.every(t => t.grupos.length === 0);
  const visibles = useMemo(() => data.purchases.filter(p => filtro === "all" || p.status === filtro), [data.purchases, filtro]);
  const grupos = useMemo(() => agruparPorProyecto(data, visibles), [data, visibles]);
  const totales = resumen(data.purchases);

  return (
    <div className="page">
      <div>
        <h1 className="pl-title">Materiales</h1>
        <p className="subtitle">{loading ? "Cargando…" : `${totales.porPedir} por pedir · ${totales.pedidos} ${totales.pedidos === 1 ? "pedido" : "pedidos"} sin recibir · ${totales.recibidos} recibidos · ${totales.enObra} en obra`}</p>
      </div>

      <div className="pl-seg" role="group" aria-label="Qué ver">
        <button type="button" aria-pressed={vista === "hacer"} onClick={() => setVista("hacer")}>Por hacer</button>
        <button type="button" aria-pressed={vista === "proyecto"} onClick={() => setVista("proyecto")}>Por proyecto</button>
      </div>

      {vista === "hacer" && <>
        {!loading && nadaQueHacer && <div className="empty"><strong>Nada que pedir, recibir ni llevar</strong><span className="muted text-sm">Los materiales se añaden desde la pestaña Materiales de cada proyecto.</span></div>}
        {porHacer.filter(t => t.grupos.length > 0).map(t => (
          <section key={t.id} className="materiales-grupo" aria-label={t.label}>
            <h2 className="materiales-titulo">{t.label} <span className="pl-mono muted">{t.grupos.reduce((s, g) => s + g.items.length, 0)}</span></h2>
            {t.grupos.map(({ project, items }) => (
              <div key={project.id}>
                <div className="section-label"><Link href={`/proyectos/${project.id}?s=purchases`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--pl-ink)", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>{project.name}<ArrowUpRight size={14} strokeWidth={1.6} aria-hidden="true" /></Link><span className="pl-mono">{items.length}</span></div>
                <PurchasesPanel projectId={project.id} purchases={items} showAdd={false} />
              </div>
            ))}
          </section>
        ))}
        {enObra.length > 0 && <details className="pl-card otras">
          <summary>Ya en obra <span className="muted">· {enObra.reduce((s, g) => s + g.items.length, 0)} materiales</span></summary>
          {enObra.map(({ project, items }) => <div key={project.id} className="materiales-enobra"><div className="section-label"><span>{project.name}</span><span className="pl-mono">{items.length}</span></div><PurchasesPanel projectId={project.id} purchases={items} showAdd={false} /></div>)}
        </details>}
      </>}

      {vista === "proyecto" && <>
      <Tabs label="Filtrar materiales" value={filtro} onChange={setFiltro} options={filtros.map(f => ({ id: f.id, label: f.label, count: f.id === "all" ? data.purchases.length : data.purchases.filter(p => p.status === f.id).length }))} />

      {!loading && grupos.length === 0 && <div className="empty"><strong>Nada en este filtro</strong><span className="muted text-sm">Los materiales se añaden desde la pestaña Materiales de cada proyecto.</span></div>}

      {grupos.map(({ project, items }) => (
        <section key={project.id}>
          <div className="section-label">
            <Link href={`/proyectos/${project.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--pl-ink)", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>{project.name}<ArrowUpRight size={14} strokeWidth={1.6} aria-hidden="true" /></Link>
            <span className="pl-mono">{items.length}</span>
          </div>
          <PurchasesPanel projectId={project.id} purchases={items} showAdd={false} />
        </section>
      ))}
      </>}
    </div>
  );
}
