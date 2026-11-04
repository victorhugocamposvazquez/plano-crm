"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ImagePlus, Mic, MicOff, Send, Trash2, Undo2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { useBanda } from "@/components/band";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { budgetHistory } from "@/lib/budget-history";
import { can, lineTotal, money, totals, type Article, type Project } from "@/lib/domain";
import { normalizar } from "@/lib/busqueda";
import {
  cantidadPorDefecto, claveVisita, describirOrden, esFoto360, interpretarOrden, muestra, panoramas, partidasDe, prefijo360, proporcion360, seAplicaATodo, soloPartida,
  type Colocacion, type Orden, type Panorama, type TipoSuperficie
} from "@/lib/visita360";
import {
  alturaTechoEstimada, areaMascara, ceñir, centroMascara, columnasPared, comprimir, descomprimir, detectar, estimarLimites, pixelDe, prepararLab, regionDesde, retocar, segmentar, tipos, type TipoAuto
} from "@/lib/autodeteccion";
import type { Direccion, Visor360 } from "@/lib/visor360";
import type { Embedding, Sam } from "@/lib/sam";
import type { Vista } from "@/lib/vistas360";
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
    // Las marcas de versiones anteriores no sabían de qué foto eran ni traían zona detectada.
    return Array.isArray(lista) ? lista.map((c: Colocacion) => ({ ...c, foto: c.foto ?? panoramas[0].id, superficie: undefined })) : [];
  } catch { return []; }
}
const cifra = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);
const nombreBonito = (archivo: string) => { const n = archivo.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim(); return n ? n[0].toUpperCase() + n.slice(1) : "Estancia"; };
const nombreSuperficie: Record<TipoSuperficie, string> = { suelo: "el suelo", pared: "las paredes", techo: "el techo" };

/** Lo que se sabe de una foto tras analizarla: imagen en Lab, segmentación, encuentros con suelo y techo y altura del techo. */
type Analisis = {
  L: Float32Array; seg: Uint8Array; w: number; h: number; alturaTecho: number; columnas: Float32Array; suelo: Uint8Array;
  limites: { suelo: Int16Array; techo: Int16Array };
  /** Si SAM ha podido afinar la foto: el modelo y las seis vistas codificadas, para recortar lo que se toque. */
  sam?: { modelo: Sam; vistas: { vista: Vista; emb: Embedding }[] };
};
const ANCHO = 1024, ALTO = 512;

