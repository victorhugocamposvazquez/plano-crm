"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, MicOff, Minus, Plus, Rotate3d, RotateCcw, RotateCw, Ruler, Send, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { useBanda } from "@/components/band";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { budgetHistory } from "@/lib/budget-history";
import { can, lineTotal, money, totals, type Project } from "@/lib/domain";
import { decir, escuchar, type Recognition } from "@/lib/voz";
import {
  aplicar3d, aspectos, cantidades, candidatos, color, coloresDe, describirDims, elementos, escena3d, espacios, estadoInicial, huecos,
  interpretar3d, nombreElemento, partidas3d, unidadesQueCaben, type Elemento, type Estado3d, type Orden3d, type TipoEspacio, type Vista
} from "@/lib/espacio3d";
import type { VisualAsset } from "@/lib/visual/schema";
import type { createSpaceViewer } from "@/lib/visual/viewer";
import "@/styles/visita-360.css";
import "@/styles/espacio-3d.css";

type Visor = Awaited<ReturnType<typeof createSpaceViewer>>;
const clave = (projectId: string) => `plano.espacio3d.${projectId}`;
const cifra = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);
const rgb = (c: readonly number[]) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
const ayuda = "Prueba: «pon porcelánico en el suelo», «pinta las paredes de verde salvia», «pon dos estanterías», «mide 6 por 4 y 3 de alto», «entra» o «¿cuánto va?».";

function leer(projectId: string): Estado3d | null {
  try { const raw = localStorage.getItem(clave(projectId)); const e = raw ? JSON.parse(raw) : null; return e && (e.tipo === "local" || e.tipo === "nave") && e.dims ? e : null; } catch { return null; }
}

/**
 * Propuesta en 3D: el espacio de ejemplo (local o nave) con los artículos del catálogo. Se cambia suelo, paredes y mobiliario
 * por voz, escribiendo o tocando la escena; las cantidades salen de las medidas y el precio del catálogo. Se pasa al borrador del presupuesto.
 */
