"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { LineChart, Sparkline } from "@/components/ui/line-chart";
import { Popover } from "@/components/ui/popover";
import { InvoicePanel, type FacturaInicial } from "@/components/project/invoice-panel";
import { Pill } from "@/components/ui/status";
import { can, dateLabel, money } from "@/lib/domain";
import { emitidas, estadoFactura, estadosFactura, etiquetaFactura, facturasDe, porCobrar, sumaBase, sumaTotal, type EstadoFactura } from "@/lib/facturas";
import { localDate } from "@/lib/hoy";
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
  const [activas, setActivas] = useState<Set<Serie>>(new Set(["facturado", "cobrado", "aceptado"]));
  const [proyectoAbierto, setProyectoAbierto] = useState(false);
  const [tabla, setTabla] = useState<"facturas" | "cobros" | "proyectos">("facturas");
  const [filtroEstado, setFiltroEstado] = useState<EstadoFactura | "">("");
  const [facturaParam, setFacturaParam] = useQueryState<string>("factura", "");
  const [nueva, setNueva] = useState<FacturaInicial | null>(null);
  const r = useMemo(() => resumenPeriodo(data, periodo, desplazamiento, proyecto), [data, periodo, desplazamiento, proyecto]);
  const porProyecto = useMemo(() => finanzas(data).filas.filter(f => !proyecto || f.project.id === proyecto), [data, proyecto]);
  const hoy = localDate();
  const todas = facturasDe(data, proyecto);
  const deudas = porCobrar(todas, hoy);
  const delPeriodo = todas.filter(f => { const fecha = f.issue_date ?? f.created_at.slice(0, 10); return f.status === "draft" || (fecha >= r.rango.desde && fecha <= r.rango.hasta); });
  const facturasVisibles = delPeriodo.filter(f => !filtroEstado || estadoFactura(f, hoy) === filtroEstado).sort((a, b) => (b.number ?? "9").localeCompare(a.number ?? "9"));
  const cobros = data.certifications.filter(c => (!proyecto || c.project_id === proyecto) && !todas.some(f => f.certification_id === c.id)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const nombreProyecto = (id: string) => data.projects.find(p => p.id === id);
  const series = seriesFinanzas.filter(s => activas.has(s.id)).map(s => ({ ...s, values: r.series[s.id] }));
  const puedeFacturar = can(actor.role, "invoice.create");

  function exportar() {
    const blob = new Blob([`﻿${csvGestoria(data, proyecto)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "facturas-para-la-gestoria.csv"; a.click(); URL.revokeObjectURL(url);
  }

  const cifras = [
    { label: "Facturado", valor: money(r.facturado.ahora), detalle: comparar(r.facturado.ahora, r.facturado.antes), spark: r.series.facturado, color: "var(--pl-series-1)" },
    { label: "Cobrado", valor: money(r.cobrado.ahora), detalle: comparar(r.cobrado.ahora, r.cobrado.antes), spark: r.series.cobrado, color: "var(--pl-series-2)", tone: "success" },
    { label: "Pendiente de cobro · con IVA", valor: money(r.pendiente), detalle: r.vencidas ? `${r.vencidas} ${r.vencidas === 1 ? "factura vencida" : "facturas vencidas"} · ${money(r.vencido)}` : r.pendientes ? `${r.pendientes} ${r.pendientes === 1 ? "factura" : "facturas"} sin cobrar` : "Nada pendiente", tone: "warning", alerta: r.vencidas > 0 },
    { label: "Aceptado", valor: money(r.aceptado.ahora), detalle: comparar(r.aceptado.ahora, r.aceptado.antes), spark: r.series.aceptado, color: "var(--pl-series-3)" },
    { label: "Aceptado sin facturar", valor: money(r.sinFacturar), detalle: "A día de hoy" },
    { label: "Enviado, sin respuesta", valor: money(r.sinRespuesta), detalle: "Presupuestos, a día de hoy", tone: "info" }
  ];

  return (
    <div className="page fin-page">
      <div className="pl-head">
        <div><h1 className="pl-title">Finanzas</h1><p className="pl-sub">Lo que facturamos, lo que cobramos y lo que nos deben. Sin IVA salvo donde se indica.</p></div>
        <div className="pl-head-actions">
          <Button onClick={exportar} disabled={!emitidas(todas).length} title={emitidas(todas).length ? undefined : "Todavía no hay facturas que exportar"}><Download size={16} strokeWidth={1.7} aria-hidden="true" />Exportar para la gestoría</Button>
          {puedeFacturar && <Button variant="primary" onClick={() => setNueva({ project_id: proyecto || undefined })}><Plus size={17} strokeWidth={1.8} aria-hidden="true" />Nueva factura</Button>}
        </div>
      </div>

      <div className="fin-controls">
        <div className="pl-seg" role="group" aria-label="Periodo">{periodos.map(p => <button key={p.id} type="button" aria-pressed={periodo === p.id} onClick={() => { setPeriodo(p.id); setDesplazamiento(0); }}><span className="solo-escritorio-inline">{p.label}</span><span className="solo-movil-inline">{{ semana: "Sem.", mes: "Mes", trimestre: "Trim.", ano: "Año" }[p.id]}</span></button>)}</div>
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
            <small data-alerta={c.alerta || undefined}>{c.detalle}</small>
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
          {deudas.length === 0 && <p className="muted text-sm" style={{ padding: "14px 16px", margin: 0 }}>Nadie os debe nada ahora mismo.</p>}
          {deudas.slice(0, 6).map(f => { const tarde = estadoFactura(f, hoy) === "vencida"; return (
            <button key={f.id} type="button" className="fin-due-row" onClick={() => setFacturaParam(f.id)} aria-haspopup="dialog"><span><strong>{f.client_name} · {nombreProyecto(f.project_id)?.name}</strong><small data-alerta={tarde || undefined}>{tarde ? "Venció" : "Vence"} el {f.due_date ? dateLabel(f.due_date) : "—"}</small></span><span className="pl-mono">{money(f.total)}</span></button>
          ); })}
        </section>
      </div>

      <section className="pl-card fin-table-card" aria-label="Detalle">
        <div className="fin-table-head">
          <div className="pl-seg" role="group" aria-label="Qué tabla ver">
            <button type="button" aria-pressed={tabla === "facturas"} onClick={() => setTabla("facturas")}>Facturas · {delPeriodo.length}</button>
            <button type="button" aria-pressed={tabla === "cobros"} onClick={() => setTabla("cobros")}>Cobros sin facturar · {cobros.length}</button>
            <button type="button" aria-pressed={tabla === "proyectos"} onClick={() => setTabla("proyectos")}>Por proyecto · {porProyecto.length}</button>
          </div>
          {tabla === "facturas" && <div className="fin-states" role="group" aria-label="Filtrar facturas por estado">
            <button type="button" className="search-chip" data-active={!filtroEstado || undefined} onClick={() => setFiltroEstado("")}>Todas</button>
            {estadosFactura.map(e => <button key={e.id} type="button" className="search-chip" data-active={filtroEstado === e.id || undefined} onClick={() => setFiltroEstado(filtroEstado === e.id ? "" : e.id)}>{e.label}</button>)}
          </div>}
        </div>
        {tabla === "facturas" && <>
          {facturasVisibles.length === 0 && <div className="fin-empty"><p className="muted text-sm">{filtroEstado ? "Ninguna factura en este estado." : `Sin facturas en ${r.rango.etiqueta.toLowerCase()}.`}</p>{puedeFacturar && !filtroEstado && <Button onClick={() => setNueva({ project_id: proyecto || undefined })}><Plus size={15} strokeWidth={1.8} aria-hidden="true" />Nueva factura</Button>}</div>}
          {facturasVisibles.map(f => { const e = etiquetaFactura(f, hoy); return (
            <button key={f.id} type="button" className="fin-line" onClick={() => setFacturaParam(f.id)} aria-haspopup="dialog">
              <span className="fin-line-number pl-mono">{f.number ?? "Borrador"}</span>
              <span className="fin-line-main"><strong>{f.client_name}</strong><small>{nombreProyecto(f.project_id)?.name} · {f.concept}</small></span>
              <span className="muted fin-line-date">{f.issue_date ? dateLabel(f.issue_date) : "Sin enviar"}</span>
              <span className="muted fin-line-date">{f.due_date ? `Vence ${dateLabel(f.due_date)}` : ""}</span>
              <Pill label={e.label} tone={e.tone} />
              <span className="pl-mono fin-line-amount">{money(f.total)}</span>
            </button>
          ); })}
          {facturasVisibles.length > 0 && <div className="fin-total"><span className="muted">{facturasVisibles.length} {facturasVisibles.length === 1 ? "factura" : "facturas"} · con IVA</span><strong className="pl-mono">{money(sumaTotal(facturasVisibles))}</strong></div>}
        </>}
        {tabla === "cobros" && <>
          {cobros.length === 0 && <p className="muted text-sm" style={{ padding: "12px 16px", margin: 0 }}>No hay cobros preparados pendientes de facturar.</p>}
          {cobros.map(c => { const p = nombreProyecto(c.project_id); return (
            <div key={c.id} className="fin-line"><span className="fin-line-main"><strong>{c.title}</strong><small>{p?.client_name} · {p?.name}</small></span><span className="muted">{dateLabel(c.created_at)}</span><span className="pl-mono fin-line-amount">{money(c.amount)}</span>{puedeFacturar && <Button onClick={() => setNueva({ project_id: c.project_id, concept: c.title, base: c.amount, certification_id: c.id })}>Facturar</Button>}</div>
          ); })}
        </>}
        {tabla === "proyectos" && <>
          {porProyecto.length === 0 && <p className="muted text-sm" style={{ padding: "12px 16px", margin: 0 }}>Aparecen en cuanto un presupuesto se envía o se acepta.</p>}
          {porProyecto.map(f => <Link key={f.project.id} href={`/proyectos/${f.project.id}?s=cobros`} className="fin-grid-row"><span className="fin-line-main"><strong>{f.project.name}</strong><small>{f.project.client_name}</small></span><span data-label="Aceptado" className="pl-mono">{f.aprobado ? money(f.aprobado) : "—"}</span><span data-label="Facturado" className="pl-mono">{money(sumaBase(emitidas(facturasDe(data, f.project.id))))}</span><span data-label="Cobrado" className="pl-mono">{money(sumaBase(facturasDe(data, f.project.id).filter(x => x.status === "paid")))}</span></Link>)}
        </>}
      </section>
      <p className="pl-note">Plano registra las facturas y les hace seguimiento: no sustituye a la factura oficial. Gastos, beneficio y margen aparecerán cuando Plano pueda registrar gastos; hoy no se muestran cifras aproximadas.</p>
      <InvoicePanel open={Boolean(nueva) || Boolean(facturaParam)} onClose={() => { setNueva(null); setFacturaParam(""); }} invoiceId={facturaParam || null} inicial={nueva ?? undefined} />
    </div>
  );
}