/** SAM se descarga una vez (unos 80 MB, luego queda en caché) y se usa en todas las fotos; si no se puede, se sigue con la detección por color. */
let samPromesa: Promise<Sam | null> | null = null;
function prepararSam(alProgreso: (f: number) => void): Promise<Sam | null> {
  samPromesa ??= import("@/lib/sam").then(m => m.cargarSam(alProgreso)).catch(() => null);
  return samPromesa;
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

  // Lo guardado en el navegador se lee después del primer pintado: el servidor no lo conoce y así no hay desajuste al hidratar.
  const [colocaciones, setColocaciones] = useState<Colocacion[]>([]);
  const leidas = useRef(false);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState("");
  // Cómo se ha analizado cada foto («sam» o «color») y cuánto ha tardado: queda en la escena para revisarlo y para las pruebas.
  const [metodo, setMetodo] = useState<Record<string, string>>({});
  const descargaSam = useRef(0);
  const enCurso = useRef(new Map<string, Promise<Analisis | null>>());
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
  const [retoque, setRetoqueEstado] = useState<string | null>(null);
  // Lo que había antes de cada toque de retoque, para deshacerlo si el toque cae donde no era.
  const [deshacer, setDeshacer] = useState<{ mascara: string; quantity: number }[]>([]);
  const setRetoque = useCallback((id: string | null) => { setRetoqueEstado(id); setDeshacer([]); }, []);
  const [nombrar, setNombrar] = useState<{ file: File; nombre: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const escenario = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const visor = useRef<Visor360 | null>(null);
  const rec = useRef<Recognition | null>(null);
  const analisis = useRef(new Map<string, Analisis>());
  const fotoCargada = useRef<string | null>(null);
  const colocacionesRef = useRef(colocaciones); colocacionesRef.current = colocaciones;
  const retoqueRef = useRef(retoque); retoqueRef.current = retoque;
  const fotoRef = useRef(foto); fotoRef.current = foto;

  useEffect(() => { setColocaciones(leerGuardadas(project.id)); }, [project.id]);
  // La primera vez la lista aún está vacía (no se ha leído): no se guarda para no borrar lo que había.
  useEffect(() => { if (!leidas.current) { leidas.current = true; return; } try { localStorage.setItem(claveVisita(project.id), JSON.stringify(colocaciones)); } catch { /* sin almacenamiento */ } }, [colocaciones, project.id]);

  // El visor se crea una vez; tocar la foto corrige la zona si se está retocando y, si no, pregunta qué va ahí.
  useEffect(() => {
    const el = escenario.current; if (!el) return;
    let vivo = true, instancia: Visor360 | null = null;
    import("@/lib/visor360").then(({ crearVisor360 }) => {
      if (!vivo) return;
      instancia = crearVisor360(el, fotoRef.current.url, {
        alTocar: d => { if (retoqueRef.current) void tocarRetoque(d); else abrirHoja(d); },
        alMover: () => setTick(t => t + 1),
        alCargar: () => { fotoCargada.current = fotoRef.current.id; setCargando(false); setFallo(""); },
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
    urlCargada.current = foto.url; fotoCargada.current = null; setCargando(true); setRetoque(null);
    void visor.current.cambiarFoto(foto.url).catch(() => setFallo("No se ha podido cargar la foto 360."));
  }, [foto.url]);

  // SAM empieza a descargarse en cuanto se abre la visita, para que esté listo cuando se pida algo.
  useEffect(() => { void prepararSam(f => { descargaSam.current = f; }); }, []);

  /**
   * Analiza la foto de una estancia (una vez): espera a que esté cargada en el visor, la segmenta por color y, si SAM está disponible,
   * afina la segmentación con SAM (seis vistas; unos segundos con tarjeta gráfica). Si SAM falla, se queda la segmentación por color.
   */
  const analizar = useCallback(async (id: string): Promise<Analisis | null> => {
    const hecho = analisis.current.get(id); if (hecho) return hecho;
    const pendiente = enCurso.current.get(id); if (pendiente) return pendiente;
    const trabajo = (async (): Promise<Analisis | null> => {
      for (let i = 0; i < 150 && (fotoCargada.current !== id || !visor.current); i++) await new Promise(r => setTimeout(r, 100));
      const img = visor.current?.pixeles(ANCHO, ALTO), grande = visor.current?.pixeles(ANCHO * 2, ALTO * 2); if (!img) return null;
      setAviso("Analizando la foto…"); const inicio = performance.now();
      await new Promise(r => setTimeout(r, 30)); // deja pintar el aviso
      try {
        const L = prepararLab({ data: img.data, w: ANCHO, h: ALTO }), color = segmentar(L, ANCHO, ALTO), limites = estimarLimites(L, ANCHO, ALTO);
        let seg = color, sam: Analisis["sam"];
        const espera = setInterval(() => { if (descargaSam.current < 1) setAviso(`Preparando la detección precisa · ${Math.round(descargaSam.current * 100)} %`); }, 300);
        const modelo = await prepararSam(f => { descargaSam.current = f; });
        clearInterval(espera);
        if (modelo && grande) {
          try {
            const { codificarPanoramica, afinarConSam } = await import("@/lib/sam360");
            const vistas = await codificarPanoramica(modelo, { data: grande.data, w: grande.width, h: grande.height }, (k, n) => setAviso(`Analizando la foto · ${Math.round((k / n) * 30)} %`));
            const afinada = await afinarConSam(modelo, vistas, color, ANCHO, ALTO, (k, n) => setAviso(`Analizando la foto · ${30 + Math.round((k / n) * 70)} %`));
            // Si SAM apenas reconoce nada (foto rara), mejor la detección por color.
            let n = 0; for (let i = 0; i < afinada.length; i++) if (afinada[i]) n++;
            if (n > afinada.length * 0.25) { seg = afinada; sam = { modelo, vistas }; }
            else console.warn(`Visita 360: SAM solo reconoce el ${Math.round((n / afinada.length) * 100)} % de la foto; se usa la detección por color.`);
          } catch (e) { console.warn("Visita 360: SAM ha fallado; se usa la detección por color.", e); }
        }
        if (typeof window !== "undefined" && new URLSearchParams(location.search).has("depurar")) {
          // Solo para revisar la detección desde la consola: ?depurar en la dirección.
          Object.assign(window, { __v360: { id, color, seg, modelo, img, grande, sam360: await import("@/lib/sam360"), vistas360: await import("@/lib/vistas360"), vistas: sam?.vistas } });
        }
        const suelo = detectar(L, ANCHO, ALTO, "suelo", seg);
        const a: Analisis = { L, seg, w: ANCHO, h: ALTO, limites, alturaTecho: alturaTechoEstimada(limites, ANCHO, ALTO), columnas: columnasPared(limites, ANCHO, ALTO), suelo: sam ? suelo : ceñir(suelo, ANCHO, ALTO, limites, "suelo"), sam };
        // Las vistas codificadas ocupan memoria: solo se guardan las de las dos últimas fotos analizadas.
        const conSam = [...analisis.current.entries()].filter(([, x]) => x.sam);
        if (conSam.length >= 2) conSam[0][1].sam = undefined;
        setMetodo(m => ({ ...m, [id]: `${sam ? `sam-${modelo?.dispositivo}` : "color"} ${Math.round(performance.now() - inicio)}ms` }));
        analisis.current.set(id, a); return a;
      } finally { setAviso(""); }
    })();
    enCurso.current.set(id, trabajo);
    try { return await trabajo; } finally { enCurso.current.delete(id); }
  }, []);

  /** Zona de una superficie entera: con SAM, tal cual; con color, ceñida al rodapié o a la moldura. */
  const superficieEntera = (a: Analisis, tipo: TipoAuto) => { const bits = detectar(a.L, a.w, a.h, tipo, a.seg); return a.sam ? bits : ceñir(bits, a.w, a.h, a.limites, tipo); };
  /** Zona tocada: el suelo o el techo tocados, enteros; una pared, solo esa pared (SAM la recorta). */
  async function zonaTocada(a: Analisis, pixel: number, tipo: TipoAuto): Promise<Uint8Array> {
    if (!a.sam) return regionDesde(a.L, a.w, a.h, pixel, tipo, a.seg);
    const t = tipos.indexOf(tipo) + 1;
    const { componente, recortarToque } = await import("@/lib/sam360");
    if (tipo !== "pared" && a.seg[pixel] === t) return componente(a.seg, a.w, a.h, pixel, t);
    const r = await recortarToque(a.sam.modelo, a.sam.vistas, pixel, a.w, a.h, tipo);
    return r.some(Boolean) ? r : regionDesde(a.L, a.w, a.h, pixel, tipo, a.seg);
  }
  /** Retoque con un toque: fuera de la zona añade lo tocado; dentro, lo quita. */
  async function retocarZona(a: Analisis, actual: Uint8Array, pixel: number, tipo: TipoAuto): Promise<Uint8Array> {
    if (!a.sam) return retocar(a.L, { bits: actual, w: a.w, h: a.h }, pixel, tipo);
    const { recortarToque } = await import("@/lib/sam360");
    const r = await recortarToque(a.sam.modelo, a.sam.vistas, pixel, a.w, a.h, tipo), out = actual.slice();
    if (!r.some(Boolean)) return retocar(a.L, { bits: actual, w: a.w, h: a.h }, pixel, tipo);
    const quitar = Boolean(actual[pixel]);
    for (let i = 0; i < out.length; i++) if (r[i]) out[i] = quitar ? 0 : 1;
    return out;
  }

  const articulos = useMemo(() => [...data.articles].sort((a, b) => a.chapter.localeCompare(b.chapter, "es") || a.name.localeCompare(b.name, "es")), [data.articles]);
  const articulo = useCallback((id: string) => data.articles.find(a => a.id === id), [data.articles]);
  const partidas = useMemo(() => partidasDe(colocaciones, data.articles, zonas), [colocaciones, data.articles, zonas]);
  const total = totals(partidas.map(soloPartida));
  const enEstaFoto = colocaciones.filter(c => c.foto === foto.id);

  // Las zonas detectadas de la estancia que se ve, dibujadas con su material.
  useEffect(() => {
    if (!visor.current || cargando) return;
    const conZona = enEstaFoto.filter(c => c.zona);
    if (!conZona.length) { visor.current.capas([]); return; }
    let vivo = true;
    void analizar(foto.id).then(a => {
      if (!vivo || !a || !visor.current) return;
      visor.current.capas(conZona.flatMap(c => {
        const art = articulo(c.article_id), m = art && muestra(art);
        if (!c.zona || !m?.acabado) return [];
        return [{ id: c.id, tipo: c.zona.tipo, bits: descomprimir(c.zona.mascara, c.zona.w * c.zona.h), w: c.zona.w, h: c.zona.h, acabado: m.acabado, columnas: a.columnas, alturaTecho: a.alturaTecho }];
      }));
    });
    return () => { vivo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colocaciones, foto.id, cargando, articulo]);
  useEffect(() => { visor.current?.verOriginal(original); }, [original]);
  // Cada estancia se analiza en cuanto se ve, para que esté lista cuando se pida algo.
  useEffect(() => { if (!cargando && !fallo) void analizar(foto.id); }, [cargando, fallo, foto.id, analizar]);

  const colocar = useCallback((article: Article, quantity: number, d: Direccion, origen: Colocacion["origen"], aproximada: boolean, fotoDestino: string, zona?: Colocacion["zona"]) => {
    // Si ya hay una marca en ese punto, la nueva baja un poco para que no se tapen.
    const cerca = colocacionesRef.current.filter(c => c.foto === fotoDestino && Math.abs(c.yaw - d.yaw) < 0.12 && Math.abs(c.pitch - d.pitch) < 0.12).length;
    const c: Colocacion = { id: crypto.randomUUID(), article_id: article.id, quantity, yaw: d.yaw, pitch: d.pitch - cerca * 0.13, origen, aproximada, foto: fotoDestino, zona };
    setColocaciones(prev => [...prev, c]); setNueva(c.id); setTimeout(() => setNueva(""), 2500);
    return c;
  }, []);

  const medir = (a: Analisis, tipo: TipoSuperficie, bits: Uint8Array) => areaMascara({ bits, w: a.w, h: a.h }, tipo, 1.5, a.alturaTecho, { bits: a.suelo, w: a.w, h: a.h });

  /**
   * Pone un artículo. Los de superficie se detectan en la foto: pedidos por voz, toda la superficie de la estancia (todo el suelo,
   * todas las paredes); tocando la foto, la zona tocada («esta pared»). La cantidad, si no se dijo, sale de lo detectado.
   * Lo demás (un punto de luz, una puerta) va como marca.
   */
  const poner = useCallback(async (article: Article, quantity: number | null, tocado: Direccion | null, origen: Colocacion["origen"], fotoDestino: string): Promise<string | null> => {
    const tipo = muestra(article).superficie;
    if (tipo && (tocado || seAplicaATodo(article))) {
      setRespuesta(`Buscando ${nombreSuperficie[tipo]} en ${zonas.find(z => z.id === fotoDestino)?.nombre.toLocaleLowerCase() ?? "la foto"}…`);
      const a = await analizar(fotoDestino);
      if (a) {
        const bits = tocado ? await zonaTocada(a, pixelDe(tocado, a.w, a.h), tipo) : superficieEntera(a, tipo);
        if (bits.some(Boolean)) {
          const area = medir(a, tipo, bits), porArea = article.unit === "m²";
          const q = quantity ?? (porArea ? Math.max(0.5, Math.round(area * 10) / 10) : cantidadPorDefecto(article.unit));
          const c = colocar(article, q, centroMascara({ bits, w: a.w, h: a.h }), origen, quantity === null, fotoDestino, { tipo, mascara: comprimir(bits), w: a.w, h: a.h });
          setRetoque(c.id);
          return `${article.name} en ${nombreSuperficie[tipo]}${quantity === null && porArea ? `: ≈ ${cifra(q)} m² medidos en la foto` : `: ${cifra(q)} ${article.unit}`}. Si sobra o falta algo, toca esa zona.`;
        }
      }
    }
    const q = quantity ?? cantidadPorDefecto(article.unit);
    colocar(article, q, tocado ?? visor.current?.centro() ?? { yaw: 0, pitch: 0 }, origen, quantity === null, fotoDestino);
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analizar, colocar, zonas]);

  /** En modo retoque, un toque añade la zona tocada o la quita si ya estaba; la cantidad aproximada se vuelve a medir. */
  async function tocarRetoque(d: Direccion) {
    const c = colocacionesRef.current.find(x => x.id === retoqueRef.current); if (!c?.zona) return;
    const a = await analizar(c.foto); if (!a) return;
    const bits = await retocarZona(a, descomprimir(c.zona.mascara, c.zona.w * c.zona.h), pixelDe(d, a.w, a.h), c.zona.tipo);
    const art = articulo(c.article_id), area = Math.round(medir(a, c.zona.tipo, bits) * 10) / 10;
    setDeshacer(h => [...h, { mascara: c.zona!.mascara, quantity: c.quantity }]);
    setColocaciones(prev => prev.map(x => x.id !== c.id || !x.zona ? x : { ...x, zona: { ...x.zona, mascara: comprimir(bits) }, ...(x.aproximada && art?.unit === "m²" ? { quantity: Math.max(0.5, area) } : {}) }));
    setRespuesta(`${art?.name ?? "Zona"}: ≈ ${cifra(area)} m². Toca otra zona o pulsa «Hecho».`);
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
  const atender = useCallback(async (frase: string) => {
    setOido(frase);
    const orden: Orden | null = interpretarOrden(frase, data.articles, zonas);
    if (!orden) { setRespuesta("No lo he entendido. Prueba «pon tarima en la cocina», «pinta las paredes» o «¿cuánto va?»."); return; }
    const destino = "zona" in orden && orden.zona ? orden.zona.id : fotoRef.current.id;
    if (destino !== fotoRef.current.id) setFotoId(destino);
    let texto = describirOrden(orden, totals(partidasDe(colocacionesRef.current, data.articles, zonas).map(soloPartida)).total);
    if (orden.tipo === "añadir") { setRetoque(null); const dicho = await poner(orden.article, orden.quantity, null, "voz", destino); if (dicho) texto = dicho; }
    else if (orden.tipo === "quitar") {
      const ultima = [...colocacionesRef.current].reverse().find(c => c.article_id === orden.article.id && (!orden.zona || c.foto === orden.zona.id));
      if (!ultima) texto = `No había ${orden.article.name.toLocaleLowerCase()}`; else setColocaciones(prev => prev.filter(c => c.id !== ultima.id));
    }
    else if (orden.tipo === "deshacer") { if (!colocacionesRef.current.length) texto = "No hay nada que deshacer"; else { setRetoque(null); setColocaciones(prev => prev.slice(0, -1)); } }
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
      for (let i = e.resultIndex; i < e.results.length; i++) { const res = e.results[i]; const t = res[0]?.transcript ?? ""; if (res.isFinal) void atender(t.trim()); else parcial += t; }
      if (parcial) setOido(parcial.trim());
    };
    r.onerror = e => { if (e.error === "not-allowed") notify("Permite el micrófono para dar órdenes por voz."); };
    r.onend = () => { setEscuchando(false); rec.current = null; };
    rec.current = r; r.start(); setEscuchando(true); setRespuesta("Te escucho. Di qué va y dónde: «tarima en la cocina», «pinta las paredes».");
  }
  useEffect(() => () => rec.current?.stop(), []);

  // Hoja: qué va aquí.
  function abrirHoja(d: Direccion, editar?: Colocacion) { setHoja({ direccion: d, editar }); setBuscar(""); setArticuloId(editar?.article_id ?? ""); setCantidad(editar ? String(editar.quantity) : ""); }
  const elegido = articuloId ? articulo(articuloId) : undefined;
  const filtrados = buscar ? articulos.filter(a => normalizar(a.name + " " + a.chapter).includes(normalizar(buscar))) : articulos;
  const elegidoSuperficie = elegido ? muestra(elegido).superficie : undefined;
  async function confirmarHoja() {
    if (!hoja || !elegido) return;
    const q = parseFloat(cantidad.replace(",", ".")); const dicha = Number.isFinite(q) && q > 0 ? q : null;
    if (hoja.editar) { setColocaciones(prev => prev.map(c => c.id === hoja.editar!.id ? { ...c, article_id: elegido.id, quantity: dicha ?? c.quantity, aproximada: dicha === null ? c.aproximada : false } : c)); setHoja(null); return; }
    const d = hoja.direccion; setHoja(null);
    const dicho = await poner(elegido, dicha, d, "toque", foto.id);
    setRespuesta(dicho ?? `${elegido.name}: ${cifra(dicha ?? cantidadPorDefecto(elegido.unit))} ${elegido.unit}`);
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
  const conZona = enEstaFoto.some(c => c.zona);
  const enRetoque = colocaciones.find(c => c.id === retoque);

  return <div className="page v360">
    <header className="v360-head">
      <div>
        <Link prefetch={false} href={salida} className="flow-back solo-escritorio"><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" /><span>{project.name}</span></Link>
        <h1>Visita 360 · {foto.nombre}</h1>
        <p>{foto.nota}. Di o toca qué va: Plano encuentra el suelo, las paredes y el techo y los mide.</p>
      </div>
      <div className="v360-fotos" role="group" aria-label="Estancia">
        {fotos.map(p => { const n = colocaciones.filter(c => c.foto === p.id).length; return <button key={p.id} type="button" aria-pressed={p.id === foto.id} onClick={() => setFotoId(p.id)}>{p.nombre}{n > 0 && <span className="v360-cuenta">{n}</span>}</button>; })}
        {puedeSubir && <>
          <button type="button" className="v360-subir" onClick={() => entrada.current?.click()} disabled={subiendo}><ImagePlus size={16} strokeWidth={1.7} aria-hidden="true" />Subir foto 360</button>
          <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void elegirArchivo(f); }} aria-label="Elegir una foto 360" />
        </>}
      </div>
    </header>

    <div className="v360-stage" ref={escenario} data-marcando={enRetoque ? "" : undefined} data-deteccion={metodo[foto.id]}>
      {cargando && !fallo && <div className="v360-loading">Cargando la foto 360…</div>}
      {aviso && !cargando && <div className="v360-loading v360-analizando" role="status">{aviso}</div>}
      {fallo && <div className="v360-loading">{fallo}</div>}
      {!cargando && !fallo && !enRetoque && <span className="v360-crosshair" aria-hidden="true" />}
      {pines.filter(x => x.p.visible && x.a).map(({ c, p, a }) => (
        <button key={c.id} type="button" className="v360-pin" data-nueva={c.id === nueva || undefined} style={{ left: p.x, top: p.y }} onClick={() => abrirHoja(c, c)} aria-label={`${a!.name}, ${c.quantity} ${a!.unit}. Cambiar o quitar`}>
          <span><Muestra article={a!} />{a!.name.split(" ").slice(0, 3).join(" ")} · {c.aproximada ? "≈" : ""}{cifra(c.quantity)} {a!.unit}</span><i />
        </button>
      ))}
      {enRetoque && <div className="v360-marcar" role="status">
        <p><strong>{articulo(enRetoque.article_id)?.name}</strong> · ≈ {cifra(enRetoque.quantity)} {articulo(enRetoque.article_id)?.unit}. Si sobra o falta algo, toca esa zona de la foto.</p>
        <div>
          {deshacer.length > 0 && <button type="button" className="btn" onClick={() => {
            const antes = deshacer[deshacer.length - 1];
            setColocaciones(prev => prev.map(x => x.id === enRetoque.id && x.zona ? { ...x, quantity: antes.quantity, zona: { ...x.zona, mascara: antes.mascara } } : x));
            setDeshacer(h => h.slice(0, -1)); setRespuesta("Deshecho el último toque.");
          }}><Undo2 size={16} strokeWidth={1.8} aria-hidden="true" />Deshacer</button>}
          <button type="button" className="btn btn-primary" onClick={() => setRetoque(null)}><Check size={16} strokeWidth={1.8} aria-hidden="true" />Hecho</button>
        </div>
      </div>}
      {!enRetoque && <div className="v360-tools">
        {escuchando ? <span className="v360-escuchando" aria-live="polite"><i />{oido || "Escuchando…"}</span> : conZona ? <button type="button" className="v360-suelo" aria-pressed={original} onClick={() => setOriginal(v => !v)}>{original ? "Ver con lo nuevo" : "Ver cómo está"}</button> : <span />}
        <button type="button" className="v360-mic" aria-pressed={escuchando} onClick={alternarVoz} aria-label={escuchando ? "Parar de escuchar" : "Hablar"}>{escuchando ? <MicOff size={20} strokeWidth={1.8} aria-hidden="true" /> : <Mic size={20} strokeWidth={1.8} aria-hidden="true" />}<span>{escuchando ? "Parar" : "Hablar"}</span></button>
      </div>}
    </div>

    <form className="v360-escribir" onSubmit={e => { e.preventDefault(); const t = escrita.trim(); if (t) { void atender(t); setEscrita(""); } }}>
      <label className="sr-only" htmlFor="v360-orden">Orden escrita</label>
      <input id="v360-orden" type="text" value={escrita} onChange={e => setEscrita(e.target.value)} placeholder="O escríbelo: «pon tarima en la cocina»" autoComplete="off" />
      <button type="submit" className="btn btn-secondary" aria-label="Dar la orden" disabled={!escrita.trim()}><Send size={16} strokeWidth={1.8} aria-hidden="true" /></button>
    </form>

    {(oido || respuesta) && <div className="v360-dicho" aria-live="polite">{oido && <small>Has dicho: «{oido}»</small>}{respuesta && <strong>{respuesta}</strong>}</div>}

    <section className="pl-card v360-ticket" aria-label="Lo que va en cada estancia">
      {partidas.length === 0 && <p className="v360-ayuda" style={{ paddingTop: 14 }}>Todavía no hay nada. Pulsa «Hablar» y di <code>«pon tarima en la cocina»</code>, <code>«pinta las paredes»</code>, <code>«pon dos puertas»</code>, <code>«¿cuánto va?»</code> o <code>«pásalo al presupuesto»</code>; o toca una pared o el suelo y elige del catálogo. Plano encuentra la superficie y la mide.</p>}
      {zonas.filter(z => partidas.some(p => p.zona === z.nombre)).map(z => <div key={z.id} className="v360-grupo">
        <button type="button" className="v360-zona" onClick={() => setFotoId(z.id)} aria-pressed={z.id === foto.id}>{z.nombre}</button>
        {partidas.filter(p => p.zona === z.nombre).map(i => <div key={i.id} className="v360-linea">
          <span className="v360-linea-texto"><Muestra article={{ chapter: i.chapter, name: i.description }} /><span><strong>{i.description.replace(` · ${z.nombre}`, "")}</strong><small>{i.aproximada ? "≈ " : ""}{cifra(i.quantity)} {i.unit} × {money(i.unit_price)}{i.aproximada ? " · medido en la foto, revísalo" : ""}</small></span></span>
          <span className="pl-mono">{money(lineTotal(i))}</span>
          <button type="button" className="btn btn-icon" aria-label={`Quitar ${i.description}`} onClick={() => { setRetoque(null); setColocaciones(prev => prev.filter(c => !(c.article_id === i.article_id && c.foto === z.id))); }}><Trash2 size={16} strokeWidth={1.7} aria-hidden="true" /></button>
        </div>)}
      </div>)}
      {partidas.length > 0 && <div className="v360-total"><span><small>Total con IVA · {partidas.length} {partidas.length === 1 ? "partida" : "partidas"}</small></span><strong>{money(total.total)}</strong></div>}
      {partidas.length > 0 && <div className="v360-acciones">
        <Button variant="secondary" onClick={() => { setRetoque(null); setColocaciones([]); }}>Vaciar</Button>
        {puede ? <Button variant="primary" data-accent="orange" disabled={guardando || busy} onClick={() => void incorporar()}>{guardando ? "Pasando…" : "Pasar al presupuesto"}</Button> : <span className="muted text-sm">Tu perfil puede mirar, pero no presupuestar.</span>}
      </div>}
      {partidas.length > 0 && <p className="v360-ayuda">Las medidas con ≈ salen de la foto: suponen la cámara a 1,5 m del suelo. Revísalas en el presupuesto antes de enviarlo.</p>}
    </section>

    <Modal open={Boolean(hoja)} onClose={() => setHoja(null)} title={hoja?.editar ? "Cambiar o quitar" : `¿Qué va aquí? · ${foto.nombre}`} footer={<>
      {hoja?.editar && <Button variant="secondary" onClick={() => { setColocaciones(prev => prev.filter(c => c.id !== hoja.editar!.id)); setRetoque(null); setHoja(null); }}>Quitar</Button>}
      {hoja?.editar?.zona && <Button variant="secondary" onClick={() => { setRetoque(hoja.editar!.id); setHoja(null); }}>Retocar la zona</Button>}
      <Button variant="secondary" onClick={() => setHoja(null)}>Cancelar</Button>
      <Button variant="primary" disabled={!elegido} onClick={() => void confirmarHoja()}>{hoja?.editar ? "Guardar" : "Poner aquí"}</Button>
    </>}>
      <div className="form" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="field"><span>Buscar en el catálogo</span><input type="search" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="tarima, pintura, puerta, azulejo…" autoFocus /></label>
        <div className="v360-lista" role="listbox" aria-label="Artículos del catálogo">
          {filtrados.slice(0, 40).map(a => <button key={a.id} type="button" role="option" aria-selected={a.id === articuloId} aria-pressed={a.id === articuloId} onClick={() => setArticuloId(a.id)}><span className="v360-linea-texto"><Muestra article={a} /><span>{a.name}</span></span><small>{money(a.unit_price)} / {a.unit}</small></button>)}
          {filtrados.length === 0 && <p className="muted text-sm" style={{ padding: 12, margin: 0 }}>Nada con ese nombre en el catálogo.</p>}
        </div>
        {elegido && <div className="v360-cantidad">
          <span className="muted text-sm">{elegido.name} · {money(elegido.unit_price)} por {elegido.unit}{elegidoSuperficie && elegido.unit === "m²" && !hoja?.editar ? `. Déjalo vacío: se mide ${elegidoSuperficie === "pared" ? "la pared tocada" : nombreSuperficie[elegidoSuperficie]} en la foto.` : ""}</span>
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
