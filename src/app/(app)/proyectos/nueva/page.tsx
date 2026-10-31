"use client";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Camera, Mic, MicOff, Plus, Trash2, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { can, money, kindNames, dateLabel, type Project, type BudgetVersion } from "@/lib/domain";
import { trabajosRapidos, articulosPorCapitulo, articuloPara, partidasDesdeLineas, rangoEstimacion, importeLinea, notasDeVisita, comprobaciones, type Linea } from "@/lib/estimacion";

type Step = 1 | 2 | 3 | 4 | 5;
/** Sobre un proyecto: fotos y notas, y guardar. Proyecto nuevo desde la visita: además los datos. Los números internos se conservan. */
const pantallasExistente: { id: Step; label: string }[] = [{ id: 2, label: "Fotos y notas" }, { id: 5, label: "Guardar" }];
const pantallasNuevo: { id: Step; label: string }[] = [{ id: 1, label: "Datos" }, { id: 2, label: "Fotos y notas" }, { id: 5, label: "Resumen" }];

/** Dictado del navegador (Web Speech API). Transcribe lo que se dice; no interpreta ni calcula nada. */
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null; start(): void; stop(): void };
function recognitionFactory(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function NuevaVisitaPage() {
  const router = useRouter();
  const params = useSearchParams();
  const proyectoId = params.get("proyecto");
  const { data, actor, busy, loading, send, upload, notify } = useWorkspace();
  // Con «?proyecto=» la visita estima sobre un proyecto ya dado de alta en oficina: no crea otro.
  const existente = useMemo(() => (proyectoId ? data.projects.find(p => p.id === proyectoId) ?? null : null), [data.projects, proyectoId]);
  const allowed = (existente ? true : can(actor.role, "project.create")) && can(actor.role, "budget.create");
  const [step, setStep] = useState<Step>(1);
  const pantallas = existente ? pantallasExistente : pantallasNuevo;
  // Sobre un proyecto ya dado de alta no hay datos que repetir: se empieza por las fotos.
  useEffect(() => { if (existente && step === 1) setStep(2); }, [existente, step]);
  // En móvil la fila de pasos se desplaza: el paso actual siempre queda a la vista.
  useEffect(() => { document.querySelector('.step[aria-current="step"]')?.scrollIntoView({ inline: "center", block: "nearest" }); }, [step]);
  const [datos, setDatos] = useState({ name: "", client_name: "", location: "", kind: "integral" as Project["kind"] });
  const [fotos, setFotos] = useState<{ file: File; url: string }[]>([]);
  const [alcance, setAlcance] = useState("");
  const [comprobado, setComprobado] = useState<string[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [margen, setMargen] = useState(0.15);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const destinoSalida = existente ? `/proyectos/${existente.id}` : "/proyectos";
  const hayCambios = fotos.length > 0 || lineas.length > 0 || alcance.trim().length > 0 || (!existente && (datos.name.trim().length > 0 || datos.client_name.trim().length > 0));
  function salir() { if (hayCambios) setConfirmarSalida(true); else router.push(destinoSalida); }
  const [dictando, setDictando] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const Factory = useMemo(recognitionFactory, []);

  useEffect(() => () => { fotos.forEach(f => URL.revokeObjectURL(f.url)); }, [fotos]);
  useEffect(() => () => recognition.current?.stop(), []);

  const porCapitulo = useMemo(() => articulosPorCapitulo(data.articles), [data.articles]);
  const items = useMemo(() => partidasDesdeLineas(lineas, data.articles), [lineas, data.articles]);
  const rango = useMemo(() => rangoEstimacion(items, margen), [items, margen]);
  const pendientes = comprobaciones.filter(c => !comprobado.includes(c));
  const datosOk = existente ? true : Boolean(datos.name.trim() && datos.client_name.trim());

  function addFotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter(f => f.type.startsWith("image/"));
    setFotos(prev => [...prev, ...files.map(file => ({ file, url: URL.createObjectURL(file) }))]);
    event.target.value = "";
  }

  function toggleDictado() {
    if (!Factory) return;
    if (dictando) { recognition.current?.stop(); return; }
    const rec = new Factory();
    rec.lang = "es-ES"; rec.continuous = true; rec.interimResults = false;
    rec.onresult = e => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      if (text) setAlcance(prev => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${text.trim()}`);
    };
    rec.onerror = e => { setDictando(false); notify(e.error === "not-allowed" ? "El navegador no tiene permiso para usar el micrófono." : "El dictado se ha interrumpido."); };
    rec.onend = () => setDictando(false);
    recognition.current = rec; rec.start(); setDictando(true);
  }

  function addLinea(articleId: string) {
    setLineas(prev => [...prev, { id: crypto.randomUUID(), article_id: articleId, quantity: 0, adjustment_percent: 0, motivo: "" }]);
  }
  const updateLinea = (id: string, patch: Partial<Linea>) => setLineas(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));

  const soloFotos = Boolean(existente) && items.length === 0;
  const puedeGuardar = datosOk && (items.length > 0 || (soloFotos && (fotos.length > 0 || alcance.trim().length > 0)));
  async function guardar() {
    if (saving || busy || !puedeGuardar) return;
    setSaving(true); setError("");
    let projectId: string | null = null;
    try {
      let ws = data;
      let project: Project | undefined = existente ?? undefined;
      if (!project) {
        ws = await send({ type: "project.create", name: datos.name.trim(), client_name: datos.client_name.trim(), location: datos.location.trim(), kind: datos.kind });
        project = ws.projects.filter(p => p.name === datos.name.trim() && p.client_name === datos.client_name.trim()).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        if (!project) throw new Error("El proyecto se ha creado pero no se ha podido localizar. Recarga y busca por el cliente.");
      }
      const pid = project.id;
      projectId = pid;
      for (const foto of fotos) await upload(foto.file, pid, "before");
      if (soloFotos) {
        // Solo fotos y notas: quedan en Planos y fotos y, si hay notas, en el chat del proyecto. El presupuesto no se toca.
        if (alcance.trim() && can(actor.role, "message.send")) await send({ type: "message.send", project_id: pid, body: `Notas de la visita: ${alcance.trim()}` });
        notify(`${fotos.length ? `${fotos.length} foto${fotos.length === 1 ? "" : "s"} guardada${fotos.length === 1 ? "" : "s"}` : "Notas guardadas"} · ${project.name}`);
        router.push(`/proyectos/${pid}`);
        return;
      }
      // Si el proyecto ya tiene un borrador abierto, las partidas se añaden a él en vez de abrir otro presupuesto.
      const borradores = ws.versions.filter(v => v.status === "draft" && ws.budgets.some(b => b.id === v.budget_id && b.project_id === pid));
      let version: BudgetVersion | undefined = borradores.find(v => v.items.length === 0) ?? borradores[0];
      if (!version) {
        ws = await send({ type: "budget.create", project_id: pid, title: "Estimación de visita" });
        const budget = ws.budgets.filter(b => b.project_id === pid).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        version = budget ? ws.versions.find(v => v.budget_id === budget.id && v.status === "draft") : undefined;
      }
      if (!version) throw new Error("No se ha podido abrir el borrador del presupuesto.");
      const notasNuevas = notasDeVisita(alcance, pendientes, dateLabel(new Date().toISOString()), margen);
      const notes = version.items.length ? [version.notes, notasNuevas].filter(Boolean).join("\n\n") : notasNuevas;
      await send({ type: "budget.save", version_id: version.id, expected_revision: version.draft_revision, items: [...version.items, ...items], notes });
      if (project.status === "lead") await send({ type: "project.status", id: pid, status: "estimating" });
      notify(`Estimación guardada · ${project.name}`);
      router.push(`/proyectos/${pid}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se ha podido guardar la estimación.";
      setError(projectId ? `${message} La obra ya existe; puedes completar el presupuesto desde su ficha.` : message);
      if (projectId) notify("Obra creada; la estimación quedó incompleta.");
    } finally {
      setSaving(false);
    }
  }

  if (proyectoId && loading) return <p className="muted">Cargando el proyecto…</p>;
  if (proyectoId && !loading && !existente) {
    return <div className="empty"><strong>Ese proyecto ya no existe</strong><span className="muted text-sm">Puedes empezar la visita como proyecto nuevo o volver a la lista.</span><div style={{ display: "flex", gap: 8 }}><Link href="/proyectos/nueva" className="btn btn-primary">Visita nueva</Link><Link href="/proyectos" className="btn btn-secondary">Proyectos</Link></div></div>;
  }

  const modalSalida = (
    <Modal open={confirmarSalida} onClose={() => setConfirmarSalida(false)} title="Salir sin guardar" footer={<><Button variant="secondary" onClick={() => setConfirmarSalida(false)}>Seguir en la visita</Button><Button variant="primary" onClick={() => router.push(destinoSalida)}>Salir</Button></>}>
      <p className="text-sm">Las fotos, el alcance y las partidas de esta visita no se han guardado todavía. Si sales, se pierden{existente ? "; el proyecto se queda como estaba" : ""}.</p>
    </Modal>
  );

  if (!allowed) {
    return <div className="empty"><strong>Tu perfil no puede crear proyectos ni presupuestos</strong><span className="muted text-sm">Pide a oficina o administración que registren la visita.</span><Link href="/proyectos" className="btn btn-secondary">Volver a proyectos</Link></div>;
  }

  return (
    <div className="page">
      <div>
        <div className="visit-back"><Link href={existente ? `/proyectos/${existente.id}` : "/proyectos"} className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}><ArrowLeft size={13} strokeWidth={1.8} aria-hidden="true" />{existente ? existente.name : "Proyectos"}</Link></div>
        <div className="page-head">
          <h1 className="pl-title">{existente ? "Fotos y notas de la obra" : "Empezar una visita"}</h1>
          <button type="button" className="btn btn-icon" aria-label={existente ? "Salir y volver al proyecto" : "Salir de la visita"} title={existente ? "Volver al proyecto" : "Salir"} onClick={salir}><X size={19} strokeWidth={1.6} aria-hidden="true" /></button>
        </div>
        <p className="subtitle">{existente ? "Hazlas ahora con la cámara o elígelas de la galería, apunta lo que se quiere hacer y, si quieres, deja una cifra orientativa con los precios del catálogo. Puedes volver y añadir más fotos cuando haga falta." : "Sal de la visita con una cifra orientativa, calculada con los precios del catálogo. Lo que no se mide queda marcado como pendiente."}</p>
      </div>

      <ol className="steps" aria-label="Pasos">
        {pantallas.map((s, i) => <li key={s.id}><button type="button" className="step" aria-current={s.id === step ? "step" : undefined} data-done={s.id < step} onClick={() => s.id < step && setStep(s.id)} disabled={s.id > step}><span className="pl-mono">{i + 1}</span>{s.label}</button></li>)}
      </ol>

      {step === 1 && existente && (
        <section className="form">
          <div className="panel"><div className="panel-body">
            <small className="muted text-xs">Proyecto dado de alta en oficina</small>
            <strong style={{ display: "block", marginTop: 4, fontSize: "var(--pl-text-h3)", fontWeight: "var(--pl-weight-medium)" }}>{existente.name}</strong>
            <span className="muted text-sm">{[existente.client_name, existente.location, kindNames[existente.kind], existente.code].filter(Boolean).join(" · ")}</span>
          </div></div>
          <p className="muted text-xs">La estimación se guardará en este proyecto. Si no es el que estás visitando, vuelve a <Link href="/proyectos" className="link-inline">Proyectos</Link> y elige el correcto.</p>
          <div className="form-actions"><Button variant="primary" onClick={() => setStep(2)}>Seguir con las fotos</Button></div>
        </section>
      )}

      {step === 1 && !existente && (
        <section className="form">
          <label className="field"><span>Proyecto</span><input type="text" value={datos.name} onChange={e => setDatos({ ...datos, name: e.target.value })} placeholder="Reforma de baño · C/ Mayor 12" autoFocus /></label>
          <label className="field"><span>Cliente</span><input type="text" value={datos.client_name} onChange={e => setDatos({ ...datos, client_name: e.target.value })} autoComplete="name" /></label>
          <label className="field"><span>Dirección de la obra</span><input type="text" value={datos.location} onChange={e => setDatos({ ...datos, location: e.target.value })} autoComplete="street-address" placeholder="Calle, número, piso · municipio" /></label>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ padding: 0, marginBottom: 6 }}>Tipo</legend>
            <div className="segments">{(Object.keys(kindNames) as Project["kind"][]).map(kind => <button key={kind} type="button" className="segment" aria-pressed={datos.kind === kind} aria-selected={datos.kind === kind} onClick={() => setDatos({ ...datos, kind })}><span>{kindNames[kind]}</span></button>)}</div>
          </fieldset>
          <div className="form-actions"><Button variant="primary" disabled={!datosOk} onClick={() => setStep(2)}>Seguir con las fotos</Button></div>
        </section>
      )}

      {step === 2 && (
        <section className="form">
          <label className="btn btn-secondary" style={{ alignSelf: "flex-start", cursor: "pointer" }}>
            <Camera size={19} strokeWidth={1.55} aria-hidden="true" />Hacer o elegir fotos
            <input type="file" accept="image/*" multiple onChange={addFotos} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
          </label>
          {fotos.length > 0 && (
            <ul className="thumbs" aria-label="Fotos de la visita">
              {fotos.map((foto, i) => (
                <li key={foto.url}><img src={foto.url} alt={`Foto ${i + 1} de la visita`} /><button type="button" className="thumb-remove" aria-label={`Quitar foto ${i + 1}`} onClick={() => setFotos(prev => prev.filter(f => f.url !== foto.url))}><X size={13} strokeWidth={2} aria-hidden="true" /></button></li>
              ))}
            </ul>
          )}
          <p className="muted text-xs">Se guardan en la obra como fotos de «antes». No se miden ni se interpretan automáticamente.</p>
        </section>
      )}

      {step === 2 && (
        <section className="form">
          <label className="field">
            <span>Qué quiere reformar el cliente</span>
            <textarea rows={6} value={alcance} onChange={e => setAlcance(e.target.value)} placeholder="Cambiar el suelo de todo el piso, pintar, renovar el baño completo y mantener la distribución…" />
          </label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {Factory ? (
              <Button variant={dictando ? "primary" : "secondary"} onClick={toggleDictado} aria-pressed={dictando}>{dictando ? <MicOff size={19} strokeWidth={1.55} aria-hidden="true" /> : <Mic size={19} strokeWidth={1.55} aria-hidden="true" />}{dictando ? "Parar dictado" : "Dictar"}</Button>
            ) : <span className="muted text-xs">Este navegador no permite dictar; escribe el alcance.</span>}
            {dictando && <span className="status" data-tone="warning">Escuchando… habla con normalidad</span>}
          </div>
          <div className="field" style={{ gap: 4 }}>
            <span>Comprobado en la visita</span>
            {comprobaciones.map(c => (
              <label key={c} className="task-row" style={{ minHeight: 44, padding: "4px 0" }}>
                <input type="checkbox" checked={comprobado.includes(c)} onChange={e => setComprobado(prev => (e.target.checked ? [...prev, c] : prev.filter(x => x !== c)))} />
                <span className="task-title" style={{ fontWeight: 400 }}>{c}</span>
                <span className="text-xs muted">{comprobado.includes(c) ? "visto" : "pendiente"}</span>
              </label>
            ))}
            <span className="muted text-xs">Lo que no marques queda anotado como pendiente en el presupuesto.</span>
          </div>
        </section>
      )}

      {step === 2 && (
        <details className="form-optional" open={lineas.length > 0}>
        <summary><strong>¿Quieres dejar una cifra orientativa?</strong> <span className="muted text-sm">Opcional · partidas del catálogo con cantidades a ojo</span></summary>
        <section className="form" style={{ marginTop: 12 }}>
          <div className="field" style={{ gap: 8 }}>
            <span>Trabajos habituales</span>
            <div className="chips">
              {trabajosRapidos.map(t => { const a = articuloPara(t, data.articles); return <button key={t.id} type="button" className="chip" disabled={!a} title={a ? t.hint : "Sin artículo en el catálogo"} onClick={() => a && addLinea(a.id)}><Plus size={13} strokeWidth={2} aria-hidden="true" />{t.label}</button>; })}
            </div>
            <div className="field" style={{ marginTop: 4 }}>
              <span>Otra partida del catálogo</span>
              <Select label="Añadir artículo del catálogo" value="" placeholder="Elegir artículo…" onChange={id => addLinea(id)} options={[...porCapitulo.entries()].flatMap(([chapter, list]) => list.map(a => ({ value: a.id, label: a.name, hint: `${chapter} · ${money(a.unit_price)}/${a.unit}` })))} />
            </div>
          </div>

          {lineas.length === 0 && <div className="empty"><strong>Aún no hay partidas</strong><span className="muted text-sm">Toca un trabajo habitual o elige un artículo del catálogo y estima la cantidad.</span></div>}

          {lineas.map(linea => {
            const article = data.articles.find(a => a.id === linea.article_id);
            if (!article) return null;
            return (
              <article key={linea.id} className="line">
                <div className="line-head">
                  <span style={{ minWidth: 0 }}><strong>{article.name}</strong><small className="muted text-xs" style={{ display: "block" }}>{article.chapter} · {money(article.unit_price)}/{article.unit}</small></span>
                  <button type="button" className="search-clear" aria-label={`Quitar ${article.name}`} onClick={() => setLineas(prev => prev.filter(l => l.id !== linea.id))}><Trash2 size={14} strokeWidth={1.8} aria-hidden="true" /></button>
                </div>
                <div className="line-grid">
                  <label className="field"><span>Cantidad estimada</span><span className="unit-input"><input type="number" inputMode="decimal" min={0} step={article.unit === "ud" ? 1 : 0.5} value={linea.quantity || ""} onChange={e => updateLinea(linea.id, { quantity: Number(e.target.value) || 0 })} aria-label={`Cantidad de ${article.name}`} /><span>{article.unit}</span></span></label>
                  <label className="field"><span>Motivo del ajuste</span><input type="text" value={linea.motivo} onChange={e => updateLinea(linea.id, { motivo: e.target.value })} placeholder="Sin ascensor, acceso difícil…" /></label>
                </div>
                <div className="adjust">
                  <button type="button" aria-label="Bajar 5 %" onClick={() => updateLinea(linea.id, { adjustment_percent: Math.max(-50, linea.adjustment_percent - 5) })}>−</button>
                  <input type="range" min={-50} max={100} step={1} value={linea.adjustment_percent} onChange={e => updateLinea(linea.id, { adjustment_percent: Number(e.target.value) })} aria-label={`Ajuste de ${article.name} en porcentaje`} />
                  <button type="button" aria-label="Subir 5 %" onClick={() => updateLinea(linea.id, { adjustment_percent: Math.min(100, linea.adjustment_percent + 5) })}>+</button>
                  <span className="unit-input" style={{ width: 84 }}><input type="number" inputMode="numeric" min={-50} max={100} step={1} value={linea.adjustment_percent} onChange={e => updateLinea(linea.id, { adjustment_percent: Math.max(-50, Math.min(100, Number(e.target.value) || 0)) })} aria-label="Ajuste exacto en porcentaje" /><span>%</span></span>
                  <strong className="pl-mono" style={{ marginLeft: "auto" }}>{money(importeLinea(linea, data.articles))}</strong>
                </div>
              </article>
            );
          })}

        </section>
        </details>
      )}

      {step === 2 && (
        <div className="form-actions">{!existente && <Button variant="secondary" onClick={() => setStep(1)}>Atrás</Button>}<Button variant="primary" disabled={items.length === 0 && !existente} onClick={() => setStep(5)}>{items.length === 0 && existente ? "Ver el resumen" : "Ver la estimación"}</Button></div>
      )}

      {step === 5 && (
        <section className="form">
          {!soloFotos && <div className="panel">
            <div className="panel-head"><span>ESTIMACIÓN ORIENTATIVA</span><span className="pl-mono">{items.length} partidas</span></div>
            <div className="panel-body">
              <div className="range"><small>Entre</small><strong className="pl-mono">{money(rango.minTotal)}</strong><small>y</small><strong className="pl-mono">{money(rango.maxTotal)}</strong><small>con IVA</small></div>
              <div className="totals" style={{ marginTop: 10 }}><span><small>Sin IVA</small><strong className="pl-mono">{money(rango.base)}</strong></span><span><small>Total con IVA</small><strong className="pl-mono">{money(rango.total)}</strong></span>
                <div className="field" style={{ gap: 2, minWidth: 120 }}><span>Horquilla</span><Select size="sm" label="Horquilla de la estimación" value={String(margen)} onChange={v => setMargen(Number(v))} options={[{ value: "0.1", label: "±10 %" }, { value: "0.15", label: "±15 %" }, { value: "0.25", label: "±25 %" }]} /></div>
              </div>
            </div>
            <div style={{ borderTop: "var(--pl-hairline) solid var(--pl-line)" }}>
              {items.map(item => <div key={item.id} className="row-item" style={{ padding: "0 14px" }}><span><strong>{item.description}</strong><small>{item.chapter}{item.adjustment_percent ? ` · ajuste ${item.adjustment_percent > 0 ? "+" : ""}${item.adjustment_percent} %` : ""}</small></span><span className="pl-mono muted text-xs">{item.quantity} {item.unit}</span><span className="pl-mono">{money(importeLinea(lineas.find(l => l.id === item.id)!, data.articles))}</span></div>)}
            </div>
          </div>}

          <div className="panel"><div className="panel-body text-sm">
            <small className="muted text-xs">Se guardará en el proyecto</small>
            <p style={{ marginTop: 4 }}><strong>{existente ? existente.name : datos.name}</strong> · {existente ? existente.client_name : datos.client_name}{(existente ? existente.location : datos.location) ? ` · ${existente ? existente.location : datos.location}` : ""} · {kindNames[existente ? existente.kind : datos.kind]}</p>
            <p className="muted" style={{ marginTop: 6 }}>{fotos.length ? `${fotos.length} foto${fotos.length === 1 ? "" : "s"} en Planos y fotos` : "Sin fotos"}{soloFotos ? (alcance.trim() ? " · las notas van al chat del proyecto · el presupuesto no cambia" : " · el presupuesto no cambia") : existente ? ` · ${items.length} partida${items.length === 1 ? "" : "s"} al borrador del presupuesto` : " · presupuesto «Estimación de visita» V1 en borrador · estado «Presupuestando»"}</p>
            <p className="muted text-xs" style={{ marginTop: 10, whiteSpace: "pre-line" }}>{soloFotos ? (alcance.trim() ? `Notas de la visita: ${alcance.trim()}` : "Sin notas.") : notasDeVisita(alcance, pendientes, dateLabel(new Date().toISOString()), margen)}</p>
          </div></div>

          {error && <p role="alert" className="auth-error">{error}</p>}
          <div className="form-actions"><Button variant="secondary" onClick={() => setStep(2)} disabled={saving}>Atrás</Button><Button variant="primary" onClick={guardar} disabled={saving || busy || !puedeGuardar}>{saving ? "Guardando…" : soloFotos ? "Guardar fotos y notas" : "Guardar estimación"}</Button></div>
        </section>
      )}
      {modalSalida}
    </div>
  );
}
