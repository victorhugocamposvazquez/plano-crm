"use client";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FileText, Upload, Loader2, RotateCcw, X, Ruler, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useWorkspace } from "@/components/workspace-provider";
import { PlanSvg } from "@/components/plan/plan-svg";
import { pdfExtractionSchema, colorCss } from "@/lib/captura/pdf-extraction";
import { samplePlan } from "@/lib/captura/sample-plan";
import { can, money, lineTotal, type Project, type BudgetItem, type Document } from "@/lib/domain";
import { budgetHistory } from "@/lib/budget-history";
import { formatSize } from "@/lib/documentos";
import { borradorNuevo, cargarBorrador, guardarBorrador, borrarBorrador, añadirPlano, quitarPlano, usos, nombreUso, paginaDe, planoParaMedir, mismaHoja, comparteEscala, confirmarEscalaCompartida, cambiarPagina, medidaDe, escalaDe, escala, planosSinEscala, colores, cuentaComoPared, puntoCercano, paredes as calcularParedes, resumenParedes, trabajos, articulosMedibles, sugerirArticulo, cantidadTrabajo, huecosTrabajo, asegurarIds, propuesta as calcularPropuesta, coincidencias, fusionar, numero, type Borrador, type Paso, type PlanoCargado, type Decision } from "@/lib/plano-flujo";

/** Tres pasos. Internamente se conservan los números 1, 2 y 4 para que los borradores guardados sigan valiendo. */
const pasos: { n: Paso; titulo: string; corto: string }[] = [
  { n: 1, titulo: "Tus planos", corto: "Planos" },
  { n: 2, titulo: "Mide y confirma las paredes", corto: "Medir" },
  { n: 4, titulo: "Qué se hace y qué entra en el presupuesto", corto: "Partidas" }
];
const pasoVigente = (paso: Paso): Paso => (paso === 3 ? 2 : paso === 5 ? 4 : paso);
const cantidad = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);
type Vista = { medida: boolean };

/**
 * Flujo «Presupuestar desde un plano». Un expediente trae varios planos de la misma vivienda: cada uno dice
 * para qué sirve, comparten una medida tras confirmar que tienen la misma escala y cada trabajo toma su cantidad del plano que
 * le toca. Tres pasos con palabras de obra; la X siempre arriba; el borrador se guarda en este navegador.
 */
