"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, MicOff, Send, Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { useBanda } from "@/components/band";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { budgetHistory } from "@/lib/budget-history";
import { can, lineTotal, money, totals, type Article, type Project } from "@/lib/domain";
import { normalizar } from "@/lib/busqueda";
import { cantidadPorDefecto, claveVisita, describirOrden, interpretarOrden, muestra, panoramas, partidasDe, type Colocacion, type Orden } from "@/lib/visita360";
import type { Direccion, Visor360 } from "@/lib/visor360";
import "@/styles/visita-360.css";

/** Dictado del navegador (Web Speech API), en español. Aquí sí se interpreta: cada frase final pasa por `interpretarOrden`. */
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null; start(): void; stop(): void };
function reconocimiento(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
function decir(texto: string) {
  try { if (!("speechSynthesis" in window)) return; const u = new SpeechSynthesisUtterance(texto); u.lang = "es-ES"; u.rate = 1.05; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch { /* sin voz */ }
}
function leerGuardadas(projectId: string): Colocacion[] {
  try { const raw = localStorage.getItem(claveVisita(projectId)); const lista = raw ? JSON.parse(raw) : []; return Array.isArray(lista) ? lista : []; } catch { return []; }
}

export function Visita360({ project, budgetId }: { project: Project; budgetId: string | null }) {
  const { data, actor, send, notify, busy } = useWorkspace();
  const router = useRouter();
  const puede = can(actor.role, "budget.save");
  const salida = `/proyectos/${project.id}?s=budget${budgetId ? `&p=${budgetId}` : ""}`;
  useBanda({ label: project.name, href: salida });

  const [foto, setFoto] = useState(panoramas[0]);
  const [colocaciones, setColocaciones] = useState<Colocacion[]>(() => leerGuardadas(project.id));
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState("");
  const [escuchando, setEscuchando] = useState(false);
  const [oido, setOido] = useState("");
  const [respuesta, setRespuesta] = useState("");
  const [tick, setTick] = useState(0);
  const [hoja, setHoja] = useState<{ direccion: Direccion; editar?: Colocacion } | null>(null);
  const [buscar, setBuscar] = useState("");
  const [articuloId, setArticuloId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [nueva, setNueva] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [escrita, setEscrita] = useState("");
  const [verSuelo, setVerSuelo] = useState(true);

  const escenario = useRef<HTMLDivElement>(null);
  const visor = useRef<Visor360 | null>(null);
  const rec = useRef<Recognition | null>(null);
  const colocacionesRef = useRef(colocaciones);
  colocacionesRef.current = colocaciones;

  useEffect(() => { try { localStorage.setItem(claveVisita(project.id), JSON.stringify(colocaciones)); } catch { /* sin almacenamiento */ } }, [colocaciones, project.id]);

  // El visor se carga solo en el navegador, con three.js importado al vuelo.
  useEffect(() => {
    const el = escenario.current; if (!el) return;
    let vivo = true, instancia: Visor360 | null = null;
    import("@/lib/visor360").then(({ crearVisor360 }) => {
      if (!vivo) return;
      instancia = crearVisor360(el, foto.url, {
        alTocar: d => setHoja({ direccion: d }),
        alMover: () => setTick(t => t + 1),
        alCargar: () => setCargando(false),
        alFallar: () => { setCargando(false); setFallo("No se ha podido cargar la foto 360."); }
      });
      visor.current = instancia;
    }).catch(() => { setCargando(false); setFallo("Este navegador no puede mostrar la foto 360."); });
    return () => { vivo = false; instancia?.dispose(); visor.current = null; };
  // El visor se crea una vez por proyecto; cambiar de foto no lo recrea.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);
  const primeraFoto = useRef(true);
  useEffect(() => { if (primeraFoto.current) { primeraFoto.current = false; return; } if (!visor.current) return; setCargando(true); void visor.current.cambiarFoto(foto.url).catch(() => setFallo("No se ha podido cargar la foto 360.")); }, [foto]);

  const articulos = useMemo(() => [...data.articles].sort((a, b) => a.chapter.localeCompare(b.chapter, "es") || a.name.localeCompare(b.name, "es")), [data.articles]);
  const articulo = (id: string) => data.articles.find(a => a.id === id);
  const partidas = useMemo(() => partidasDe(colocaciones, data.articles), [colocaciones, data.articles]);
  const total = totals(partidas);
  // Si hay suelo en el ticket, la foto lo enseña puesto bajo la cámara: el último que se haya colocado.
  const sueloActual = useMemo(() => { for (let i = colocaciones.length - 1; i >= 0; i--) { const a = data.articles.find(x => x.id === colocaciones[i].article_id); const s = a && muestra(a).suelo; if (s) return s; } return null; }, [colocaciones, data.articles]);
  useEffect(() => { visor.current?.probarSuelo(verSuelo ? sueloActual : null); }, [sueloActual, verSuelo, cargando]);
  // Al poner un suelo nuevo, la vista baja para enseñarlo.
  const sueloVisto = useRef<string | null>(null);
  useEffect(() => { if (!sueloActual || sueloActual === sueloVisto.current || !visor.current) return; sueloVisto.current = sueloActual; const c = visor.current.centro(); if (c.pitch > -0.45) visor.current.mirar({ yaw: c.yaw, pitch: -0.5 }); }, [sueloActual]);

  const colocar = useCallback((article: Article, quantity: number, d: Direccion, origen: Colocacion["origen"], aproximada: boolean) => {
    // Si ya hay una marca en ese punto, la nueva baja un poco para que no se tapen.
    const cerca = colocacionesRef.current.filter(c => Math.abs(c.yaw - d.yaw) < 0.12 && Math.abs(c.pitch - d.pitch) < 0.12).length;
    const c: Colocacion = { id: crypto.randomUUID(), article_id: article.id, quantity, yaw: d.yaw, pitch: d.pitch - cerca * 0.13, origen, aproximada };
    setColocaciones(prev => [...prev, c]); setNueva(c.id); setTimeout(() => setNueva(""), 2500);
  }, []);

  const incorporar = useCallback(async () => {
    if (!puede || !colocacionesRef.current.length || guardando) return;
    setGuardando(true);
    try {
      let ws = data;
      let budget = ws.budgets.find(b => b.id === budgetId && b.project_id === project.id) ?? ws.budgets.find(b => b.project_id === project.id);
      if (!budget) { const antes = new Set(ws.budgets.map(b => b.id)); ws = await send({ type: "budget.create", project_id: project.id, title: "Presupuesto" }); budget = ws.budgets.find(b => b.project_id === project.id && !antes.has(b.id)); }
      if (!budget) throw new Error("No se ha podido abrir el presupuesto.");
      let version = budgetHistory(budget, ws.versions).working;
      if (!version || version.status !== "draft") {
        const base = budgetHistory(budget, ws.versions).current; if (!base) throw new Error("El presupuesto no tiene ninguna versión.");
        ws = await send({ type: "budget.revise", version_id: base.id, reason: "Visita 360" }); version = budgetHistory(budget, ws.versions).working;
      }
      if (!version) throw new Error("No hay un borrador abierto.");
      const nuevas = partidasDe(colocacionesRef.current, ws.articles);
      await send({ type: "budget.save", version_id: version.id, expected_revision: version.draft_revision, items: [...version.items, ...nuevas], notes: version.notes });
      setColocaciones([]);
      notify(`${nuevas.length} ${nuevas.length === 1 ? "partida incorporada" : "partidas incorporadas"} a la V${version.number}`);
      router.push(`/proyectos/${project.id}?s=budget&p=${budget.id}`);
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido incorporar."); }
    finally { setGuardando(false); }
  }, [puede, guardando, data, budgetId, project.id, send, notify, router]);

  // Cada frase final se interpreta; lo dicho se coloca donde se está mirando.
  const atender = useCallback((frase: string) => {
    setOido(frase);
    const orden: Orden | null = interpretarOrden(frase, data.articles);
    if (!orden) { setRespuesta("No lo he entendido. Prueba «añade 20 metros de tarima» o «pon una puerta aquí»."); return; }
    let texto = describirOrden(orden, totals(partidasDe(colocacionesRef.current, data.articles)).total);
    if (orden.tipo === "añadir") colocar(orden.article, orden.quantity, visor.current?.centro() ?? { yaw: 0, pitch: 0 }, "voz", orden.aproximada);
    else if (orden.tipo === "quitar") { const ultima = [...colocacionesRef.current].reverse().find(c => c.article_id === orden.article.id); if (!ultima) texto = `No había ${orden.article.name.toLocaleLowerCase()}`; else setColocaciones(prev => prev.filter(c => c.id !== ultima.id)); }
    else if (orden.tipo === "deshacer") { if (!colocacionesRef.current.length) texto = "No hay nada que deshacer"; else setColocaciones(prev => prev.slice(0, -1)); }
    else if (orden.tipo === "cambiar") setFoto(orden.panorama);
    else if (orden.tipo === "incorporar") void incorporar();
    setRespuesta(texto); decir(texto);
  }, [data.articles, colocar, incorporar]);

  function alternarVoz() {
    if (escuchando) { rec.current?.stop(); setEscuchando(false); return; }
    const Rec = reconocimiento();
    if (!Rec) { notify("Este navegador no tiene dictado. En el móvil, usa Chrome o Safari."); return; }
    const r = new Rec(); r.lang = "es-ES"; r.continuous = true; r.interimResults = true;
    r.onresult = e => {
      let parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) { const res = e.results[i]; const t = res[0]?.transcript ?? ""; if (res.isFinal) atender(t.trim()); else parcial += t; }
      if (parcial) setOido(parcial.trim());
    };
    r.onerror = e => { if (e.error === "not-allowed") notify("Permite el micrófono para dar órdenes por voz."); };
    r.onend = () => { setEscuchando(false); rec.current = null; };
    rec.current = r; r.start(); setEscuchando(true); setRespuesta("Te escucho. Di qué va en lo que estás mirando.");
  }
  useEffect(() => () => rec.current?.stop(), []);

  // Hoja: qué va aquí.
  function abrirHoja(d: Direccion, editar?: Colocacion) { setHoja({ direccion: d, editar }); setBuscar(""); setArticuloId(editar?.article_id ?? ""); setCantidad(editar ? String(editar.quantity) : ""); }
  const elegido = articuloId ? articulo(articuloId) : undefined;
  const filtrados = buscar ? articulos.filter(a => normalizar(a.name + " " + a.chapter).includes(normalizar(buscar))) : articulos;
  function confirmarHoja() {
    if (!hoja || !elegido) return;
    const q = parseFloat(cantidad.replace(",", ".")); const quantity = Number.isFinite(q) && q > 0 ? q : cantidadPorDefecto(elegido.unit);
    if (hoja.editar) setColocaciones(prev => prev.map(c => c.id === hoja.editar!.id ? { ...c, article_id: elegido.id, quantity, aproximada: false } : c));
    else colocar(elegido, quantity, hoja.direccion, "toque", !(Number.isFinite(q) && q > 0));
    setRespuesta(`${elegido.name}: ${quantity} ${elegido.unit}`); setHoja(null);
  }

  const pines = colocaciones.map(c => ({ c, p: visor.current?.proyectar(c) ?? { x: 0, y: 0, visible: false }, a: articulo(c.article_id) }));
  void tick;

  return <div className="page v360">
    <header className="v360-head">
      <div>
        <Link prefetch={false} href={salida} className="flow-back solo-escritorio"><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" /><span>{project.name}</span></Link>
        <h1>Visita 360</h1>
        <p>{foto.nota}. Toca un sitio o di qué va ahí; la cantidad la pones tú.</p>
      </div>
      <div className="v360-fotos" role="group" aria-label="Estancia">
        {panoramas.map(p => <button key={p.id} type="button" aria-pressed={p.id === foto.id} onClick={() => setFoto(p)}>{p.nombre}</button>)}
      </div>
    </header>

    <div className="v360-stage" ref={escenario}>
      {cargando && !fallo && <div className="v360-loading">Cargando la foto 360…</div>}
      {fallo && <div className="v360-loading">{fallo}</div>}
      {!cargando && !fallo && <span className="v360-crosshair" aria-hidden="true" />}
      {pines.filter(x => x.p.visible && x.a).map(({ c, p, a }) => (
        <button key={c.id} type="button" className="v360-pin" data-nueva={c.id === nueva || undefined} style={{ left: p.x, top: p.y }} onClick={() => abrirHoja(c, c)} aria-label={`${a!.name}, ${c.quantity} ${a!.unit}. Cambiar o quitar`}>
          <span><Muestra article={a!} />{a!.name.split(" ").slice(0, 3).join(" ")} · {c.aproximada ? "≈" : ""}{c.quantity} {a!.unit}</span><i />
        </button>
      ))}
      <div className="v360-tools">
        {escuchando ? <span className="v360-escuchando" aria-live="polite"><i />{oido || "Escuchando…"}</span> : sueloActual ? <button type="button" className="v360-suelo" aria-pressed={verSuelo} onClick={() => setVerSuelo(v => !v)}>{verSuelo ? "Ver el suelo actual" : "Ver con el suelo nuevo"}</button> : <span />}
        <button type="button" className="v360-mic" aria-pressed={escuchando} onClick={alternarVoz} aria-label={escuchando ? "Parar de escuchar" : "Hablar"}>{escuchando ? <MicOff size={20} strokeWidth={1.8} aria-hidden="true" /> : <Mic size={20} strokeWidth={1.8} aria-hidden="true" />}<span>{escuchando ? "Parar" : "Hablar"}</span></button>
      </div>
    </div>

    <form className="v360-escribir" onSubmit={e => { e.preventDefault(); const t = escrita.trim(); if (t) { atender(t); setEscrita(""); } }}>
      <label className="sr-only" htmlFor="v360-orden">Orden escrita</label>
      <input id="v360-orden" type="text" value={escrita} onChange={e => setEscrita(e.target.value)} placeholder="O escríbelo: «añade 20 metros de tarima»" autoComplete="off" />
      <button type="submit" className="btn btn-secondary" aria-label="Dar la orden" disabled={!escrita.trim()}><Send size={16} strokeWidth={1.8} aria-hidden="true" /></button>
    </form>

    {(oido || respuesta) && <div className="v360-dicho" aria-live="polite">{oido && <small>Has dicho: «{oido}»</small>}{respuesta && <strong>{respuesta}</strong>}</div>}

    <section className="pl-card v360-ticket" aria-label="Lo que va en la estancia">
      {partidas.length === 0 && <p className="v360-ayuda" style={{ paddingTop: 14 }}>Todavía no hay nada. Toca un punto de la foto y elige del catálogo, o pulsa «Hablar» y di <code>«añade 20 metros de tarima»</code>, <code>«pon una puerta aquí»</code>, <code>«quita la pintura»</code>, <code>«¿cuánto va?»</code> o <code>«pásalo al presupuesto»</code>.</p>}
      {partidas.map(i => <div key={i.id} className="v360-linea">
        <span className="v360-linea-texto"><Muestra article={{ chapter: i.chapter, name: i.description }} /><span><strong>{i.description}</strong><small>{i.quantity} {i.unit} × {money(i.unit_price)}{colocaciones.some(c => c.article_id === articulos.find(a => a.name === i.description)?.id && c.aproximada) ? " · cantidad aproximada" : ""}</small></span></span>
        <span className="pl-mono">{money(lineTotal(i))}</span>
        <button type="button" className="btn btn-icon" aria-label={`Quitar ${i.description}`} onClick={() => { const a = articulos.find(x => x.name === i.description); setColocaciones(prev => prev.filter(c => c.article_id !== a?.id)); }}><Trash2 size={16} strokeWidth={1.7} aria-hidden="true" /></button>
      </div>)}
      {partidas.length > 0 && <div className="v360-total"><span><small>Total con IVA · {partidas.length} {partidas.length === 1 ? "partida" : "partidas"}</small></span><strong>{money(total.total)}</strong></div>}
      {partidas.length > 0 && <div className="v360-acciones">
        <Button variant="secondary" onClick={() => setColocaciones([])}>Vaciar</Button>
        {puede ? <Button variant="primary" data-accent="orange" disabled={guardando || busy} onClick={() => void incorporar()}>{guardando ? "Pasando…" : "Pasar al presupuesto"}</Button> : <span className="muted text-sm">Tu perfil puede mirar, pero no presupuestar.</span>}
      </div>}
      {partidas.length > 0 && <p className="v360-ayuda">Las cantidades son las que has dicho o tocado; nada se mide en la foto. Revísalas en el presupuesto antes de enviarlo.</p>}
    </section>

    <Modal open={Boolean(hoja)} onClose={() => setHoja(null)} title={hoja?.editar ? "Cambiar o quitar" : "¿Qué va aquí?"} footer={<>
      {hoja?.editar && <Button variant="secondary" onClick={() => { setColocaciones(prev => prev.filter(c => c.id !== hoja.editar!.id)); setHoja(null); }}>Quitar</Button>}
      <Button variant="secondary" onClick={() => setHoja(null)}>Cancelar</Button>
      <Button variant="primary" disabled={!elegido} onClick={confirmarHoja}>{hoja?.editar ? "Guardar" : "Poner aquí"}</Button>
    </>}>
      <div className="form" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="field"><span>Buscar en el catálogo</span><input type="search" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="tarima, puerta, pintura…" autoFocus /></label>
        <div className="v360-lista" role="listbox" aria-label="Artículos del catálogo">
          {filtrados.slice(0, 40).map(a => <button key={a.id} type="button" role="option" aria-selected={a.id === articuloId} aria-pressed={a.id === articuloId} onClick={() => { setArticuloId(a.id); if (!cantidad) setCantidad(String(cantidadPorDefecto(a.unit))); }}><span className="v360-linea-texto"><Muestra article={a} /><span>{a.name}</span></span><small>{money(a.unit_price)} / {a.unit}</small></button>)}
          {filtrados.length === 0 && <p className="muted text-sm" style={{ padding: 12, margin: 0 }}>Nada con ese nombre en el catálogo.</p>}
        </div>
        {elegido && <div className="v360-cantidad">
          <span className="muted text-sm">{elegido.name} · {money(elegido.unit_price)} por {elegido.unit}</span>
          <label className="field"><span>Cantidad · {elegido.unit}</span><input type="number" inputMode="decimal" min={0} step="0.5" value={cantidad} onChange={e => setCantidad(e.target.value)} /></label>
        </div>}
      </div>
    </Modal>
  </div>;
}

/** Muestra del material: la textura si la hay, si no un color por oficio. */
function Muestra({ article }: { article: Pick<Article, "chapter" | "name"> }) {
  const m = muestra(article);
  return <i className="v360-muestra" aria-hidden="true" style={m.imagen ? { backgroundImage: `url(${m.imagen})` } : { background: m.color }} />;
}
