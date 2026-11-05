"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useWorkspace } from "@/components/workspace-provider";
import { dateLabel } from "@/lib/domain";
import { localDate } from "@/lib/hoy";
import { oficios, oficiosHabituales, sumarDias } from "@/lib/agenda";
import { ResponsableField, asignacion, nombreResponsable, sinResponsable, type Responsable } from "@/components/equipo/responsable-field";
import { DateField } from "@/components/ui/date-field";
import { EnviarParte } from "@/components/equipo/enviar-parte";
import { MessageCircle } from "lucide-react";
import type { Task } from "@/lib/domain";

/** El próximo lunes (si hoy es lunes, el de la semana que viene). */
const proximoLunes = (hoy: string) => { const d = new Date(`${hoy}T12:00:00`).getDay(); return sumarDias(hoy, ((8 - d) % 7) || 7); };

/**
 * Tarea nueva con todo a la vista antes de crearla: título (que llega rellenado, por ejemplo con el texto de un mensaje),
 * fecha con atajos, responsable del equipo y oficio. Así nada se crea a ciegas «para hoy y sin asignar».
 * Con «Enviársela por WhatsApp», al crearla se abre el envío al operario con su enlace (sin cuenta).
 */
export function NewTaskDialog({ projectId, open, initialTitle = "", onClose, origen, enviarAlCrear = false }: { projectId: string; open: boolean; initialTitle?: string; onClose: () => void; origen?: string; enviarAlCrear?: boolean }) {
  const { data, send, notify, busy } = useWorkspace();
  const hoy = localDate();
  const [title, setTitle] = useState(initialTitle);
  const [due, setDue] = useState(hoy);
  const [responsable, setResponsable] = useState<Responsable>(sinResponsable);
  const [trade, setTrade] = useState("Coordinación");
  const [weight, setWeight] = useState("10");
  const [pending, setPending] = useState(false);
  const [enviar, setEnviar] = useState(enviarAlCrear);
  const [enviarTarea, setEnviarTarea] = useState<Task | null>(null);
  useEffect(() => { if (open) { setTitle(initialTitle); setDue(hoy); setResponsable(sinResponsable); setTrade("Coordinación"); setWeight("10"); setEnviar(enviarAlCrear); } }, [open, initialTitle, hoy, enviarAlCrear]);

  const listaOficios = useMemo(() => { const o = oficios(data.tasks); return [...new Set(["Coordinación", ...(o.length ? o : oficiosHabituales), ...(data.operarios ?? []).flatMap(x => x.trades)])]; }, [data.tasks, data.operarios]);
  const atajos = [{ label: "Hoy", fecha: hoy }, { label: "Mañana", fecha: sumarDias(hoy, 1) }, { label: "Lunes", fecha: proximoLunes(hoy) }, { label: "En una semana", fecha: sumarDias(hoy, 7) }];
  const quien = nombreResponsable(responsable, data);

  async function crear(e: FormEvent) {
    e.preventDefault();
    const titulo = title.trim();
    if (!titulo || !due || pending || busy) return;
    setPending(true);
    try {
      const antes = new Set(data.tasks.map(t => t.id));
      const ws = await send({ type: "task.create", project_id: projectId, title: titulo, trade: trade.trim() || "Coordinación", due_date: due, weight: Math.min(100, Math.max(1, Number(weight) || 10)), ...asignacion(responsable) });
      notify(`Tarea creada para el ${dateLabel(due)}${quien ? ` · ${quien}` : ""}: ${titulo}`);
      onClose();
      if (enviar) setEnviarTarea(ws.tasks.find(t => !antes.has(t.id) && t.project_id === projectId) ?? null);
    } catch (err) { notify(err instanceof Error ? err.message : "No se ha podido crear la tarea."); }
    finally { setPending(false); }
  }

  return <>
  <EnviarParte open={Boolean(enviarTarea)} projectId={projectId} task={enviarTarea} onClose={() => setEnviarTarea(null)} />
  <Modal open={open} onClose={onClose} title="Nueva tarea" kicker={origen} footer={<>
    <Button variant="secondary" onClick={onClose} disabled={pending}>Cancelar</Button>
    <Button variant="primary" type="submit" form="tarea-nueva" disabled={pending || busy || !title.trim() || !due || (responsable.valor === "otra" && !responsable.libre.trim())}>{pending ? "Creando…" : "Crear tarea"}</Button>
  </>}>
    <form id="tarea-nueva" className="form nueva-tarea" onSubmit={crear} style={{ maxWidth: "none" }}>
      <label className="field"><span>Tarea</span><textarea value={title} onChange={e => setTitle(e.target.value)} rows={2} maxLength={500} required autoFocus placeholder="Replantear tabiquería con el electricista" /></label>
      <div className="field">
        <span>Fecha</span>
        <div className="nueva-tarea-atajos" role="group" aria-label="Fecha rápida">
          {atajos.map(a => <button key={a.label} type="button" className="segment" aria-pressed={due === a.fecha} onClick={() => setDue(a.fecha)}>{a.label}</button>)}
        </div>
        <DateField label="Fecha de la tarea" value={due} min={hoy} onChange={setDue} required />
      </div>
      <div className="field"><span>Oficio</span><Select label="Oficio" value={trade} onChange={setTrade} options={listaOficios.map(o => ({ value: o, label: o }))} placeholder="Coordinación" /></div>
      <ResponsableField value={responsable} onChange={r => { if (r.valor.startsWith("op:") && !responsable.valor.startsWith("op:")) setEnviar(true); setResponsable(r); }} oficio={trade} />
      <button type="button" className="chip enviar-al-crear" aria-pressed={enviar} onClick={() => setEnviar(v => !v)}><MessageCircle size={14} strokeWidth={1.8} aria-hidden="true" />{enviar ? "Se enviará al operario por WhatsApp" : "Enviársela por WhatsApp al crearla"}</button>
      <details className="editor-advanced">
        <summary>Cuánto cuenta en el avance</summary>
        <label className="field" style={{ marginTop: 10 }}><span>Peso</span><span className="unit-input"><input type="number" inputMode="numeric" min={1} max={100} value={weight} onChange={e => setWeight(e.target.value)} /><span>%</span></span></label>
        <p className="muted text-xs">El avance se reparte entre las tareas del proyecto; 10 es lo normal.</p>
      </details>
    </form>
  </Modal>
  </>;
}
