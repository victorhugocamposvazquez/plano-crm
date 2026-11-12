"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, MicOff, Plus, RotateCcw, RotateCw, Send, Trash2, TriangleAlert, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { useBanda } from "@/components/band";
import { Button } from "@/components/ui/button";
import { budgetHistory } from "@/lib/budget-history";
import { can, lineTotal, money, totals, type Project } from "@/lib/domain";
import { decir, escuchar, type Escucha } from "@/lib/voz";
import { TrazaVoz, useTrazaVoz } from "@/components/capture/traza-voz";
import {
  aplicarPlanta, claseDe, coloresCircuito, coloresUso, describirEquipos, describirMetros, describirRecinto, escenaInstalacion, escenaPlanta, estaVacio, estadoVacio, evaporadores, interpretarPlanta, medicionTuberia, modeloDe,
  nombreGrupo, nombreUso, partidasPlanta, type EstadoPlanta, type OrdenPlanta, type Planta
} from "@/lib/planta3d";
import type { createPlantaViewer, PlantaSeleccion } from "@/lib/visual/planta-viewer";
import "@/styles/visita-360.css";
import "@/styles/espacio-3d.css";
import "@/styles/planta-3d.css";

type Visor = ReturnType<typeof createPlantaViewer>;
const clave = (projectId: string, plantaId: string) => `plano.planta3d.${projectId}.${plantaId}`;
const cifra = (n: number, d = 2) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: d }).format(n);
const rgb = (c: readonly number[]) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
const ayuda = "Prueba: «pon lo del plano», «pon un evaporador en la cámara 3», «quita el MT04», «¿qué lleva la cámara 2?», «¿cuántos metros de tubería?» o «¿cuánto va?».";

function leer(k: string): EstadoPlanta | null {
  try { const e = JSON.parse(localStorage.getItem(k) ?? "null"); return e && Array.isArray(e.equipos) && typeof e.tuberia === "boolean" && typeof e.central === "boolean" ? e : null; } catch { return null; }
}

/**
 * Plano en 3D: la planta levantada a la altura de cada recinto, con los equipos y las tuberías que marca el plano.
 * Se presupuesta diciéndolo, escribiéndolo o tocando un recinto y eligiendo del catálogo; todo es propuesta hasta pasarlo al presupuesto.
 */
