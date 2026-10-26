"use client";
import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { can, dateLabel, type Task } from "@/lib/domain";
import { localDate } from "@/lib/hoy";
import { lunesDe, sumarDias, diasDeSemana, etiquetaDia, etiquetaSemana, tareasConProyecto, filtrar, porDia, atrasadasAntesDe, cargaSemanal, oficios, personas, type TareaAgenda } from "@/lib/agenda";

export default function AgendaPage() {
  const { data, actor, busy, loading, send, notify } = useWorkspace();
  const hoy = localDate();
  const [lunes, setLunes] = useState(() => lunesDe(hoy));
  const [dia, setDia] = useState(hoy);
  const [filtros, setFiltros] = useState({ oficio: "", persona: "" });
  const [carga, setCarga] = useState<"trade" | "assignee">("trade");
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [form, setForm] = useState({ project_id: "", title: "", trade: "", assignee: "", due_date: hoy, weight: "10" });

  const canCreate = can(actor.role, "task.create");
  const canToggle = can(actor.role, "task.toggle");
  const todas = useMemo(() => tareasConProyecto(data), [data]);
  const visibles = useMemo(() => filtrar(todas, filtros), [todas, filtros]);
  const dias = useMemo(() => porDia(visibles, lunes), [visibles, lunes]);
  const atrasadas = useMemo(() => atrasadasAntesDe(visibles, lunes), [visibles, lunes]);
  const cargas = useMemo(() => cargaSemanal(visibles, lunes, carga), [visibles, lunes, carga]);
  const listaOficios = useMemo(() => oficios(data.tasks), [data.tasks]);
  const listaPersonas = useMemo(() => personas(data.tasks), [data.tasks]);
  const diaVisible = diasDeSemana(lunes).includes(dia) ? dia : lunes;

  function mover(semanas: number) {
    const nuevo = sumarDias(lunes, 7 * semanas);
    setLunes(nuevo); setDia(nuevo === lunesDe(hoy) ? hoy : nuevo);
  }

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
      setForm({ ...form, title: "" }); setAdding(false); setLunes(lunesDe(form.due_date)); setDia(form.due_date);
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido crear la tarea."); }
    finally { setPending(null); }
  }

  const Fila = ({ t, conFecha = false }: { t: TareaAgenda; conFecha?: boolean }) => (
    <label className="task-row" data-done={t.status === "done"}>
      <input type="checkbox" checked={t.status === "done"} disabled={!canToggle || pending === t.id} onChange={() => toggle(t)} aria-label={`${t.status === "done" ? "Reabrir" : "Completar"} ${t.title}`} />
      <span style={{ minWidth: 0 }}>
        <span className="task-title">{t.title}</span>
        <span className="task-meta">{t.project.name} · {t.trade}{t.assignee ? ` · ${t.assignee}` : " · sin asignar"}{conFecha ? ` · ${dateLabel(t.due_date)}` : ""} · peso {t.weight}%</span>
      </span>
      <Link href={`/proyectos/${t.project_id}`} className="muted task-open" aria-label={`Abrir ${t.project.name}`}><ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" /></Link>
    </label>
  );

  return (
    <div className="page">
      <div>
        <div className="eyebrow"><CalendarDays size={13} strokeWidth={1.8} aria-hidden="true" /><span>{data.organization_name || "Espacio de trabajo"}</span></div>
        <div className="page-head">
          <h1 className="h1">Agenda de oficios.</h1>
          {canCreate && <Button variant="icon" aria-label={adding ? "Cerrar" : "Nueva tarea"} aria-expanded={adding} onClick={() => { setAdding(v => !v); setForm(f => ({ ...f, due_date: diaVisible, project_id: f.project_id || data.projects.find(p => p.status === "active")?.id || data.projects[0]?.id || "" })); }}>{adding ? <X size={19} strokeWidth={1.55} aria-hidden="true" /> : <Plus size={19} strokeWidth={1.55} aria-hidden="true" />}</Button>}
        </div>
        <p className="subtitle">{loading ? "Cargando…" : "Quién está en qué proyecto cada día. La disponibilidad por trabajador y las horas llegarán con el dominio."}</p>
      </div>

      {adding && canCreate && (
        <form className="form line" onSubmit={crear} style={{ maxWidth: "none" }}>
          <div className="line-grid">
            <label className="field"><span>Proyecto</span><select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} required>{data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="field"><span>Fecha</span><input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} required /></label>
          </div>
          <label className="field"><span>Tarea</span><input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Replantear tabiquería con el electricista" required maxLength={500} autoFocus /></label>
          <div className="line-grid">
            <label className="field"><span>Oficio</span><input list="oficios" type="text" value={form.trade} onChange={e => setForm({ ...form, trade: e.target.value })} placeholder="Electricidad" required maxLength={120} /><datalist id="oficios">{listaOficios.map(o => <option key={o} value={o} />)}</datalist></label>
            <label className="field"><span>Responsable</span><input list="personas" type="text" value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })} placeholder="Nombre o equipo" maxLength={120} /><datalist id="personas">{listaPersonas.map(p => <option key={p} value={p} />)}</datalist></label>
            <label className="field"><span>Peso en el avance</span><span className="unit-input"><input type="number" inputMode="numeric" min={1} max={100} value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} /><span>%</span></span></label>
          </div>
          <div className="form-actions"><span className="muted text-xs" style={{ alignSelf: "center" }}>El peso reparte el avance del proyecto entre sus tareas.</span><Button type="submit" variant="primary" disabled={pending === "new" || busy || !form.title.trim() || !form.trade.trim() || !form.project_id}>{pending === "new" ? "Guardando…" : "Planificar"}</Button></div>
        </form>
      )}

      <div className="week-nav">
        <Button variant="icon" aria-label="Semana anterior" onClick={() => mover(-1)}><ChevronLeft size={19} strokeWidth={1.55} aria-hidden="true" /></Button>
        <button type="button" className="week-label" onClick={() => { setLunes(lunesDe(hoy)); setDia(hoy); }} title="Ir a la semana actual"><strong>{etiquetaSemana(lunes)}</strong>{lunes === lunesDe(hoy) && <small className="muted">esta semana</small>}</button>
        <Button variant="icon" aria-label="Semana siguiente" onClick={() => mover(1)}><ChevronRight size={19} strokeWidth={1.55} aria-hidden="true" /></Button>
      </div>

      <div className="filters">
        <select value={filtros.oficio} onChange={e => setFiltros({ ...filtros, oficio: e.target.value })} aria-label="Filtrar por oficio"><option value="">Todos los oficios</option>{listaOficios.map(o => <option key={o} value={o}>{o}</option>)}</select>
        <select value={filtros.persona} onChange={e => setFiltros({ ...filtros, persona: e.target.value })} aria-label="Filtrar por persona"><option value="">Todas las personas</option>{listaPersonas.map(p => <option key={p} value={p}>{p}</option>)}</select>
        {(filtros.oficio || filtros.persona) && <Button variant="ghost" onClick={() => setFiltros({ oficio: "", persona: "" })}>Quitar filtros</Button>}
      </div>

      <div className="detail">
        <section>
          <div className="week" role="tablist" aria-label="Días de la semana">
            {diasDeSemana(lunes).map(d => {
              const lista = dias.get(d) ?? [];
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

          <div className="week-grid">
            {diasDeSemana(lunes).map(d => {
              const lista = dias.get(d) ?? [];
              return (
                <div key={d} className="day-col" data-active={d === diaVisible}>
                  <div className="section-label" style={{ marginTop: 16 }}><span className={d === hoy ? "warning" : undefined}>{etiquetaDia(d, true)}</span><span className="pl-mono">{lista.length}</span></div>
                  {lista.length === 0 && <p className="muted text-sm" style={{ padding: "8px 0" }}>Sin tareas.</p>}
                  {lista.map(t => <Fila key={t.id} t={t} />)}
                </div>
              );
            })}
          </div>
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div className="section-label" style={{ marginTop: 0 }}>
              <span>Carga de la semana</span>
              <span className="segments" style={{ gap: 4 }}>
                <button type="button" className="segment" style={{ minHeight: 32, padding: "4px 10px" }} aria-selected={carga === "trade"} onClick={() => setCarga("trade")}><span>Por oficio</span></button>
                <button type="button" className="segment" style={{ minHeight: 32, padding: "4px 10px" }} aria-selected={carga === "assignee"} onClick={() => setCarga("assignee")}><span>Por persona</span></button>
              </span>
            </div>
            <div className="panel">
              {cargas.length === 0 && <div className="panel-body muted text-sm">Nadie tiene tareas pendientes esta semana.</div>}
              {cargas.map((c, i) => (
                <div key={c.clave} className="panel-row" style={i === 0 ? { borderTop: 0 } : undefined}>
                  <span>{c.clave}<small className="muted text-xs" style={{ display: "block" }}>{c.proyectos} proyecto{c.proyectos === 1 ? "" : "s"}</small></span>
                  <span className="pl-mono">{c.pendientes} pend.</span>
                </div>
              ))}
            </div>
          </div>
          {atrasadas.length > 0 && (
            <div>
              <div className="section-label" style={{ marginTop: 0 }}><span className="warning">Pendientes de semanas anteriores</span><span className="pl-mono">{atrasadas.length}</span></div>
              {atrasadas.map(t => <Fila key={t.id} t={t} conFecha />)}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
