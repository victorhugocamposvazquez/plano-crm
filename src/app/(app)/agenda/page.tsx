"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { TaskDialog } from "@/components/project/task-dialog";
import { QuickCreatePanels } from "@/components/quick-create";
import { can, type Task } from "@/lib/domain";
import { localDate } from "@/lib/hoy";
import { useQueryState } from "@/lib/use-query-state";
import { lunesDe, sumarDias, diasDeSemana, etiquetaDia, tareasConProyecto, filtrar, personas, primerDiaMes, sumarMeses, rejillaMes, type TareaAgenda } from "@/lib/agenda";

type Vista = "dia" | "tres" | "semana" | "mes" | "lista";
const SIN_ASIGNAR = "Sin asignar";
const mesNombre = new Intl.DateTimeFormat("es-ES", { month: "long" });
const diaMes = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
const capital = (t: string) => t.replace(/^./, c => c.toUpperCase());
const fecha = (iso: string) => new Date(`${iso}T12:00:00`);
const iniciales = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * Agenda de calendario. Las tareas solo tienen fecha, no hora (`event` está en docs/PREGUNTAS.md):
 * por eso cada día es una columna con sus tareas y no una rejilla por horas. No se inventan horas.
 */
export default function AgendaPage() {
  const { data, actor, loading } = useWorkspace();
  const hoy = localDate();
  const [vistaParam, setVista] = useQueryState<Vista | "">("v", "");
  const [dia, setDia] = useQueryState<string>("d", hoy);
  const [persona, setPersona] = useQueryState<string>("p", "");
  const [nuevaParam, setNuevaParam] = useQueryState<"1" | "">("nueva", "");
  const [esMovil, setEsMovil] = useState(false);
  useEffect(() => { const m = window.matchMedia("(max-width: 767px)"); const sync = () => setEsMovil(m.matches); sync(); m.addEventListener("change", sync); return () => m.removeEventListener("change", sync); }, []);
  const vista: Vista = vistaParam || (esMovil ? "dia" : "semana");
  const [verAbierto, setVerAbierto] = useState(false);
  const [mostrar, setMostrar] = useState({ pendientes: true, atrasadas: true, hechas: true });
  const [abierta, setAbierta] = useState<Task | null>(null);
  const [nueva, setNueva] = useState<string | null>(null);
  useEffect(() => { if (nuevaParam === "1") { setNueva(hoy); setNuevaParam(""); } }, [nuevaParam, setNuevaParam, hoy]);
  const puedeCrear = can(actor.role, "task.create");
  const equipo = useMemo(() => personas(data.tasks), [data.tasks]);
  const todas = useMemo(() => tareasConProyecto(data), [data]);
  const visibles = useMemo(() => filtrar(todas, { oficio: "", persona }).filter(t => t.status === "done" ? mostrar.hechas : t.due_date < hoy ? mostrar.atrasadas : mostrar.pendientes), [todas, persona, mostrar, hoy]);
  const delDia = (d: string) => visibles.filter(t => t.due_date === d);
  const mes = primerDiaMes(dia), lunes = lunesDe(dia);
  const paso = (n: number) => setDia(vista === "mes" ? sumarMeses(mes, n) : sumarDias(dia, n * (vista === "dia" ? 1 : vista === "tres" ? 3 : vista === "lista" ? 14 : 7)));
  const rango = vista === "dia" ? capital(etiquetaDia(dia, true)) : vista === "tres" ? `${diaMes.format(fecha(dia))} – ${diaMes.format(fecha(sumarDias(dia, 2)))}` : vista === "semana" ? `${diaMes.format(fecha(lunes))} – ${diaMes.format(fecha(sumarDias(lunes, 6)))}` : vista === "lista" ? `Desde el ${diaMes.format(fecha(dia))}` : capital(mesNombre.format(fecha(mes)));
  const atrasadas = visibles.filter(t => t.status === "pending" && t.due_date < hoy && (vista === "mes" ? t.due_date < rejillaMes(mes)[0][0].iso : vista === "semana" ? t.due_date < lunes : t.due_date < dia));
  const celdas = rejillaMes(mes).flat();
  const hayDia = useMemo(() => new Set(visibles.map(t => t.due_date)), [visibles]);

  const tono = (t: TareaAgenda) => (t.status === "done" ? "success" : t.due_date < hoy ? "danger" : t.due_date === hoy ? "warning" : "info");
  const Bloque = ({ t, conFecha = false }: { t: TareaAgenda; conFecha?: boolean }) => (
    <button type="button" className="cal-task" data-tone={tono(t)} data-done={t.status === "done" || undefined} onClick={() => setAbierta(t)} aria-haspopup="dialog">
      <strong>{t.title}</strong><small>{t.project.name}{t.assignee ? ` · ${t.assignee}` : ""}{conFecha ? ` · ${diaMes.format(fecha(t.due_date))}` : ""}</small>
    </button>
  );
  const Columna = ({ d }: { d: string }) => (
    <section className="cal-col" data-today={d === hoy || undefined} aria-label={etiquetaDia(d, true)}>
      <button type="button" className="cal-col-head" onClick={() => { setDia(d); setVista("dia"); }} aria-label={`Ver el ${etiquetaDia(d, true)}`}><span>{capital(etiquetaDia(d))}</span><strong>{Number(d.slice(8))}</strong></button>
      <div className="cal-col-body">
        {delDia(d).map(t => <Bloque key={t.id} t={t} />)}
        {delDia(d).length === 0 && puedeCrear && <button type="button" className="cal-add" aria-label={`Nueva tarea el ${etiquetaDia(d, true)}`} onClick={() => setNueva(d)}><Plus size={15} strokeWidth={1.8} aria-hidden="true" /></button>}
      </div>
    </section>
  );
  // Vista Día: en escritorio, una columna por persona para ver quién está dónde.
  const gente = useMemo(() => {
    const lista = delDia(dia), mapa = new Map<string, TareaAgenda[]>();
    for (const n of persona ? [persona] : equipo) mapa.set(n, []);
    for (const t of lista) { const clave = t.assignee || SIN_ASIGNAR; if (persona && clave !== persona) continue; mapa.set(clave, [...(mapa.get(clave) ?? []), t]); }
    return [...mapa.entries()].filter(([, l], _, all) => l.length > 0 || all.length <= 4);
  }, [dia, visibles, equipo, persona]); // eslint-disable-line react-hooks/exhaustive-deps
  const proximos14 = Array.from({ length: 14 }, (_, i) => sumarDias(dia, i)).filter(d => delDia(d).length > 0);

  return (
    <div className="page cal-page">
      <div className="cal-head">
        <h1 className="pl-title">Agenda</h1>
        <div className="cal-month"><strong>{capital(mesNombre.format(fecha(dia)))}</strong> <span>{dia.slice(0, 4)}</span></div>
        <div className="cal-nav">
          <button type="button" className="cal-icon" aria-label="Anterior" onClick={() => paso(-1)}><ChevronLeft size={17} strokeWidth={1.8} aria-hidden="true" /></button>
          <button type="button" className="cal-today" onClick={() => setDia(hoy)}>Hoy</button>
          <button type="button" className="cal-icon" aria-label="Siguiente" onClick={() => paso(1)}><ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" /></button>
          {vista !== "mes" && <span className="cal-range" aria-live="polite">{rango}</span>}
        </div>
      </div>
      <div className="cal-tools">
        <div className="pl-seg cal-views" role="group" aria-label="Vista">
          <button type="button" aria-pressed={vista === "dia"} onClick={() => setVista("dia")}>Día</button>
          <button type="button" className="solo-movil-inline" aria-pressed={vista === "tres"} onClick={() => setVista("tres")}>3 días</button>
          <button type="button" className="solo-escritorio-inline" aria-pressed={vista === "semana"} onClick={() => setVista("semana")}>Semana</button>
          <button type="button" aria-pressed={vista === "mes"} onClick={() => setVista("mes")}>Mes</button>
          <button type="button" aria-pressed={vista === "lista"} onClick={() => setVista("lista")}>Lista</button>
        </div>
        <Popover open={verAbierto} onClose={() => setVerAbierto(false)} panelClassName="filter-panel" trigger={
          <button type="button" className="filter-button" data-active={persona ? true : undefined} aria-expanded={verAbierto} onClick={() => setVerAbierto(v => !v)}><span>Ver:</span><strong>{persona || "Todo el equipo"}</strong><ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" /></button>
        }>
          <button type="button" className="filter-option" data-on={!persona || undefined} onClick={() => { setPersona(""); setVerAbierto(false); }}>Todo el equipo</button>
          {equipo.map(p => <button key={p} type="button" className="filter-option" data-on={persona === p || undefined} onClick={() => { setPersona(p); setVerAbierto(false); }}>{p}</button>)}
        </Popover>
        {puedeCrear && <Button variant="primary" className="cal-new" onClick={() => setNueva(dia)}><Plus size={16} strokeWidth={1.8} aria-hidden="true" />Nueva tarea</Button>}
      </div>

      <div className="cal-layout">
        <aside className="cal-side" aria-label="Saltar a un día y qué mostrar">
          <div className="mini-cal" role="group" aria-label="Elegir día">
            {iniciales.map(d => <span key={d}>{d}</span>)}
            {celdas.map(({ iso, enMes }) => <button key={iso} type="button" data-out={!enMes || undefined} data-today={iso === hoy || undefined} data-on={iso === dia || undefined} aria-label={etiquetaDia(iso, true)} onClick={() => setDia(iso)}>{Number(iso.slice(8))}{hayDia.has(iso) && <i aria-hidden="true" />}</button>)}
          </div>
          <div className="cal-show" role="group" aria-label="Qué mostrar">
            <span>Qué mostrar</span>
            {([["pendientes", "Pendientes", "info"], ["atrasadas", "Atrasadas", "danger"], ["hechas", "Hechas", "success"]] as const).map(([id, label, tone]) => <label key={id} data-tone={tone}><input type="checkbox" checked={mostrar[id]} onChange={() => setMostrar(m => ({ ...m, [id]: !m[id] }))} />{label}</label>)}
          </div>
        </aside>
        <div className="cal-main">
          {atrasadas.length > 0 && <section className="cal-late" aria-label="Atrasadas de antes"><strong>Atrasadas de antes · {atrasadas.length}</strong><div>{atrasadas.slice(0, 6).map(t => <Bloque key={t.id} t={t} conFecha />)}</div></section>}

          {vista === "dia" && <>
            <div className="week-strip solo-movil" role="group" aria-label="Días de la semana">
              {diasDeSemana(lunes).map((d, i) => <button key={d} type="button" data-on={d === dia || undefined} data-today={d === hoy || undefined} aria-label={etiquetaDia(d, true)} onClick={() => setDia(d)}><span>{iniciales[i]}</span><strong>{Number(d.slice(8))}</strong>{hayDia.has(d) && <i aria-hidden="true" />}</button>)}
            </div>
            <div className="solo-movil cal-day-list">
              {delDia(dia).length === 0 && <p className="cal-empty">Sin tareas este día.{puedeCrear && <> <button type="button" className="link-inline" onClick={() => setNueva(dia)}>Planificar una</button></>}</p>}
              {delDia(dia).map(t => <Bloque key={t.id} t={t} />)}
            </div>
            <div className="cal-people solo-escritorio" style={{ "--cols": Math.max(1, gente.length) } as CSSProperties}>
              {gente.map(([nombre, lista]) => <section key={nombre} className="cal-col" aria-label={nombre}>
                <div className="cal-person"><span className="avatar avatar-sm" aria-hidden="true">{nombre.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("")}</span><strong>{nombre}</strong></div>
                <div className="cal-col-body">{lista.map(t => <Bloque key={t.id} t={t} />)}{lista.length === 0 && <p className="cal-empty">Sin tareas</p>}</div>
              </section>)}
              {gente.length === 0 && <p className="cal-empty">Sin tareas este día.</p>}
            </div>
          </>}
          {vista === "tres" && <div className="cal-columns" style={{ "--cols": 3 } as CSSProperties}>{[0, 1, 2].map(i => <Columna key={i} d={sumarDias(dia, i)} />)}</div>}
          {vista === "semana" && <div className="cal-scroll"><div className="cal-columns cal-week" style={{ "--cols": 7 } as CSSProperties}>{diasDeSemana(lunes).map(d => <Columna key={d} d={d} />)}</div></div>}
          {vista === "mes" && <>
            <div className="cal-month-grid" role="grid" aria-label={rango}>
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
              {celdas.map(({ iso, enMes }) => { const lista = delDia(iso); return (
                <div key={iso} className="cal-cell" role="gridcell" data-out={!enMes || undefined} data-on={iso === dia || undefined}>
                  <button type="button" className="cal-cell-day" data-today={iso === hoy || undefined} aria-label={`${etiquetaDia(iso, true)}, ${lista.length} tareas`} onClick={() => setDia(iso)}>{Number(iso.slice(8))}</button>
                  <span className="cal-dots" aria-hidden="true">{lista.slice(0, 4).map(t => <i key={t.id} data-tone={tono(t)} />)}</span>
                  <div className="cal-pills">{lista.slice(0, 3).map(t => <button key={t.id} type="button" className="cal-pill" data-tone={tono(t)} onClick={() => setAbierta(t)} title={t.title}>{t.title}</button>)}{lista.length > 3 && <button type="button" className="cal-more" onClick={() => { setDia(iso); setVista("dia"); }}>+{lista.length - 3} más</button>}</div>
                </div>
              ); })}
            </div>
            <div className="solo-movil cal-day-list"><h2 className="cal-list-day">{capital(etiquetaDia(dia, true))}</h2>{delDia(dia).length === 0 && <p className="cal-empty">Sin tareas este día.</p>}{delDia(dia).map(t => <Bloque key={t.id} t={t} />)}</div>
          </>}
          {vista === "lista" && <div className="cal-list">
            {proximos14.length === 0 && <p className="cal-empty">{loading ? "Cargando…" : "Sin tareas en los próximos 14 días."}</p>}
            {proximos14.map(d => <section key={d} aria-label={etiquetaDia(d, true)}><h2 className="cal-list-day" data-today={d === hoy || undefined}>{capital(etiquetaDia(d, true))}{d === hoy ? " · hoy" : ""}</h2><div>{delDia(d).map(t => <Bloque key={t.id} t={t} />)}</div></section>)}
          </div>}
        </div>
      </div>
      <TaskDialog task={abierta ? data.tasks.find(t => t.id === abierta.id) ?? null : null} onClose={() => setAbierta(null)} />
      <QuickCreatePanels panel={nueva ? "tarea" : null} fecha={nueva ?? undefined} onClose={() => setNueva(null)} />
    </div>
  );
}