export function Espacio3d({ project, budgetId }: { project: Project; budgetId: string | null }) {
  const { data, actor, send, notify, busy } = useWorkspace();
  const router = useRouter();
  const puede = can(actor.role, "budget.save");
  const salida = `/proyectos/${project.id}?s=budget${budgetId ? `&p=${budgetId}` : ""}`;
  useBanda({ label: project.name, href: salida });

  const [estado, setEstado] = useState<Estado3d>(() => estadoInicial());
  const [historial, setHistorial] = useState<Estado3d[]>([]);
  const [cargado, setCargado] = useState(false);
  const [sel, setSel] = useState<Elemento>("suelo");
  const [vista, setVista] = useState<Vista>("overview");
  const [visorEstado, setVisorEstado] = useState<"cargando" | "listo" | "fallo">("cargando");
  const [escuchando, setEscuchando] = useState(false);
  const [oido, setOido] = useState("");
  const [respuesta, setRespuesta] = useState("");
  const [escrita, setEscrita] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [medidasForm, setMedidasForm] = useState<{ largo: string; ancho: string; alto: string } | null>(null);

  // Lo guardado se lee tras el primer pintado (evita diferencias de hidratación) y se guarda en cada cambio.
  useEffect(() => { const e = leer(project.id); if (e) setEstado(e); setCargado(true); }, [project.id]);
  useEffect(() => { if (cargado) try { localStorage.setItem(clave(project.id), JSON.stringify(estado)); } catch { /* sin almacenamiento */ } }, [estado, cargado, project.id]);

  const looks = useMemo(() => aspectos(estado, data.articles), [estado, data.articles]);
  const q = cantidades(estado);
  const partidas = useMemo(() => partidas3d(estado, data.articles), [estado, data.articles]);
  const total = totals(partidas);

  // El visor se crea de nuevo solo si cambia la forma (espacio, medidas, qué mueble y cuántos); materiales y colores se actualizan en el sitio.
  const forma = JSON.stringify([estado.tipo, estado.dims, estado.mueble?.article_id ?? null, estado.mueble?.unidades ?? 0, looks.mueble?.dimensions_m ?? null]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const escena = useMemo(() => escena3d(estado, looks.mueble), [forma]);
  const seleccionVisor = useMemo(() => ({ suelo: looks.suelo!.id, paredes: looks.paredes!.id, mueble: looks.mueble?.id ?? "ninguno" }), [looks]);

  const host = useRef<HTMLDivElement>(null), visor = useRef<Visor | null>(null), rec = useRef<Recognition | null>(null);
  const assets = useRef<VisualAsset[]>([]);
  const ultimo = useRef({ seleccionVisor, sel, vista });
  ultimo.current = { seleccionVisor, sel, vista };
  const asegurar = useCallback(() => { for (const a of Object.values(looks)) if (a && !assets.current.some(x => x.id === a.id)) assets.current.push(a); }, [looks]);
  const alTocar = useRef<(id: string) => void>(() => {});

  useEffect(() => {
    let cancelado = false; const control = new AbortController(); setVisorEstado("cargando");
    asegurar();
    import("@/lib/visual/viewer").then(async ({ createSpaceViewer }) => {
      if (cancelado || !host.current) return;
      const v = await createSpaceViewer(host.current, escena, assets.current, ultimo.current.seleccionVisor, id => alTocar.current(id), () => { if (!cancelado) setVisorEstado("fallo"); }, control.signal);
      if (cancelado) { v.dispose(); return; }
      visor.current = v; v.update(ultimo.current.seleccionVisor, ultimo.current.sel); if (ultimo.current.vista !== "overview") v.view(ultimo.current.vista);
      setVisorEstado("listo");
    }).catch(() => { if (!cancelado) setVisorEstado("fallo"); });
    return () => { cancelado = true; control.abort(); visor.current?.dispose(); visor.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escena]);
  useEffect(() => { asegurar(); visor.current?.update(seleccionVisor, sel); }, [seleccionVisor, sel, asegurar]);

  function cambiar(siguiente: Estado3d) {
    if (JSON.stringify(siguiente) === JSON.stringify(estado)) return;
    setHistorial(h => [...h.slice(-29), estado]); setEstado(siguiente);
  }
  function responder(texto: string) { setRespuesta(texto); decir(texto); }
  function ver(v: Vista, elemento?: Elemento) {
    if (elemento) { setSel(elemento); visor.current?.update(seleccionVisor, elemento); }
    setVista(v); visor.current?.view(v);
  }
  const nombreDe = (e: Elemento) => { const el = estado[e]; const a = el && data.articles.find(x => x.id === el.article_id); return a ? `${a.name}${el.color ? `, ${el.color}` : ""}` : e === "mueble" ? "Sin muebles" : "Existente"; };

  /** Qué responde Plano tras una orden que cambia algo: lo puesto, cuánto sale y cuánto cuesta. */
  function explicar(o: Orden3d, nuevo: Estado3d): string {
    const p = partidas3d(nuevo, data.articles), linea = (e: Elemento) => p.find(i => i.elemento === e);
    const coste = (e: Elemento) => { const l = linea(e); return l ? ` ${cifra(l.quantity)} ${l.unit}, ${money(lineTotal(l))} sin IVA.` : ""; };
    switch (o.tipo) {
      case "poner": return `${nombreElemento[o.elemento]}: ${o.article.name}${nuevo[o.elemento]?.color ? `, ${nuevo[o.elemento]!.color}` : ""}.${coste(o.elemento)}`;
      case "color": return nuevo[o.elemento] ? `${nombreElemento[o.elemento]} en ${o.color}.${coste(o.elemento)}` : `No hay en el catálogo nada para ${nombreElemento[o.elemento].toLocaleLowerCase()}.`;
      case "unidades": return nuevo.mueble ? `${nombreDe("mueble")}: ${nuevo.mueble.unidades} ${nuevo.mueble.unidades === 1 ? "unidad" : "unidades"}.${coste("mueble")}` : "No hay muebles en el catálogo.";
      case "quitar": return `${nombreElemento[o.elemento]}: se queda como está.`;
      case "medidas": { const c = cantidades(nuevo); return `${espacios[nuevo.tipo].nombre}: ${describirDims(nuevo.dims)}. Suelo ${cifra(c.suelo)} m², paredes ${cifra(c.paredes)} m².`; }
      case "espacio": return `${espacios[nuevo.tipo].nombre} de ejemplo: ${describirDims(nuevo.dims)}.`;
      default: return "";
    }
  }

  const incorporar = useCallback(async () => {
    if (!puede || !partidas.length || guardando) return;
    setGuardando(true);
    try {
      let ws = data;
      let budget = ws.budgets.find(b => b.id === budgetId && b.project_id === project.id) ?? ws.budgets.find(b => b.project_id === project.id);
      if (!budget) { const antes = new Set(ws.budgets.map(b => b.id)); ws = await send({ type: "budget.create", project_id: project.id, title: "Presupuesto" }); budget = ws.budgets.find(b => b.project_id === project.id && !antes.has(b.id)); }
      if (!budget) throw new Error("No se ha podido abrir el presupuesto.");
      let version = budgetHistory(budget, ws.versions).working;
      if (!version || version.status !== "draft") {
        const base = budgetHistory(budget, ws.versions).current; if (!base) throw new Error("El presupuesto no tiene ninguna versión.");
        ws = await send({ type: "budget.revise", version_id: base.id, reason: "Propuesta en 3D" }); version = budgetHistory(budget, ws.versions).working;
      }
      if (!version) throw new Error("No hay un borrador abierto.");
      const nuevas = partidas.map(({ elemento: _e, ...i }) => ({ ...i, id: crypto.randomUUID() }));
      await send({ type: "budget.save", version_id: version.id, expected_revision: version.draft_revision, items: [...version.items, ...nuevas], notes: version.notes });
      notify(`${nuevas.length} ${nuevas.length === 1 ? "partida incorporada" : "partidas incorporadas"} a la V${version.number}`);
      router.push(`/proyectos/${project.id}?s=budget&p=${budget.id}`);
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido incorporar."); }
    finally { setGuardando(false); }
  }, [puede, partidas, guardando, data, budgetId, project.id, send, notify, router]);

  // Cada frase (dicha o escrita) se interpreta contra el catálogo; lo que cambia se ve en la escena y en el ticket.
  const atender = useCallback((frase: string) => {
    setOido(frase);
    const o = interpretar3d(frase, data.articles);
    if (!o) { responder(`No lo he entendido. ${ayuda}`); return; }
    if (o.tipo === "total") { responder(partidas.length ? `Van ${money(total.total)} con IVA en ${partidas.length} ${partidas.length === 1 ? "partida" : "partidas"}.` : "Todavía no has cambiado nada."); return; }
    if (o.tipo === "incorporar") { if (!partidas.length) responder("No hay nada que pasar todavía."); else { responder("Lo paso al presupuesto."); void incorporar(); } return; }
    if (o.tipo === "deshacer") { const prev = historial.at(-1); if (!prev) { responder("No hay nada que deshacer."); return; } setHistorial(h => h.slice(0, -1)); setEstado(prev); responder("Deshecho."); return; }
    if (o.tipo === "vista") { ver(o.vista, o.elemento); responder(o.vista === "inside" ? "Dentro del espacio." : o.vista === "overview" ? "Vista general." : `Mirando ${nombreElemento[o.elemento!].toLocaleLowerCase()}.`); return; }
    if (o.tipo === "mover") { visor.current?.command(o.mover); return; }
    const nuevo = aplicar3d(estado, o, data.articles);
    if ("elemento" in o) setSel(o.elemento); else if (o.tipo === "unidades") setSel("mueble");
    cambiar(nuevo); responder(explicar(o, nuevo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.articles, estado, historial, partidas, total.total, incorporar, seleccionVisor]);
  const atenderRef = useRef(atender); atenderRef.current = atender;

  // Tocar la escena elige el elemento y abre sus alternativas.
  alTocar.current = (id: string) => {
    if (id !== "suelo" && id !== "paredes" && id !== "mueble") return;
    setSel(id); setRespuesta(`${nombreElemento[id]}: elige del catálogo debajo, o dilo.`);
  };

  function alternarVoz() {
    if (escuchando) { rec.current?.stop(); setEscuchando(false); return; }
    const r = escuchar({ alOir: t => atenderRef.current(t), alParcial: setOido, alTerminar: () => { setEscuchando(false); rec.current = null; }, alError: notify });
    if (!r) { notify("Este navegador no tiene dictado. Usa Chrome, Edge o Safari, o escribe la orden."); return; }
    rec.current = r; setEscuchando(true); setRespuesta(`Te escucho. ${ayuda}`);
  }
  useEffect(() => () => rec.current?.stop(), []);

  function elegirEspacio(tipo: TipoEspacio) { if (tipo !== estado.tipo) { cambiar(aplicar3d(estado, { tipo: "espacio", espacio: tipo }, data.articles)); setVista("overview"); setRespuesta(""); } }
  function guardarMedidas() {
    if (!medidasForm) return;
    const n = (t: string) => { const v = parseFloat(t.replace(",", ".")); return Number.isFinite(v) ? v : undefined; };
    const o: Orden3d = { tipo: "medidas", medidas: { largo: n(medidasForm.largo), ancho: n(medidasForm.ancho), alto: n(medidasForm.alto) } };
    const nuevo = aplicar3d(estado, o, data.articles); cambiar(nuevo); responder(explicar(o, nuevo)); setMedidasForm(null);
  }

  const lista = candidatos(data.articles, sel), elegido = estado[sel];
  const maxUnidades = unidadesQueCaben(estado, looks.mueble);
  const ponerArticulo = (articleId: string) => { const a = data.articles.find(x => x.id === articleId); if (!a) return; const o: Orden3d = { tipo: "poner", elemento: sel, article: a }; const nuevo = aplicar3d(estado, o, data.articles); cambiar(nuevo); setRespuesta(explicar(o, nuevo)); };
  const ponerColor = (c: string) => { const o: Orden3d = { tipo: "color", elemento: sel as "paredes" | "mueble", color: c }; const nuevo = aplicar3d(estado, o, data.articles); cambiar(nuevo); setRespuesta(explicar(o, nuevo)); };
  const ponerUnidades = (n: number) => { const o: Orden3d = { tipo: "unidades", unidades: n }; const nuevo = aplicar3d(estado, o, data.articles); cambiar(nuevo); setRespuesta(explicar(o, nuevo)); };

  return <div className="page v360 e3d">
    <header className="v360-head">
      <div>
        <Link prefetch={false} href={salida} className="flow-back solo-escritorio"><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" /><span>{project.name}</span></Link>
        <h1>Propuesta en 3D · {espacios[estado.tipo].nombre.toLocaleLowerCase()} de ejemplo</h1>
        <p>Di, escribe o toca qué cambia: suelo, paredes y muebles del catálogo, con su precio.</p>
      </div>
      <div className="pl-seg" role="group" aria-label="Espacio">
        {(Object.keys(espacios) as TipoEspacio[]).map(t => <button key={t} type="button" aria-pressed={estado.tipo === t} onClick={() => elegirEspacio(t)}>{espacios[t].nombre}</button>)}
      </div>
    </header>

    <div className="e3d-stage">
      <div ref={host} className="e3d-lienzo" />
      {visorEstado !== "listo" && <div className="v360-loading">{visorEstado === "cargando" ? "Preparando el espacio 3D…" : "La vista 3D no está disponible en este navegador. Puedes seguir eligiendo con la lista."}</div>}
      <div className="e3d-vistas" role="group" aria-label="Vista">
        <button type="button" aria-pressed={vista === "overview"} onClick={() => ver("overview")} disabled={visorEstado !== "listo"}>Vista general</button>
        <button type="button" aria-pressed={vista === "inside"} onClick={() => ver("inside")} disabled={visorEstado !== "listo"}>Entrar</button>
        <button type="button" aria-pressed={vista === "focus"} onClick={() => ver("focus")} disabled={visorEstado !== "listo"}>Ver {nombreElemento[sel].toLocaleLowerCase()}</button>
      </div>
      <div className="v360-tools">
        {escuchando ? <span className="v360-escuchando" aria-live="polite"><i />{oido || "Escuchando…"}</span> : <span className="e3d-mover" role="group" aria-label="Mover la cámara">
          <button type="button" aria-label="Girar a la izquierda" onClick={() => visor.current?.command("left")} disabled={visorEstado !== "listo"}><RotateCcw size={18} strokeWidth={1.7} aria-hidden="true" /></button>
          <button type="button" aria-label="Girar a la derecha" onClick={() => visor.current?.command("right")} disabled={visorEstado !== "listo"}><RotateCw size={18} strokeWidth={1.7} aria-hidden="true" /></button>
          <button type="button" aria-label="Acercar" onClick={() => visor.current?.command("closer")} disabled={visorEstado !== "listo"}><ZoomIn size={18} strokeWidth={1.7} aria-hidden="true" /></button>
          <button type="button" aria-label="Alejar" onClick={() => visor.current?.command("farther")} disabled={visorEstado !== "listo"}><ZoomOut size={18} strokeWidth={1.7} aria-hidden="true" /></button>
        </span>}
        <button type="button" className="v360-mic" aria-pressed={escuchando} onClick={alternarVoz} aria-label={escuchando ? "Parar de escuchar" : "Hablar"}>{escuchando ? <MicOff size={20} strokeWidth={1.8} aria-hidden="true" /> : <Mic size={20} strokeWidth={1.8} aria-hidden="true" />}<span>{escuchando ? "Parar" : "Hablar"}</span></button>
      </div>
    </div>

    <form className="v360-escribir" onSubmit={e => { e.preventDefault(); const t = escrita.trim(); if (t) { atender(t); setEscrita(""); } }}>
      <label className="sr-only" htmlFor="e3d-orden">Orden escrita</label>
      <input id="e3d-orden" type="text" value={escrita} onChange={e => setEscrita(e.target.value)} placeholder="O escríbelo: «pinta las paredes de verde salvia»" autoComplete="off" />
      <button type="submit" className="btn btn-secondary" aria-label="Dar la orden" disabled={!escrita.trim()}><Send size={16} strokeWidth={1.8} aria-hidden="true" /></button>
    </form>

    {(oido || respuesta) && <div className="v360-dicho" aria-live="polite">{oido && <small>Has dicho: «{oido}»</small>}{respuesta && <strong>{respuesta}</strong>}</div>}

    <div className="v360-medidas">
      <Ruler size={18} strokeWidth={1.6} aria-hidden="true" />
      <p><strong>{describirDims(estado.dims)}</strong><small>Suelo {cifra(q.suelo)} m² · paredes {cifra(q.paredes)} m²{huecos(estado) ? ` (sin la ventana de ${cifra(huecos(estado))} m²)` : ""}. Di «mide 6 por 4 y 3 de alto» con las de verdad.</small></p>
      <Button variant="secondary" onClick={() => setMedidasForm({ largo: cifra(estado.dims.largo), ancho: cifra(estado.dims.ancho), alto: cifra(estado.dims.alto) })}>Cambiar</Button>
    </div>

    <section className="pl-card e3d-elementos" aria-label="Qué cambia">
      <div className="e3d-pestanas" role="tablist" aria-label="Elemento">
        {elementos.map(e => { const a = e === "mueble" ? looks.mueble : looks[e]; return <button key={e} type="button" role="tab" aria-selected={sel === e} onClick={() => setSel(e)}>
          <i className="e3d-muestra" aria-hidden="true" style={a ? { background: rgb(a.color) } : undefined} data-vacia={!a || undefined} />
          <span><strong>{nombreElemento[e]}</strong><small>{nombreDe(e)}</small></span>
        </button>; })}
      </div>
      <div className="e3d-opciones" role="tabpanel" aria-label={nombreElemento[sel]}>
        {lista.length === 0 && <p className="muted text-sm" style={{ margin: 0 }}>No hay en el catálogo nada para {nombreElemento[sel].toLocaleLowerCase()}. Añádelo en Catálogo y aparecerá aquí.</p>}
        {lista.length > 0 && <div className="e3d-lista">
          <button type="button" aria-pressed={!elegido} onClick={() => { const o: Orden3d = { tipo: "quitar", elemento: sel }; cambiar(aplicar3d(estado, o, data.articles)); setRespuesta(explicar(o, estado)); }}><span>{sel === "mueble" ? "Sin muebles" : "Dejar como está"}</span><small>Sin partida</small></button>
          {lista.map(a => <button key={a.id} type="button" aria-pressed={elegido?.article_id === a.id} onClick={() => ponerArticulo(a.id)}><span>{a.name}</span><small className="pl-mono">{money(a.unit_price)} / {a.unit}</small></button>)}
        </div>}
        {sel !== "suelo" && elegido && <div className="e3d-colores" role="group" aria-label="Color">
          {coloresDe[sel].map(nombre => { const c = color(nombre)!; return <button key={nombre} type="button" aria-pressed={elegido.color === nombre} onClick={() => ponerColor(nombre)} title={nombre}><i style={{ background: rgb(c.rgb) }} aria-hidden="true" /><span>{nombre}</span></button>; })}
        </div>}
        {sel === "mueble" && elegido && <div className="e3d-unidades">
          <span>Unidades</span>
          <Button variant="icon" aria-label="Una menos" disabled={(elegido.unidades ?? 1) <= 1} onClick={() => ponerUnidades((elegido.unidades ?? 1) - 1)}><Minus size={16} strokeWidth={1.8} aria-hidden="true" /></Button>
          <strong className="pl-mono">{elegido.unidades ?? 1}</strong>
          <Button variant="icon" aria-label="Una más" disabled={(elegido.unidades ?? 1) >= maxUnidades} onClick={() => ponerUnidades((elegido.unidades ?? 1) + 1)}><Plus size={16} strokeWidth={1.8} aria-hidden="true" /></Button>
          {(elegido.unidades ?? 1) > maxUnidades && <small className="muted">Se dibujan {maxUnidades}; caben en la pared del fondo.</small>}
        </div>}
      </div>
    </section>

    <section className="pl-card v360-ticket" aria-label="Lo que entra en el presupuesto">
      {partidas.length === 0 && <p className="v360-ayuda" style={{ paddingTop: 14 }}><Rotate3d size={16} strokeWidth={1.6} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 6 }} />Todavía no has cambiado nada. {ayuda}</p>}
      {partidas.map(i => <div key={i.id} className="v360-linea">
        <span className="v360-linea-texto"><span><strong>{i.description}</strong><small>{nombreElemento[i.elemento]} · {cifra(i.quantity)} {i.unit} × {money(i.unit_price)}</small></span></span>
        <span className="pl-mono">{money(lineTotal(i))}</span>
        <span />
      </div>)}
      {partidas.length > 0 && <div className="v360-total"><span><small>Total con IVA · {partidas.length} {partidas.length === 1 ? "partida" : "partidas"}</small></span><strong>{money(total.total)}</strong></div>}
      {partidas.length > 0 && <div className="v360-acciones">
        <Button variant="secondary" disabled={!historial.length} onClick={() => { const prev = historial.at(-1); if (prev) { setHistorial(h => h.slice(0, -1)); setEstado(prev); } }}><Undo2 size={15} strokeWidth={1.7} aria-hidden="true" />Deshacer</Button>
        {puede ? <Button variant="primary" data-accent="orange" disabled={guardando || busy} onClick={() => void incorporar()}>{guardando ? "Pasando…" : "Pasar al presupuesto"}</Button> : <span className="muted text-sm">Tu perfil puede mirar, pero no presupuestar.</span>}
      </div>}
      {partidas.length > 0 && <p className="v360-ayuda">Las cantidades salen de las medidas del espacio, no del dibujo. El espacio y los modelos son de ejemplo; los precios, los del catálogo.</p>}
    </section>

    <Modal open={Boolean(medidasForm)} onClose={() => setMedidasForm(null)} title={`Medidas · ${espacios[estado.tipo].nombre.toLocaleLowerCase()}`} footer={<>
      <Button variant="secondary" onClick={() => setMedidasForm(null)}>Cancelar</Button>
      <Button variant="primary" onClick={guardarMedidas}>Guardar</Button>
    </>}>
      {medidasForm && <div className="form v360-form-medidas">
        <p className="muted text-sm" style={{ margin: 0 }}>Toma las medidas con el láser. El espacio se redibuja y las cantidades se recalculan.</p>
        <div className="v360-campos">
          {([["largo", "Largo · m"], ["ancho", "Ancho · m"], ["alto", "Alto · m"]] as const).map(([k, etiqueta]) => <label key={k} className="field"><span>{etiqueta}</span><input type="text" inputMode="decimal" value={medidasForm[k]} onChange={e => setMedidasForm(f => f && { ...f, [k]: e.target.value })} placeholder="0,00" /></label>)}
        </div>
      </div>}
    </Modal>
  </div>;
}