export function Planta3d({ project, planta, budgetId }: { project: Project; planta: Planta; budgetId: string | null }) {
  const { data, actor, send, notify, busy } = useWorkspace();
  const router = useRouter();
  const puede = can(actor.role, "budget.save");
  const salida = `/proyectos/${project.id}?s=budget${budgetId ? `&p=${budgetId}` : ""}`;
  useBanda({ label: project.name, href: salida });

  const [estado, setEstado] = useState<EstadoPlanta>(estadoVacio);
  const [historial, setHistorial] = useState<EstadoPlanta[]>([]);
  const [cargado, setCargado] = useState(false);
  const [sel, setSel] = useState<PlantaSeleccion>({ recinto: planta.equipos[0]?.recinto ?? planta.recintos[0].id });
  const [encuadre, setEncuadre] = useState<string | null>(null);
  const [visorEstado, setVisorEstado] = useState<"cargando" | "listo" | "fallo">("cargando");
  const [escuchando, setEscuchando] = useState(false);
  const [oido, setOido] = useState("");
  const [enVivo, setEnVivo] = useState("");
  const { lineas: trazaLineas, traza } = useTrazaVoz();
  const [respuesta, setRespuesta] = useState("");
  const [escrita, setEscrita] = useState("");
  const [guardando, setGuardando] = useState(false);

  const k = clave(project.id, planta.id);
  useEffect(() => { const e = leer(k); if (e) setEstado(e); setCargado(true); }, [k]);
  useEffect(() => { if (cargado) try { localStorage.setItem(k, JSON.stringify(estado)); } catch { /* sin almacenamiento */ } }, [estado, cargado, k]);

  const escena = useMemo(() => escenaPlanta(planta), [planta]);
  const instalacion = useMemo(() => escenaInstalacion(planta, estado), [planta, estado]);
  const partidas = useMemo(() => partidasPlanta(planta, estado, data.articles), [planta, estado, data.articles]);
  const total = totals(partidas), sinPrecio = partidas.filter(p => p.sinPrecio).length;
  const catalogo = useMemo(() => evaporadores(data.articles), [data.articles]);
  const medicion = useMemo(() => medicionTuberia(planta, new Set(estado.equipos.map(e => e.id))), [planta, estado.equipos]);
  const recinto = planta.recintos.find(r => r.id === sel.recinto) ?? planta.recintos[0];
  const puestos = estado.equipos.filter(e => e.recinto === recinto.id);
  const pendientes = planta.equipos.filter(e => e.recinto === recinto.id && !estado.equipos.some(x => x.id === e.id));

  const host = useRef<HTMLDivElement>(null), visor = useRef<Visor | null>(null), rec = useRef<Escucha | null>(null);
  const ultimo = useRef({ instalacion, sel }); ultimo.current = { instalacion, sel };
  const alTocar = useRef<(s: PlantaSeleccion) => void>(() => {});
  useEffect(() => {
    let cancelado = false;
    import("@/lib/visual/planta-viewer").then(({ createPlantaViewer }) => {
      if (cancelado || !host.current) return;
      const v = createPlantaViewer(host.current, escena, s => alTocar.current(s));
      visor.current = v; v.instalar(ultimo.current.instalacion.equipos, ultimo.current.instalacion.tubos); v.seleccionar(ultimo.current.sel); setVisorEstado("listo");
    }).catch(() => { if (!cancelado) setVisorEstado("fallo"); });
    return () => { cancelado = true; visor.current?.dispose(); visor.current = null; };
  }, [escena]);
  useEffect(() => { visor.current?.instalar(instalacion.equipos, instalacion.tubos); }, [instalacion]);
  useEffect(() => { visor.current?.seleccionar(sel); }, [sel]);

  function cambiar(siguiente: EstadoPlanta) {
    if (JSON.stringify(siguiente) === JSON.stringify(estado)) return false;
    setHistorial(h => [...h.slice(-29), estado]); setEstado(siguiente); return true;
  }
  function deshacer() { const prev = historial.at(-1); if (!prev) return false; setHistorial(h => h.slice(0, -1)); setEstado(prev); return true; }
  function ver(id: string | null) { setEncuadre(id); visor.current?.view(id ?? undefined); }
  const nombre = (id: string) => planta.recintos.find(r => r.id === id)?.nombre ?? id;

  /** Qué responde Plano tras una orden que cambia la propuesta: lo hecho y cómo queda la cuenta. */
  function explicar(o: OrdenPlanta, nuevo: EstadoPlanta): string {
    const p = partidasPlanta(planta, nuevo, data.articles), t = totals(p), sin = p.filter(x => x.sinPrecio).length;
    const cuenta = !p.length ? "No queda nada en la propuesta." : sin === p.length ? `${p.length} ${p.length === 1 ? "partida" : "partidas"}, todas con el precio pendiente en el catálogo.` : `Van ${money(t.total)} con IVA${sin ? `, con ${sin} ${sin === 1 ? "partida" : "partidas"} sin precio` : ""}.`;
    switch (o.tipo) {
      case "plano": return `Puesto lo que marca el plano: ${nuevo.equipos.length} evaporadores, ${cifra(medicionTuberia(planta, new Set(nuevo.equipos.map(e => e.id))).total, 1)} m de tubería en planta y la central. ${cuenta}`;
      case "vaciar": return "Propuesta vacía.";
      case "poner": { const suyos = nuevo.equipos.filter(e => !estado.equipos.some(x => x.id === e.id)); return `${nombre(o.recinto)}: ${suyos.length === 1 ? "puesto" : "puestos"} ${suyos.map(e => e.id).join(", ")} (${o.modelo})${suyos.some(e => !e.delPlano) ? ", fuera de lo que marca el plano" : ""}. ${cuenta}`; }
      case "quitar": return `${o.ids.length === 1 ? "Quitado" : "Quitados"} ${o.ids.join(", ")}. ${cuenta}`;
      case "cambiar": return `${o.id} pasa a ${o.modelo}. ${cuenta}`;
      case "tuberia": return o.poner ? `Tubería puesta: ${cifra(medicionTuberia(planta, new Set(nuevo.equipos.map(e => e.id))).total, 1)} m en planta, sin bajadas ni subida a la central. ${cuenta}` : `Tubería fuera. ${cuenta}`;
      case "central": return o.poner ? `Central de CO2 puesta. ${cuenta}` : `Central fuera. ${cuenta}`;
      default: return "";
    }
  }
  function responder(texto: string, voz = true) { setRespuesta(texto); if (voz) decir(texto); }
  function ejecutar(o: OrdenPlanta, voz = false) {
    const nuevo = aplicarPlanta(planta, estado, o);
    if (o.tipo === "poner") setSel({ recinto: o.recinto });
    cambiar(nuevo); responder(explicar(o, nuevo), voz);
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
        ws = await send({ type: "budget.revise", version_id: base.id, reason: "Plano en 3D" }); version = budgetHistory(budget, ws.versions).working;
      }
      if (!version) throw new Error("No hay un borrador abierto.");
      const nuevas = partidas.map(({ grupo, detalle, sinArticulo: _a, sinPrecio: _p, ...i }) => ({ ...i, id: crypto.randomUUID(), description: grupo === "evaporadores" ? `${i.description} · ${detalle}` : grupo === "tuberia" ? `${i.description} · en planta, sin bajadas` : i.description }));
      await send({ type: "budget.save", version_id: version.id, expected_revision: version.draft_revision, items: [...version.items, ...nuevas], notes: version.notes });
      notify(`${nuevas.length} ${nuevas.length === 1 ? "partida incorporada" : "partidas incorporadas"} a la V${version.number}${sinPrecio ? `; ${sinPrecio} sin precio` : ""}`);
      router.push(`/proyectos/${project.id}?s=budget&p=${budget.id}`);
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido incorporar."); }
    finally { setGuardando(false); }
  }, [puede, partidas, sinPrecio, guardando, data, budgetId, project.id, send, notify, router]);

  // Cada frase (dicha o escrita) se interpreta contra el plano y el catálogo; lo que cambia se ve en la escena y en la cuenta.
  const atender = useCallback((frase: string) => {
    setOido(frase);
    const o = interpretarPlanta(frase, planta, estado, data.articles);
    if (!o) { responder(`No lo he entendido. ${ayuda}`); return; }
    switch (o.tipo) {
      case "aviso": responder(o.mensaje); return;
      case "total": responder(!partidas.length ? "Todavía no hay nada en la propuesta." : sinPrecio === partidas.length ? `Hay ${partidas.length} partidas y ninguna tiene precio en el catálogo todavía.` : `Van ${money(total.total)} con IVA en ${partidas.length} partidas${sinPrecio ? `; ${sinPrecio} no tienen precio` : ""}.`); return;
      case "incorporar": if (!partidas.length) responder("No hay nada que pasar todavía."); else { responder("Lo paso al presupuesto."); void incorporar(); } return;
      case "deshacer": responder(deshacer() ? "Deshecho." : "No hay nada que deshacer."); return;
      case "mover": visor.current?.command(o.mover); return;
      case "vista": if (o.recinto) setSel({ recinto: o.recinto }); ver(o.recinto ?? null); responder(o.recinto ? describirEquipos(planta, estado, planta.recintos.find(r => r.id === o.recinto)!) : "Vista general de la planta."); return;
      case "recinto": setSel({ recinto: o.recinto }); responder(describirEquipos(planta, estado, planta.recintos.find(r => r.id === o.recinto)!)); return;
      case "metros": responder(describirMetros(planta, estado, o.circuito)); return;
      default: ejecutar(o, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planta, data.articles, estado, historial, partidas, sinPrecio, total.total, incorporar]);
  const atenderRef = useRef(atender); atenderRef.current = atender;

  // Tocar la escena elige el recinto o el equipo y dice qué hay.
  alTocar.current = s => {
    if (s.equipo) {
      const e = estado.equipos.find(x => x.id === s.equipo) ?? planta.equipos.find(x => x.id === s.equipo);
      if (!e) return;
      setSel({ recinto: e.recinto, equipo: e.id });
      setRespuesta(`${e.id} · ${e.modelo} en ${nombre(e.recinto)}. ${estado.equipos.some(x => x.id === e.id) ? "Está en la propuesta." : "Lo marca el plano; todavía sin presupuestar."}`);
    } else if (s.recinto) { setSel({ recinto: s.recinto }); setRespuesta(describirEquipos(planta, estado, planta.recintos.find(r => r.id === s.recinto)!)); }
  };

  async function alternarVoz() {
    if (escuchando) { rec.current?.parar(); rec.current = null; setEscuchando(false); setEnVivo(""); return; }
    setEnVivo("");
    const r = await escuchar({ alOir: t => atenderRef.current(t), alParcial: setEnVivo, alTerminar: () => { setEscuchando(false); setEnVivo(""); rec.current = null; }, alError: notify, traza });
    if (!r) { notify("Este navegador no tiene dictado. Usa Chrome, Edge o Safari, o escribe la orden."); return; }
    rec.current = r; setEscuchando(true);
    setRespuesta(`${r.continuidad && r.microfono ? `Micrófono: ${r.microfono}. ` : ""}Te escucho. ${ayuda}`);
  }
  useEffect(() => () => rec.current?.parar(), []);

  const listo = visorEstado === "listo", vacio = estaVacio(estado);
  return <div className="page v360 e3d p3d">
    <header className="v360-head">
      <div>
        <Link prefetch={false} href={salida} className="flow-back solo-escritorio"><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" /><span>{project.name}</span></Link>
        <h1>Plano en 3D · {planta.nombre.toLocaleLowerCase()}</h1>
        <p>{planta.origen} Di, escribe o toca un recinto para presupuestar con el catálogo.</p>
      </div>
    </header>

    <div className="e3d-stage">
      <div ref={host} className="e3d-lienzo" />
      {!listo && <div className="v360-loading">{visorEstado === "cargando" ? "Levantando la planta…" : "La vista 3D no está disponible en este navegador. Puedes seguir con la lista de recintos."}</div>}
      <div className="e3d-vistas" role="group" aria-label="Vista">
        <button type="button" aria-pressed={encuadre === null} onClick={() => ver(null)} disabled={!listo}>Planta entera</button>
        <button type="button" aria-pressed={encuadre === recinto.id} onClick={() => ver(recinto.id)} disabled={!listo}>Ver {recinto.nombre.toLocaleLowerCase()}</button>
      </div>
      <div className="v360-tools">
        {escuchando ? <span className="v360-escuchando" aria-live="polite"><i />{enVivo || "Escuchando…"}</span> : <span className="e3d-mover" role="group" aria-label="Mover la cámara">
          <button type="button" aria-label="Girar a la izquierda" onClick={() => visor.current?.command("left")} disabled={!listo}><RotateCcw size={18} strokeWidth={1.7} aria-hidden="true" /></button>
          <button type="button" aria-label="Girar a la derecha" onClick={() => visor.current?.command("right")} disabled={!listo}><RotateCw size={18} strokeWidth={1.7} aria-hidden="true" /></button>
          <button type="button" aria-label="Acercar" onClick={() => visor.current?.command("closer")} disabled={!listo}><ZoomIn size={18} strokeWidth={1.7} aria-hidden="true" /></button>
          <button type="button" aria-label="Alejar" onClick={() => visor.current?.command("farther")} disabled={!listo}><ZoomOut size={18} strokeWidth={1.7} aria-hidden="true" /></button>
        </span>}
        <button type="button" className="v360-mic" aria-pressed={escuchando} onClick={alternarVoz} aria-label={escuchando ? "Parar de escuchar" : "Hablar"}>{escuchando ? <MicOff size={20} strokeWidth={1.8} aria-hidden="true" /> : <Mic size={20} strokeWidth={1.8} aria-hidden="true" />}<span>{escuchando ? "Parar" : "Hablar"}</span></button>
      </div>
    </div>

    <ul className="p3d-leyenda" aria-label="Qué significa cada color">
      {(["congelado", "refrigerado", "atemperado", "ambiente"] as const).map(u => <li key={u}><i aria-hidden="true" style={{ background: rgb(coloresUso[u]) }} />{nombreUso[u]}</li>)}
      {([["aspiracion-bt", "Aspiración de baja"], ["aspiracion-mt", "Aspiración de media"], ["liquido", "Líquido"], ["gas-caliente", "Gas caliente"]] as const).map(([c, n]) => <li key={c}><i aria-hidden="true" data-linea style={{ background: rgb(coloresCircuito[c]) }} />{n}</li>)}
    </ul>

    <form className="v360-escribir" onSubmit={e => { e.preventDefault(); const t = escrita.trim(); if (t) { atender(t); setEscrita(""); } }}>
      <label className="sr-only" htmlFor="p3d-orden">Orden escrita</label>
      <input id="p3d-orden" type="text" value={escrita} onChange={e => setEscrita(e.target.value)} placeholder="O escríbelo: «pon un evaporador en la cámara 3»" autoComplete="off" />
      <button type="submit" className="btn btn-secondary" aria-label="Dar la orden" disabled={!escrita.trim()}><Send size={16} strokeWidth={1.8} aria-hidden="true" /></button>
    </form>

    {(oido || respuesta) && <div className="v360-dicho" aria-live="polite">{oido && <small>Has dicho: «{oido}»</small>}{respuesta && <strong>{respuesta}</strong>}</div>}
    <TrazaVoz lineas={trazaLineas} />

    <section className="pl-card p3d-recinto" aria-label="Recinto">
      <div className="p3d-recinto-cab">
        <label className="field"><span>Recinto</span>
          <select value={recinto.id} onChange={e => setSel({ recinto: e.target.value })}>{planta.recintos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select>
        </label>
        <p><strong className="pl-mono">{describirRecinto(recinto)}</strong><small>{nombreUso[recinto.uso]} · superficie, altura y temperatura rotuladas en el plano</small></p>
      </div>
      <div className="p3d-equipos">
        {puestos.map(e => <div key={e.id} className="p3d-equipo" data-sel={sel.equipo === e.id || undefined}>
          <span><strong className="pl-mono">{e.id}</strong><small>{e.modelo}{e.delPlano ? "" : " · añadido, no está en el plano"}</small></span>
          <Button variant="icon" aria-label={`Quitar ${e.id}`} onClick={() => ejecutar({ tipo: "quitar", ids: [e.id] })}><Trash2 size={16} strokeWidth={1.7} aria-hidden="true" /></Button>
        </div>)}
        {pendientes.length > 0 && <div className="p3d-pendiente">
          <span>El plano marca {pendientes.map(e => e.id).join(", ")} <small>({[...new Set(pendientes.map(e => e.modelo))].join(", ")})</small></span>
          <Button variant="secondary" onClick={() => ejecutar({ tipo: "poner", recinto: recinto.id, modelo: pendientes[0].modelo, clase: pendientes[0].clase, unidades: pendientes.length })}><Plus size={15} strokeWidth={1.8} aria-hidden="true" />Poner</Button>
        </div>}
        {!puestos.length && !pendientes.length && <p className="muted text-sm">El plano no marca equipos en este recinto. Puedes añadir uno del catálogo.</p>}
      </div>
      <div className="e3d-opciones">
        <strong className="p3d-sub">Añadir del catálogo a {recinto.nombre.toLocaleLowerCase()}</strong>
        {catalogo.length === 0 ? <p className="muted text-sm" style={{ margin: 0 }}>No hay evaporadores en el catálogo. Añádelos en Catálogo, capítulo Refrigeración, con la referencia en el nombre.</p> : <div className="e3d-lista">
          {catalogo.map(a => <button key={a.id} type="button" onClick={() => ejecutar({ tipo: "poner", recinto: recinto.id, modelo: modeloDe(a)!, clase: claseDe(a), unidades: 1 })}><span>{a.name}</span><small className="pl-mono">{a.unit_price ? `${money(a.unit_price)} / ${a.unit}` : "Precio pendiente"}</small></button>)}
        </div>}
      </div>
    </section>

    <section className="pl-card v360-ticket" aria-label="Lo que entra en el presupuesto">
      <div className="p3d-conmutar" role="group" aria-label="Qué más entra">
        <button type="button" aria-pressed={estado.tuberia} onClick={() => ejecutar({ tipo: "tuberia", poner: !estado.tuberia })}>Tubería en planta<small className="pl-mono">{cifra(medicion.total, 1)} m</small></button>
        <button type="button" aria-pressed={estado.central} onClick={() => ejecutar({ tipo: "central", poner: !estado.central })}>Central de CO2<small className="pl-mono">1 ud</small></button>
      </div>
      {vacio && <p className="v360-ayuda" style={{ paddingTop: 14 }}>Todavía no hay nada presupuestado. Lo que marca el plano se ve en silueta: ponlo de una vez o ve recinto por recinto. {ayuda}</p>}
      {partidas.map(i => <div key={i.id} className="v360-linea">
        <span className="v360-linea-texto"><span><strong>{i.description}</strong><small>{nombreGrupo[i.grupo]} · {cifra(i.quantity, 1)} {i.unit}{i.sinPrecio ? "" : ` × ${money(i.unit_price)}`} · {i.detalle}</small>{i.sinArticulo && <small className="e3d-stock" data-estado="corto">No está en el catálogo: entra sin precio.</small>}</span></span>
        <span className="pl-mono">{i.sinPrecio ? "Precio pendiente" : money(lineTotal(i))}</span>
        <span />
      </div>)}
      {partidas.length > 0 && <div className="v360-total"><span><small>Total con IVA · {partidas.length} {partidas.length === 1 ? "partida" : "partidas"}{sinPrecio ? ` · ${sinPrecio} sin precio, fuera del total` : ""}</small></span><strong>{sinPrecio === partidas.length ? "Pendiente" : money(total.total)}</strong></div>}
      {estado.tuberia && medicion.dudas.length > 0 && <details className="p3d-dudas">
        <summary><TriangleAlert size={15} strokeWidth={1.7} aria-hidden="true" />{medicion.dudas.length} {medicion.dudas.length === 1 ? "tramo de tubería por confirmar" : "tramos de tubería por confirmar"}</summary>
        <ul>{medicion.dudas.map(d => <li key={d}>{d}</li>)}</ul>
      </details>}
      <div className="v360-acciones">
        {!vacio && <Button variant="secondary" disabled={!historial.length} onClick={() => { if (deshacer()) setRespuesta("Deshecho."); }}><Undo2 size={15} strokeWidth={1.7} aria-hidden="true" />Deshacer</Button>}
        {vacio ? <Button variant="primary" data-accent="orange" onClick={() => ejecutar({ tipo: "plano" })}>Poner lo que marca el plano</Button>
          : puede ? <Button variant="primary" data-accent="orange" disabled={guardando || busy || !partidas.length} onClick={() => void incorporar()}>{guardando ? "Pasando…" : "Pasar al presupuesto"}</Button> : <span className="muted text-sm">Tu perfil puede mirar, pero no presupuestar.</span>}
      </div>
      <p className="v360-ayuda">Propuesta sacada del plano, por validar. Las superficies y alturas son las rotuladas; los metros de tubería se miden sobre el trazado en planta y no incluyen bajadas a los equipos ni la subida a la central. Recintos y equipos de este ejemplo están transcritos a mano del plano. El precio es el del catálogo; sin precio, la partida entra a cero.</p>
    </section>
  </div>;
}
