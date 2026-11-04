"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ImagePlus, Mic, MicOff, Send, Trash2, Undo2, X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { useBanda } from "@/components/band";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { budgetHistory } from "@/lib/budget-history";
import { can, lineTotal, money, totals, type Article, type Project } from "@/lib/domain";
import { normalizar } from "@/lib/busqueda";
import {
  cantidadPorDefecto, claveVisita, describirOrden, esFoto360, geometriaSuperficie, interpretarOrden, muestra, panoramas, partidasDe, prefijo360, proporcion360, soloPartida,
  type Colocacion, type Orden, type Panorama, type TipoSuperficie
} from "@/lib/visita360";
import type { Direccion, Visor360 } from "@/lib/visor360";
import "@/styles/visita-360.css";

/** Dictado del navegador (Web Speech API), en español. Cada frase final pasa por `interpretarOrden`. */
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
  try {
    const raw = localStorage.getItem(claveVisita(projectId)); const lista = raw ? JSON.parse(raw) : [];
    // Las marcas de antes de las estancias no sabían de qué foto eran: se asignan a la primera de ejemplo.
    return Array.isArray(lista) ? lista.map((c: Colocacion) => ({ ...c, foto: c.foto ?? panoramas[0].id })) : [];
  } catch { return []; }
}
const instrucciones: Record<TipoSuperficie, string> = {
  suelo: "Toca las esquinas del suelo, siguiendo la base de paredes y muebles. Deja fuera lo que no se cambia.",
  techo: "Toca las esquinas del techo, siguiendo la línea donde se junta con las paredes.",
  pared: "Toca primero las dos esquinas de abajo, donde toca el suelo; luego las de arriba. Sirve para paredes, puertas y frentes de muebles."
};
/** Marcar una superficie: primero el contorno; después, si hace falta, cada hueco (ventana, puerta) que no se toca. */
type Marcando = { article: Article; quantity: number | null; origen: Colocacion["origen"]; foto: string; tipo: TipoSuperficie; puntos: Direccion[]; huecos: Direccion[][]; hueco: Direccion[] | null; editar?: string };
const cifra = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);
const nombreBonito = (archivo: string) => { const n = archivo.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim(); return n ? n[0].toUpperCase() + n.slice(1) : "Estancia"; };