export function PlanFlow({ project, budgetId }: { project: Project; budgetId: string | null }) {
  const { data, actor, busy, send, notify, upload, fileUrl, mode } = useWorkspace();
  const router = useRouter();
  const puede = can(actor.role, "budget.save");
  const [b, setB] = useState<Borrador>(() => { const guardado = typeof window !== "undefined" ? cargarBorrador(project.id) : null; return guardado ? { ...guardado, paso: pasoVigente(guardado.paso) } : borradorNuevo(project.id, budgetId); });
  const [subiendo, setSubiendo] = useState(false);
  const [planoActivoId, setPlanoActivoId] = useState<string | null>(null);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [decisiones, setDecisiones] = useState<Record<string, Decision>>({});
  const [guardando, setGuardando] = useState(false);
  const [avisoGuardado, setAvisoGuardado] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);
  const lecturaActual = useRef<AbortController | null>(null);
  const [progresoLectura, setProgresoLectura] = useState("");
  useEffect(() => () => lecturaActual.current?.abort(), []);

  const salida = `/proyectos/${project.id}?s=budget${b.budgetId ? `&p=${b.budgetId}` : ""}`;
  const budgets = useMemo(() => data.budgets.filter(x => x.project_id === project.id).sort((x, y) => x.created_at.localeCompare(y.created_at)), [data.budgets, project.id]);
  const budget = budgets.find(x => x.id === b.budgetId) ?? budgets[0];
  const versions = useMemo(() => (budget ? data.versions.filter(v => v.budget_id === budget.id).sort((x, y) => y.number - x.number) : []), [data.versions, budget]);
  const abierta = budget ? budgetHistory(budget, versions).working : undefined;
  const aprobada = versions.find(v => v.id === budget?.approved_version_id);
  const destino = abierta ?? aprobada;
  const existentes: BudgetItem[] = destino?.items ?? [];
  const planosAdjuntos = useMemo(() => data.documents.filter(d => d.project_id === project.id && d.mime_type === "application/pdf" && d.category === "plan").sort((x, y) => y.created_at.localeCompare(x.created_at)), [data.documents, project.id]);

  const ps = useMemo(() => calcularParedes(b), [b]);
  const resumen = resumenParedes(ps);
  const medibles = useMemo(() => articulosMedibles(data.articles), [data.articles]);
  const conParedes = b.planos.filter(p => usos.find(u => u.id === p.uso)?.paredes);
  const sinEscala = planosSinEscala(b);
  const base = b.planos.find(p => p.id === b.medida.planoId) ?? null;
  const planoActivo = b.planos.find(p => p.id === planoActivoId) ?? base ?? planoParaMedir(b);
  const planoMedida = planoActivo;
  const planoParedes = planoActivo && usos.find(u => u.id === planoActivo.uso)?.paredes ? planoActivo : null;

  useEffect(() => { if (!guardarBorrador(b) && !avisoGuardado) { setAvisoGuardado(true); notify("No se ha podido guardar el borrador en este navegador (ocupa demasiado); sigue, pero no cierres la pestaña."); } }, [b]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setB(prev => asegurarIds(prev, ps)); }, [ps]);
  useEffect(() => { if (b.paso !== 4) return; setB(prev => { let cambiado = false; const t = { ...prev.trabajos }; for (const tr of trabajos) if (!t[tr.id].articleId) { const a = sugerirArticulo(data.articles, tr); if (a) { t[tr.id] = { ...t[tr.id], articleId: a.id }; cambiado = true; } } return cambiado ? { ...prev, trabajos: t } : prev; }); }, [b.paso, data.articles]);

  const set = (patch: Partial<Borrador>) => setB(prev => ({ ...prev, ...patch }));
  const actualizarPlano = (id: string, patch: Partial<PlanoCargado>) => setB(prev => {
    const siguiente = patch.page === undefined ? prev : cambiarPagina(prev, id, patch.page);
    return { ...siguiente, planos: siguiente.planos.map(p => p.id === id ? { ...p, ...patch } : p) };
  });
  const ir = (paso: Paso) => { set({ paso }); window.scrollTo({ top: 0 }); };

  async function subir(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    if (file.type !== "application/pdf") { notify("Sube el plano en PDF. Si solo tienes una foto o un escaneo, adjúntalo al proyecto y presupuesta a mano."); return; }
    await leerArchivo(file);
  }
  async function leerArchivo(file: File, existente?: Document) {
    await procesarPlano(async () => file, existente);
  }
  async function procesarPlano(obtener: (signal: AbortSignal) => Promise<File>, existente?: Document) {
    if (lecturaActual.current || busy) return;
    const controller = new AbortController(); lecturaActual.current = controller;
    setSubiendo(true); setProgresoLectura(existente ? "Abriendo el PDF adjunto…" : "Leyendo el plano…");
    try {
      const file = await obtener(controller.signal);
      if (controller.signal.aborted) return;
      const { readPdfFile } = await import("@/lib/captura/read-pdf-browser");
      const lectura = await readPdfFile(file, { signal: controller.signal, onProgress: (page, total) => setProgresoLectura(`Leyendo página ${page} de ${total}…`) });
      if (controller.signal.aborted) return;
      if (b.planos.some(p => p.extraction.sha256 === lectura.extraction.sha256 && p.page === lectura.extraction.pages[0].page)) { notify("Este plano ya está añadido. No se ha creado otra copia en Planos y fotos."); return; }
      setProgresoLectura(existente ? "Vinculando el plano…" : "Guardando el original en Planos y fotos…");
      const documento = existente ?? await upload(file, project.id, "plan");
      if (controller.signal.aborted) return;
      setB(prev => añadirPlano(prev, { nombre: file.name, extraction: lectura.extraction, documentId: documento.id, lectura: lectura.report }));
      if (lectura.report.partial) notify("El plano se ha leído parcialmente. Revisa los avisos antes de medir o presupuestar.");
    } catch (err) { if (!controller.signal.aborted) notify(err instanceof Error ? err.message : "No se ha podido leer el plano."); }
    finally { if (lecturaActual.current === controller) lecturaActual.current = null; if (!controller.signal.aborted) { setSubiendo(false); setProgresoLectura(""); } }
  }
  async function leerAdjunto(documento: Document) {
    await procesarPlano(async signal => {
      const url = await fileUrl(documento);
      try {
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error("No se ha podido abrir el PDF adjunto.");
        if (Number(response.headers.get("content-length")) > 50 * 1024 * 1024) throw new Error("El PDF supera los 50 MB de la lectura rápida.");
        return new File([await response.blob()], documento.name, { type: "application/pdf" });
      } finally { if (url.startsWith("blob:")) URL.revokeObjectURL(url); }
    }, documento);
  }
  async function cargarLecturas(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []); e.target.value = ""; if (!files.length) return;
    let b2 = b; let leidos = 0;
    for (const file of files) {
      try {
        if (file.size > 20 * 1024 * 1024) throw new Error("La lectura técnica supera los 20 MB.");
        const r = pdfExtractionSchema.safeParse(JSON.parse(await file.text()));
        if (!r.success) throw new Error(`«${file.name}» no es una lectura de plano de Plano.`);
        const nombre = file.name.replace(/\.json$/i, ".pdf").replace(/_/g, " ");
        const doc = planosAdjuntos.find(d => d.name.replace(/_/g, " ").toLowerCase() === nombre.toLowerCase());
        b2 = añadirPlano(b2, { nombre: doc?.name ?? nombre, extraction: r.data, documentId: doc?.id ?? null }); leidos++;
      } catch (err) { notify(err instanceof Error ? err.message : "No se ha podido leer un archivo."); }
    }
    if (leidos) { setB(b2); }
  }
  function usarEjemplo() {
    let b2 = añadirPlano(b, { nombre: "Ejemplo · Plano Demolición.pdf", extraction: { ...samplePlan, sha256: "a".repeat(64), pages: [{ ...samplePlan.pages[0], paths: samplePlan.pages[0].paths.filter(p => p.id !== "construir-b") }] } });
    b2 = añadirPlano(b2, { nombre: "Ejemplo · Plano Pladur.pdf", extraction: { ...samplePlan, sha256: "b".repeat(64), pages: [{ ...samplePlan.pages[0], paths: samplePlan.pages[0].paths.filter(p => !p.id.startsWith("demoler")) }] } });
    b2 = añadirPlano(b2, { nombre: "Ejemplo · Plano Cotas.pdf", extraction: samplePlan });
    setB(b2);
  }

  function marcar(p: [number, number]) {
    if (!planoMedida) return;
    const page = paginaDe(planoMedida);
    const q = puntoCercano(page, p, Math.max(page.width, page.height) / 60);
    const propia = base && base.id !== planoMedida.id;
    setB(prev => {
      if (propia) { const m = prev.planos.find(x => x.id === planoMedida.id)?.medida ?? { start: null, end: null, metros: prev.medida.metros }; const nueva = !m.start || (m.start && m.end) ? { ...m, start: q, end: null } : { ...m, end: q }; return { ...prev, planos: prev.planos.map(x => (x.id === planoMedida.id ? { ...x, medida: nueva, escalaConfirmada: undefined } : x)) }; }
      const m = prev.medida; const nueva = !m.start || (m.start && m.end) ? { ...m, start: q, end: null, planoId: planoMedida.id } : { ...m, end: q };
      return { ...prev, medida: nueva };
    });
  }
  const medidaEnPantalla = (() => { if (!planoMedida) return null; const propia = base && base.id !== planoMedida.id; return propia ? (planoMedida.medida ?? { start: null, end: null, metros: "" }) : b.medida; })();
  const metrosEnPantalla = (v: string) => { if (!planoMedida) return; const propia = base && base.id !== planoMedida.id; if (propia) actualizarPlano(planoMedida.id, { medida: { ...(planoMedida.medida ?? { start: null, end: null, metros: "" }), metros: v }, escalaConfirmada: undefined }); else set({ medida: { ...b.medida, metros: v } }); };
  function reiniciarMedida() {
    if (!planoMedida) return;
    const propia = base && base.id !== planoMedida.id;
    if (propia) actualizarPlano(planoMedida.id, { medida: { start: null, end: null, metros: planoMedida.medida?.metros ?? "" }, escalaConfirmada: undefined });
    else set({ medida: { ...b.medida, start: null, end: null } });
  }
  const alternarPared = (id: string) => setB(prev => ({ ...prev, noParedes: prev.noParedes.includes(id) ? prev.noParedes.filter(x => x !== id) : [...prev.noParedes, id] }));
  // Detalles secundarios de los trabajos (huecos) plegados por defecto.
  const alternarColor = (p: PlanoCargado, key: string) => actualizarPlano(p.id, { ignorados: p.ignorados.includes(key) ? p.ignorados.filter(k => k !== key) : [...p.ignorados, key] });

  const resultado = useMemo(() => (b.paso === 4 ? calcularPropuesta(b, ps, data.articles, data.organization_id) : null), [b, ps, data.articles, data.organization_id]);
  const nuevos = resultado && !("error" in resultado) ? resultado.items : [];
  const pares = useMemo(() => coincidencias(existentes, nuevos), [existentes, nuevos]);
  const finales = useMemo(() => fusionar(existentes, nuevos, decisiones, pares), [existentes, nuevos, decisiones, pares]);
  const sumaNuevos = nuevos.reduce((s, i) => s + lineTotal(i), 0);

  async function añadir() {
    if (!puede || busy || guardando || !nuevos.length || pares.some(p => !decisiones[p.nuevo.id]) || (resultado && !("error" in resultado) && resultado.pendientes > 0)) return;
    setGuardando(true);
    try {
      let ws = data; let objetivo = budget;
      if (!objetivo) { ws = await send({ type: "budget.create", project_id: project.id, title: "Presupuesto de reforma" }); objetivo = ws.budgets.filter(x => x.project_id === project.id).sort((x, y) => y.created_at.localeCompare(x.created_at))[0]; if (project.status === "lead") ws = await send({ type: "project.status", id: project.id, status: "estimating" }); }
      if (!objetivo) throw new Error("No se ha podido abrir el presupuesto.");
      const suyas = () => ws.versions.filter(v => v.budget_id === objetivo!.id).sort((x, y) => y.number - x.number);
      let borrador = suyas().find(v => v.status === "draft");
      if (!borrador) { const baseV = budgetHistory(objetivo, suyas()).current; if (!baseV) throw new Error("El presupuesto no tiene ninguna revisión."); ws = await send({ type: "budget.revise", version_id: baseV.id, reason: "Partidas añadidas desde los planos" }); borrador = suyas().find(v => v.status === "draft"); }
      if (!borrador) throw new Error("No se ha podido abrir un borrador.");
      const paresAhora = coincidencias(borrador.items, nuevos);
      if (paresAhora.some(p => !decisiones[p.nuevo.id] || !pares.some(visto => visto.nuevo.id === p.nuevo.id && visto.existente.id === p.existente.id)))
        throw new Error("El presupuesto ha cambiado. Revisa las coincidencias antes de añadir partidas.");
      await send({ type: "budget.save", version_id: borrador.id, expected_revision: borrador.draft_revision, items: fusionar(borrador.items, nuevos, decisiones, paresAhora), notes: borrador.notes });
      borrarBorrador(project.id);
      notify(`${nuevos.length} partida${nuevos.length === 1 ? "" : "s"} de los planos añadida${nuevos.length === 1 ? "" : "s"} a la V${borrador.number}.`);
      router.push(`/proyectos/${project.id}?s=budget&p=${objetivo.id}`);
    } catch (err) { notify(err instanceof Error ? err.message : "No se han podido añadir las partidas."); }
    finally { setGuardando(false); }
  }
  function salir() { router.push(salida); }
  function empezarDeNuevo() { borrarBorrador(project.id); setB(borradorNuevo(project.id, budgetId)); setDecisiones({}); }

  const cabeceraDestino = destino ? `Añadiendo al presupuesto · V${destino.number} · ${destino.status === "draft" ? "borrador" : destino.status === "issued" ? "enviada, se abrirá una versión nueva" : "aceptada, se abrirá una versión nueva"}` : "Se abrirá el presupuesto · V1";
  const indice = Math.max(0, pasos.findIndex(p => p.n === b.paso));
  const actual = pasos[indice];
  const vista: Vista = { medida: Boolean(b.medida.start && b.medida.end) };

  if (!puede) return <div className="empty"><strong>Tu perfil puede ver el presupuesto, pero no añadir partidas.</strong><Link prefetch={false} href={salida} className="btn btn-secondary">Volver a la ficha</Link></div>;

  return (
    <div className="flow">
      <header className="flow-head">
        <Link prefetch={false} href={salida} className="flow-back" title="Volver al proyecto"><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" /><span>{project.name}</span></Link>
        <div className="flow-head-text"><span className="eyebrow">{cabeceraDestino}</span><span className="muted text-xs flow-head-save">Se guarda solo en este navegador</span></div>
        <button type="button" className="btn btn-icon" aria-label="Salir y volver al proyecto" title="Salir · el borrador se guarda" onClick={salir}><X size={19} strokeWidth={1.6} aria-hidden="true" /></button>
      </header>
      <ol className="flow-steps" aria-label="Pasos">
        {pasos.map((p, i) => <li key={p.n} data-state={i < indice ? "done" : i === indice ? "current" : "todo"} aria-current={i === indice ? "step" : undefined}><button type="button" disabled={i > indice} onClick={() => ir(p.n)}><i>{i < indice ? <Check size={11} strokeWidth={2.6} aria-hidden="true" /> : i + 1}</i><span>{p.corto}</span></button></li>)}
      </ol>
      <div className="flow-title"><span className="eyebrow">Paso {indice + 1} de {pasos.length}</span><h1 className="h2">{actual.titulo}</h1></div>

      {b.paso === 1 && (
        <div className="flow-body">
          <p className="muted">Un expediente suele traer varios planos del mismo espacio: demolición, obra nueva, cotas, áreas, instalaciones. Añádelos todos y di para qué sirve cada uno. Se guardan en Planos y fotos del proyecto.</p>
          {b.planos.length > 0 && (
            <ul className="plan-list">{b.planos.map(p => { const page = paginaDe(p); const u = usos.find(x => x.id === p.uso)!; return (
              <li key={p.id} className="plan-card" data-uso={p.uso}>
                <div className="plan-stage plan-stage-xs"><PlanSvg page={page} label={`Vista previa de ${p.nombre}`} /></div>
                <div className="plan-card-body">
                  <strong title={p.nombre}>{p.nombre}</strong>
                  <small className="muted">{p.extraction.pages.length} página{p.extraction.pages.length === 1 ? "" : "s"} · {page.paths.length.toLocaleString("es-ES")} trazo{page.paths.length === 1 ? "" : "s"}{p.documentId ? " · en Planos y fotos" : ""}</small>
                  <Select label={`¿Qué muestra ${p.nombre}?`} size="sm" value={p.uso} onChange={v => actualizarPlano(p.id, { uso: v })} options={usos.map(x => ({ value: x.id, label: x.label }))} />
                  <small className="muted">{u.hint}</small>
                  {p.lectura?.warnings.length ? <details><summary>{p.lectura.partial ? "Lectura parcial · revisar" : "Avisos de lectura"}</summary><ul>{p.lectura.warnings.map(w => <li key={w} className="muted text-sm">{w}</li>)}</ul></details> : null}
                  {p.extraction.pages.length > 1 && <Select label="Página" size="sm" value={String(p.page)} onChange={v => actualizarPlano(p.id, { page: Number(v) })} options={p.extraction.pages.map(x => ({ value: String(x.page), label: `Página ${x.page} · ${x.paths.length} trazos` }))} />}
                </div>
                <button type="button" className="btn btn-icon" disabled={subiendo || busy} aria-label={`Quitar ${p.nombre}`} onClick={() => setB(prev => quitarPlano(prev, p.id))}><X size={16} strokeWidth={1.7} aria-hidden="true" /></button>
              </li>
            ); })}</ul>
          )}
          <div className="plan-add">
            <button type="button" className="dropzone dropzone-sm" disabled={subiendo || busy} onClick={() => pdfInput.current?.click()}>
              {subiendo ? <Loader2 size={24} strokeWidth={1.6} aria-hidden="true" className="spin" /> : <Upload size={24} strokeWidth={1.5} aria-hidden="true" />}
              <strong>{subiendo ? progresoLectura : "Añadir y leer un plano (PDF)"}</strong><span className="muted text-xs">hasta 50 MB y 20 páginas · lectura local · original en Planos y fotos</span>
            </button>
            <div className="plan-add-alt">
              <details><summary>Opciones de soporte</summary><Button variant="ghost" disabled={subiendo || busy} onClick={() => jsonInput.current?.click()}><Plus size={15} strokeWidth={1.8} aria-hidden="true" />Importar lectura técnica (.json)</Button></details>
              {(mode === "demo" || b.planos.length === 0) && <Button variant="ghost" disabled={subiendo || busy} onClick={usarEjemplo}>Probar con planos de ejemplo</Button>}
              {planosAdjuntos.length > 0 && <details><summary>Leer un plano de Planos y fotos ({planosAdjuntos.length})</summary><ul className="info-list">{planosAdjuntos.map(doc => <li key={doc.id} className="info-row"><span>{doc.name}</span><Button variant="secondary" disabled={subiendo || busy} onClick={() => leerAdjunto(doc)}><FileText size={15} aria-hidden="true" />Leer este plano</Button></li>)}</ul></details>}
            </div>
          </div>
          <input ref={pdfInput} type="file" accept="application/pdf" onChange={subir} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
          <input ref={jsonInput} type="file" accept=".json,application/json" multiple onChange={cargarLecturas} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
          {b.planos.length > 0 && conParedes.length === 0 && <p className="muted text-sm">Ningún plano está marcado como demolición u obra nueva: sin ellos no saldrán paredes. Áreas e instalaciones se aprovecharán cuando el motor las lea.</p>}
          <footer className="flow-foot">
            <Button variant="ghost" onClick={salir}>Salir</Button>
            <Button variant="primary" disabled={!b.planos.length || subiendo || busy} onClick={() => { setPlanoActivoId(planoParaMedir(b)?.id ?? null); ir(2); }}>Siguiente: mide y confirma las paredes<ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" /></Button>
          </footer>
        </div>
      )}

      {b.paso === 2 && planoMedida && (
        <div className="flow-body flow-split">
          <div>
            {b.planos.length > 1 && <div className="plan-tabs" role="tablist" aria-label="Plano">{b.planos.map(p => <button key={p.id} type="button" role="tab" className="chip" aria-selected={planoActivo?.id === p.id} onClick={() => setPlanoActivoId(p.id)}>{nombreUso(p.uso)} · {p.nombre}</button>)}</div>}
            <div className="plan-stage"><PlanSvg page={paginaDe(planoMedida)} paredes={ps.filter(w => w.planoId === planoMedida.id)} seleccionada={seleccionada} medida={medidaEnPantalla ?? undefined} onPick={marcar} onPared={id => setSeleccionada(id)} label={`${planoMedida.nombre}: toca dos puntos para marcar una medida conocida; las paredes encontradas se marcan encima`} /></div>
            <p className="muted text-sm" style={{ marginTop: 8 }}>Toca los dos extremos de una cota que conozcas y escribe cuánto mide. En cuanto haya medida, las paredes del plano se dibujan con sus metros.</p>
          </div>
          <div className="flow-side">
            <div className="panel"><div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="eyebrow">{!medidaEnPantalla?.start ? "1. Toca el primer extremo" : !medidaEnPantalla.end ? "2. Toca el segundo extremo" : "Esa distancia mide"}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <label className="field-inline"><input className="input pl-mono" inputMode="decimal" value={medidaEnPantalla?.metros ?? ""} onChange={e => metrosEnPantalla(e.target.value)} placeholder="4,20" aria-label="Metros" style={{ fontSize: 24, maxWidth: 140 }} /><span className="muted">metros</span></label>
                <button type="button" className="link-button text-sm" onClick={reiniciarMedida}><RotateCcw size={13} strokeWidth={1.8} aria-hidden="true" /> Marcar otra</button>
              </div>
              {escalaDe(b, planoMedida) && <span className="muted text-sm"><Ruler size={13} strokeWidth={1.8} aria-hidden="true" /> Escala lista: 1 m son {cantidad(1 / escalaDe(b, planoMedida)!)} unidades del dibujo.</span>}
              {b.planos.length > 1 && vista.medida && (
                <ul className="info-list" style={{ marginTop: 4 }}>{b.planos.filter(p => p.id !== b.medida.planoId).map(p => { const k = escalaDe(b, p); const comparte = comparteEscala(b, p); return (
                  <li key={p.id} className="info-row plan-scale-row"><span><strong>{p.nombre}</strong><small className="muted">{comparte ? "Misma escala confirmada" : k ? "Con su propia medida" : "Escala pendiente"}</small>
                    <label className="legend-row"><input type="checkbox" aria-label={`Confirmo la misma escala para ${p.nombre} que ${base?.nombre}`} checked={comparte} onChange={e => setB(prev => confirmarEscalaCompartida(prev, p.id, e.target.checked))} />Misma escala que {base?.nombre}</label>
                    {!k && <small className="muted">{base && mismaHoja(base, p) ? "Mismo papel; comprueba la escala escrita o una medida conocida." : "Comprueba la escala o toma una medida propia."}</small>}
                  </span><Button variant="secondary" onClick={() => setPlanoActivoId(p.id)}>Medir este</Button>{k ? <Check size={16} strokeWidth={2} aria-hidden="true" style={{ color: "var(--pl-success)" }} /> : null}</li>
                ); })}</ul>
              )}
            </div></div>
            {planoParedes && colores(paginaDe(planoParedes)).length > 0 && (
              <details className="panel" open={false}><summary className="panel-body" style={{ cursor: "pointer" }}><span className="eyebrow">{nombreUso(planoParedes.uso)} · lo coloreado {planoParedes.uso === "demolicion" ? "se tira" : "es nuevo"}</span><br /><small className="muted">Colores que cuentan como pared · toca para ajustar</small></summary>
                <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 0 }}>
                  {colores(paginaDe(planoParedes)).map(c => <label key={c.key} className="legend-row" style={{ cursor: "pointer" }}><input type="checkbox" checked={cuentaComoPared(planoParedes, c)} onChange={() => alternarColor(planoParedes, c.key)} /><span className="legend-swatch" style={{ background: colorCss(c.color) }} aria-hidden="true" /><span style={{ flex: 1 }}><strong style={{ textTransform: "capitalize" }}>{c.nombre}</strong><small className="muted"> · {c.paths} trazos</small></span></label>)}
                </div>
              </details>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="pill" data-tone="danger">Se tira · {resumen.tira.n} · {cantidad(resumen.tira.metros)} m</span>
              <span className="pill" data-tone="success">Nueva · {resumen.nueva.n} · {cantidad(resumen.nueva.metros)} m</span>
              {resumen.descartadas > 0 && <span className="pill">No son paredes · {resumen.descartadas}</span>}
            </div>
            {ps.length > 0 ? (
              <ul className="wall-list">{ps.map(w => (
                <li key={w.id} className="wall-row" data-estado={w.estado} data-descartada={w.descartada || undefined} data-seleccionada={w.id === seleccionada || undefined}>
                  <button type="button" className="wall-main" onClick={() => { setSeleccionada(w.id); setPlanoActivoId(w.planoId); }}><strong>{w.nombre}</strong><small className="muted">{w.estado === "tira" ? "Se tira" : "Nueva"} · {cantidad(w.longitud)} m{b.planos.length > 1 ? ` · ${w.plano}` : ""}</small></button>
                  <button type="button" className="btn btn-ghost" style={{ height: 32, fontSize: 13 }} onClick={() => alternarPared(w.id)}>{w.descartada ? "Sí es pared" : "No es pared"}</button>
                </li>
              ))}</ul>
            ) : conParedes.length === 0 ? <p className="muted text-sm">Ningún plano está marcado como demolición u obra nueva: vuelve a «Tus planos» y di cuál es cuál.</p> : <p className="muted text-sm">Las paredes aparecerán aquí cuando haya medida.</p>}
            <footer className="flow-foot">
              <Button variant="ghost" onClick={() => ir(1)}><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />Tus planos</Button>
              <Button variant="primary" disabled={!escala(b) || sinEscala.length > 0 || resumen.tira.n + resumen.nueva.n === 0} onClick={() => ir(4)}>{sinEscala.length ? `Faltan medidas: ${sinEscala.length}` : <>Siguiente: qué se hace<ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" /></>}</Button>
            </footer>
          </div>
        </div>
      )}

      {b.paso === 4 && (
        <div className="flow-body">
          <p className="muted">Marca los trabajos. Las cantidades salen de los planos; el precio, de tu catálogo. Todo se puede cambiar después en el presupuesto.</p>
          <div className="facts-2">
            <label className="field"><span className="field-label">Altura de las paredes</span><span className="field-inline"><input className="input pl-mono" inputMode="decimal" value={b.altura} onChange={e => set({ altura: e.target.value })} aria-label="Altura en metros" /><span className="muted">m</span></span><small className="muted">Confirma la altura medida; el valor inicial es solo una referencia.</small></label>
            <details className="field" open={numero(b.huecos) > 0 || numero(b.huecosDemolicion ?? "0") > 0}>
              <summary className="field-label" style={{ cursor: "pointer" }}>Huecos que no cuentan <small className="muted">· opcional, puertas y ventanas</small></summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                <label className="field"><span className="field-label">Huecos en paredes nuevas</span><span className="field-inline"><input className="input pl-mono" inputMode="decimal" value={b.huecos} onChange={e => set({ huecos: e.target.value })} aria-label="Huecos en paredes nuevas en metros cuadrados" /><span className="muted">m²</span></span><small className="muted">Superficie de puertas y ventanas de una cara. Se descuenta también al pintar las dos caras.</small></label>
                <label className="field"><span className="field-label">Huecos en paredes de demolición</span><span className="field-inline"><input className="input pl-mono" inputMode="decimal" value={b.huecosDemolicion ?? b.huecos} onChange={e => set({ huecosDemolicion: e.target.value })} aria-label="Huecos en paredes de demolición en metros cuadrados" /><span className="muted">m²</span></span><small className="muted">Solo se descuentan de las paredes que se tiran.</small></label>
              </div>
            </details>
          </div>
          {trabajos.map(t => {
            const cfg = b.trabajos[t.id]; const hay = ps.some(p => !p.descartada && p.estado === t.aplicaA);
            const article = data.articles.find(a => a.id === cfg.articleId) ?? null;
            const q = hay ? cantidadTrabajo(t, ps, numero(b.altura), huecosTrabajo(b, t), article?.unit ?? "m²") : 0;
            const origen = [...new Set(ps.filter(p => !p.descartada && p.estado === t.aplicaA).map(p => p.plano))];
            return (
              <div key={t.id} className="work-card" data-activo={cfg.activo && hay} data-disabled={!hay || undefined}>
                <label className="work-head"><input type="checkbox" checked={cfg.activo && hay} disabled={!hay} onChange={e => set({ trabajos: { ...b.trabajos, [t.id]: { ...cfg, activo: e.target.checked } } })} /><span style={{ flex: 1 }}><strong>{t.titulo}</strong><small className="muted">{hay ? `${t.detalle} Sale de: ${origen.join(", ")}.` : `No hay paredes de «${t.aplicaA === "tira" ? "demolición" : "obra nueva"}».`}</small></span>{hay && <span className="pl-mono">{cantidad(q)} {article?.unit ?? "m²"}</span>}</label>
                {hay && cfg.activo && <div className="work-body"><Select label="Artículo del catálogo" value={cfg.articleId ?? ""} onChange={v => set({ trabajos: { ...b.trabajos, [t.id]: { ...cfg, articleId: v } } })} options={medibles.map(a => ({ value: a.id, label: `${a.name} · ${money(a.unit_price)}/${a.unit}` }))} placeholder="Elegir artículo…" />{!article && <small className="muted">Selecciona un artículo para calcular y añadir este trabajo, o desmárcalo si queda fuera del encargo.</small>}</div>}
              </div>
            );
          })}
          {b.planos.some(p => p.uso === "areas" || p.uso === "instalaciones") && <p className="muted text-sm">Los planos de áreas e instalaciones ya están guardados. Suelos, techos, pintura de lo existente y puntos de luz o clima saldrán de ellos en cuanto el motor los lea; de momento, añádelos a mano.</p>}
          <div className="section-label"><span>Lo que entra en el presupuesto</span><span className="muted text-xs">se recalcula al cambiar lo de arriba</span></div>
          {resultado && "error" in resultado && <div className="empty"><strong>Todavía no hay partidas</strong><span className="muted text-sm">{resultado.error}</span></div>}
          {resultado && !("error" in resultado) && (
            <>
              {b.planos.some(p => p.lectura?.partial) && <div className="panel notice-panel"><div className="panel-body"><strong>Hay planos con lectura parcial</strong><p className="muted text-sm">Las partidas solo incluyen las paredes detectadas y revisadas. Comprueba las zonas no interpretadas y añade sus trabajos antes de emitir el presupuesto.</p></div></div>}
              <p className="muted">{nuevos.length} partida{nuevos.length === 1 ? "" : "s"} nueva{nuevos.length === 1 ? "" : "s"} para {destino ? `la V${destino.number}` : "el presupuesto"}. {existentes.length > 0 ? `Las ${existentes.length} que ya tenías se quedan como están.` : ""}</p>
              <div className="panel">
                {resultado.lineas.map(l => (
                  <div key={l.trabajo.id} className="proposal-row" data-pendiente={!l.item || undefined}>
                    <span style={{ minWidth: 0, flex: 1 }}><span className="eyebrow">{l.article?.chapter ?? l.trabajo.titulo}</span><strong style={{ display: "block" }}>{l.article?.name ?? l.trabajo.titulo}</strong><small className="muted">{l.paredes} pared{l.paredes === 1 ? "" : "es"} de {l.planos.join(" y ")} · {cantidad(l.cantidad)} {l.article?.unit ?? ""}{l.article ? ` × ${money(l.article.unit_price)}` : ""}</small>{l.pendientes.map(p => <small key={p} className="pendiente">{p}</small>)}</span>
                    <span className="pl-mono">{l.item ? money(lineTotal(l.item)) : <span className="pill" data-tone="warning">Pendiente</span>}</span>
                  </div>
                ))}
              </div>
              {pares.map(par => (
                <div key={par.nuevo.id} className="panel notice-panel"><div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <strong>Ya tenías «{par.existente.description}» ({cantidad(par.existente.quantity)} {par.existente.unit})</strong>
                  <span className="muted text-sm">¿La sustituimos por la de los planos ({cantidad(par.nuevo.quantity)} {par.nuevo.unit}) o la dejamos y añadimos esta aparte?</span>
                  <span className="seg" role="radiogroup" aria-label="Qué hacer con la partida repetida">{(["sustituir", "añadir"] as const).map(d => <button key={d} type="button" role="radio" aria-checked={decisiones[par.nuevo.id] === d} onClick={() => setDecisiones(prev => ({ ...prev, [par.nuevo.id]: d }))}>{d === "sustituir" ? "Sustituir" : "Añadir aparte"}</button>)}</span>
                </div></div>
              ))}
              <div className="proposal-total"><span className="muted">Partidas calculadas · sin IVA</span><span className="pl-mono">{money(sumaNuevos)}</span></div>
              {pares.some(p => !decisiones[p.nuevo.id]) ? <p className="muted text-sm">Elige qué hacer con cada coincidencia antes de añadir las partidas.</p> : <p className="muted text-sm">Cambio en la base del presupuesto: {money(finales.reduce((s, i) => s + lineTotal(i), 0) - existentes.reduce((s, i) => s + lineTotal(i), 0))}. Incluye las sustituciones elegidas.</p>}
              {resultado.lineas.some(l => l.avisos.length) && <p className="muted text-sm"><Sparkles size={13} strokeWidth={1.8} aria-hidden="true" /> {resultado.lineas.flatMap(l => l.avisos)[0]}</p>}
              {resultado.pendientes > 0 && <p role="alert" className="muted text-sm">Completa las partidas pendientes o vuelve a los trabajos y desmarca los que queden fuera del encargo.</p>}
              <p className="muted text-sm">Después se editan como cualquier partida. El presupuesto quedará con {finales.length} partida{finales.length === 1 ? "" : "s"}.</p>
            </>
          )}
          <footer className="flow-foot">
            <Button variant="ghost" onClick={() => ir(2)}><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />Volver a medir</Button>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={salir}>Guardar y seguir luego</Button>
              <Button variant="primary" disabled={!nuevos.length || guardando || busy || pares.some(p => !decisiones[p.nuevo.id]) || Boolean(resultado && !("error" in resultado) && resultado.pendientes > 0)} onClick={añadir}>{guardando ? "Añadiendo…" : `Añadir ${nuevos.length} partida${nuevos.length === 1 ? "" : "s"} ${destino ? `a la V${destino.number}` : "al presupuesto"}`}</Button>
            </div>
          </footer>
        </div>
      )}

      {b.paso > 1 && <p className="muted text-xs" style={{ textAlign: "center" }}><button type="button" className="link-button" onClick={empezarDeNuevo}>Empezar de nuevo con otros planos</button></p>}
    </div>
  );
}
