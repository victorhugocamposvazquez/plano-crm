"use client";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Plus, X, SlidersHorizontal } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TaskRow } from "@/components/project/task-row";
import { TaskDialog } from "@/components/project/task-dialog";
import { can, dateLabel, type Task } from "@/lib/domain";
import { localDate } from "@/lib/hoy";
import { useQueryState } from "@/lib/use-query-state";
import { lunesDe, sumarDias, diasDeSemana, etiquetaDia, etiquetaSemana, tareasConProyecto, filtrar, porDia, atrasadasAntesDe, oficios, personas, primerDiaMes, sumarMeses, etiquetaMes, rejillaMes, porDiaDelMes, type TareaAgenda } from "@/lib/agenda";

type Vista = "semana" | "mes";
type Agrupar = "dia" | "persona" | "oficio";

export default function AgendaPage() {
  const { data, actor, busy, loading, send, notify } = useWorkspace();
  const hoy = localDate();
  // Vista, día y filtros viven en la URL: «atrás» y recargar devuelven la misma agenda.
  const [vista, setVista] = useQueryState<Vista>("v", "semana");
  const [dia, setDia] = useQueryState<string>("d", hoy);
  const [oficio, setOficio] = useQueryState<string>("o", "");
  const [persona, setPersona] = useQueryState<string>("p", "");
  const [agrupar, setAgrupar] = useQueryState<Agrupar>("g", "dia");
  const filtros = { oficio, persona };
  const setFiltros = (f: { oficio: string; persona: string }) => { if (f.oficio !== oficio) setOficio(f.oficio); if (f.persona !== persona) setPersona(f.persona); };
  const lunes = lunesDe(dia);
  const mes = primerDiaMes(dia);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const firstName = actor.name.split(/[\s·]+/)[0] ?? "";
  const [adding, setAdding] = useState(false);
  const [nuevaParam, setNuevaParam] = useQueryState<"1" | "">("nueva", "");
  useEffect(() => { if (nuevaParam === "1") { setAdding(true); setNuevaParam(""); } }, [nuevaParam, setNuevaParam]);
  const [pending, setPending] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<Task | null>(null);
  const [form, setForm] = useState({ project_id: "", title: "", trade: "", assignee: "", due_date: hoy, weight: "10" });

  const canCreate = can(actor.role, "task.create");
  const canToggle = can(actor.role, "task.toggle");
  const todas = useMemo(() => tareasConProyecto(data), [data]);
  const visibles = useMemo(() => filtrar(todas, filtros), [todas, filtros]);
  const porDias = useMemo(() => porDia(visibles, lunes), [visibles, lunes]);
  const delMes = useMemo(() => porDiaDelMes(visibles, mes), [visibles, mes]);
  const atrasadas = useMemo(() => atrasadasAntesDe(visibles, lunes), [visibles, lunes]);
  const grupos = useMemo(() => {
    const semana = diasDeSemana(lunes).flatMap(d => porDias.get(d) ?? []);
    const mapa = new Map<string, TareaAgenda[]>();
    for (const t of semana) { const clave = (agrupar === "persona" ? t.assignee : t.trade) || (agrupar === "persona" ? "Sin asignar" : "Sin oficio"); mapa.set(clave, [...(mapa.get(clave) ?? []), t]); }
    return [...mapa.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "es"));
  }, [agrupar, lunes, porDias]);
  const diasTablero = diasDeSemana(lunes).filter((d, i) => i < 5 || (porDias.get(d) ?? []).length > 0);
  const listaOficios = useMemo(() => oficios(data.tasks), [data.tasks]);
  const listaPersonas = useMemo(() => personas(data.tasks), [data.tasks]);
  const diaVisible = vista === "semana" ? (diasDeSemana(lunes).includes(dia) ? dia : lunes) : dia;
  // En la semana, además del día elegido se listan los demás días con tareas: la semana se lee sin tocar cada día.
  const otrosDias = vista === "semana" ? diasDeSemana(lunes).filter(d => d !== diaVisible && (porDias.get(d) ?? []).length > 0) : [];
  const pendientesSemana = diasDeSemana(lunes).reduce((n, d) => n + (porDias.get(d) ?? []).filter(t => t.status === "pending").length, 0);
  const miasPosible = listaPersonas.includes(firstName);
  const textoFiltros = [filtros.oficio || "Todos los oficios", filtros.persona || "todas las personas"].join(" · ");
  const tareasDelDia = vista === "semana" ? (porDias.get(diaVisible) ?? []) : (delMes.get(diaVisible) ?? []);
  // El diálogo lee la tarea viva del espacio, para que al completarla desde dentro se refresque.
  const tareaAbierta = abierta ? data.tasks.find(t => t.id === abierta.id) ?? null : null;

  function moverSemana(n: number) { const nuevo = sumarDias(lunes, 7 * n); setDia(nuevo === lunesDe(hoy) ? hoy : nuevo); }
  function moverMes(n: number) { const nuevo = sumarMeses(mes, n); setDia(nuevo === primerDiaMes(hoy) ? hoy : nuevo); }
  function irAHoy() { setDia(hoy); }
  function elegirDia(d: string) { setDia(d); }

  async function toggle(task: Task) {
    if (!canToggle || busy || pending) return;
    setPending(task.id);
    try { await send({ type: "task.toggle", id: task.id, status: task.status === "done" ? "pending" : "done" }); notify(task.status === "done" ? `Reabierta: ${task.title}` : `Completada: ${task.title}`, { label: "Deshacer", run: () => send({ type: "task.toggle", id: task.id, status: task.status }) }); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido actualizar la tarea."); }
    finally { setPending(null); }
  }

  async function crear(event: FormEvent) {
    event.preventDefault();
    if (pending || busy) return;
    setPending("new");
    try {
      await send({ type: "task.create", project_id: form.project_id, title: form.title.trim(), trade: form.trade.trim() || "Coordinación", assignee: form.assignee.trim(), due_date: form.due_date, weight: Math.max(1, Math.min(100, Number(form.weight) || 10)) });
      notify(`Tarea planificada: ${form.title.trim()}`);
      setForm({ ...form, title: "" }); setAdding(false); elegirDia(form.due_date);
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido crear la tarea."); }
    finally { setPending(null); }
  }

  const Lista = ({ tareas, vacio, conFecha = false, accion }: { tareas: TareaAgenda[]; vacio: string; conFecha?: boolean; accion?: React.ReactNode }) => (
    tareas.length === 0
      ? <p className="muted text-sm empty-line" style={{ padding: "8px 0" }}>{vacio}{accion}</p>
      : <div>{tareas.map(t => <TaskRow key={t.id} task={t} projectName={t.project.name} canToggle={canToggle} pending={pending === t.id} showDate={conFecha} compact onToggle={toggle} onOpen={setAbierta} />)}</div>
  );

  return (
    <div className="page">
      <div>
        <div className="pl-head">
          <div><h1 className="pl-title">Agenda <span className="pl-title-soft">· {vista === "semana" ? `semana del ${dateLabel(lunes)}` : etiquetaMes(mes)}</span></h1><p className="pl-sub">{loading ? "Cargando…" : `${pendientesSemana} ${pendientesSemana === 1 ? "tarea pendiente" : "tareas pendientes"} esta semana · quién está en qué proyecto cada día`}</p></div>
          {canCreate && <Button variant={adding ? "secondary" : "primary"} aria-expanded={adding} onClick={() => { setAdding(v => !v); setForm(f => ({ ...f, due_date: diaVisible, project_id: f.project_id || data.projects.find(p => p.status === "active")?.id || data.projects[0]?.id || "" })); }}>{adding ? <X size={17} strokeWidth={1.8} aria-hidden="true" /> : <Plus size={17} strokeWidth={1.8} aria-hidden="true" />}{adding ? "Cerrar" : "Nueva tarea"}</Button>}
        </div>
      </div>

      {adding && canCreate && (
        <form className="form line" onSubmit={crear} style={{ maxWidth: "none" }}>
          <div className="line-grid">
            <div className="field"><span>Proyecto</span><Select label="Proyecto" value={form.project_id} onChange={v => setForm({ ...form, project_id: v })} options={data.projects.map(p => ({ value: p.id, label: p.name, hint: p.client_name }))} /></div>
            <label className="field"><span>Fecha</span><input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} required /></label>
          </div>
          <label className="field"><span>Tarea</span><input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Replantear tabiquería con el electricista" required maxLength={500} autoFocus /></label>
          <details className="editor-advanced" open={Boolean(form.trade || form.assignee)}>
          <summary>Más detalles · oficio, responsable y cuánto cuenta</summary>
          <div className="line-grid" style={{ marginTop: 10 }}>
            <div className="field"><span>Oficio</span><Select label="Oficio" value={form.trade} onChange={v => setForm({ ...form, trade: v })} options={listaOficios.map(o => ({ value: o, label: o }))} placeholder="Elegir oficio…" /></div>
            <label className="field"><span>Responsable</span><input list="personas" type="text" value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })} placeholder="Nombre o equipo" maxLength={120} /><datalist id="personas">{listaPersonas.map(p => <option key={p} value={p} />)}</datalist></label>
            <label className="field"><span>Cuánto cuenta en el avance</span><span className="unit-input"><input type="number" inputMode="numeric" min={1} max={100} value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} /><span>%</span></span></label>
          </div>
          <p className="muted text-xs">Sin oficio queda como «Coordinación»; el avance se reparte entre las tareas y 10 es lo normal.</p>
          </details>
          <div className="form-actions"><span className="muted text-xs" style={{ alignSelf: "center" }}>Con el qué y el cuándo basta para planificarla.</span><Button type="submit" variant="primary" disabled={pending === "new" || busy || !form.title.trim() || !form.project_id}>{pending === "new" ? "Guardando…" : "Planificar"}</Button></div>
        </form>
      )}

      <div className="toolbar">
        <div className="week-nav">
          <Button variant="icon" aria-label={vista === "semana" ? "Semana anterior" : "Mes anterior"} onClick={() => (vista === "semana" ? moverSemana(-1) : moverMes(-1))}><ChevronLeft size={19} strokeWidth={1.55} aria-hidden="true" /></Button>
          <Button variant="icon" aria-label={vista === "semana" ? "Semana siguiente" : "Mes siguiente"} onClick={() => (vista === "semana" ? moverSemana(1) : moverMes(1))}><ChevronRight size={19} strokeWidth={1.55} aria-hidden="true" /></Button>
          <button type="button" className="week-label" onClick={irAHoy} title="Ir a hoy"><strong>{vista === "semana" ? etiquetaSemana(lunes) : etiquetaMes(mes)}</strong><small className="muted">{(vista === "semana" ? lunes === lunesDe(hoy) : mes === primerDiaMes(hoy)) ? (vista === "semana" ? "esta semana" : "este mes") : "volver a hoy"}</small></button>
        </div>
        <div className="agenda-views">
          {vista === "semana" && <div className="pl-seg" role="group" aria-label="Ordenar la semana">
            <button type="button" aria-pressed={agrupar === "dia"} onClick={() => setAgrupar("dia")}>Por día</button>
            <button type="button" aria-pressed={agrupar === "persona"} onClick={() => setAgrupar("persona")}>Por persona</button>
            <button type="button" aria-pressed={agrupar === "oficio"} onClick={() => setAgrupar("oficio")}>Por oficio</button>
          </div>}
          <div className="pl-seg" role="group" aria-label="Vista">
            <button type="button" aria-pressed={vista === "semana"} onClick={() => setVista("semana")}>Semana</button>
            <button type="button" aria-pressed={vista === "mes"} onClick={() => setVista("mes")}>Mes</button>
          </div>
        </div>
      </div>

      <div className="filters-compact" role="group" aria-label="Filtros">
        <button type="button" className="chip" aria-pressed={Boolean(filtros.oficio || filtros.persona)} aria-haspopup="dialog" onClick={() => setFiltrosAbiertos(true)}><SlidersHorizontal size={14} strokeWidth={1.7} aria-hidden="true" />{textoFiltros}</button>
        {miasPosible && <button type="button" className="chip" aria-pressed={filtros.persona === firstName} onClick={() => setFiltros({ ...filtros, persona: filtros.persona === firstName ? "" : firstName })}>Solo las mías</button>}
      </div>
      <Modal open={filtrosAbiertos} onClose={() => setFiltrosAbiertos(false)} title="Filtrar la agenda" footer={<><Button variant="ghost" onClick={() => { setFiltros({ oficio: "", persona: "" }); }} disabled={!filtros.oficio && !filtros.persona}>Quitar filtros</Button><Button variant="primary" onClick={() => setFiltrosAbiertos(false)}>Listo</Button></>}>
        <div className="form" style={{ maxWidth: "none" }}>
          <div className="field"><span>Oficio</span><Select label="Filtrar por oficio" value={filtros.oficio} onChange={v => setFiltros({ ...filtros, oficio: v })} options={[{ value: "", label: "Todos los oficios" }, ...listaOficios.map(o => ({ value: o, label: o }))]} /></div>
          <div className="field"><span>Persona</span><Select label="Filtrar por persona" value={filtros.persona} onChange={v => setFiltros({ ...filtros, persona: v })} options={[{ value: "", label: "Todas las personas" }, ...listaPersonas.map(p => ({ value: p, label: p }))]} /></div>
        </div>
      </Modal>
      <div className="filters filters-wide">
        <Select size="sm" label="Filtrar por oficio" value={filtros.oficio} onChange={v => setFiltros({ ...filtros, oficio: v })} options={[{ value: "", label: "Todos los oficios" }, ...listaOficios.map(o => ({ value: o, label: o }))]} />
        <Select size="sm" label="Filtrar por persona" value={filtros.persona} onChange={v => setFiltros({ ...filtros, persona: v })} options={[{ value: "", label: "Todas las personas" }, ...listaPersonas.map(p => ({ value: p, label: p }))]} />
        {(filtros.oficio || filtros.persona) && <Button variant="ghost" onClick={() => { const antes = { ...filtros }; setFiltros({ oficio: "", persona: "" }); notify("Filtros quitados", { label: "Deshacer", run: () => setFiltros(antes) }); }}>Quitar filtros</Button>}
      </div>

      {atrasadas.length > 0 && <section className="pl-card agenda-late" aria-label="Pendientes de semanas anteriores"><h2 className="task-group-title" data-tone="danger">Pendientes de semanas anteriores <span className="pl-mono">{atrasadas.length}</span></h2><div style={{ padding: "0 16px" }}><Lista tareas={atrasadas} vacio="" conFecha /></div></section>}

      {vista === "semana" && agrupar !== "dia" && <div className="agenda-groups">
        {grupos.length === 0 && <p className="muted text-sm">Sin tareas esta semana.</p>}
        {grupos.map(([clave, lista]) => <section key={clave} className="pl-card" aria-label={clave}><h2 className="task-group-title">{clave} <span className="pl-mono">{lista.length}</span></h2><div style={{ padding: "0 16px" }}><Lista tareas={lista} vacio="" conFecha /></div></section>)}
      </div>}

      {vista === "semana" && agrupar === "dia" && <div className="week-board" role="group" aria-label="Tareas de la semana" style={{ "--dias": diasTablero.length } as CSSProperties}>
        {diasTablero.map(d => { const lista = porDias.get(d) ?? []; return (
          <section key={d} className="week-col" data-today={d === hoy || undefined} aria-label={etiquetaDia(d, true)}>
            <h2>{etiquetaDia(d)} {Number(d.slice(8))}{d === hoy ? " · hoy" : ""}</h2>
            {lista.length === 0 && canCreate && <button type="button" className="week-empty" aria-label={`Planificar una tarea el ${etiquetaDia(d, true)}`} onClick={() => { setAdding(true); setForm(f => ({ ...f, due_date: d, project_id: f.project_id || data.projects.find(p => p.status === "active")?.id || data.projects[0]?.id || "" })); }}>+</button>}
            {lista.map(t => <button key={t.id} type="button" className="week-task" data-tone={t.status === "done" ? "success" : t.due_date < hoy ? "danger" : d === hoy ? "warning" : undefined} onClick={() => setAbierta(t)} aria-haspopup="dialog"><strong>{t.title}</strong><small>{t.project.name}</small>{t.assignee && <small>{t.assignee}</small>}</button>)}
          </section>
        ); })}
      </div>}

      <div className="agenda-phone" data-mes={vista === "mes" || undefined} data-oculta={vista === "semana" && agrupar !== "dia" || undefined}>
        <section>
          {vista === "semana" ? (
            <div className="week" role="tablist" aria-label="Días de la semana">
              {diasDeSemana(lunes).map(d => {
                const lista = porDias.get(d) ?? [];
                const pendientes = lista.filter(t => t.status === "pending").length;
                return (
                  <button key={d} type="button" role="tab" className="week-day" aria-selected={d === diaVisible} data-today={d === hoy} onClick={() => setDia(d)}>
                    <span>{etiquetaDia(d)}</span>
                    <strong>{Number(d.slice(8))}</strong>
                    <small className="pl-mono">{pendientes || (lista.length ? "✓" : "·")}</small>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="month" role="grid" aria-label={etiquetaMes(mes)}>
              {["L", "M", "X", "J", "V", "S", "D"].map(d => <div key={d} className="month-head" role="columnheader">{d}</div>)}
              {rejillaMes(mes).flat().map(({ iso, enMes }) => {
                const lista = delMes.get(iso) ?? [];
                return (
                  <button key={iso} type="button" role="gridcell" className="month-day" data-out={!enMes} data-today={iso === hoy} aria-selected={iso === diaVisible} aria-label={`${etiquetaDia(iso, true)}, ${lista.length} tareas`} onClick={() => setDia(iso)}>
                    <span className="num">{Number(iso.slice(8))}</span>
                    <span className="dots" aria-hidden="true">{lista.slice(0, 6).map(t => <i key={t.id} data-done={t.status === "done"} data-late={t.status === "pending" && t.due_date < hoy} />)}</span>
                    <span className="titles" aria-hidden="true">{lista.slice(0, 3).map(t => <span key={t.id} data-done={t.status === "done"} data-late={t.status === "pending" && t.due_date < hoy}>{t.title}</span>)}{lista.length > 3 && <span className="muted">+{lista.length - 3} más</span>}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="section-label" style={{ marginTop: 16 }}><span className={diaVisible === hoy ? "warning" : undefined}>{etiquetaDia(diaVisible, true)}{diaVisible === hoy ? " · hoy" : ""}</span><span className="pl-mono">{tareasDelDia.length}</span></div>
          <Lista tareas={tareasDelDia} vacio="Sin tareas este día." accion={canCreate ? <button type="button" className="link-button" onClick={() => { setAdding(true); setForm(f => ({ ...f, due_date: diaVisible, project_id: f.project_id || data.projects.find(p => p.status === "active")?.id || data.projects[0]?.id || "" })); document.querySelector(".shell-main")?.scrollTo({ top: 0, behavior: "smooth" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Planificar una tarea para este día</button> : undefined} />
          {otrosDias.map(d => <div key={d}><div className="section-label"><span className={d === hoy ? "warning" : undefined}>{etiquetaDia(d, true)}{d === hoy ? " · hoy" : ""}</span><span className="pl-mono">{(porDias.get(d) ?? []).length}</span></div><Lista tareas={porDias.get(d) ?? []} vacio="" /></div>)}
        </section>

      </div>

      <TaskDialog task={tareaAbierta} onClose={() => setAbierta(null)} />
    </div>
  );
}
