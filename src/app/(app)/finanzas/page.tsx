"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { LineChart, Sparkline } from "@/components/ui/line-chart";
import { Popover } from "@/components/ui/popover";
import { QuickCreatePanels } from "@/components/quick-create";
import { can, dateLabel, money } from "@/lib/domain";
import { finanzas } from "@/lib/resumen";
import { comparar, csvGestoria, periodos, resumenPeriodo, seriesFinanzas, type Periodo, type Serie } from "@/lib/finanzas-periodo";
import { useQueryState } from "@/lib/use-query-state";

const euros = (c: number) => (c === 0 ? "0 €" : c >= 100000 ? `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(c / 100000)} k€` : `${Math.round(c / 100)} €`);

/** Lo aceptado, lo preparado para cobrar y lo que falta, por periodo y por proyecto. Importes sin IVA. */
export default function FinanzasPage() {
  const { data, actor } = useWorkspace();
  const [periodo, setPeriodo] = useQueryState<Periodo>("periodo", "mes");
  const [proyecto, setProyecto] = useQueryState<string>("proyecto", "");
  const [desplazamiento, setDesplazamiento] = useState(0);
  const [activas, setActivas] = useState<Set<Serie>>(new Set(["aceptado", "cobros", "enviado"]));
  const [proyectoAbierto, setProyectoAbierto] = useState(false);
  const [tabla, setTabla] = useState<"cobros" | "proyectos">("cobros");
  const [nuevoCobro, setNuevoCobro] = useState(false);
  const r = useMemo(() => resumenPeriodo(data, periodo, desplazamiento, proyecto), [data, periodo, desplazamiento, proyecto]);
  const porProyecto = useMemo(() => finanzas(data).filas.filter(f => !proyecto || f.project.id === proyecto), [data, proyecto]);
  const porCobrar = porProyecto.filter(f => f.pendiente > 0).sort((a, b) => b.pendiente - a.pendiente);
  const cobros = data.certifications.filter(c => (!proyecto || c.project_id === proyecto) && c.created_at.slice(0, 10) >= r.rango.desde && c.created_at.slice(0, 10) <= r.rango.hasta).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const nombreProyecto = (id: string) => data.projects.find(p => p.id === id);
  const series = seriesFinanzas.filter(s => activas.has(s.id)).map(s => ({ ...s, values: r.series[s.id] }));
  const puedeCobrar = can(actor.role, "certification.create");

  function exportar() {
    const blob = new Blob([`﻿${csvGestoria(data, proyecto)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "cobros-para-la-gestoria.csv"; a.click(); URL.revokeObjectURL(url);
  }

  const cifras = [
    { label: "Aceptado", valor: money(r.aceptado.ahora), detalle: comparar(r.aceptado.ahora, r.aceptado.antes), spark: r.series.aceptado, color: "var(--pl-series-1)" },
    { label: "Cobros preparados", valor: money(r.cobros.ahora), detalle: comparar(r.cobros.ahora, r.cobros.antes), spark: r.series.cobros, color: "var(--pl-series-2)", tone: "success" },
    { label: "Pendiente de cobro", valor: money(r.pendiente), detalle: "Aceptado menos lo preparado, a día de hoy", tone: "warning" },
    { label: "Enviado, sin respuesta", valor: money(r.sinRespuesta), detalle: "A día de hoy", spark: r.series.enviado, color: "var(--pl-series-3)", tone: "info" },
    { label: "Borradores sin enviar", valor: money(r.borradores), detalle: "A día de hoy" },
    { label: "Preparado sobre lo aceptado", valor: `${r.porcentaje} %`, detalle: "Lo que ya tiene cobro preparado" }
  ];

  return (
    <div className="page fin-page">
      <div className="pl-head">
        <div><h1 className="pl-title">Finanzas</h1><p className="pl-sub">Lo aceptado, lo preparado para cobrar y lo que falta. Importes sin IVA.</p></div>
        <div className="pl-head-actions">
          <Button onClick={exportar} disabled={!data.certifications.length} title={data.certifications.length ? undefined : "Todavía no hay cobros que exportar"}><Download size={16} strokeWidth={1.7} aria-hidden="true" />Exportar para la gestoría</Button>
          {puedeCobrar && <Button variant="primary" onClick={() => setNuevoCobro(true)}><Plus size={17} strokeWidth={1.8} aria-hidden="true" />Preparar cobro</Button>}
        </div>
      </div>

      <div className="fin-controls">
        <div className="pl-seg" role="group" aria-label="Periodo">{periodos.map(p => <button key={p.id} type="button" aria-pressed={periodo === p.id} onClick={() => { setPeriodo(p.id); setDesplazamiento(0); }}>{p.label}</button>)}</div>
        <div className="fin-nav">
          <button type="button" aria-label="Periodo anterior" onClick={() => setDesplazamiento(d => d - 1)}><ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" /></button>
          <strong aria-live="polite">{r.rango.etiqueta}</strong>
          <button type="button" aria-label="Periodo siguiente" disabled={desplazamiento >= 0} onClick={() => setDesplazamiento(d => d + 1)}><ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" /></button>
        </div>
        <Popover open={proyectoAbierto} onClose={() => setProyectoAbierto(false)} align="end" className="fin-project" panelClassName="filter-panel" trigger={
          <button type="button" className="filter-button" data-active={proyecto ? true : undefined} aria-expanded={proyectoAbierto} onClick={() => setProyectoAbierto(v => !v)}><span>Proyecto:</span><strong>{nombreProyecto(proyecto)?.name ?? "Todos"}</strong><ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" /></button>
        }>
          <button type="button" className="filter-option" data-on={!proyecto || undefined} onClick={() => { setProyecto(""); setProyectoAbierto(false); }}>Todos</button>
          {data.projects.map(p => <button key={p.id} type="button" className="filter-option" data-on={proyecto === p.id || undefined} onClick={() => { setProyecto(p.id); setProyectoAbierto(false); }}>{p.name}</button>)}
        </Popover>
      </div>

      <div className="fin-kpis">
        {cifras.map(c => (
          <div key={c.label} className="pl-card stat fin-kpi">
            <span>{c.label}</span>
            <strong className="pl-mono" data-tone={c.tone}>{c.valor}</strong>
            <small>{c.detalle}</small>
            {c.spark && <Sparkline values={c.spark} color={c.color!} />}
          </div>
        ))}
      </div>

      <div className="fin-two">
        <section className="pl-card fin-chart" aria-label={`Evolución · ${r.rango.etiqueta}`}>
          <div className="fin-chart-head">
            <strong>Evolución · {r.rango.etiqueta}</strong>
            <div className="fin-series" role="group" aria-label="Qué series mostrar">
              {seriesFinanzas.map(s => <label key={s.id} className="fin-serie"><input type="checkbox" checked={activas.has(s.id)} onChange={() => setActivas(prev => { const next = new Set(prev); if (next.has(s.id)) next.delete(s.id); else next.add(s.id); return next; })} style={{ accentColor: s.color }} />{s.label}</label>)}
            </div>
          </div>
          <LineChart labels={r.rango.tramos.map(t => t.etiqueta)} series={series} format={money} formatAxis={euros} ariaLabel={`Evolución de ${seriesFinanzas.filter(s => activas.has(s.id)).map(s => s.label.toLowerCase()).join(", ")}. Los mismos datos están en la tabla de debajo.`} />
        </section>
        <section className="pl-card fin-due" aria-label="Por cobrar, lo primero">
          <header className="pl-card-head"><strong>Por cobrar, lo primero</strong></header>
          {porCobrar.length === 0 && <p className="muted text-sm" style={{ padding: "14px 16px", margin: 0 }}>Nada pendiente de preparar.</p>}
          {porCobrar.slice(0, 6).map(f => (
            <Link key={f.project.id} href={`/proyectos/${f.project.id}?s=cobros`} className="fin-due-row"><span><strong>{f.project.name}</strong><small>{f.project.client_name}</small></span><span className="pl-mono">{money(f.pendiente)}</span></Link>
          ))}
        </section>
      </div>

      <section className="pl-card fin-table-card" aria-label="Detalle">
        <div className="fin-table-head">
          <div className="pl-seg" role="group" aria-label="Qué tabla ver">
            <button type="button" aria-pressed={tabla === "cobros"} onClick={() => setTabla("cobros")}>Cobros · {cobros.length}</button>
            <button type="button" aria-pressed={tabla === "proyectos"} onClick={() => setTabla("proyectos")}>Por proyecto · {porProyecto.length}</button>
          </div>
        </div>
        {tabla === "cobros" && <>
          {cobros.length === 0 && <p className="muted text-sm" style={{ padding: "12px 16px", margin: 0 }}>Sin cobros preparados en {r.rango.etiqueta.toLowerCase()}.</p>}
          {cobros.map(c => { const p = nombreProyecto(c.project_id); return (
            <Link key={c.id} href={`/proyectos/${c.project_id}?s=cobros`} className="fin-line"><span className="fin-line-main"><strong>{c.title}</strong><small>{p?.client_name} · {p?.name}</small></span><span className="muted">{dateLabel(c.created_at)}</span><span className="pill" data-tone="muted">Borrador</span><span className="pl-mono fin-line-amount">{money(c.amount)}</span></Link>
          ); })}
          {cobros.length > 0 && <div className="fin-total"><span className="muted">{cobros.length} {cobros.length === 1 ? "cobro" : "cobros"}</span><strong className="pl-mono">{money(cobros.reduce((s, c) => s + c.amount, 0))}</strong></div>}
        </>}
        {tabla === "proyectos" && <>
          {porProyecto.length === 0 && <p className="muted text-sm" style={{ padding: "12px 16px", margin: 0 }}>Aparecen en cuanto un presupuesto se envía o se acepta.</p>}
          {porProyecto.map(f => <Link key={f.project.id} href={`/proyectos/${f.project.id}?s=cobros`} className="fin-grid-row"><span className="fin-line-main"><strong>{f.project.name}</strong><small>{f.project.client_name}</small></span><span data-label="Aceptado" className="pl-mono">{f.aprobado ? money(f.aprobado) : "—"}</span><span data-label="Preparado" className="pl-mono">{f.certificado ? money(f.certificado) : "—"}</span><span data-label="Pendiente" className="pl-mono">{f.aprobado ? money(f.pendiente) : "—"}</span></Link>)}
        </>}
      </section>
      <p className="pl-note">Gastos, facturas, beneficio y margen aparecerán aquí cuando Plano pueda registrarlos. Hoy no se guardan, así que no se muestran cifras aproximadas. Los cobros preparados todavía no son facturas emitidas.</p>
      <QuickCreatePanels panel={nuevoCobro ? "cobro" : null} onClose={() => setNuevoCobro(false)} />
    </div>
  );
}
