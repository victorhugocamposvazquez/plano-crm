"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Pencil, Trash2, CalendarPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Status } from "@/components/ui/status";
import { useWorkspace } from "@/components/workspace-provider";
import { can, dateLabel, type Task } from "@/lib/domain";
import { localDate } from "@/lib/hoy";
import { oficios, oficiosHabituales, personas, sumarDias } from "@/lib/agenda";

const fechaLarga = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/**
 * Detalle de una tarea sin salir de la pantalla: estado, proyecto, oficio, responsable, fecha y peso.
 * Desde aquí se completa, se edita (título, oficio, responsable, fecha, peso), se pospone un día o una semana y se elimina.
 */
export function TaskDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { data, actor, busy, send, notify } = useWorkspace();
  const [pending, setPending] = useState(false);
  const [modo, setModo] = useState<"ver" | "editar" | "eliminar">("ver");
  const [form, setForm] = useState({ title: "", trade: "", assignee: "", due_date: "", weight: "10" });
  const project = task ? data.projects.find(p => p.id === task.project_id) : undefined;
  const canToggle = can(actor.role, "task.toggle");
  const canEdit = can(actor.role, "task.update");
  const canDelete = can(actor.role, "task.delete");
  const listaOficios = useMemo(() => { const o = oficios(data.tasks); return o.length ? o : oficiosHabituales; }, [data.tasks]);
  const listaPersonas = useMemo(() => personas(data.tasks), [data.tasks]);

  useEffect(() => { setModo("ver"); if (task) setForm({ title: task.title, trade: task.trade, assignee: task.assignee, due_date: task.due_date, weight: String(task.weight) }); }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function ejecutar(fn: () => Promise<unknown>, error: string, despues?: () => void) {
    if (busy || pending) return;
    setPending(true);
    try { await fn(); despues?.(); }
    catch (e) { notify(e instanceof Error ? e.message : error); }
    finally { setPending(false); }
  }
  const toggle = () => task && canToggle && ejecutar(() => send({ type: "task.toggle", id: task.id, status: task.status === "done" ? "pending" : "done" }), "No se ha podido actualizar la tarea.");
  const posponer = (dias: number) => task && canEdit && ejecutar(() => send({ type: "task.update", id: task.id, due_date: sumarDias(task.due_date, dias) }), "No se ha podido mover la tarea.", () => notify(`Tarea movida al ${dateLabel(sumarDias(task.due_date, dias))}`));
  const eliminar = () => task && canDelete && ejecutar(() => send({ type: "task.delete", id: task.id }), "No se ha podido eliminar la tarea.", () => { notify(`Tarea eliminada: ${task.title}`); onClose(); });
  function guardar(event: FormEvent) {
    event.preventDefault();
    if (!task || !canEdit) return;
    const weight = Math.min(100, Math.max(1, Number(form.weight) || task.weight));
    void ejecutar(() => send({ type: "task.update", id: task.id, title: form.title.trim(), trade: form.trade.trim(), assignee: form.assignee.trim(), due_date: form.due_date, weight }), "No se ha podido guardar la tarea.", () => { notify("Tarea actualizada"); setModo("ver"); });
  }

  const vencida = task ? task.status === "pending" && task.due_date < localDate() : false;
  const tone = !task ? "muted" : task.status === "done" ? "success" : vencida ? "danger" : task.due_date === localDate() ? "warning" : "info";
  const label = !task ? "" : task.status === "done" ? "Completada" : vencida ? "Atrasada" : task.due_date === localDate() ? "Para hoy" : "Pendiente";

  const footer = !task ? null : modo === "editar" ? (
    <><Button variant="secondary" onClick={() => setModo("ver")} disabled={pending}>Cancelar</Button><Button variant="primary" type="submit" form="editar-tarea" disabled={pending || busy || !form.title.trim() || !form.trade.trim() || !form.due_date}>{pending ? "Guardando…" : "Guardar cambios"}</Button></>
  ) : modo === "eliminar" ? (
    <><Button variant="secondary" onClick={() => setModo("ver")} disabled={pending}>Conservar</Button><Button variant="primary" onClick={eliminar} disabled={pending || busy} className="btn-danger">{pending ? "Eliminando…" : "Eliminar tarea"}</Button></>
  ) : (
    <>
      {project && <Link href={`/proyectos/${project.id}`} className="btn btn-secondary" onClick={onClose}><ArrowUpRight size={16} strokeWidth={1.6} aria-hidden="true" />Abrir proyecto</Link>}
      {canToggle && <Button variant="primary" onClick={toggle} disabled={pending || busy}>{task.status === "done" ? "Reabrir" : "Marcar como hecha"}</Button>}
    </>
  );

  return (
    <Modal open={Boolean(task)} onClose={onClose} title={modo === "editar" ? "Editar tarea" : modo === "eliminar" ? "Eliminar tarea" : "Tarea"} footer={footer}>
      {task && modo === "editar" && (
        <form id="editar-tarea" className="form" onSubmit={guardar} style={{ maxWidth: "none" }}>
          <label className="field"><span>Tarea</span><input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required maxLength={500} autoFocus /></label>
          <div className="line-grid">
            <div className="field"><span>Oficio</span><Select label="Oficio" value={form.trade} onChange={v => setForm({ ...form, trade: v })} options={[...new Set([...listaOficios, form.trade].filter(Boolean))].map(o => ({ value: o, label: o }))} placeholder="Elegir oficio…" /></div>
            <label className="field"><span>Fecha</span><input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} required /></label>
          </div>
          <div className="line-grid">
            <label className="field"><span>Responsable</span><input list="personas-tarea" type="text" value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })} placeholder="Nombre o equipo" maxLength={120} /><datalist id="personas-tarea">{listaPersonas.map(p => <option key={p} value={p} />)}</datalist></label>
            <label className="field"><span>Peso en el avance</span><span className="unit-input"><input type="number" inputMode="numeric" min={1} max={100} value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} /><span>%</span></span></label>
          </div>
        </form>
      )}

      {task && modo === "eliminar" && (
        <p className="text-sm">Se elimina «{task.title}» del proyecto y de la agenda. {task.status === "done" ? "Ya estaba completada: el avance del proyecto bajará." : "No afecta al presupuesto ni a los documentos."} Esta acción no se puede deshacer.</p>
      )}

      {task && modo === "ver" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <Status label={label} tone={tone} />
            <h3 className="h2" style={{ marginTop: 8, textDecoration: task.status === "done" ? "line-through" : undefined, color: task.status === "done" ? "var(--pl-muted)" : undefined }}>{task.title}</h3>
          </div>
          <dl className="facts">
            <div><dt>Proyecto</dt><dd>{project ? `${project.name} · ${project.client_name}` : "—"}</dd></div>
            <div><dt>Oficio</dt><dd>{task.trade}</dd></div>
            <div><dt>Responsable</dt><dd>{task.assignee || "Sin asignar"}</dd></div>
            <div><dt>Fecha</dt><dd>{fechaLarga.format(new Date(`${task.due_date}T12:00:00`)).replace(/^./, c => c.toUpperCase())}{vencida ? <span className="danger"> · vencida</span> : ""}</dd></div>
            <div><dt>Peso en el avance</dt><dd className="pl-mono">{task.weight} %</dd></div>
          </dl>
          {(canEdit || canDelete) && (
            <div className="task-tools">
              {canEdit && task.status === "pending" && <><Button variant="secondary" onClick={() => posponer(1)} disabled={pending || busy}><CalendarPlus size={15} strokeWidth={1.7} aria-hidden="true" />Mañana</Button><Button variant="secondary" onClick={() => posponer(7)} disabled={pending || busy}><CalendarPlus size={15} strokeWidth={1.7} aria-hidden="true" />+1 semana</Button></>}
              {canEdit && <Button variant="secondary" onClick={() => { setForm({ title: task.title, trade: task.trade, assignee: task.assignee, due_date: task.due_date, weight: String(task.weight) }); setModo("editar"); }} disabled={pending || busy}><Pencil size={15} strokeWidth={1.7} aria-hidden="true" />Editar</Button>}
              {canDelete && <Button variant="ghost" onClick={() => setModo("eliminar")} disabled={pending || busy} className="danger"><Trash2 size={15} strokeWidth={1.7} aria-hidden="true" />Eliminar</Button>}
            </div>
          )}
          {!canEdit && <p className="muted text-xs">Tu perfil puede completar la tarea; editarla o moverla corresponde a oficina, jefe de obra o administración.</p>}
          {project && <p className="muted text-xs">Creada el {dateLabel(project.created_at)} como parte de la planificación del proyecto.</p>}
        </div>
      )}
    </Modal>
  );
}
