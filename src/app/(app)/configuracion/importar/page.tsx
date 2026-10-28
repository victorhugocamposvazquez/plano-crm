"use client";
import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { FolderDown, Check, AlertTriangle, Loader2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { can, kindNames, money } from "@/lib/domain";
import { leerPaquete, planificar, resumen, claveArchivo, ejecutar, type Plan, type Resultado } from "@/lib/importar-expedientes";

const NOMBRE_PAQUETE = "plano-importacion.json";

/**
 * Importar expedientes: se elige la carpeta que contiene el paquete y los archivos, se revisa qué va a entrar
 * y se importa por los comandos de siempre. Los proyectos que ya existen no se tocan, así que se puede repetir.
 */
export default function ImportarPage() {
  const { data, actor, busy, send, upload, mode } = useWorkspace();
  const permitido = can(actor.role, "project.create") && can(actor.role, "budget.create");
  const input = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<Map<string, File>>(new Map());
  const [plan, setPlan] = useState<Plan[] | null>(null);
  const [carpeta, setCarpeta] = useState("");
  const [error, setError] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [fase, setFase] = useState<"elegir" | "listo" | "importando" | "hecho">("elegir");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function elegir(e: ChangeEvent<HTMLInputElement>) {
    const lista = Array.from(e.target.files ?? []); e.target.value = "";
    setError(""); setPlan(null); setResultado(null); setLog([]);
    if (!lista.length) return;
    const mapa = new Map<string, File>();
    let json: File | undefined;
    for (const f of lista) { const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name; if (f.name === NOMBRE_PAQUETE) json = f; else mapa.set(claveArchivo(rel), f); }
    setCarpeta(((lista[0] as File & { webkitRelativePath?: string }).webkitRelativePath || "").split("/")[0] || "carpeta");
    if (!json) { setError(`En esa carpeta no está «${NOMBRE_PAQUETE}». Elige la carpeta que lo contiene junto a la subcarpeta de archivos.`); return; }
    try {
      const leido = leerPaquete(JSON.parse(await json.text()));
      if ("error" in leido) { setError(leido.error); return; }
      setArchivos(mapa); setPlan(planificar(leido.paquete, data, new Set(mapa.keys()))); setFase("listo");
    } catch { setError("No se ha podido leer el paquete."); }
  }

  async function importar() {
    if (!plan || fase === "importando") return;
    setFase("importando"); setLog([]);
    const r = await ejecutar(plan, { data, send, upload, archivos, onProgreso: m => setLog(prev => [...prev.slice(-200), m]) });
    setResultado(r); setFase("hecho");
  }

  const res = plan ? resumen(plan) : null;
  if (!permitido) return <div className="page"><div className="empty"><strong>Solo oficina o administración pueden importar expedientes.</strong></div></div>;

  return (
    <div className="page">
      <div>
        <div className="eyebrow"><BackLink fallback="/mas">Más</BackLink><span>· Configuración</span></div>
        <div className="page-head"><h1 className="h2" style={{ fontSize: "var(--pl-text-h1)" }}>Importar expedientes</h1></div>
        <p className="subtitle">Carga proyectos con sus presupuestos y documentos desde una carpeta preparada. Entra por los mismos caminos que si lo hicieras a mano, y lo que ya existe no se toca.</p>
      </div>

      <section className="panel"><div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="eyebrow">1 · Elige la carpeta</span>
        <p className="text-sm muted" style={{ margin: 0 }}>La carpeta debe contener el archivo <code>{NOMBRE_PAQUETE}</code> y, dentro, las carpetas de los expedientes con sus PDF y vídeos. El navegador pedirá permiso para leerla; nada sale de tu equipo hasta que pulses «Importar».</p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={() => input.current?.click()} disabled={fase === "importando"}><FolderDown size={17} strokeWidth={1.6} aria-hidden="true" />Elegir carpeta</Button>
          {carpeta && <span className="text-sm muted">Carpeta: <strong>{carpeta}</strong> · {archivos.size} archivos</span>}
        </div>
        <input ref={input} type="file" multiple onChange={elegir} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
        {error && <p role="alert" className="auth-error" style={{ margin: 0 }}>{error}</p>}
      </div></section>

      {plan && res && (
        <section className="panel">
          <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="eyebrow">2 · Revisa qué va a entrar</span>
            <p style={{ margin: 0 }}><strong>{res.nuevos} proyecto{res.nuevos === 1 ? "" : "s"} nuevo{res.nuevos === 1 ? "" : "s"}</strong> con {res.presupuestos} presupuesto{res.presupuestos === 1 ? "" : "s"} ({res.partidas} partidas) y {res.documentos} documento{res.documentos === 1 ? "" : "s"}.{res.existentes ? ` ${res.existentes} ya exist${res.existentes === 1 ? "e" : "en"} y se dejan como están.` : ""}{res.faltan ? ` ${res.faltan} archivo${res.faltan === 1 ? "" : "s"} del paquete no está${res.faltan === 1 ? "" : "n"} en la carpeta.` : ""}</p>
            <p className="muted text-sm" style={{ margin: 0 }}>Cada presupuesto entra como V1 en borrador, con una partida alzada por capítulo y una nota que dice de qué PDF sale y si cuadra con el total impreso. Las opciones del documento entran como alternativas que no suman.</p>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Proyecto</th><th>Tipo</th><th className="num">Presupuestos</th><th className="num">Base V1</th><th className="num">Archivos</th><th>Estado</th></tr></thead>
              <tbody>{plan.map(p => {
                const base = p.proyecto.presupuestos[0]?.items.filter(i => i.inclusion === "included").reduce((s, i) => s + i.unit_price * i.quantity, 0) ?? 0;
                return (
                  <tr key={p.proyecto.name} style={{ opacity: p.estado === "existe" ? 0.6 : 1 }}>
                    <td><strong>{p.proyecto.client_name}</strong><br /><small className="muted">{p.proyecto.name}</small></td>
                    <td>{kindNames[p.proyecto.kind]}</td>
                    <td className="num pl-mono">{p.proyecto.presupuestos.length}</td>
                    <td className="num pl-mono">{p.proyecto.presupuestos.length ? money(base) : "—"}</td>
                    <td className="num pl-mono">{p.archivosEncontrados}{p.archivosFaltan.length ? <small className="muted"> · faltan {p.archivosFaltan.length}</small> : ""}{p.proyecto.omitidos.length ? <small className="muted"> · {p.proyecto.omitidos.length} &gt; 50 MB</small> : ""}</td>
                    <td>{p.estado === "existe" ? <span className="pill">Ya existe</span> : <span className="pill" data-tone="success">Nuevo</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <div className="panel-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: "var(--pl-hairline) solid var(--pl-line)" }}>
            <span className="muted text-sm">{mode === "demo" ? "Modo demo: se guarda en este navegador." : "Se guardará en tu espacio de trabajo."} Los documentos se suben uno a uno; con vídeos puede tardar unos minutos.</span>
            <Button variant="primary" disabled={res.nuevos === 0 || fase === "importando" || busy} onClick={importar}>{fase === "importando" ? <><Loader2 size={16} strokeWidth={1.8} aria-hidden="true" className="spin" />Importando…</> : `Importar ${res.nuevos} proyecto${res.nuevos === 1 ? "" : "s"}`}</Button>
          </div>
        </section>
      )}

      {(fase === "importando" || fase === "hecho") && (
        <section className="panel"><div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="eyebrow">3 · {fase === "importando" ? "Importando" : "Resultado"}</span>
          {fase === "importando" && <p className="text-sm" style={{ margin: 0 }}>{log[log.length - 1] ?? "Empezando…"}</p>}
          {resultado && (
            <>
              <p style={{ margin: 0 }}><Check size={16} strokeWidth={2} aria-hidden="true" style={{ verticalAlign: "-3px", color: "var(--pl-success)" }} /> {resultado.proyectos} proyecto{resultado.proyectos === 1 ? "" : "s"}, {resultado.presupuestos} presupuesto{resultado.presupuestos === 1 ? "" : "s"} y {resultado.documentos} documento{resultado.documentos === 1 ? "" : "s"} importados.</p>
              {resultado.errores.length > 0 && <div><p className="text-sm" style={{ margin: "0 0 4px" }}><AlertTriangle size={15} strokeWidth={1.8} aria-hidden="true" style={{ verticalAlign: "-3px", color: "var(--pl-warning)" }} /> {resultado.errores.length} con error:</p><ul className="text-sm muted" style={{ margin: 0, paddingLeft: 18 }}>{resultado.errores.map(e => <li key={e}>{e}</li>)}</ul></div>}
              {resultado.omitidos.length > 0 && <details><summary className="text-sm muted" style={{ cursor: "pointer" }}>{resultado.omitidos.length} avisos (omitidos, ya existentes, archivos que faltan)</summary><ul className="text-sm muted" style={{ margin: "6px 0 0", paddingLeft: 18 }}>{resultado.omitidos.map(o => <li key={o}>{o}</li>)}</ul></details>}
              <div><Link href="/proyectos" className="btn btn-primary">Ver los proyectos</Link></div>
            </>
          )}
        </div></section>
      )}
    </div>
  );
}
