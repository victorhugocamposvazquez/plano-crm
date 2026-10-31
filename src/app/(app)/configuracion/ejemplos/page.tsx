"use client";
import { useState } from "react";
import Link from "next/link";
import { Sparkles, Check, AlertTriangle, Loader2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { can, kindNames } from "@/lib/domain";
import { previsualizar, articulosQueFaltan, cargarEjemplos, type Resultado } from "@/lib/proyectos-ejemplo";

const estados: Record<string, string> = { lead: "Visita", estimating: "Presupuesto", planning: "Obra · planificando", active: "Obra", completed: "Entregado" };

/**
 * Proyectos de ejemplo: los cinco del modo demo, creados en el espacio de trabajo real por los comandos de siempre.
 * Sirve para enseñar la app con contenido. Lo que ya existe no se toca, así que se puede repetir.
 */
export default function EjemplosPage() {
  const { data, actor, busy, send, mode } = useWorkspace();
  const permitido = can(actor.role, "project.create") && can(actor.role, "budget.create");
  const [fase, setFase] = useState<"listo" | "cargando" | "hecho">("listo");
  const [log, setLog] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const vista = previsualizar(data);
  const nuevos = vista.filter(p => !p.existe);
  const articulos = articulosQueFaltan(data).length;

  async function cargar() {
    if (fase === "cargando") return;
    setFase("cargando"); setLog("Empezando…");
    const r = await cargarEjemplos({ data, send, onProgreso: setLog });
    setResultado(r); setFase("hecho");
  }

  if (!permitido) return <div className="page"><div className="empty"><strong>Solo oficina o administración pueden cargar proyectos de ejemplo.</strong></div></div>;

  return (
    <div className="page">
      <div>
        <div className="eyebrow"><BackLink fallback="/mas">Más</BackLink><span>· Configuración</span></div>
        <div className="page-head"><h1 className="h2" style={{ fontSize: "var(--pl-text-h1)" }}>Proyectos de ejemplo</h1></div>
        <p className="subtitle">Cinco proyectos ficticios con sus presupuestos, tareas, compras y un catálogo corto, para ver Plano con contenido y enseñarlo. Son los mismos de la demostración. Lo que ya exista no se toca.</p>
      </div>

      <section className="panel">
        <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="eyebrow">Qué va a entrar</span>
          <p style={{ margin: 0 }}><strong>{nuevos.length} proyecto{nuevos.length === 1 ? "" : "s"} nuevo{nuevos.length === 1 ? "" : "s"}</strong>{nuevos.length < vista.length ? ` (${vista.length - nuevos.length} ya ${vista.length - nuevos.length === 1 ? "está" : "están"})` : ""}{articulos ? ` y ${articulos} artículo${articulos === 1 ? "" : "s"} de catálogo` : ""}.</p>
          <p className="muted text-sm" style={{ margin: 0 }}>Los clientes se llaman «Cliente de ejemplo» y los precios son ficticios, sin validez comercial. Puedes borrar o editar cada proyecto después como cualquier otro.</p>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Proyecto</th><th>Tipo</th><th>Fase</th><th className="num">Versiones</th><th className="num">Tareas</th><th className="num">Compras</th><th>Estado</th></tr></thead>
            <tbody>{vista.map(p => (
              <tr key={p.name} style={{ opacity: p.existe ? 0.6 : 1 }}>
                <td><strong>{p.name}</strong><br /><small className="muted">{p.client_name}</small></td>
                <td>{kindNames[p.kind]}</td>
                <td>{estados[p.status] ?? p.status}</td>
                <td className="num pl-mono">{p.versiones || "—"}</td>
                <td className="num pl-mono">{p.tareas || "—"}</td>
                <td className="num pl-mono">{p.compras || "—"}</td>
                <td>{p.existe ? <span className="pill">Ya existe</span> : <span className="pill" data-tone="success">Nuevo</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="panel-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: "var(--pl-hairline) solid var(--pl-line)" }}>
          <span className="muted text-sm">{mode === "demo" ? "Modo demo: se guarda en este navegador." : "Se guardará en tu espacio de trabajo, visible para todo el equipo."}</span>
          <Button variant="primary" disabled={(nuevos.length === 0 && articulos === 0) || fase === "cargando" || busy} onClick={cargar}>
            {fase === "cargando" ? <><Loader2 size={16} strokeWidth={1.8} aria-hidden="true" className="spin" />Cargando…</> : <><Sparkles size={16} strokeWidth={1.7} aria-hidden="true" />{nuevos.length ? `Cargar ${nuevos.length} proyecto${nuevos.length === 1 ? "" : "s"} de ejemplo` : "Completar el catálogo"}</>}
          </Button>
        </div>
      </section>

      {(fase === "cargando" || fase === "hecho") && (
        <section className="panel"><div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="eyebrow">{fase === "cargando" ? "Cargando" : "Resultado"}</span>
          {fase === "cargando" && <p className="text-sm" style={{ margin: 0 }}>{log}</p>}
          {resultado && (
            <>
              <p style={{ margin: 0 }}><Check size={16} strokeWidth={2} aria-hidden="true" style={{ verticalAlign: "-3px", color: "var(--pl-success)" }} /> {resultado.proyectos} proyecto{resultado.proyectos === 1 ? "" : "s"}, {resultado.presupuestos} presupuesto{resultado.presupuestos === 1 ? "" : "s"}, {resultado.tareas} tarea{resultado.tareas === 1 ? "" : "s"}, {resultado.compras} compra{resultado.compras === 1 ? "" : "s"} y {resultado.articulos} artículo{resultado.articulos === 1 ? "" : "s"} de catálogo.</p>
              {resultado.errores.length > 0 && <div><p className="text-sm" style={{ margin: "0 0 4px" }}><AlertTriangle size={15} strokeWidth={1.8} aria-hidden="true" style={{ verticalAlign: "-3px", color: "var(--pl-warning)" }} /> {resultado.errores.length} con error:</p><ul className="text-sm muted" style={{ margin: 0, paddingLeft: 18 }}>{resultado.errores.map(e => <li key={e}>{e}</li>)}</ul></div>}
              {resultado.omitidos.length > 0 && <details><summary className="text-sm muted" style={{ cursor: "pointer" }}>{resultado.omitidos.length} ya existían</summary><ul className="text-sm muted" style={{ margin: "6px 0 0", paddingLeft: 18 }}>{resultado.omitidos.map(o => <li key={o}>{o}</li>)}</ul></details>}
              <div><Link href="/proyectos" className="btn btn-primary">Ver los proyectos</Link></div>
            </>
          )}
        </div></section>
      )}
    </div>
  );
}
