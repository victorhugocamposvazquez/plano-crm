"use client";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FileText, Upload, Loader2, RotateCcw, X, Ruler, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useWorkspace } from "@/components/workspace-provider";
import { PlanSvg } from "@/components/plan/plan-svg";
import { pdfExtractionSchema } from "@/lib/captura/pdf-extraction";
import { samplePlan } from "@/lib/captura/sample-plan";
import { colorCss } from "@/lib/captura/pdf-extraction";
import { can, money, lineTotal, type Project, type BudgetItem } from "@/lib/domain";
import { formatSize } from "@/lib/documentos";
import { borradorNuevo, cargarBorrador, guardarBorrador, borrarBorrador, paginaActual, colores, escala, puntoCercano, paredes as calcularParedes, resumenParedes, trabajos, articulosMedibles, sugerirArticulo, cantidadTrabajo, asegurarIds, propuesta as calcularPropuesta, coincidencias, fusionar, numero, type Borrador, type Paso, type Significado, type Decision } from "@/lib/plano-flujo";

const pasos: { n: Paso; titulo: string; corto: string }[] = [
  { n: 1, titulo: "Sube el plano", corto: "Plano" }, { n: 2, titulo: "Dale una medida", corto: "Medida" }, { n: 3, titulo: "Confirma las paredes", corto: "Paredes" },
  { n: 4, titulo: "¿Qué se hace?", corto: "Trabajos" }, { n: 5, titulo: "Revisa y añade al presupuesto", corto: "Revisar" }
];
const cantidad = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);

/**
 * Flujo «Presupuestar desde un plano». Cinco pasos con palabras de obra; «Salir» siempre a mano y el
 * borrador guardado en este navegador. Lo que sale se añade a la revisión abierta del presupuesto (o abre la V1).
 */
