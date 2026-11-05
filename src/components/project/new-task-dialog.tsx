"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useWorkspace } from "@/components/workspace-provider";
import { dateLabel } from "@/lib/domain";
import { localDate } from "@/lib/hoy";
import { oficios, oficiosHabituales, sumarDias } from "@/lib/agenda";
import { puestoNombres } from "@/lib/puestos";

const OTRA = "__otra__";
/** El próximo lunes (si hoy es lunes, el de la semana que viene). */
const proximoLunes = (hoy: string) => { const d = new Date(`${hoy}T12:00:00`).getDay(); return sumarDias(hoy, ((8 - d) % 7) || 7); };

/**
 * Tarea nueva con todo a la vista antes de crearla: título (que llega rellenado, por ejemplo con el texto de un mensaje),
 * fecha con atajos, responsable del equipo y oficio. Así nada se crea a ciegas «para hoy y sin asignar».
 */
export function NewTaskDialog({ projectId, open, initialTitle = "", onClose, origen }: { projectId: string; open: boolean; initialTitle?: string; onClose: () => void; origen?: string }) {
  const { data, send, notify, busy } = useWorkspace();
  const hoy = localDate();
  const [title, setTitle] = useState(initialTitle);
  const [due, setDue] = useState(hoy);
  const [responsable, setResponsable] = useState("");
  const [otra, setOtra] = useState("");
  const [trade, setTrade] = useState("Coordinación");
  const [weight, setWeight] = useState("10");
  const [pending, setPending] = useState(false);
  useEffect(() => { if (open) { setTitle(initialTitle); setDue(hoy); setResponsable(""); setOtra(""); setTrade("Coordinación"); setWeight("10"); } }, [open, initialTitle, hoy]);

  const listaOficios = useMemo(() => { const o = oficios(data.tasks); return [...new Set(["Coordinación", ...(o.length ? o : oficiosHabituales)])]; }, [data.tasks]);
  const personas = useMemo(() => [...data.members].sort((a, b) => a.display_name.localeCompare(b.display_name, "es")), [data.members]);
  const opcionesPersona = [{ value: "", label: "Sin asignar" }, ...personas.map(m => ({ value: m.user_id, label: `${m.display_name} · ${puestoNombres[m.position]}` })), { value: OTRA, label: "Otra persona o equipo…" }];
  const atajos = [{ label: "Hoy", fecha: hoy }, { label: "Mañana", fecha: sumarDias(hoy, 1) }, { label: "Lunes", fecha: proximoLunes(hoy) }, { label: "En una semana", fecha: sumarDias(hoy, 7) }];
  const nombreResponsable = responsable === OTRA ? otra.trim() : personas.find(m => m.user_id === responsable)?.display_name ?? "";

  async function crear(e: FormEvent) {
    e.preventDefault();
    const titulo = title.trim();
    if (!titulo || !due || pending || busy) return;
    setPending(true);
    try {
      const asignacion = responsable && responsable !== OTRA ? { assignee_id: responsable } : { assignee: responsable === OTRA ? otra.trim() : "" };
      await send({ type: "task.create", project_id: projectId, title: titulo, trade: trade.trim() || "Coordinación", due_date: due, weight: Math.min(100, Math.max(1, Number(weight) || 10)), ...asignacion });
      notify(`Tarea creada para el ${dateLabel(due)}${nombreResponsable ? ` · ${nombreResponsable}` : ""}: ${titulo}`);
      onClose();
    } catch (err) { notify(err instanceof Error ? err.message : "No se ha podido crear la tarea."); }
    finally { setPending(false); }
  }

  return <Modal open={open} onClose={onClose} title="Nueva tarea" kicker={origen} footer={<>
    <Button variant="secondary" onClick={onClose} disabled={pending}>Cancelar</Button>
    <Button variant="primary" type="submit" form="tarea-nueva" disabled={pending || busy || !title.trim() || !due || (responsable === OTRA && !otra.trim())}>{pending ? "Creando…" : "Crear tarea"}</Button>
  </>}>
    <form id="tarea-nueva" className="form nueva-tarea" onSubmit={crear} style={{ maxWidth: "none" }}>
      <label className="field"><span>Tarea</span><textarea value={title} onChange={e => setTitle(e.target.value)} rows={2} maxLength={500} required autoFocus placeholder="Replantear tabiquería con el electricista" /></label>
      <div className="field">
        <span>Fecha</span>
        <div className="nueva-tarea-atajos" role="group" aria-label="Fecha rápida">
          {atajos.map(a => <button key={a.label} type="button" className="segment" aria-pressed={due === a.fecha} onClick={() => setDue(a.fecha)}>{a.label}</button>)}
        </div>
        <input type="date" value={due} min={hoy} onChange={e => setDue(e.target.value)} required aria-label="Fecha de la tarea" />
      </div>
      <div className="line-grid">
        <div className="field"><span>Responsable</span><Select label="Responsable" value={responsable} onChange={setResponsable} options={opcionesPersona} placeholder="Sin asignar" /></div>
        <div className="field"><span>Oficio</span><Select label="Oficio" value={trade} onChange={setTrade} options={listaOficios.map(o => ({ value: o, label: o }))} placeholder="Coordinación" /></div>
      </div>
      {responsable === OTRA && <label className="field"><span>Quién</span><input type="text" value={otra} onChange={e => setOtra(e.target.value)} placeholder="Electricista de Ferrer, cuadrilla de pintura…" maxLength={120} autoFocus /></label>}
      <details className="editor-advanced">
        <summary>Cuánto cuenta en el avance</summary>
        <label className="field" style={{ marginTop: 10 }}><span>Peso</span><span className="unit-input"><input type="number" inputMode="numeric" min={1} max={100} value={weight} onChange={e => setWeight(e.target.value)} /><span>%</span></span></label>
        <p className="muted text-xs">El avance se reparte entre las tareas del proyecto; 10 es lo normal.</p>
      </details>
    </form>
  </Modal>;
}
