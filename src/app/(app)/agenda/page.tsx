"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TaskRow } from "@/components/project/task-row";
import { TaskDialog } from "@/components/project/task-dialog";
import { can, type Task } from "@/lib/domain";
import { localDate } from "@/lib/hoy";
import { useQueryState } from "@/lib/use-query-state";
import { lunesDe, sumarDias, diasDeSemana, etiquetaDia, etiquetaSemana, tareasConProyecto, filtrar, porDia, atrasadasAntesDe, cargaSemanal, oficios, personas, primerDiaMes, sumarMeses, etiquetaMes, rejillaMes, porDiaDelMes, type TareaAgenda } from "@/lib/agenda";

type Vista = "semana" | "mes";

export default function AgendaPage() {
  const { data, actor, busy, loading, send, notify } = useWorkspace();
  const hoy = localDate();
  // Vista, día y filtros viven en la URL: «atrás» y recargar devuelven la misma agenda.
  const [vista, setVista] = useQueryState<Vista>("v", "semana");
  const [dia, setDia] = useQueryState<string>("d", hoy);
  const [oficio, setOficio] = useQueryState<string>("o", "");
  const [persona, setPersona] = useQueryState<string>("p", "");
  const filtros = { oficio, persona };
  const setFiltros = (f: { oficio: string; persona: string }) => { if (f.oficio !== oficio) setOficio(f.oficio); if (f.persona !== persona) setPersona(f.persona); };
  const lunes = lunesDe(dia);
  const mes = primerDiaMes(dia);
  const [carga, setCarga] = useState<"trade" | "assignee">("trade");
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
  const cargas = useMemo(() => cargaSemanal(visibles, lunes, carga), [visibles, lunes, carga]);
  const listaOficios = useMemo(() => oficios(data.tasks), [data.tasks]);
  const listaPersonas = useMemo(() => personas(data.tasks), [data.tasks]);
  const diaVisible = vista === "semana" ? (diasDeSemana(lunes).includes(dia) ? dia : lunes) : dia;
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
    try { await send({ type: "task.toggle", id: task.id, status: task.status === "done" ? "pending" : "done" }); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido actualizar la tarea."); }
    finally { setPending(null); }
  }

  async function crear(event: FormEvent) {
    event.preventDefault();
    if (pending || busy) return;
    setPending("new");
    try {
      await send({ type: "task.create", project_id: form.project_id, title: form.title.trim(), trade: form.trade.trim(), assignee: form.assignee.trim(), due_date: form.due_date, weight: Math.max(1, Math.min(100, Number(form.weight) || 10)) });
      notify(`Tarea planificada: ${form.title.trim()}`);
      setForm({ ...form, title: "" }); setAdding(false); elegirDia(form.due_date);
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido crear la tarea."); }
    finally { setPending(null); }
  }

  const Lista = ({ tareas, vacio, conFecha = false }: { tareas: TareaAgenda[]; vacio: string; conFecha?: boolean }) => (
    tareas.length === 0
      ? <p className="muted text-sm" style={{ padding: "8px 0" }}>{vacio}</p>
      : <div>{tareas.map(t => <TaskRow key={t.id} task={t} projectName={t.project.name} canToggle={canToggle} pending={pending === t.id} showDate={conFecha} onToggle={toggle} onOpen={setAbierta} />)}</div>
  );

  return (
    <div className="page">
      <div>
        <div className="eyebrow"><CalendarDays size={13} strokeWidth={1.8} aria-hidden="true" /><span>{data.organization_name || "Espacio de trabajo"}</span></div>
        <div className="page-head">
          <h1 className="h1">Agenda de oficios.</h1>
          {canCreate && <Button variant={adding ? "secondary" : "primary"} className="btn-new" aria-expanded={adding} onClick={() => { setAdding(v => !v); setForm(f => ({ ...f, due_date: diaVisible, project_id: f.project_id || data.projects.find(p => p.status === "active")?.id || data.projects[0]?.id || "" })); }}>{adding ? <X size={17} strokeWidth={1.8} aria-hidden="true" /> : <Plus size={17} strokeWidth={1.8} aria-hidden="true" />}{adding ? "Cerrar" : "Nueva tarea"}</Button>}
        </div>
        <p className="subtitle">{loading ? "Cargando…" : "Quién está en qué proyecto cada día. La disponibilidad por trabajador y las horas llegarán con el dominio."}</p>
      </div>

      {adding && canCreate && (
        <form className="form line" onSubmit={crear} style={{ maxWidth: "none" }}>
          <div className="line-grid">
            <div className="field"><span>Proyecto</span><Select label="Proyecto" value={form.project_id} onChange={v => setForm({ ...form, project_id: v })} options={data.projects.map(p => ({ value: p.id, label: p.name, hint: p.client_name }))} /></div>
            <label className="field"><span>Fecha</span><input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} required /></label>
          </div>
          <label className="field"><span>Tarea</span><input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Replantear tabiquería con el electricista" required maxLength={500} autoFocus /></label>
          <div className="line-grid">
            <div className="field"><span>Oficio</span><Select label="Oficio" value={form.trade} onChange={v => setForm({ ...form, trade: v })} options={listaOficios.map(o => ({ value: o, label: o }))} placeholder="Elegir oficio…" /></div>
            <label className="field"><span>Responsable</span><input list="personas" type="text" value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })} placeholder="Nombre o equipo" maxLength={120} /><datalist id="personas">{listaPersonas.map(p => <option key={p} value={p} />)}</datalist></label>
            <label className="field"><span>Peso en el avance</span><span className="unit-input"><input type="number" inputMode="numeric" min={1} max={100} value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} /><span>%</span></span></label>
          </div>
          <div className="form-actions"><span className="muted text-xs" style={{ alignSelf: "center" }}>El peso reparte el avance del proyecto entre sus tareas.</span><Button type="submit" variant="primary" disabled={pending === "new" || busy || !form.title.trim() || !form.trade.trim() || !form.project_id}>{pending === "new" ? "Guardando…" : "Planificar"}</Button></div>
        </form>
      )}

      <div className="toolbar">
        <div className="week-nav">
          <Button variant="icon" aria-label={vista === "semana" ? "Semana anterior" : "Mes anterior"} onClick={() => (vista === "semana" ? moverSemana(-1) : moverMes(-1))}><ChevronLeft size={19} strokeWidth={1.55} aria-hidden="true" /></Button>
          <Button variant="icon" aria-label={vista === "semana" ? "Semana siguiente" : "Mes siguiente"} onClick={() => (vista === "semana" ? moverSemana(1) : moverMes(1))}><ChevronRight size={19} strokeWidth={1.55} aria-hidden="true" /></Button>
          <button type="button" className="week-label" onClick={irAHoy} title="Ir a hoy"><strong>{vista === "semana" ? etiquetaSemana(lunes) : etiquetaMes(mes)}</strong><small className="muted">{(vista === "semana" ? lunes === lunesDe(hoy) : mes === primerDiaMes(hoy)) ? (vista === "semana" ? "esta semana" : "este mes") : "volver a hoy"}</small></button>
        </div>
        <div className="view-toggle" role="group" aria-label="Vista">
          <button type="button" aria-pressed={vista === "semana"} onClick={() => setVista("semana")}>Semana</button>
          <button type="button" aria-pressed={vista === "mes"} onClick={() => setVista("mes")}>Calendario</button>
        </div>
      </div>

      <div className="filters">
        <Select size="sm" label="Filtrar por oficio" value={filtros.oficio} onChange={v => setFiltros({ ...filtros, oficio: v })} options={[{ value: "", label: "Todos los oficios" }, ...listaOficios.map(o => ({ value: o, label: o }))]} />
        <Select size="sm" label="Filtrar por persona" value={filtros.persona} onChange={v => setFiltros({ ...filtros, persona: v })} options={[{ value: "", label: "Todas las personas" }, ...listaPersonas.map(p => ({ value: p, label: p }))]} />
        {(filtros.oficio || filtros.persona) && <Button variant="ghost" onClick={() => setFiltros({ oficio: "", persona: "" })}>Quitar filtros</Button>}
      </div>

      <div className="detail">
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

          <div className="section-label" style={{ marginTop: 16 }}><span className={diaVisible === hoy ? "warning" : undefined}>{etiquetaDia(diaVisible, true)}</span><span className="pl-mono">{tareasDelDia.length}</span></div>
          <Lista tareas={tareasDelDia} vacio="Sin tareas este día." />
        </section>

        <aside className="zone" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div className="section-label" style={{ marginTop: 0 }}><span>Carga de la semana</span><span className="pl-mono">{cargas.reduce((s, c) => s + c.pendientes, 0)} pend.</span></div>
            <div className="view-toggle" role="group" aria-label="Agrupar la carga" style={{ marginBottom: 10 }}>
              <button type="button" aria-pressed={carga === "trade"} onClick={() => setCarga("trade")}>Por oficio</button>
              <button type="button" aria-pressed={carga === "assignee"} onClick={() => setCarga("assignee")}>Por persona</button>
            </div>
            <div className="panel">
              {cargas.length === 0 && <div className="panel-body muted text-sm">Nadie tiene tareas pendientes esta semana.</div>}
              {cargas.map((c, i) => (
                <div key={c.clave} className="panel-row" style={i === 0 ? { borderTop: 0 } : undefined}>
                  <span>{c.clave}<small className="muted text-xs" style={{ display: "block" }}>{c.proyectos} proyecto{c.proyectos === 1 ? "" : "s"}</small></span>
                  <span className="pl-mono">{c.pendientes}</span>
                </div>
              ))}
            </div>
          </div>
          {atrasadas.length > 0 && (
            <div>
              <div className="section-label" style={{ marginTop: 0 }}><span className="danger">Pendientes de semanas anteriores</span><span className="pl-mono">{atrasadas.length}</span></div>
              <Lista tareas={atrasadas} vacio="" conFecha />
            </div>
          )}
        </aside>
      </div>

      <TaskDialog task={tareaAbierta} onClose={() => setAbierta(null)} />
    </div>
  );
}
