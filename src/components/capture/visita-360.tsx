"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, ImagePlus, Mic, MicOff, Ruler, Send, Sparkles, Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { useBanda } from "@/components/band";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { budgetHistory } from "@/lib/budget-history";
import { can, lineTotal, money, totals, type Article, type Project } from "@/lib/domain";
import { normalizar } from "@/lib/busqueda";
import {
  cantidadPorDefecto, claveVisita, describirOrden, esFoto360, interpretarOrden, muestra, panoramas, partidasDe, prefijo360, proporcion360, seAplicaATodo, soloPartida,
  type Colocacion, type Orden, type Panorama
} from "@/lib/visita360";
import { cantidadDesdeMedidas, describirMedidas, describirSuperficies, faltaPara, huecoPuerta, huecoVentana, interpretarMedidas, type Medidas } from "@/lib/medidas";
import type { Direccion, Visor360 } from "@/lib/visor360";
import { decir, escuchar, type Escucha } from "@/lib/voz";
import "@/styles/visita-360.css";

/** Dictado del navegador: cada frase final pasa por `interpretarMedidas` y, si no es de medidas, por `interpretarOrden`. */
const claveMedidas = (projectId: string) => `${claveVisita(projectId)}.medidas`;
function leerGuardadas(projectId: string): { colocaciones: Colocacion[]; medidas: Record<string, Medidas> } {
  try {
    const raw = localStorage.getItem(claveVisita(projectId)); const lista = raw ? JSON.parse(raw) : [];
    const rawM = localStorage.getItem(claveMedidas(projectId)); const medidas = rawM ? JSON.parse(rawM) : {};
    // Las marcas de versiones anteriores podían traer superficies detectadas en la foto: ya no se usan.
    const colocaciones = Array.isArray(lista) ? lista.map(({ zona: _z, superficie: _s, ...c }: Colocacion & { zona?: unknown; superficie?: unknown }) => ({ ...c, foto: c.foto ?? panoramas[0].id })) : [];
    return { colocaciones, medidas: medidas && typeof medidas === "object" ? medidas : {} };
  } catch { return { colocaciones: [], medidas: {} }; }
}
const cifra = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);
const nombreBonito = (archivo: string) => { const n = archivo.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim(); return n ? n[0].toUpperCase() + n.slice(1) : "Estancia"; };
const numero = (t: string) => { const n = parseFloat(t.replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : undefined; };
const entero = (t: string) => { const n = parseInt(t, 10); return Number.isFinite(n) && n >= 0 ? n : undefined; };
type FormMedidas = { foto: string; largo: string; ancho: string; alto: string; puertas: string; ventanas: string };
type Simulacion = { estado: "cargando" | "lista" | "error"; original: string; imagen?: string; error?: string; estancia: string; materiales: string[] };

/** Muestra del catálogo reducida a 512 px, como referencia del material para la IA. */
async function referenciaDe(url: string): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());
    const escala = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height)), lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bitmap.width * escala); lienzo.height = Math.round(bitmap.height * escala);
    lienzo.getContext("2d")!.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height); bitmap.close();
    return lienzo.toDataURL("image/jpeg", 0.85);
  } catch { return null; }
}

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
  const nombreDe = useCallback((id: string) => zonas.find(z => z.id === id)?.nombre ?? "la estancia", [zonas]);

  // Lo guardado en el navegador se lee después del primer pintado: el servidor no lo conoce y así no hay desajuste al hidratar.
  const [colocaciones, setColocaciones] = useState<Colocacion[]>([]);
  const [medidas, setMedidas] = useState<Record<string, Medidas>>({});
  const leidas = useRef(false), leidasM = useRef(false);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState("");
  const [escuchando, setEscuchando] = useState(false);
  const [oido, setOido] = useState("");
  const [enVivo, setEnVivo] = useState("");
  const [respuesta, setRespuesta] = useState("");
  const [, setTick] = useState(0);
  const [hoja, setHoja] = useState<{ direccion: Direccion; editar?: Colocacion } | null>(null);
  const [hojaMedidas, setHojaMedidas] = useState<FormMedidas | null>(null);
  const [buscar, setBuscar] = useState("");
  const [articuloId, setArticuloId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [nueva, setNueva] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [escrita, setEscrita] = useState("");
  const [nombrar, setNombrar] = useState<{ file: File; nombre: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [sim, setSim] = useState<Simulacion | null>(null);
  const [verAntes, setVerAntes] = useState(false);

  const escenario = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const visor = useRef<Visor360 | null>(null);
  const rec = useRef<Escucha | null>(null);
  const colocacionesRef = useRef(colocaciones); colocacionesRef.current = colocaciones;
  const medidasRef = useRef(medidas); medidasRef.current = medidas;
  const fotoRef = useRef(foto); fotoRef.current = foto;

  useEffect(() => { const g = leerGuardadas(project.id); setColocaciones(g.colocaciones); setMedidas(g.medidas); }, [project.id]);
  // La primera vez las listas aún están vacías (no se han leído): no se guardan para no borrar lo que había.
  useEffect(() => { if (!leidas.current) { leidas.current = true; return; } try { localStorage.setItem(claveVisita(project.id), JSON.stringify(colocaciones)); } catch { /* sin almacenamiento */ } }, [colocaciones, project.id]);
  useEffect(() => { if (!leidasM.current) { leidasM.current = true; return; } try { localStorage.setItem(claveMedidas(project.id), JSON.stringify(medidas)); } catch { /* sin almacenamiento */ } }, [medidas, project.id]);

  // El visor se crea una vez; tocar la foto pregunta qué va ahí.
  useEffect(() => {
    const el = escenario.current; if (!el) return;
    let vivo = true, instancia: Visor360 | null = null;
    import("@/lib/visor360").then(({ crearVisor360 }) => {
      if (!vivo) return;
      instancia = crearVisor360(el, fotoRef.current.url, {
        alTocar: d => abrirHoja(d),
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
    urlCargada.current = foto.url; setCargando(true);
    void visor.current.cambiarFoto(foto.url).catch(() => setFallo("No se ha podido cargar la foto 360."));
  }, [foto.url]);

  const articulos = useMemo(() => [...data.articles].sort((a, b) => a.chapter.localeCompare(b.chapter, "es") || a.name.localeCompare(b.name, "es")), [data.articles]);
  const articulo = useCallback((id: string) => data.articles.find(a => a.id === id), [data.articles]);
  const partidas = useMemo(() => partidasDe(colocaciones, data.articles, zonas), [colocaciones, data.articles, zonas]);
  const total = totals(partidas.map(soloPartida));
  const enEstaFoto = colocaciones.filter(c => c.foto === foto.id);

  /** Guarda las medidas de una estancia y recalcula lo que dependía de ellas (y lo que estaba sin medir). */
  const aplicarMedidas = useCallback((fotoDestino: string, nuevas: Medidas, reemplazar = false): Medidas => {
    const combinadas = reemplazar ? nuevas : { ...medidasRef.current[fotoDestino], ...nuevas };
    setMedidas(prev => ({ ...prev, [fotoDestino]: combinadas }));
    setColocaciones(prev => prev.map(c => {
      if (c.foto !== fotoDestino || !(c.deMedidas || c.aproximada)) return c;
      const art = data.articles.find(a => a.id === c.article_id); const q = art ? cantidadDesdeMedidas(art, combinadas) : null;
      return q === null ? c : { ...c, quantity: q, deMedidas: true, aproximada: false };
    }));
    return combinadas;
  }, [data.articles]);

  const colocar = useCallback((article: Article, quantity: number, d: Direccion, origen: Colocacion["origen"], aproximada: boolean, fotoDestino: string, deMedidas = false) => {
    // Si ya hay una marca en ese punto, la nueva baja un poco para que no se tapen.
    const cerca = colocacionesRef.current.filter(c => c.foto === fotoDestino && Math.abs(c.yaw - d.yaw) < 0.12 && Math.abs(c.pitch - d.pitch) < 0.12).length;
    const c: Colocacion = { id: crypto.randomUUID(), article_id: article.id, quantity, yaw: d.yaw, pitch: d.pitch - cerca * 0.13, origen, aproximada, foto: fotoDestino, deMedidas };
    setColocaciones(prev => [...prev, c]); setNueva(c.id); setTimeout(() => setNueva(""), 2500);
    return c;
  }, []);

  /**
   * Pone un artículo en una estancia. La cantidad dicha manda; si no se dijo y el artículo va por superficie (suelo, paredes, techo),
   * sale de las medidas de la estancia. Si faltan medidas, se pone una cantidad provisional y se pide medir.
   */
  const poner = useCallback((article: Article, quantity: number | null, tocado: Direccion | null, origen: Colocacion["origen"], fotoDestino: string): string => {
    const donde = tocado ?? visor.current?.centro() ?? { yaw: 0, pitch: 0 }, nombre = nombreDe(fotoDestino);
    if (quantity !== null) { colocar(article, quantity, donde, origen, false, fotoDestino); return `${article.name} · ${nombre}: ${cifra(quantity)} ${article.unit}, ${money(article.unit_price * quantity)} sin IVA`; }
    const m = medidasRef.current[fotoDestino], q = cantidadDesdeMedidas(article, m);
    if (q !== null) { colocar(article, q, donde, origen, false, fotoDestino, true); return `${article.name} · ${nombre}: ${cifra(q)} ${article.unit} con sus medidas, ${money(article.unit_price * q)} sin IVA`; }
    colocar(article, cantidadPorDefecto(article.unit), donde, origen, true, fotoDestino);
    if (article.unit === "m²" && seAplicaATodo(article)) return `${article.name} · ${nombre}. Falta ${faltaPara(article, m) ?? "medir"}: di las medidas, por ejemplo «mide 4 por 3 y 2,6 de alto», o pulsa «Medidas».`;
    return `${article.name} · ${nombre}: ${cifra(cantidadPorDefecto(article.unit))} ${article.unit}, provisional. Corrígelo si hace falta.`;
  }, [colocar, nombreDe]);

  /**
   * Simula la vista que se está mirando con los materiales de suelo, paredes y techo puestos en esta estancia (Gemini, de pago por imagen).
   * Es orientativa: la IA puede cambiar detalles y no mide.
   */
  const simular = useCallback(async () => {
    const f = fotoRef.current;
    const vistos = new Set<string>(), materiales: { nombre: string; superficie: "suelo" | "pared" | "techo"; imagen?: string }[] = [];
    for (const c of colocacionesRef.current) {
      if (c.foto !== f.id || vistos.has(c.article_id)) continue;
      const art = data.articles.find(a => a.id === c.article_id), m = art && muestra(art);
      if (!art || !m?.superficie) continue;
      vistos.add(art.id); materiales.push({ nombre: art.name, superficie: m.superficie, imagen: m.imagen });
    }
    if (!materiales.length) { const t = `Para simular, pon antes en ${f.nombre.toLocaleLowerCase()} un material de suelo, paredes o techo.`; setRespuesta(t); decir(t); return; }
    const original = visor.current?.captura(1280);
    if (!original) { notify("No se ha podido capturar la vista."); return; }
    setVerAntes(false);
    setSim({ estado: "cargando", original, estancia: f.nombre, materiales: materiales.map(m => m.nombre) });
    const referencias = (await Promise.all(materiales.filter(m => m.imagen).slice(0, 3).map(async m => ({ nombre: m.nombre, imagen: await referenciaDe(m.imagen!) }))))
      .filter((r): r is { nombre: string; imagen: string } => Boolean(r.imagen));
    try {
      const respuesta = await fetch("/api/simulacion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imagen: original, estancia: f.nombre.toLocaleLowerCase(), materiales: materiales.slice(0, 6).map(({ nombre, superficie }) => ({ nombre, superficie })), referencias }) });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok || !datos.imagen) throw new Error(datos.error || "No se ha podido hacer la simulación.");
      setSim(s => s && s.original === original ? { ...s, estado: "lista", imagen: datos.imagen } : s);
    } catch (e) {
      setSim(s => s && s.original === original ? { ...s, estado: "error", error: e instanceof Error ? e.message : "No se ha podido hacer la simulación." } : s);
    }
  }, [data.articles, notify]);

  async function guardarSimulacion() {
    if (!sim?.imagen || subiendo) return;
    setSubiendo(true);
    try {
      const blob = await (await fetch(sim.imagen)).blob(), fecha = new Date().toLocaleDateString("es-ES").replace(/\//g, "-");
      await upload(new File([blob], `Simulación IA · ${sim.estancia} · ${fecha}.jpg`, { type: blob.type || "image/jpeg" }), project.id, "other");
      notify("Simulación guardada en los documentos del proyecto");
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido guardar la simulación."); }
    finally { setSubiendo(false); }
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

  // Cada frase final se interpreta: primero si son medidas («la cocina mide 4 por 3»); si no, una orden. La estancia dicha manda.
  const atender = useCallback((frase: string) => {
    setOido(frase);
    const med = interpretarMedidas(frase, zonas);
    if (med) {
      const destino = med.zona?.id ?? fotoRef.current.id;
      if (destino !== fotoRef.current.id) setFotoId(destino);
      const m = aplicarMedidas(destino, med.medidas), sup = describirSuperficies(m);
      const texto = `${nombreDe(destino)}: ${describirMedidas(m)}.${sup ? ` ${sup}.` : ""}${!m.alto ? " Falta la altura para las paredes." : ""}`;
      setRespuesta(texto); decir(texto); return;
    }
    const orden: Orden | null = interpretarOrden(frase, data.articles, zonas);
    if (!orden) { setRespuesta("No lo he entendido. Prueba «la cocina mide 4 por 3 y 2,6 de alto», «pon tarima en la cocina» o «¿cuánto va?»."); return; }
    const destino = "zona" in orden && orden.zona ? orden.zona.id : fotoRef.current.id;
    if (destino !== fotoRef.current.id) setFotoId(destino);
    let texto = describirOrden(orden, totals(partidasDe(colocacionesRef.current, data.articles, zonas).map(soloPartida)).total);
    if (orden.tipo === "añadir") texto = poner(orden.article, orden.quantity, null, "voz", destino);
    else if (orden.tipo === "quitar") {
      const ultima = [...colocacionesRef.current].reverse().find(c => c.article_id === orden.article.id && (!orden.zona || c.foto === orden.zona.id));
      if (!ultima) texto = `No había ${orden.article.name.toLocaleLowerCase()}`; else setColocaciones(prev => prev.filter(c => c.id !== ultima.id));
    }
    else if (orden.tipo === "deshacer") { if (!colocacionesRef.current.length) texto = "No hay nada que deshacer"; else setColocaciones(prev => prev.slice(0, -1)); }
    else if (orden.tipo === "cambiar") setFotoId(orden.zona.id);
    else if (orden.tipo === "simular") {
      if (orden.zona && orden.zona.id !== fotoRef.current.id) { setFotoId(orden.zona.id); texto = `Te llevo a ${orden.zona.nombre.toLocaleLowerCase()}. Cuando se vea, di «simula».`; }
      else { void simular(); return; }
    }
    else if (orden.tipo === "incorporar") void incorporar();
    setRespuesta(texto); decir(texto);
  }, [data.articles, zonas, poner, incorporar, aplicarMedidas, nombreDe, simular]);

  // La escucha dura lo que el micrófono esté abierto: siempre con la versión al día de `atender`.
  const atenderRef = useRef(atender); atenderRef.current = atender;
  async function alternarVoz() {
    if (escuchando) { rec.current?.parar(); rec.current = null; setEscuchando(false); setEnVivo(""); return; }
    setEnVivo("");
    const r = await escuchar({ alOir: t => atenderRef.current(t), alParcial: setEnVivo, alTerminar: () => { setEscuchando(false); setEnVivo(""); rec.current = null; }, alError: notify });
    if (!r) { notify("Este navegador no tiene dictado. Usa Chrome, Edge o Safari, o escribe la orden."); return; }
    rec.current = r; setEscuchando(true);
    const micro = r.continuidad && r.microfono ? `Micrófono: ${r.microfono}. ` : "";
    setRespuesta(`${micro}Te escucho. Di las medidas o qué va: «la cocina mide 4 por 3 y 2,6 de alto», «pon tarima en la cocina».`);
  }
  useEffect(() => () => rec.current?.parar(), []);

  // Hoja: qué va aquí.
  function abrirHoja(d: Direccion, editar?: Colocacion) { setHoja({ direccion: d, editar }); setBuscar(""); setArticuloId(editar?.article_id ?? ""); setCantidad(editar ? String(editar.quantity) : ""); }
  const elegido = articuloId ? articulo(articuloId) : undefined;
  const filtrados = buscar ? articulos.filter(a => normalizar(a.name + " " + a.chapter).includes(normalizar(buscar))) : articulos;
  const deMedidasElegido = elegido ? cantidadDesdeMedidas(elegido, medidas[foto.id]) : null;
  function confirmarHoja() {
    if (!hoja || !elegido) return;
    const dicha = numero(cantidad) ?? null;
    if (hoja.editar) { setColocaciones(prev => prev.map(c => c.id === hoja.editar!.id ? { ...c, article_id: elegido.id, quantity: dicha ?? c.quantity, aproximada: dicha === null ? c.aproximada : false, deMedidas: dicha === null ? c.deMedidas : false } : c)); setHoja(null); return; }
    const d = hoja.direccion; setHoja(null);
    setRespuesta(poner(elegido, dicha, d, "toque", foto.id));
  }

  // Hoja de medidas de una estancia.
  function abrirMedidas(id: string) {
    const m = medidas[id] ?? {}, t = (n?: number) => (n === undefined ? "" : String(n).replace(".", ","));
    setHojaMedidas({ foto: id, largo: t(m.largo), ancho: t(m.ancho), alto: t(m.alto), puertas: t(m.puertas), ventanas: t(m.ventanas) });
  }
  const medidasForm: Medidas | null = hojaMedidas && { largo: numero(hojaMedidas.largo), ancho: numero(hojaMedidas.ancho), alto: numero(hojaMedidas.alto), puertas: entero(hojaMedidas.puertas), ventanas: entero(hojaMedidas.ventanas) };
  function guardarMedidas() {
    if (!hojaMedidas || !medidasForm) return;
    const limpias = Object.fromEntries(Object.entries(medidasForm).filter(([, v]) => v !== undefined)) as Medidas;
    const m = aplicarMedidas(hojaMedidas.foto, limpias, true), sup = describirSuperficies(m);
    setRespuesta(`${nombreDe(hojaMedidas.foto)}: ${describirMedidas(m) || "sin medidas"}.${sup ? ` ${sup}.` : ""}`);
    setHojaMedidas(null);
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
  const medidasFoto = medidas[foto.id], resumenFoto = medidasFoto ? describirMedidas(medidasFoto) : "";

  return <div className="page v360">
    <header className="v360-head">
      <div>
        <Link prefetch={false} href={salida} className="flow-back solo-escritorio"><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" /><span>{project.name}</span></Link>
        <h1>Visita 360 · {foto.nombre}</h1>
        <p>{foto.nota}. Di o toca qué va y cuánto mide la estancia: Plano calcula suelo, paredes y techo.</p>
      </div>
      <div className="v360-fotos" role="group" aria-label="Estancia">
        {fotos.map(p => { const n = colocaciones.filter(c => c.foto === p.id).length; return <button key={p.id} type="button" aria-pressed={p.id === foto.id} onClick={() => setFotoId(p.id)}>{p.nombre}{n > 0 && <span className="v360-cuenta">{n}</span>}</button>; })}
        {puedeSubir && <>
          <button type="button" className="v360-subir" onClick={() => entrada.current?.click()} disabled={subiendo}><ImagePlus size={16} strokeWidth={1.7} aria-hidden="true" />Subir foto 360</button>
          <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void elegirArchivo(f); }} aria-label="Elegir una foto 360" />
        </>}
      </div>
    </header>

    <div className="v360-stage" ref={escenario}>
      {cargando && !fallo && <div className="v360-loading">Cargando la foto 360…</div>}
      {fallo && <div className="v360-loading">{fallo}</div>}
      {!cargando && !fallo && <span className="v360-crosshair" aria-hidden="true" />}
      {pines.filter(x => x.p.visible && x.a).map(({ c, p, a }) => (
        <button key={c.id} type="button" className="v360-pin" data-nueva={c.id === nueva || undefined} style={{ left: p.x, top: p.y }} onClick={() => abrirHoja(c, c)} aria-label={`${a!.name}, ${c.quantity} ${a!.unit}. Cambiar o quitar`}>
          <span><Muestra article={a!} />{a!.name.split(" ").slice(0, 3).join(" ")} · {c.aproximada ? "≈" : ""}{cifra(c.quantity)} {a!.unit}</span><i />
        </button>
      ))}
      <div className="v360-tools">
        {escuchando ? <span className="v360-escuchando" aria-live="polite"><i />{enVivo || "Escuchando…"}</span> : <button type="button" className="v360-simular" onClick={() => void simular()} disabled={cargando || Boolean(fallo) || sim?.estado === "cargando"}><Sparkles size={16} strokeWidth={1.7} aria-hidden="true" />Simular</button>}
        <button type="button" className="v360-mic" aria-pressed={escuchando} onClick={alternarVoz} aria-label={escuchando ? "Parar de escuchar" : "Hablar"}>{escuchando ? <MicOff size={20} strokeWidth={1.8} aria-hidden="true" /> : <Mic size={20} strokeWidth={1.8} aria-hidden="true" />}<span>{escuchando ? "Parar" : "Hablar"}</span></button>
      </div>
    </div>

    <div className="v360-medidas" data-sin={!resumenFoto || undefined}>
      <Ruler size={18} strokeWidth={1.6} aria-hidden="true" />
      <p>{resumenFoto
        ? <><strong>{foto.nombre}</strong> · {resumenFoto}<small>{describirSuperficies(medidasFoto!)}</small></>
        : <><strong>{foto.nombre} sin medir.</strong><small>Mide con el láser y di «mide 4 por 3 y 2,6 de alto», o pulsa «Medidas».</small></>}</p>
      <Button variant="secondary" onClick={() => abrirMedidas(foto.id)}>{resumenFoto ? "Cambiar" : "Medidas"}</Button>
    </div>

    <form className="v360-escribir" onSubmit={e => { e.preventDefault(); const t = escrita.trim(); if (t) { atender(t); setEscrita(""); } }}>
      <label className="sr-only" htmlFor="v360-orden">Orden escrita</label>
      <input id="v360-orden" type="text" value={escrita} onChange={e => setEscrita(e.target.value)} placeholder="O escríbelo: «pon tarima en la cocina»" autoComplete="off" />
      <button type="submit" className="btn btn-secondary" aria-label="Dar la orden" disabled={!escrita.trim()}><Send size={16} strokeWidth={1.8} aria-hidden="true" /></button>
    </form>

    {(oido || respuesta) && <div className="v360-dicho" aria-live="polite">{oido && <small>Has dicho: «{oido}»</small>}{respuesta && <strong>{respuesta}</strong>}</div>}

    <section className="pl-card v360-ticket" aria-label="Lo que va en cada estancia">
      {partidas.length === 0 && <p className="v360-ayuda" style={{ paddingTop: 14 }}>Todavía no hay nada. Pulsa «Hablar» y di <code>«la cocina mide 4 por 3 y 2,6 de alto»</code>, <code>«pon tarima en la cocina»</code>, <code>«pinta las paredes»</code>, <code>«pon dos puertas»</code>, <code>«¿cuánto va?»</code> o <code>«pásalo al presupuesto»</code>; o toca la foto y elige del catálogo.</p>}
      {zonas.filter(z => partidas.some(p => p.zona === z.nombre)).map(z => <div key={z.id} className="v360-grupo">
        <div className="v360-grupo-cabeza">
          <button type="button" className="v360-zona" onClick={() => setFotoId(z.id)} aria-pressed={z.id === foto.id}>{z.nombre}</button>
          <button type="button" className="v360-zona-medidas" onClick={() => abrirMedidas(z.id)}>{medidas[z.id] && describirMedidas(medidas[z.id]) ? describirMedidas(medidas[z.id]) : "Añadir medidas"}</button>
        </div>
        {partidas.filter(p => p.zona === z.nombre).map(i => <div key={i.id} className="v360-linea">
          <span className="v360-linea-texto"><Muestra article={{ chapter: i.chapter, name: i.description }} /><span><strong>{i.description.replace(` · ${z.nombre}`, "")}</strong><small>{i.aproximada ? "≈ " : ""}{cifra(i.quantity)} {i.unit} × {money(i.unit_price)}{i.aproximada ? " · provisional, falta medir" : ""}</small></span></span>
          <span className="pl-mono">{money(lineTotal(i))}</span>
          <button type="button" className="btn btn-icon" aria-label={`Quitar ${i.description}`} onClick={() => setColocaciones(prev => prev.filter(c => !(c.article_id === i.article_id && c.foto === z.id)))}><Trash2 size={16} strokeWidth={1.7} aria-hidden="true" /></button>
        </div>)}
      </div>)}
      {partidas.length > 0 && <div className="v360-total"><span><small>Total con IVA · {partidas.length} {partidas.length === 1 ? "partida" : "partidas"}</small></span><strong>{money(total.total)}</strong></div>}
      {partidas.length > 0 && <div className="v360-acciones">
        <Button variant="secondary" onClick={() => setColocaciones([])}>Vaciar</Button>
        {puede ? <Button variant="primary" data-accent="orange" disabled={guardando || busy} onClick={() => void incorporar()}>{guardando ? "Pasando…" : "Pasar al presupuesto"}</Button> : <span className="muted text-sm">Tu perfil puede mirar, pero no presupuestar.</span>}
      </div>}
      {partidas.length > 0 && <p className="v360-ayuda">Suelo, paredes y techo salen de las medidas de cada estancia; a las paredes se les quitan {cifra(huecoPuerta)} m² por puerta y {cifra(huecoVentana)} m² por ventana. Las marcadas con ≈ son provisionales hasta medir.</p>}
    </section>

    <Modal open={Boolean(hoja)} onClose={() => setHoja(null)} title={hoja?.editar ? "Cambiar o quitar" : `¿Qué va aquí? · ${foto.nombre}`} footer={<>
      {hoja?.editar && <Button variant="secondary" onClick={() => { setColocaciones(prev => prev.filter(c => c.id !== hoja.editar!.id)); setHoja(null); }}>Quitar</Button>}
      <Button variant="secondary" onClick={() => setHoja(null)}>Cancelar</Button>
      <Button variant="primary" disabled={!elegido} onClick={confirmarHoja}>{hoja?.editar ? "Guardar" : "Poner aquí"}</Button>
    </>}>
      <div className="form" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="field"><span>Buscar en el catálogo</span><input type="search" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="tarima, pintura, puerta, azulejo…" autoFocus /></label>
        <div className="v360-lista" role="listbox" aria-label="Artículos del catálogo">
          {filtrados.slice(0, 40).map(a => <button key={a.id} type="button" role="option" aria-selected={a.id === articuloId} aria-pressed={a.id === articuloId} onClick={() => setArticuloId(a.id)}><span className="v360-linea-texto"><Muestra article={a} /><span>{a.name}</span></span><small>{money(a.unit_price)} / {a.unit}</small></button>)}
          {filtrados.length === 0 && <p className="muted text-sm" style={{ padding: 12, margin: 0 }}>Nada con ese nombre en el catálogo.</p>}
        </div>
        {elegido && <div className="v360-cantidad">
          <span className="muted text-sm">{elegido.name} · {money(elegido.unit_price)} por {elegido.unit}{!hoja?.editar && deMedidasElegido !== null ? `. Déjalo vacío: con las medidas de ${foto.nombre.toLocaleLowerCase()} son ${cifra(deMedidasElegido)} ${elegido.unit}.` : !hoja?.editar && elegido.unit === "m²" && seAplicaATodo(elegido) ? `. Déjalo vacío y añade las medidas de ${foto.nombre.toLocaleLowerCase()}.` : ""}</span>
          <label className="field"><span>Cantidad · {elegido.unit}</span><input type="number" inputMode="decimal" min={0} step="0.5" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder={deMedidasElegido !== null ? cifra(deMedidasElegido) : String(cantidadPorDefecto(elegido.unit))} /></label>
        </div>}
      </div>
    </Modal>

    <Modal open={Boolean(hojaMedidas)} onClose={() => setHojaMedidas(null)} title={`Medidas · ${hojaMedidas ? nombreDe(hojaMedidas.foto) : ""}`} footer={<>
      <Button variant="secondary" onClick={() => setHojaMedidas(null)}>Cancelar</Button>
      <Button variant="primary" onClick={guardarMedidas}>Guardar</Button>
    </>}>
      {hojaMedidas && <div className="form v360-form-medidas">
        <p className="muted text-sm" style={{ margin: 0 }}>Toma las medidas con el láser. Si la estancia no es rectangular, pon el largo y el ancho que den su superficie de suelo.</p>
        <div className="v360-campos">
          {([["largo", "Largo · m"], ["ancho", "Ancho · m"], ["alto", "Alto · m"]] as const).map(([k, etiqueta]) => <label key={k} className="field"><span>{etiqueta}</span><input type="text" inputMode="decimal" value={hojaMedidas[k]} onChange={e => setHojaMedidas(f => f && { ...f, [k]: e.target.value })} placeholder="0,00" /></label>)}
          {([["puertas", "Puertas"], ["ventanas", "Ventanas"]] as const).map(([k, etiqueta]) => <label key={k} className="field"><span>{etiqueta}</span><input type="number" inputMode="numeric" min={0} step={1} value={hojaMedidas[k]} onChange={e => setHojaMedidas(f => f && { ...f, [k]: e.target.value })} placeholder="0" /></label>)}
        </div>
        <p className="v360-resultado" aria-live="polite">{medidasForm && describirSuperficies(medidasForm) ? describirSuperficies(medidasForm) : "Con el largo y el ancho sale el suelo; con el alto, las paredes."}</p>
      </div>}
    </Modal>

    <Modal open={Boolean(sim)} onClose={() => setSim(null)} size="wide" kicker="Simulación orientativa con IA" title={sim ? `Así podría quedar · ${sim.estancia}` : ""} footer={sim && <>
      {sim.estado === "lista" && <a className="btn btn-secondary" href={sim.imagen} download={`Simulación · ${sim.estancia}.jpg`}><Download size={15} strokeWidth={1.7} aria-hidden="true" />Descargar</a>}
      {sim.estado === "lista" && puedeSubir && <Button variant="secondary" disabled={subiendo} onClick={() => void guardarSimulacion()}>{subiendo ? "Guardando…" : "Guardar en el proyecto"}</Button>}
      {sim.estado === "error" && <Button variant="secondary" onClick={() => { setSim(null); void simular(); }}>Reintentar</Button>}
      <Button variant="primary" onClick={() => setSim(null)}>Cerrar</Button>
    </>}>
      {sim && <div className="v360-sim">
        {sim.estado === "lista" && <div className="pl-seg" role="group" aria-label="Qué ver"><button type="button" aria-pressed={!verAntes} onClick={() => setVerAntes(false)}>Después</button><button type="button" aria-pressed={verAntes} onClick={() => setVerAntes(true)}>Antes</button></div>}
        <div className="v360-sim-imagen" data-cargando={sim.estado === "cargando" || undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sim.estado === "lista" && !verAntes ? sim.imagen : sim.original} alt={sim.estado === "lista" && !verAntes ? `Simulación de ${sim.estancia} con ${sim.materiales.join(", ")}` : `Vista actual de ${sim.estancia}`} />
          {sim.estado === "cargando" && <span role="status"><Sparkles size={18} strokeWidth={1.7} aria-hidden="true" />Simulando… suele tardar entre 10 y 20 segundos</span>}
        </div>
        {sim.estado === "error" && <p className="v360-sim-error" role="alert">{sim.error}</p>}
        <p className="muted text-sm" style={{ margin: 0 }}>Con {sim.materiales.join(", ")}. Es una imagen hecha con IA (Gemini) para hacerse una idea: puede cambiar detalles y no sirve para medir. El presupuesto sale del catálogo y de las medidas.</p>
      </div>}
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
