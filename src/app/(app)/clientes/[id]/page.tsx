"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { BackLink } from "@/components/ui/back-link";
import { Pill, type Tone } from "@/components/ui/status";
import { LinkButton } from "@/components/ui/button";
import { budgetHistory, versionState } from "@/lib/budget-history";
import { categoryNames } from "@/lib/documentos";
import { can, dateLabel, kindNames, money, totals } from "@/lib/domain";
import { iniciales, pasoDe, pasos, quienActua, quienEtiqueta, textoMovimiento } from "@/lib/pasos";
import { clientes } from "@/lib/resumen";

type Pestana = "proyectos" | "presupuestos" | "cobros" | "documentos" | "historial";

/** Ficha de cliente: se compone de sus proyectos. Los datos de contacto llegarán cuando el cliente exista en el dominio. */
export default function ClientePage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, actor } = useWorkspace();
  const [pestana, setPestana] = useState<Pestana>("proyectos");
  const clave = decodeURIComponent(id);
  const cliente = useMemo(() => clientes(data).find(c => c.id === clave), [data, clave]);
  const ids = useMemo(() => new Set(cliente?.projects.map(p => p.id) ?? []), [cliente]);
  const presupuestos = useMemo(() => data.budgets.filter(b => ids.has(b.project_id)).flatMap(b => budgetHistory(b, data.versions).versions.map(v => ({ v, b, approvedId: b.approved_version_id, actual: budgetHistory(b, data.versions).current?.id === v.id }))), [data, ids]);
  const cobros = useMemo(() => data.certifications.filter(c => ids.has(c.project_id)), [data, ids]);
  const documentos = useMemo(() => data.documents.filter(d => ids.has(d.project_id)), [data, ids]);
  const historial = useMemo(() => data.activities.filter(a => a.project_id && ids.has(a.project_id)), [data, ids]);
  if (loading) return <p className="muted">Cargando el cliente…</p>;
  if (!cliente) return <div className="empty"><strong>Cliente no encontrado</strong><LinkButton href="/clientes" variant="ghost">Volver a clientes</LinkButton></div>;
  const nombreProyecto = (pid: string | null) => data.projects.find(p => p.id === pid)?.name ?? "";
  const actuales = data.budgets.filter(b => ids.has(b.project_id)).map(b => budgetHistory(b, data.versions)).filter(h => h.current);
  const presupuestado = actuales.reduce((s, h) => s + totals(h.current!.items).total, 0);
  const aceptadoBase = cliente.aprobado, preparado = cobros.reduce((s, c) => s + c.amount, 0);
  const desde = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(cliente.projects.map(p => p.created_at).sort()[0]));
  const tabs: { id: Pestana; label: string; n: number }[] = [
    { id: "proyectos", label: "Proyectos", n: cliente.projects.length }, { id: "presupuestos", label: "Presupuestos", n: presupuestos.length }, { id: "cobros", label: "Cobros", n: cobros.length }, { id: "documentos", label: "Documentos", n: documentos.length }, { id: "historial", label: "Historial", n: historial.length }
  ];
  const tono = (approved: boolean, status: string): Tone => (approved ? "success" : status === "issued" ? "info" : status === "draft" ? "warning" : "muted");
  return (
    <div className="page ficha-enter">
      <BackLink fallback="/clientes">Todos los clientes</BackLink>
      <div className="pl-head">
        <div className="client-id"><span className="avatar avatar-lg-soft" aria-hidden="true">{iniciales(cliente.name)}</span><div><h1 className="pl-title">{cliente.name}</h1><p className="pl-sub">Cliente desde {desde}</p></div></div>
        {can(actor.role, "project.create") && <Link href={`/proyectos?nuevo=1&cliente=${encodeURIComponent(cliente.name)}`} className="btn btn-primary"><Plus size={17} strokeWidth={1.8} aria-hidden="true" />Nuevo proyecto</Link>}
      </div>
      <div className="stat-row stat-row-4">
        <div className="pl-card stat"><span>Proyectos</span><strong className="pl-mono">{cliente.projects.length}</strong><small>{cliente.activos} en marcha</small></div>
        <div className="pl-card stat"><span>Presupuestado (actual)</span><strong className="pl-mono">{money(presupuestado)}</strong><small>con IVA</small></div>
        <div className="pl-card stat"><span>Aceptado</span><strong className="pl-mono">{money(cliente.aprobadoTotal)}</strong><small>con IVA</small></div>
        <div className="pl-card stat"><span>Pendiente de cobro</span><strong className="pl-mono" data-tone="warning">{money(Math.max(0, aceptadoBase - preparado))}</strong><small>sin IVA · {cobros.length} {cobros.length === 1 ? "cobro preparado" : "cobros preparados"}</small></div>
      </div>
      <div className="client-grid">
        <section className="pl-card client-data" aria-label="Datos del cliente">
          <header className="pl-card-head"><strong>Datos</strong></header>
          <div><small>Direcciones de obra</small>{cliente.ubicaciones.length ? cliente.ubicaciones.map(u => <span key={u}>{u}</span>) : <span className="muted">Sin dirección</span>}</div>
          <div><small>Teléfono, correo y NIF</small><span className="muted">Todavía no se guardan en Plano.</span></div>
        </section>
        <section className="pl-card client-tabs-card" aria-label="Lo relacionado con el cliente">
          <div className="client-tabs" role="tablist" aria-label="Secciones del cliente">
            {tabs.map(t => <button key={t.id} type="button" role="tab" aria-selected={pestana === t.id} onClick={() => setPestana(t.id)}>{t.label}<span className="count-badge">{t.n}</span></button>)}
          </div>
          {pestana === "proyectos" && cliente.projects.map(p => { const q = quienEtiqueta[quienActua(data, p)]; return (
            <Link key={p.id} href={`/proyectos/${p.id}`} className="client-line"><span><strong>{p.name}</strong><small>{kindNames[p.kind]}{p.location ? ` · ${p.location}` : ""} · paso: {pasos.find(x => x.id === pasoDe(p.status))?.label}</small></span><Pill label={q.label} tone={q.tone} /></Link>
          ); })}
          {pestana === "presupuestos" && presupuestos.map(({ v, b, approvedId, actual }) => (
            <Link key={v.id} href={`/proyectos/${b.project_id}?s=budget&p=${b.id}&v=${v.id}`} className="client-line"><span><strong>V{v.number} · {v.change_reason || b.title}{actual && <span className="mini-chip" data-tone="success" style={{ marginLeft: 8 }}>La actual</span>}</strong><small>{nombreProyecto(b.project_id)} · {dateLabel(v.updated_at)}</small></span><Pill label={versionState(v, approvedId)} tone={tono(v.id === approvedId, v.status)} /><span className="pl-mono">{money(totals(v.items).total)}</span></Link>
          ))}
          {pestana === "cobros" && cobros.map(c => <Link key={c.id} href={`/proyectos/${c.project_id}?s=cobros`} className="client-line"><span><strong>{c.title}</strong><small>{nombreProyecto(c.project_id)} · {dateLabel(c.created_at)}</small></span><Pill label="Borrador" /><span className="pl-mono">{money(c.amount)}</span></Link>)}
          {pestana === "documentos" && documentos.map(d => <Link key={d.id} href={`/proyectos/${d.project_id}?s=documents`} className="client-line"><span><strong>{d.name}</strong><small>{nombreProyecto(d.project_id)} · {categoryNames[d.category]} · {dateLabel(d.created_at)}</small></span></Link>)}
          {pestana === "historial" && historial.slice(0, 40).map(a => <div key={a.id} className="client-line"><span><strong>{textoMovimiento(a.text)}</strong><small>{nombreProyecto(a.project_id)} · {a.actor_name} · {dateLabel(a.created_at)}</small></span></div>)}
          {tabs.find(t => t.id === pestana)?.n === 0 && <p className="muted text-sm" style={{ padding: "14px 18px", margin: 0 }}>Todavía no hay nada aquí.</p>}
        </section>
      </div>
    </div>
  );
}