export function Visita360({ project, budgetId }: { project: Project; budgetId: string | null }) {
  const { data, actor, send, notify, busy, upload, fileUrl } = useWorkspace();
  const router = useRouter();
  const puede = can(actor.role, "budget.save");
  const puedeSubir = can(actor.role, "document.add");
  const salida = `/proyectos/${project.id}?s=budget${budgetId ? `&p=${budgetId}` : ""}`;
  useBanda({ label: project.name, href: salida });

  // Estancias: las fotos 360 del proyecto (documentos «360 · Nombre») y, detrás, las de ejemplo.
  const [propias, setPropias] = useState<Panorama[]>([]);
  const docs360 = useMemo(() => data.documents.filter(d => d.project_id === project.id && esFoto360(d)).sort((a, b) => b.created_at.localeCompare(a.created_at)), [data.documents, project.id]);
  useEffect(() => {
    let vivo = true;
    Promise.all(docs360.map(async d => { try { return { id: d.id, nombre: d.name.slice(prefijo360.length).replace(/\.[a-z0-9]+$/i, "") || "Estancia", url: await fileUrl(d), nota: "Foto 360 del proyecto" }; } catch { return null; } }))
      .then(lista => { if (vivo) setPropias(lista.filter((x): x is Panorama => Boolean(x))); });
    return () => { vivo = false; };
  // fileUrl cambia en cada render del proveedor; basta con recalcular cuando cambian los documentos.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs360]);
  const fotos = useMemo(() => [...propias, ...panoramas], [propias]);
  const [fotoId, setFotoId] = useState(panoramas[0].id);
  const primeraPropia = useRef(false);
  useEffect(() => { if (propias.length && !primeraPropia.current) { primeraPropia.current = true; setFotoId(propias[0].id); } }, [propias]);
  const foto = fotos.find(f => f.id === fotoId) ?? fotos[0];
  const zonas = useMemo(() => fotos.map(f => ({ id: f.id, nombre: f.nombre })), [fotos]);

  const [colocaciones, setColocaciones] = useState<Colocacion[]>(() => leerGuardadas(project.id));
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState("");
  const [escuchando, setEscuchando] = useState(false);
  const [oido, setOido] = useState("");
  const [respuesta, setRespuesta] = useState("");
  const [, setTick] = useState(0);
  const [hoja, setHoja] = useState<{ direccion: Direccion; editar?: Colocacion } | null>(null);
  const [buscar, setBuscar] = useState("");
  const [articuloId, setArticuloId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [nueva, setNueva] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [escrita, setEscrita] = useState("");
  const [original, setOriginal] = useState(false);
  const [marcando, setMarcando] = useState<Marcando | null>(null);
  const [aviso, setAviso] = useState("");
  const [nombrar, setNombrar] = useState<{ file: File; nombre: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const escenario = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const visor = useRef<Visor360 | null>(null);
  const rec = useRef<Recognition | null>(null);
  const colocacionesRef = useRef(colocaciones); colocacionesRef.current = colocaciones;
  const marcandoRef = useRef(marcando); marcandoRef.current = marcando;
  const fotoRef = useRef(foto); fotoRef.current = foto;

  useEffect(() => { try { localStorage.setItem(claveVisita(project.id), JSON.stringify(colocaciones)); } catch { /* sin almacenamiento */ } }, [colocaciones, project.id]);

  // El visor se crea una vez; tocar la foto marca una esquina si se está marcando y, si no, pregunta qué va ahí.
  useEffect(() => {
    const el = escenario.current; if (!el) return;
    let vivo = true, instancia: Visor360 | null = null;
    import("@/lib/visor360").then(({ crearVisor360 }) => {
      if (!vivo) return;
      instancia = crearVisor360(el, fotoRef.current.url, {
        alTocar: d => { if (marcandoRef.current) setMarcando(m => !m ? m : m.hueco ? { ...m, hueco: [...m.hueco, d] } : { ...m, puntos: [...m.puntos, d] }); else abrirHoja(d); },
        alMover: () => setTick(t => t + 1),
        alCargar: () => { setCargando(false); setFallo(""); },
        alFallar: () => { setCargando(false); setFallo("No se ha podido cargar la foto 360."); }
      });
      visor.current = instancia;
      setTick(t => t + 1);
    }).catch(() => { setCargando(false); setFallo("Este navegador no puede mostrar la foto 360."); });
    return () => { vivo = false; instancia?.dispose(); visor.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);
  const urlCargada = useRef(foto.url);
  useEffect(() => {
    if (!visor.current || foto.url === urlCargada.current) return;
    urlCargada.current = foto.url; setCargando(true); setMarcando(null);
    void visor.current.cambiarFoto(foto.url).catch(() => setFallo("No se ha podido cargar la foto 360."));
  }, [foto.url]);

  const articulos = useMemo(() => [...data.articles].sort((a, b) => a.chapter.localeCompare(b.chapter, "es") || a.name.localeCompare(b.name, "es")), [data.articles]);
  const articulo = useCallback((id: string) => data.articles.find(a => a.id === id), [data.articles]);
  const partidas = useMemo(() => partidasDe(colocaciones, data.articles, zonas), [colocaciones, data.articles, zonas]);
  const total = totals(partidas.map(soloPartida));
  const enEstaFoto = colocaciones.filter(c => c.foto === foto.id);

  // Las superficies de la estancia que se ve, dibujadas con su material.
  useEffect(() => {
    if (!visor.current) return;
    const lista = enEstaFoto.flatMap(c => {
      const a = articulo(c.article_id), m = a && muestra(a);
      if (!c.superficie || !m?.acabado) return [];
      const g = geometriaSuperficie(c.superficie.tipo, c.superficie.puntos, c.superficie.huecos);
      return "error" in g ? [] : [{ id: c.id, vertices: g.vertices, plano: g.plano, huecos: g.huecos, acabado: m.acabado }];
    });
    visor.current.superficies(lista);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colocaciones, foto.id, cargando, articulo]);
  useEffect(() => { visor.current?.verOriginal(original); }, [original]);

  const colocar = useCallback((article: Article, quantity: number, d: Direccion, origen: Colocacion["origen"], aproximada: boolean, fotoDestino: string, superficie?: Colocacion["superficie"]) => {
    // Si ya hay una marca en ese punto, la nueva baja un poco para que no se tapen.
    const cerca = colocacionesRef.current.filter(c => c.foto === fotoDestino && Math.abs(c.yaw - d.yaw) < 0.12 && Math.abs(c.pitch - d.pitch) < 0.12).length;
    const c: Colocacion = { id: crypto.randomUUID(), article_id: article.id, quantity, yaw: d.yaw, pitch: d.pitch - cerca * 0.13, origen, aproximada, foto: fotoDestino, superficie };
    setColocaciones(prev => [...prev, c]); setNueva(c.id); setTimeout(() => setNueva(""), 2500);
    return c;
  }, []);

  /**
   * Pone un artículo. Se marca en la foto cuando hay que medirlo (superficie en m² sin cantidad dicha) o cuando se eligió tocando la foto;
   * si se dijo la cantidad, o va por unidades, entra directo como marca y se puede marcar después desde ella.
   */
  const poner = useCallback((article: Article, quantity: number | null, d: Direccion | null, origen: Colocacion["origen"], fotoDestino: string, marcar = false) => {
    const tipo = muestra(article).superficie;
    if (tipo && (marcar || (quantity === null && article.unit === "m²"))) {
      setMarcando({ article, quantity, origen, foto: fotoDestino, tipo, puntos: [], huecos: [], hueco: null }); setAviso("");
      const texto = `${article.name}: ${instrucciones[tipo].split(".")[0].toLocaleLowerCase()}, y pulsa «Listo».`;
      setRespuesta(texto); return texto;
    }
    const q = quantity ?? cantidadPorDefecto(article.unit);
    colocar(article, q, d ?? visor.current?.centro() ?? { yaw: 0, pitch: 0 }, origen, quantity === null, fotoDestino);
    return null;
  }, [colocar]);

  function cerrarHueco() {
    setMarcando(m => { if (!m?.hueco) return m; if (m.hueco.length < 3) return { ...m, hueco: null }; return { ...m, huecos: [...m.huecos, m.hueco], hueco: null }; });
  }
  function terminarMarcado() {
    const m0 = marcando; if (!m0) return;
    const m = m0.hueco && m0.hueco.length >= 3 ? { ...m0, huecos: [...m0.huecos, m0.hueco], hueco: null } : m0;
    const g = geometriaSuperficie(m.tipo, m.puntos, m.huecos);
    if ("error" in g) { setAviso(g.error); return; }
    const porSuperficie = m.article.unit === "m²";
    const quantity = m.quantity ?? (porSuperficie ? Math.max(0.5, g.area) : cantidadPorDefecto(m.article.unit));
    const aproximada = m.quantity === null;
    if (m.editar) setColocaciones(prev => prev.map(c => c.id === m.editar ? { ...c, superficie: { tipo: m.tipo, puntos: m.puntos, huecos: m.huecos }, yaw: g.centro.yaw, pitch: g.centro.pitch, ...(aproximada && porSuperficie ? { quantity, aproximada } : {}) } : c));
    else colocar(m.article, quantity, g.centro, m.origen, aproximada, m.foto, { tipo: m.tipo, puntos: m.puntos, huecos: m.huecos });
    const texto = `${m.article.name} en ${foto.nombre.toLocaleLowerCase()}: ${cifra(quantity)} ${m.article.unit}${aproximada && porSuperficie ? ", medido sobre la foto, aproximado" : ""}`;
    setRespuesta(texto); decir(texto); setMarcando(null); setAviso("");
  }

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
      const nuevas = partidasDe(colocacionesRef.current, ws.articles, zonas).map(soloPartida);
      await send({ type: "budget.save", version_id: version.id, expected_revision: version.draft_revision, items: [...version.items, ...nuevas], notes: version.notes });
      setColocaciones([]);
      notify(`${nuevas.length} ${nuevas.length === 1 ? "partida incorporada" : "partidas incorporadas"} a la V${version.number}`);
      router.push(`/proyectos/${project.id}?s=budget&p=${budget.id}`);
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido incorporar."); }
    finally { setGuardando(false); }
  }, [puede, guardando, data, budgetId, project.id, send, notify, router, zonas]);

  // Cada frase final se interpreta: la estancia dicha manda («tarima en la cocina»); si no, la que se ve.
  const atender = useCallback((frase: string) => {
    setOido(frase);
    const orden: Orden | null = interpretarOrden(frase, data.articles, zonas);
    if (!orden) { const t = "No lo he entendido. Prueba «pon tarima en la cocina», «pinta esta pared» o «¿cuánto va?»."; setRespuesta(t); return; }
    const destino = "zona" in orden && orden.zona ? orden.zona.id : fotoRef.current.id;
    if (destino !== fotoRef.current.id) setFotoId(destino);
    let texto = describirOrden(orden, totals(partidasDe(colocacionesRef.current, data.articles, zonas).map(soloPartida)).total);
    if (orden.tipo === "añadir") { const pedido = poner(orden.article, orden.quantity, null, "voz", destino); if (pedido) texto = pedido; }
    else if (orden.tipo === "quitar") {
      const ultima = [...colocacionesRef.current].reverse().find(c => c.article_id === orden.article.id && (!orden.zona || c.foto === orden.zona.id));
      if (!ultima) texto = `No había ${orden.article.name.toLocaleLowerCase()}`; else setColocaciones(prev => prev.filter(c => c.id !== ultima.id));
    }
    else if (orden.tipo === "deshacer") { if (marcandoRef.current) { setMarcando(m => !m ? m : m.hueco ? { ...m, hueco: m.hueco.slice(0, -1) } : m.puntos.length ? { ...m, puntos: m.puntos.slice(0, -1) } : null); texto = "Quitada la última esquina"; } else if (!colocacionesRef.current.length) texto = "No hay nada que deshacer"; else setColocaciones(prev => prev.slice(0, -1)); }
    else if (orden.tipo === "cambiar") setFotoId(orden.zona.id);
    else if (orden.tipo === "incorporar") void incorporar();
    setRespuesta(texto); decir(texto);
  }, [data.articles, zonas, poner, incorporar]);

  function alternarVoz() {
    if (escuchando) { rec.current?.stop(); setEscuchando(false); return; }
    const Rec = reconocimiento();
    if (!Rec) { notify("Este navegador no tiene dictado. Usa Chrome, Edge o Safari, o escribe la orden."); return; }
    const r = new Rec(); r.lang = "es-ES"; r.continuous = true; r.interimResults = true;
    r.onresult = e => {
      let parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) { const res = e.results[i]; const t = res[0]?.transcript ?? ""; if (res.isFinal) atender(t.trim()); else parcial += t; }
      if (parcial) setOido(parcial.trim());
    };
    r.onerror = e => { if (e.error === "not-allowed") notify("Permite el micrófono para dar órdenes por voz."); };
    r.onend = () => { setEscuchando(false); rec.current = null; };
    rec.current = r; r.start(); setEscuchando(true); setRespuesta("Te escucho. Di qué va y dónde: «tarima en la cocina», «pinta esta pared».");
  }
  useEffect(() => () => rec.current?.stop(), []);

  // Hoja: qué va aquí.
  function abrirHoja(d: Direccion, editar?: Colocacion) { setHoja({ direccion: d, editar }); setBuscar(""); setArticuloId(editar?.article_id ?? ""); setCantidad(editar ? String(editar.quantity) : ""); }
  const elegido = articuloId ? articulo(articuloId) : undefined;
  const filtrados = buscar ? articulos.filter(a => normalizar(a.name + " " + a.chapter).includes(normalizar(buscar))) : articulos;
  const elegidoSuperficie = elegido ? muestra(elegido).superficie : undefined;
  function confirmarHoja() {
    if (!hoja || !elegido) return;
    const q = parseFloat(cantidad.replace(",", ".")); const dicha = Number.isFinite(q) && q > 0 ? q : null;
    if (hoja.editar) { setColocaciones(prev => prev.map(c => c.id === hoja.editar!.id ? { ...c, article_id: elegido.id, quantity: dicha ?? c.quantity, aproximada: dicha === null ? c.aproximada : false } : c)); setHoja(null); return; }
    setHoja(null);
    const pedido = poner(elegido, dicha, hoja.direccion, "toque", foto.id, true);
    if (!pedido) setRespuesta(`${elegido.name}: ${cifra(dicha ?? cantidadPorDefecto(elegido.unit))} ${elegido.unit}`);
  }

  // Subir foto 360: se comprueba que es 2:1, se pregunta qué estancia es y se reduce a 4096 px.
  async function elegirArchivo(file: File) {
    try {
      const bitmap = await createImageBitmap(file); const ok = proporcion360(bitmap.width, bitmap.height); bitmap.close();
      if (!ok) { notify("No parece una foto 360: tiene que ser el doble de ancha que de alta (por ejemplo 6000 × 3000)."); return; }
      setNombrar({ file, nombre: nombreBonito(file.name) });
    } catch { notify("No se ha podido leer la foto."); }
    finally { if (entrada.current) entrada.current.value = ""; }
  }
  async function subirFoto() {
    if (!nombrar || subiendo) return;
    setSubiendo(true);
    try {
      const { file } = nombrar, nombre = nombrar.nombre.trim() || "Estancia";
      const bitmap = await createImageBitmap(file);
      let final: Blob = file;
      if (bitmap.width > 4096) {
        const lienzo = document.createElement("canvas"); lienzo.width = 4096; lienzo.height = 2048;
        lienzo.getContext("2d")!.drawImage(bitmap, 0, 0, 4096, 2048);
        final = await new Promise<Blob>((resolve, reject) => lienzo.toBlob(b => b ? resolve(b) : reject(new Error("No se ha podido preparar la foto.")), "image/jpeg", 0.88));
      }
      bitmap.close();
      const doc = await upload(new File([final], `${prefijo360}${nombre}.jpg`, { type: final === file ? file.type : "image/jpeg" }), project.id, "before");
      setNombrar(null); setFotoId(doc.id); notify(`Foto 360 de ${nombre.toLocaleLowerCase()} subida al proyecto`);
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido subir la foto 360."); }
    finally { setSubiendo(false); }
  }

  const pines = enEstaFoto.map(c => ({ c, p: visor.current?.proyectar(c) ?? { x: 0, y: 0, visible: false }, a: articulo(c.article_id) }));
  const proyectar = (d: Direccion) => visor.current?.proyectar(d) ?? { x: 0, y: 0, visible: false };
  const puntosMarcados = (marcando?.puntos ?? []).map(proyectar);
  const huecosMarcados = [...(marcando?.huecos ?? []), ...(marcando?.hueco ? [marcando.hueco] : [])].map(h => h.map(proyectar));
  const conSuperficie = enEstaFoto.some(c => c.superficie);

  return <div className="page v360">
    <header className="v360-head">
      <div>
        <Link prefetch={false} href={salida} className="flow-back solo-escritorio"><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" /><span>{project.name}</span></Link>
        <h1>Visita 360 · {foto.nombre}</h1>
        <p>{foto.nota}. Toca un sitio o di qué va y dónde; las superficies se marcan en la foto.</p>
      </div>
      <div className="v360-fotos" role="group" aria-label="Estancia">
        {fotos.map(p => { const n = colocaciones.filter(c => c.foto === p.id).length; return <button key={p.id} type="button" aria-pressed={p.id === foto.id} onClick={() => setFotoId(p.id)}>{p.nombre}{n > 0 && <span className="v360-cuenta">{n}</span>}</button>; })}
        {puedeSubir && <>
          <button type="button" className="v360-subir" onClick={() => entrada.current?.click()} disabled={subiendo}><ImagePlus size={16} strokeWidth={1.7} aria-hidden="true" />Subir foto 360</button>
          <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void elegirArchivo(f); }} aria-label="Elegir una foto 360" />
        </>}
      </div>
    </header>

    <div className="v360-stage" ref={escenario} data-marcando={marcando ? "" : undefined}>
      {cargando && !fallo && <div className="v360-loading">Cargando la foto 360…</div>}
      {fallo && <div className="v360-loading">{fallo}</div>}
      {!cargando && !fallo && !marcando && <span className="v360-crosshair" aria-hidden="true" />}
      {marcando && <svg className="v360-trazo" aria-hidden="true">
        {puntosMarcados.length > 1 && <polygon points={puntosMarcados.filter(p => p.visible).map(p => `${p.x},${p.y}`).join(" ")} />}
        {puntosMarcados.map((p, i) => p.visible && <circle key={i} cx={p.x} cy={p.y} r={i < 2 && marcando.tipo === "pared" ? 8 : 6} data-base={i < 2 && marcando.tipo === "pared" ? "" : undefined} />)}
        {huecosMarcados.map((h, k) => <g key={k} data-hueco="">{h.length > 1 && <polygon points={h.filter(p => p.visible).map(p => `${p.x},${p.y}`).join(" ")} />}{h.map((p, i) => p.visible && <circle key={i} cx={p.x} cy={p.y} r={5} />)}</g>)}
      </svg>}
      {!marcando && pines.filter(x => x.p.visible && x.a).map(({ c, p, a }) => (
        <button key={c.id} type="button" className="v360-pin" data-nueva={c.id === nueva || undefined} style={{ left: p.x, top: p.y }} onClick={() => abrirHoja(c, c)} aria-label={`${a!.name}, ${c.quantity} ${a!.unit}. Cambiar o quitar`}>
          <span><Muestra article={a!} />{a!.name.split(" ").slice(0, 3).join(" ")} · {c.aproximada ? "≈" : ""}{cifra(c.quantity)} {a!.unit}</span><i />
        </button>
      ))}
      {marcando && <div className="v360-marcar" role="status">
        <p><strong>{marcando.article.name}</strong> · {marcando.hueco ? "Toca las esquinas de la ventana o la puerta que no se toca; luego «Hueco hecho»." : instrucciones[marcando.tipo]}</p>
        {aviso && <p className="v360-aviso">{aviso}</p>}
        <div>
          <span className="pl-mono">{marcando.hueco ? `Hueco · ${marcando.hueco.length} ${marcando.hueco.length === 1 ? "esquina" : "esquinas"}` : `${marcando.puntos.length} ${marcando.puntos.length === 1 ? "esquina" : "esquinas"}${marcando.huecos.length ? ` · ${marcando.huecos.length} ${marcando.huecos.length === 1 ? "hueco" : "huecos"}` : ""}`}</span>
          <button type="button" className="btn btn-secondary" onClick={() => setMarcando(m => !m ? m : m.hueco ? { ...m, hueco: m.hueco.slice(0, -1) } : { ...m, puntos: m.puntos.slice(0, -1) })} disabled={marcando.hueco ? !marcando.hueco.length : !marcando.puntos.length}><Undo2 size={16} strokeWidth={1.8} aria-hidden="true" />Quitar esquina</button>
          {marcando.hueco ? <button type="button" className="btn btn-secondary" onClick={cerrarHueco} disabled={marcando.hueco.length < 3}>Hueco hecho</button>
            : <button type="button" className="btn btn-secondary" onClick={() => setMarcando(m => m && { ...m, hueco: [] })} disabled={marcando.puntos.length < 3}>Quitar un hueco</button>}
          <button type="button" className="btn btn-secondary" onClick={() => { const m = marcando; setMarcando(null); if (!m.editar) colocar(m.article, m.quantity ?? cantidadPorDefecto(m.article.unit), visor.current?.centro() ?? { yaw: 0, pitch: 0 }, m.origen, m.quantity === null, m.foto); }}>Sin marcar</button>
          <button type="button" className="btn btn-secondary" aria-label="Cancelar" onClick={() => { setMarcando(null); setAviso(""); }}><X size={16} strokeWidth={1.8} aria-hidden="true" /></button>
          <button type="button" className="btn btn-primary" onClick={terminarMarcado} disabled={marcando.puntos.length < 3}><Check size={16} strokeWidth={1.8} aria-hidden="true" />Listo</button>
        </div>
      </div>}
      {!marcando && <div className="v360-tools">
        {escuchando ? <span className="v360-escuchando" aria-live="polite"><i />{oido || "Escuchando…"}</span> : conSuperficie ? <button type="button" className="v360-suelo" aria-pressed={original} onClick={() => setOriginal(v => !v)}>{original ? "Ver con lo nuevo" : "Ver cómo está"}</button> : <span />}
        <button type="button" className="v360-mic" aria-pressed={escuchando} onClick={alternarVoz} aria-label={escuchando ? "Parar de escuchar" : "Hablar"}>{escuchando ? <MicOff size={20} strokeWidth={1.8} aria-hidden="true" /> : <Mic size={20} strokeWidth={1.8} aria-hidden="true" />}<span>{escuchando ? "Parar" : "Hablar"}</span></button>
      </div>}
    </div>

    <form className="v360-escribir" onSubmit={e => { e.preventDefault(); const t = escrita.trim(); if (t) { atender(t); setEscrita(""); } }}>
      <label className="sr-only" htmlFor="v360-orden">Orden escrita</label>
      <input id="v360-orden" type="text" value={escrita} onChange={e => setEscrita(e.target.value)} placeholder="O escríbelo: «pon tarima en la cocina»" autoComplete="off" />
      <button type="submit" className="btn btn-secondary" aria-label="Dar la orden" disabled={!escrita.trim()}><Send size={16} strokeWidth={1.8} aria-hidden="true" /></button>
    </form>

    {(oido || respuesta) && <div className="v360-dicho" aria-live="polite">{oido && <small>Has dicho: «{oido}»</small>}{respuesta && <strong>{respuesta}</strong>}</div>}

    <section className="pl-card v360-ticket" aria-label="Lo que va en cada estancia">
      {partidas.length === 0 && <p className="v360-ayuda" style={{ paddingTop: 14 }}>Todavía no hay nada. Toca la foto y elige del catálogo, o pulsa «Hablar» y di <code>«pon tarima en la cocina»</code>, <code>«pinta esta pared»</code>, <code>«pon dos puertas aquí»</code>, <code>«¿cuánto va?»</code> o <code>«pásalo al presupuesto»</code>. El suelo, las paredes y los muebles se marcan tocando sus esquinas en la foto.</p>}
      {zonas.filter(z => partidas.some(p => p.zona === z.nombre)).map(z => <div key={z.id} className="v360-grupo">
        <button type="button" className="v360-zona" onClick={() => setFotoId(z.id)} aria-pressed={z.id === foto.id}>{z.nombre}</button>
        {partidas.filter(p => p.zona === z.nombre).map(i => <div key={i.id} className="v360-linea">
          <span className="v360-linea-texto"><Muestra article={{ chapter: i.chapter, name: i.description }} /><span><strong>{i.description.replace(` · ${z.nombre}`, "")}</strong><small>{i.aproximada ? "≈ " : ""}{cifra(i.quantity)} {i.unit} × {money(i.unit_price)}{i.aproximada ? " · aproximado, revísalo" : ""}</small></span></span>
          <span className="pl-mono">{money(lineTotal(i))}</span>
          <button type="button" className="btn btn-icon" aria-label={`Quitar ${i.description}`} onClick={() => setColocaciones(prev => prev.filter(c => !(c.article_id === i.article_id && c.foto === z.id)))}><Trash2 size={16} strokeWidth={1.7} aria-hidden="true" /></button>
        </div>)}
      </div>)}
      {partidas.length > 0 && <div className="v360-total"><span><small>Total con IVA · {partidas.length} {partidas.length === 1 ? "partida" : "partidas"}</small></span><strong>{money(total.total)}</strong></div>}
      {partidas.length > 0 && <div className="v360-acciones">
        <Button variant="secondary" onClick={() => setColocaciones([])}>Vaciar</Button>
        {puede ? <Button variant="primary" data-accent="orange" disabled={guardando || busy} onClick={() => void incorporar()}>{guardando ? "Pasando…" : "Pasar al presupuesto"}</Button> : <span className="muted text-sm">Tu perfil puede mirar, pero no presupuestar.</span>}
      </div>}
      {partidas.length > 0 && <p className="v360-ayuda">Las superficies marcadas dan una medida aproximada (≈): supone la cámara a 1,5 m del suelo. Revísalas en el presupuesto antes de enviarlo.</p>}
    </section>

    <Modal open={Boolean(hoja)} onClose={() => setHoja(null)} title={hoja?.editar ? "Cambiar o quitar" : `¿Qué va aquí? · ${foto.nombre}`} footer={<>
      {hoja?.editar && <Button variant="secondary" onClick={() => { setColocaciones(prev => prev.filter(c => c.id !== hoja.editar!.id)); setHoja(null); }}>Quitar</Button>}
      {hoja?.editar && (() => { const c = hoja.editar, a = articulo(c.article_id), tipo = a && muestra(a).superficie; return a && tipo ? <Button variant="secondary" onClick={() => { setHoja(null); setMarcando({ article: a, quantity: c.aproximada ? null : c.quantity, origen: c.origen, foto: c.foto, tipo, puntos: [], huecos: [], hueco: null, editar: c.id }); }}>{c.superficie ? "Volver a marcar" : "Marcar en la foto"}</Button> : null; })()}
      <Button variant="secondary" onClick={() => setHoja(null)}>Cancelar</Button>
      <Button variant="primary" disabled={!elegido} onClick={confirmarHoja}>{hoja?.editar ? "Guardar" : elegidoSuperficie ? "Marcar en la foto" : "Poner aquí"}</Button>
    </>}>
      <div className="form" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="field"><span>Buscar en el catálogo</span><input type="search" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="tarima, pintura, puerta, azulejo…" autoFocus /></label>
        <div className="v360-lista" role="listbox" aria-label="Artículos del catálogo">
          {filtrados.slice(0, 40).map(a => <button key={a.id} type="button" role="option" aria-selected={a.id === articuloId} aria-pressed={a.id === articuloId} onClick={() => setArticuloId(a.id)}><span className="v360-linea-texto"><Muestra article={a} /><span>{a.name}</span></span><small>{money(a.unit_price)} / {a.unit}</small></button>)}
          {filtrados.length === 0 && <p className="muted text-sm" style={{ padding: 12, margin: 0 }}>Nada con ese nombre en el catálogo.</p>}
        </div>
        {elegido && <div className="v360-cantidad">
          <span className="muted text-sm">{elegido.name} · {money(elegido.unit_price)} por {elegido.unit}{elegidoSuperficie && elegido.unit === "m²" && !hoja?.editar ? ". Déjalo vacío y se mide al marcarlo." : ""}</span>
          <label className="field"><span>Cantidad · {elegido.unit}</span><input type="number" inputMode="decimal" min={0} step="0.5" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder={elegidoSuperficie && elegido.unit === "m²" ? "se mide" : String(cantidadPorDefecto(elegido.unit))} /></label>
        </div>}
      </div>
    </Modal>

    <Modal open={Boolean(nombrar)} onClose={() => setNombrar(null)} title="¿Qué estancia es?" footer={<>
      <Button variant="secondary" onClick={() => setNombrar(null)}>Cancelar</Button>
      <Button variant="primary" disabled={subiendo || !nombrar?.nombre.trim()} onClick={() => void subirFoto()}>{subiendo ? "Subiendo…" : "Subir la foto"}</Button>
    </>}>
      <div className="form" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label className="field"><span>Nombre de la estancia</span><input type="text" value={nombrar?.nombre ?? ""} onChange={e => setNombrar(n => n && { ...n, nombre: e.target.value })} placeholder="Cocina, Salón, Baño…" autoFocus /></label>
        <p className="muted text-sm" style={{ margin: 0 }}>Con este nombre se la puedes pedir por voz: «pon tarima en la cocina».</p>
      </div>
    </Modal>
  </div>;
}

/** Muestra del material: la textura si la hay, si no un color por oficio. */
function Muestra({ article }: { article: Pick<Article, "chapter" | "name"> }) {
  const m = muestra(article);
  return <i className="v360-muestra" aria-hidden="true" style={m.imagen ? { backgroundImage: `url(${m.imagen})` } : { background: m.color }} />;
}