export function PlanFlow({ project, budgetId }: { project: Project; budgetId: string | null }) {
  const { data, actor, busy, send, notify, upload, mode } = useWorkspace();
  const router = useRouter();
  const puede = can(actor.role, "budget.save");
  const [b, setB] = useState<Borrador>(() => (typeof window !== "undefined" && cargarBorrador(project.id)) || borradorNuevo(project.id, budgetId));
  const [subiendo, setSubiendo] = useState(false);
  const [pendiente, setPendiente] = useState<{ name: string; since: string } | null>(null);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [decisiones, setDecisiones] = useState<Record<string, Decision>>({});
  const [guardando, setGuardando] = useState(false);
  const [avisoGuardado, setAvisoGuardado] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  const salida = `/proyectos/${project.id}?s=budget${b.budgetId ? `&p=${b.budgetId}` : ""}`;
  const budgets = useMemo(() => data.budgets.filter(x => x.project_id === project.id).sort((x, y) => x.created_at.localeCompare(y.created_at)), [data.budgets, project.id]);
  const budget = budgets.find(x => x.id === b.budgetId) ?? budgets[0];
  const versions = useMemo(() => (budget ? data.versions.filter(v => v.budget_id === budget.id).sort((x, y) => y.number - x.number) : []), [data.versions, budget]);
  const abierta = versions.find(v => v.status === "draft" || v.status === "issued");
  const aprobada = versions.find(v => v.id === budget?.approved_version_id);
  const destino = abierta ?? aprobada;
  const existentes: BudgetItem[] = destino?.items ?? [];
  const planosAdjuntos = useMemo(() => data.documents.filter(d => d.project_id === project.id && d.mime_type === "application/pdf").sort((x, y) => y.created_at.localeCompare(x.created_at)), [data.documents, project.id]);

  const page = paginaActual(b);
  const k = escala(b);
  const ps = useMemo(() => calcularParedes(b), [b]); // eslint-disable-line react-hooks/exhaustive-deps
  const resumen = resumenParedes(ps);
  const medibles = useMemo(() => articulosMedibles(data.articles), [data.articles]);

  useEffect(() => { if (!guardarBorrador(b) && !avisoGuardado) { setAvisoGuardado(true); notify("No se ha podido guardar el borrador en este navegador; sigue, pero no cierres la pestaña."); } }, [b]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setB(prev => asegurarIds(prev, ps)); }, [ps]);
  useEffect(() => { if (!pendiente) return; const doc = data.documents.find(d => d.project_id === project.id && d.name === pendiente.name && d.created_at >= pendiente.since); if (doc) { setB(prev => ({ ...prev, documentId: doc.id, nombre: doc.name })); setPendiente(null); } }, [data.documents, pendiente, project.id]);
  // Al llegar a los trabajos, cada uno sugiere un artículo del catálogo si todavía no tiene.
  useEffect(() => { if (b.paso !== 4) return; setB(prev => { let cambiado = false; const t = { ...prev.trabajos }; for (const tr of trabajos) if (!t[tr.id].articleId) { const a = sugerirArticulo(data.articles, tr); if (a) { t[tr.id] = { ...t[tr.id], articleId: a.id }; cambiado = true; } } return cambiado ? { ...prev, trabajos: t } : prev; }); }, [b.paso, data.articles]);

  const set = (patch: Partial<Borrador>) => setB(prev => ({ ...prev, ...patch }));
  const ir = (paso: Paso) => { set({ paso }); window.scrollTo({ top: 0 }); };

  async function subir(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    if (file.type !== "application/pdf") { notify("Sube el plano en PDF. Si solo tienes una foto o un escaneo, adjúntalo al proyecto y presupuesta a mano."); return; }
    setSubiendo(true); const since = new Date(Date.now() - 1000).toISOString();
    try { await upload(file, project.id, "plan"); setPendiente({ name: file.name, since }); set({ nombre: file.name, extraction: null }); }
    catch (err) { notify(err instanceof Error ? err.message : "No se ha podido subir el plano."); }
    finally { setSubiendo(false); }
  }
  async function cargarLectura(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const r = pdfExtractionSchema.safeParse(raw);
      if (!r.success) throw new Error("Ese archivo no es una lectura de plano de Plano.");
      set({ extraction: r.data, page: r.data.pages[0].page, nombre: b.nombre || file.name.replace(/\.json$/i, ".pdf"), medida: { start: null, end: null, metros: "" }, leyenda: {}, noParedes: [] });
    } catch (err) { notify(err instanceof Error ? err.message : "No se ha podido leer el archivo."); }
  }
  function usarEjemplo() { set({ extraction: samplePlan, page: 1, nombre: b.nombre || "Plano de ejemplo (ficticio)", medida: { start: null, end: null, metros: "" }, leyenda: {}, noParedes: [] }); }

  function marcar(p: [number, number]) {
    if (!page) return;
    const q = puntoCercano(page, p, Math.max(page.width, page.height) / 60);
    setB(prev => { const m = prev.medida; if (!m.start || (m.start && m.end)) return { ...prev, medida: { start: q, end: null, metros: m.metros } }; return { ...prev, medida: { ...m, end: q } }; });
  }
  const significado = (key: string, s: Significado) => setB(prev => ({ ...prev, leyenda: { ...prev.leyenda, [key]: s } }));
  const alternarPared = (id: string) => setB(prev => ({ ...prev, noParedes: prev.noParedes.includes(id) ? prev.noParedes.filter(x => x !== id) : [...prev.noParedes, id] }));

  const resultado = useMemo(() => (b.paso === 5 ? calcularPropuesta(b, ps, data.articles, data.organization_id) : null), [b, ps, data.articles, data.organization_id]);
  const nuevos = resultado && !("error" in resultado) ? resultado.items : [];
  const pares = useMemo(() => coincidencias(existentes, nuevos), [existentes, nuevos]);
  const finales = useMemo(() => fusionar(existentes, nuevos, decisiones, pares), [existentes, nuevos, decisiones, pares]);
  const sumaNuevos = nuevos.reduce((s, i) => s + lineTotal(i), 0);

  async function añadir() {
    if (!puede || busy || guardando || !nuevos.length) return;
    setGuardando(true);
    try {
      let ws = data; let objetivo = budget;
      if (!objetivo) { ws = await send({ type: "budget.create", project_id: project.id, title: "Presupuesto de reforma" }); objetivo = ws.budgets.filter(x => x.project_id === project.id).sort((x, y) => y.created_at.localeCompare(x.created_at))[0]; if (project.status === "lead") ws = await send({ type: "project.status", id: project.id, status: "estimating" }); }
      if (!objetivo) throw new Error("No se ha podido abrir el presupuesto.");
      const suyas = () => ws.versions.filter(v => v.budget_id === objetivo!.id).sort((x, y) => y.number - x.number);
      let borrador = suyas().find(v => v.status === "draft");
      if (!borrador) { const base = suyas().find(v => v.status === "issued") ?? suyas().find(v => v.id === objetivo!.approved_version_id) ?? suyas()[0]; if (!base) throw new Error("El presupuesto no tiene ninguna revisión."); ws = await send({ type: "budget.revise", version_id: base.id, reason: "Partidas añadidas desde el plano" }); borrador = suyas().find(v => v.status === "draft"); }
      if (!borrador) throw new Error("No se ha podido abrir un borrador.");
      const paresAhora = coincidencias(borrador.items, nuevos);
      await send({ type: "budget.save", version_id: borrador.id, expected_revision: borrador.draft_revision, items: fusionar(borrador.items, nuevos, decisiones, paresAhora), notes: borrador.notes });
      borrarBorrador(project.id);
      notify(`${nuevos.length} partida${nuevos.length === 1 ? "" : "s"} del plano añadida${nuevos.length === 1 ? "" : "s"} a la V${borrador.number}.`);
      router.push(`/proyectos/${project.id}?s=budget&p=${objetivo.id}`);
    } catch (err) { notify(err instanceof Error ? err.message : "No se han podido añadir las partidas."); }
    finally { setGuardando(false); }
  }
  function salir() { router.push(salida); }
  function empezarDeNuevo() { borrarBorrador(project.id); setB(borradorNuevo(project.id, budgetId)); setDecisiones({}); }

  const cabeceraDestino = destino ? `Añadiendo al presupuesto · V${destino.number} · ${destino.status === "draft" ? "borrador" : destino.status === "issued" ? "revisión cerrada, se abrirá una nueva" : "aprobada, se abrirá una revisión nueva"}` : "Se abrirá el presupuesto · V1";
  const actual = pasos.find(p => p.n === b.paso)!;

  if (!puede) return <div className="empty"><strong>Tu perfil puede ver el presupuesto, pero no añadir partidas.</strong><Link href={salida} className="btn btn-secondary">Volver a la ficha</Link></div>;

  return (
    <div className="flow">
      <header className="flow-head">
        <button type="button" className="btn btn-ghost" onClick={salir}><ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />Salir</button>
        <div className="flow-head-text"><span className="eyebrow">{cabeceraDestino}</span><strong>{project.name}</strong></div>
        <span className="muted text-xs flow-head-save">Se guarda solo en este navegador</span>
      </header>
      <ol className="flow-steps" aria-label="Pasos">
        {pasos.map(p => <li key={p.n} data-state={p.n < b.paso ? "done" : p.n === b.paso ? "current" : "todo"} aria-current={p.n === b.paso ? "step" : undefined}><button type="button" disabled={p.n > b.paso} onClick={() => ir(p.n)}><i>{p.n < b.paso ? <Check size={11} strokeWidth={2.6} aria-hidden="true" /> : p.n}</i><span>{p.corto}</span></button></li>)}
      </ol>
      <div className="flow-title"><span className="eyebrow">Paso {b.paso} de 5</span><h1 className="h2">{actual.titulo}</h1></div>

      {b.paso === 1 && (
        <div className="flow-body">
          <p className="muted">Vale el PDF que te dio el arquitecto o el que sale de AutoCAD. Se guarda en Documentos del proyecto pase lo que pase después.</p>
          {!b.extraction && (
            <>
              <button type="button" className="dropzone" disabled={subiendo || busy} onClick={() => pdfInput.current?.click()}>
                {subiendo ? <Loader2 size={32} strokeWidth={1.6} aria-hidden="true" className="spin" /> : <Upload size={32} strokeWidth={1.5} aria-hidden="true" />}
                <strong>{subiendo ? "Subiendo el plano…" : b.documentId ? `Plano guardado: ${b.nombre}` : "Elegir PDF"}</strong>
                <span className="muted text-sm">{b.documentId ? "Puedes cambiarlo por otro" : "hasta 50 MB · se guarda como documento del proyecto"}</span>
              </button>
              <input ref={pdfInput} type="file" accept="application/pdf" onChange={subir} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
              {planosAdjuntos.length > 0 && !b.documentId && (
                <div className="panel"><div className="panel-body" style={{ paddingBottom: 6 }}><span className="eyebrow">O usa uno ya adjunto</span></div>{planosAdjuntos.slice(0, 5).map(d => <button key={d.id} type="button" className="info-row" style={{ padding: "8px 14px" }} onClick={() => set({ documentId: d.id, nombre: d.name })}><FileText size={16} strokeWidth={1.7} aria-hidden="true" /><span style={{ minWidth: 0, flex: 1 }}><strong>{d.name}</strong><small className="muted">{formatSize(d.size_bytes)}</small></span></button>)}</div>
              )}
              {b.documentId && (
                <div className="panel notice-panel">
                  <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <strong>Plano guardado. La lectura automática del PDF todavía no está en Plano.</strong>
                    <span className="muted text-sm">El equipo técnico puede leerlo con el lector de planos y darte el archivo de lectura. Mientras tanto, también puedes probar el flujo con un plano de ejemplo.</span>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button variant="secondary" onClick={() => jsonInput.current?.click()}><FileText size={16} strokeWidth={1.7} aria-hidden="true" />Tengo la lectura del plano (.json)</Button>
                      <Button variant="ghost" onClick={usarEjemplo}>Probar con un plano de ejemplo</Button>
                    </div>
                  </div>
                </div>
              )}
              {!b.documentId && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}><Button variant="ghost" onClick={() => jsonInput.current?.click()}>Tengo la lectura del plano (.json)</Button>{(mode === "demo" || planosAdjuntos.length === 0) && <Button variant="ghost" onClick={usarEjemplo}>Probar con un plano de ejemplo</Button>}</div>}
              <input ref={jsonInput} type="file" accept=".json,application/json" onChange={cargarLectura} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
            </>
          )}
          {b.extraction && page && (
            <div className="panel">
              <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.nombre}</strong><span className="pill" data-tone="success">Leído</span></div>
                <span className="muted text-sm">Es un plano con líneas: {b.extraction.pages.length} página{b.extraction.pages.length === 1 ? "" : "s"}, {page.paths.length.toLocaleString("es-ES")} trazos.</span>
                {b.extraction.pages.length > 1 && <Select label="Página a medir" value={String(b.page)} onChange={v => set({ page: Number(v), medida: { start: null, end: null, metros: "" }, leyenda: {}, noParedes: [] })} options={b.extraction.pages.map(p => ({ value: String(p.page), label: `Página ${p.page} · ${p.paths.length} trazos` }))} />}
                <div className="plan-stage plan-stage-sm"><PlanSvg page={page} label="Vista previa del plano" /></div>
                <div><Button variant="ghost" onClick={() => set({ extraction: null })}><X size={15} strokeWidth={1.8} aria-hidden="true" />Quitar y elegir otro</Button></div>
              </div>
            </div>
          )}
          <p className="muted text-sm">Si fuera una imagen o un escaneo no podríamos medirlo: adjúntalo al proyecto y sigue a mano.</p>
          <footer className="flow-foot">
            <Button variant="ghost" onClick={salir}>{b.documentId && !b.extraction ? "Solo guardar el plano, sin medir" : "Salir"}</Button>
            <Button variant="primary" disabled={!b.extraction} onClick={() => ir(2)}>Siguiente: dale una medida<ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" /></Button>
          </footer>
        </div>
      )}

      {b.paso === 2 && page && (
        <div className="flow-body flow-split">
          <div className="plan-stage"><PlanSvg page={page} medida={b.medida} onPick={marcar} label="Plano: toca dos puntos para marcar una medida conocida" /></div>
          <div className="flow-side">
            <p className="muted">Toca los dos extremos de una cota que conozcas y escribe cuánto mide. Con una basta; el punto se pega solo al trazo más cercano.</p>
            <div className="panel"><div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="eyebrow">{!b.medida.start ? "1. Toca el primer extremo" : !b.medida.end ? "2. Toca el segundo extremo" : "Esa distancia mide"}</span>
              <label className="field-inline"><input className="input pl-mono" inputMode="decimal" value={b.medida.metros} onChange={e => set({ medida: { ...b.medida, metros: e.target.value } })} placeholder="4,20" aria-label="Metros" style={{ fontSize: 24, maxWidth: 140 }} /><span className="muted">metros</span></label>
              {b.medida.start && b.medida.end && k && <span className="muted text-sm"><Ruler size={13} strokeWidth={1.8} aria-hidden="true" /> Escala lista: 1 m son {cantidad(1 / k)} unidades del dibujo.</span>}
            </div></div>
            <p className="muted text-sm">¿No hay cotas? Marca un hueco de puerta: suelen medir 0,80 m. Luego podrás corregirlo.</p>
            <footer className="flow-foot">
              <Button variant="ghost" onClick={() => set({ medida: { start: null, end: null, metros: b.medida.metros } })}><RotateCcw size={15} strokeWidth={1.8} aria-hidden="true" />Marcar otra medida</Button>
              <Button variant="primary" disabled={!k} onClick={() => ir(3)}>Siguiente: confirma las paredes<ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" /></Button>
            </footer>
          </div>
        </div>
      )}

      {b.paso === 3 && page && (
        <div className="flow-body flow-split">
          <div className="plan-stage"><PlanSvg page={page} paredes={ps} seleccionada={seleccionada} medida={b.medida} onPared={id => setSeleccionada(id)} label="Plano con las paredes encontradas" /></div>
          <div className="flow-side">
            <div className="panel"><div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="eyebrow">¿Qué significa cada color del plano?</span>
              <p className="muted text-sm" style={{ margin: 0 }}>Los arquitectos pintan de un color lo que se tira y de otro lo nuevo. Las paredes que se quedan no hace falta marcarlas.</p>
              {colores(page).length === 0 && <p className="muted text-sm" style={{ margin: 0 }}>Este plano no tiene rellenos de color, así que no podemos distinguir paredes. Puedes seguir y añadir las partidas a mano.</p>}
              {colores(page).map(c => (
                <div key={c.key} className="legend-row">
                  <span className="legend-swatch" style={{ background: colorCss(c.color) }} aria-hidden="true" /><span style={{ flex: 1, minWidth: 0 }}><strong style={{ textTransform: "capitalize" }}>{c.nombre}</strong><small className="muted"> · {c.paths} trazos</small></span>
                  <span className="seg" role="radiogroup" aria-label={`Significado del ${c.nombre}`}>{(["tira", "nueva", "nada"] as const).map(s => <button key={s} type="button" role="radio" aria-checked={(b.leyenda[c.key] ?? "nada") === s} onClick={() => significado(c.key, s)}>{s === "tira" ? "Se tira" : s === "nueva" ? "Nueva" : "Nada"}</button>)}</span>
                </div>
              ))}
            </div></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="pill" data-tone="danger">Se tira · {resumen.tira.n} · {cantidad(resumen.tira.metros)} m</span>
              <span className="pill" data-tone="success">Nueva · {resumen.nueva.n} · {cantidad(resumen.nueva.metros)} m</span>
              {resumen.descartadas > 0 && <span className="pill">No son paredes · {resumen.descartadas}</span>}
            </div>
            {ps.length === 0 && Object.values(b.leyenda).some(s => s !== "nada") && <p className="muted text-sm">Con esos colores no hemos encontrado franjas de pared. Prueba con otro color o sigue a mano.</p>}
            {ps.length > 0 && (
              <ul className="wall-list">{ps.map(w => (
                <li key={w.id} className="wall-row" data-estado={w.estado} data-descartada={w.descartada || undefined} data-seleccionada={w.id === seleccionada || undefined}>
                  <button type="button" className="wall-main" onClick={() => setSeleccionada(w.id)}><strong>{w.nombre}</strong><small className="muted">{w.estado === "tira" ? "Se tira" : "Nueva"} · {cantidad(w.longitud)} m</small></button>
                  <button type="button" className="btn btn-ghost" style={{ height: 32, fontSize: 13 }} onClick={() => alternarPared(w.id)}>{w.descartada ? "Sí es pared" : "No es pared"}</button>
                </li>
              ))}</ul>
            )}
            <footer className="flow-foot">
              <Button variant="ghost" onClick={() => ir(2)}><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />Volver a la medida</Button>
              <Button variant="primary" disabled={resumen.tira.n + resumen.nueva.n === 0} onClick={() => ir(4)}>Siguiente: ¿qué se hace?<ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" /></Button>
            </footer>
          </div>
        </div>
      )}

      {b.paso === 4 && (
        <div className="flow-body">
          <p className="muted">Marca los trabajos. Las cantidades salen del plano; el precio, de tu catálogo. Todo se puede cambiar después en el presupuesto.</p>
          <div className="facts-2">
            <label className="field"><span className="field-label">Altura de las paredes</span><span className="field-inline"><input className="input pl-mono" inputMode="decimal" value={b.altura} onChange={e => set({ altura: e.target.value })} aria-label="Altura en metros" /><span className="muted">m</span></span><small className="muted">2,60 es la habitual en vivienda.</small></label>
            <label className="field"><span className="field-label">Huecos que no cuentan</span><span className="field-inline"><input className="input pl-mono" inputMode="decimal" value={b.huecos} onChange={e => set({ huecos: e.target.value })} aria-label="Huecos en metros cuadrados" /><span className="muted">m²</span></span><small className="muted">Puertas y ventanas en esas paredes. Una puerta, unos 1,7 m².</small></label>
          </div>
          {trabajos.map(t => {
            const cfg = b.trabajos[t.id]; const hay = ps.some(p => !p.descartada && p.estado === t.aplicaA);
            const article = data.articles.find(a => a.id === cfg.articleId) ?? null;
            const q = hay ? cantidadTrabajo(t, ps, numero(b.altura), numero(b.huecos), article?.unit ?? "m²") : 0;
            return (
              <div key={t.id} className="work-card" data-activo={cfg.activo && hay} data-disabled={!hay || undefined}>
                <label className="work-head"><input type="checkbox" checked={cfg.activo && hay} disabled={!hay} onChange={e => set({ trabajos: { ...b.trabajos, [t.id]: { ...cfg, activo: e.target.checked } } })} /><span style={{ flex: 1 }}><strong>{t.titulo}</strong><small className="muted">{hay ? t.detalle : `No hay paredes marcadas como «${t.aplicaA === "tira" ? "se tira" : "nueva"}».`}</small></span>{hay && <span className="pl-mono">{cantidad(q)} {article?.unit ?? "m²"}</span>}</label>
                {hay && cfg.activo && <div className="work-body"><Select label="Artículo del catálogo" value={cfg.articleId ?? ""} onChange={v => set({ trabajos: { ...b.trabajos, [t.id]: { ...cfg, articleId: v } } })} options={medibles.map(a => ({ value: a.id, label: `${a.name} · ${money(a.unit_price)}/${a.unit}` }))} placeholder="Elegir artículo…" />{!article && <small className="muted">Sin artículo la partida queda pendiente; podrás ponerlo en el presupuesto.</small>}</div>}
              </div>
            );
          })}
          <p className="muted text-sm">Otros trabajos (suelos, alicatados, instalaciones) todavía no salen del plano: añádelos a mano en el presupuesto.</p>
          <footer className="flow-foot">
            <Button variant="ghost" onClick={() => ir(3)}><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />Volver a las paredes</Button>
            <Button variant="primary" disabled={!trabajos.some(t => b.trabajos[t.id].activo && ps.some(p => !p.descartada && p.estado === t.aplicaA))} onClick={() => ir(5)}>Ver las partidas<ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" /></Button>
          </footer>
        </div>
      )}

      {b.paso === 5 && (
        <div className="flow-body">
          {resultado && "error" in resultado && <div className="empty"><strong>No se ha podido calcular</strong><span className="muted text-sm">{resultado.error}</span></div>}
          {resultado && !("error" in resultado) && (
            <>
              <p className="muted">{nuevos.length} partida{nuevos.length === 1 ? "" : "s"} nueva{nuevos.length === 1 ? "" : "s"} para {destino ? `la V${destino.number}` : "el presupuesto"}. {existentes.length > 0 ? `Las ${existentes.length} que ya tenías se quedan como están.` : ""}</p>
              <div className="panel">
                {resultado.lineas.map(l => (
                  <div key={l.trabajo.id} className="proposal-row" data-pendiente={!l.item || undefined}>
                    <span style={{ minWidth: 0, flex: 1 }}><span className="eyebrow">{l.article?.chapter ?? l.trabajo.titulo}</span><strong style={{ display: "block" }}>{l.article?.name ?? l.trabajo.titulo}</strong><small className="muted">{l.paredes} pared{l.paredes === 1 ? "" : "es"} · {cantidad(l.cantidad)} {l.article?.unit ?? ""}{l.article ? ` × ${money(l.article.unit_price)}` : ""}</small>{l.pendientes.map(p => <small key={p} className="pendiente">{p}</small>)}</span>
                    <span className="pl-mono">{l.item ? money(lineTotal(l.item)) : <span className="pill" data-tone="warning">Pendiente</span>}</span>
                  </div>
                ))}
              </div>
              {pares.map(par => (
                <div key={par.nuevo.id} className="panel notice-panel"><div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <strong>Ya tenías «{par.existente.description}» ({cantidad(par.existente.quantity)} {par.existente.unit})</strong>
                  <span className="muted text-sm">¿La sustituimos por la del plano ({cantidad(par.nuevo.quantity)} {par.nuevo.unit}) o la dejamos y añadimos esta aparte?</span>
                  <span className="seg" role="radiogroup" aria-label="Qué hacer con la partida repetida">{(["sustituir", "añadir"] as const).map(d => <button key={d} type="button" role="radio" aria-checked={(decisiones[par.nuevo.id] ?? "sustituir") === d} onClick={() => setDecisiones(prev => ({ ...prev, [par.nuevo.id]: d }))}>{d === "sustituir" ? "Sustituir" : "Añadir aparte"}</button>)}</span>
                </div></div>
              ))}
              <div className="proposal-total"><span className="muted">{pares.length ? "Partidas del plano · base sin IVA" : "Se añaden · base sin IVA"}</span><span className="pl-mono">+{money(sumaNuevos)}</span></div>
              {resultado.lineas.some(l => l.avisos.length) && <p className="muted text-sm"><Sparkles size={13} strokeWidth={1.8} aria-hidden="true" /> {resultado.lineas.flatMap(l => l.avisos)[0]}</p>}
              <p className="muted text-sm">Después se editan como cualquier partida. El presupuesto quedará con {finales.length} partida{finales.length === 1 ? "" : "s"}.</p>
            </>
          )}
          <footer className="flow-foot">
            <Button variant="ghost" onClick={() => ir(4)}><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />Volver a los trabajos</Button>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={salir}>Guardar y seguir luego</Button>
              <Button variant="primary" disabled={!nuevos.length || guardando || busy} onClick={añadir}>{guardando ? "Añadiendo…" : `Añadir ${nuevos.length} partida${nuevos.length === 1 ? "" : "s"} ${destino ? `a la V${destino.number}` : "al presupuesto"}`}</Button>
            </div>
          </footer>
        </div>
      )}

      {b.paso > 1 && <p className="muted text-xs" style={{ textAlign: "center" }}><button type="button" className="link-button" onClick={empezarDeNuevo}>Empezar de nuevo con otro plano</button></p>}
    </div>
  );
}
