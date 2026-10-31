"use client";
import { useMemo, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Meter } from "@/components/ui/status";
import { useWorkspace } from "@/components/workspace-provider";
import { localDate } from "@/lib/hoy";
import { partidasPorCapitulo, totalCapitulo } from "@/lib/presupuesto";
import { can, dateLabel, type BudgetVersion, type Task } from "@/lib/domain";

/** Pestaña Obra: las tareas por cuándo tocan, cuánto cuenta cada una y propuesta desde las partidas aceptadas. */
export function WorkPanel({ projectId, tasks, progress, meterTone, approved, onNueva, onAbrir, onToggle, pendiente }: { projectId: string; tasks: Task[]; progress: number; meterTone: "success" | "warning"; approved?: BudgetVersion; onNueva: () => void; onAbrir: (task: Task) => void; onToggle: (task: Task) => void; pendiente: string | null }) {
  const { actor, busy, send, notify } = useWorkspace();
  const [proponiendo, setProponiendo] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [creando, setCreando] = useState(false);
  const hoy = localDate();
  const puedeCrear = can(actor.role, "task.create"), puedeMarcar = can(actor.role, "task.toggle");
  const pendientes = tasks.filter(t => t.status === "pending"), hechas = tasks.filter(t => t.status === "done");
  const grupos = [
    { id: "atrasadas", nombre: "Atrasadas", tareas: pendientes.filter(t => t.due_date < hoy), tone: "danger" },
    { id: "hoy", nombre: "Hoy", tareas: pendientes.filter(t => t.due_date === hoy), tone: "warning" },
    { id: "proximas", nombre: "Próximas", tareas: pendientes.filter(t => t.due_date > hoy), tone: "muted" },
    { id: "hechas", nombre: "Hechas", tareas: hechas, tone: "success" }
  ].filter(g => g.tareas.length > 0);
  const propuesta = useMemo(() => {
    if (!approved) return [];
    const existentes = new Set(tasks.map(t => t.title.toLowerCase()));
    const incluidas = approved.items.filter(i => i.inclusion === "included");
    const base = [...partidasPorCapitulo(incluidas).values()].reduce((s, items) => s + totalCapitulo(items), 0);
    return [...partidasPorCapitulo(incluidas)].filter(([capitulo]) => !existentes.has(capitulo.toLowerCase())).map(([capitulo, items]) => ({ capitulo, partidas: items.length, peso: Math.max(1, Math.min(100, Math.round((100 * totalCapitulo(items)) / (base || 1)))) }));
  }, [approved, tasks]);

  function abrirPropuesta() { setMarcados(new Set(propuesta.map(p => p.capitulo))); setProponiendo(true); }
  async function crearPropuestas() {
    if (creando || busy) return;
    setCreando(true);
    try {
      let creadas = 0;
      for (const p of propuesta.filter(x => marcados.has(x.capitulo))) { await send({ type: "task.create", project_id: projectId, title: p.capitulo, trade: p.capitulo, assignee: "", due_date: hoy, weight: p.peso }); creadas++; }
      notify(`${creadas} ${creadas === 1 ? "tarea creada" : "tareas creadas"}. Ponles fecha y responsable.`);
      setProponiendo(false);
    } catch (e) { notify(e instanceof Error ? e.message : "No se han podido crear las tareas."); }
    finally { setCreando(false); }
  }

  return (
    <section className="work-panel" aria-label="Tareas y avance">
      <div className="pl-head">
        <div><strong className="panel-title">Tareas</strong> <span className="muted">· {hechas.length} de {tasks.length} hechas · {progress} % del avance</span></div>
        {puedeCrear && <div className="pl-head-actions">
          {approved && propuesta.length > 0 && <Button onClick={abrirPropuesta} aria-haspopup="dialog"><Sparkles size={15} strokeWidth={1.7} aria-hidden="true" />Proponer desde las partidas aceptadas</Button>}
          <Button variant="primary" onClick={onNueva}><Plus size={16} strokeWidth={1.8} aria-hidden="true" />Nueva tarea</Button>
        </div>}
      </div>
      <Meter value={progress} label="Avance de la obra" tone={meterTone} />
      {tasks.length === 0 && <div className="empty"><strong>Todavía no hay tareas</strong><span className="muted text-sm">{approved ? "Propónlas desde las partidas aceptadas o créalas una a una." : "Cuando el cliente acepte, podrás proponerlas desde las partidas."}</span></div>}
      {grupos.map(g => (
        <section key={g.id} className="pl-card task-group" aria-label={g.nombre}>
          <h3 className="task-group-title" data-tone={g.tone}>{g.nombre} <span className="pl-mono">{g.tareas.length}</span></h3>
          {g.tareas.map(t => (
            <div key={t.id} className="task-line" data-late={g.id === "atrasadas" || undefined} data-done={t.status === "done" || undefined}>
              <input type="checkbox" checked={t.status === "done"} disabled={!puedeMarcar || pendiente === t.id} onChange={() => onToggle(t)} aria-label={`${t.status === "done" ? "Reabrir" : "Completar"} ${t.title}`} />
              <button type="button" className="task-line-main" onClick={() => onAbrir(t)} aria-haspopup="dialog">
                <strong>{t.title}</strong>
                <small>{t.trade}{t.assignee ? ` · ${t.assignee}` : " · sin asignar"}</small>
              </button>
              <span className="task-line-date">{dateLabel(t.due_date)}</span>
              <span className="task-line-weight pl-mono" title="Cuánto cuenta en el avance">{t.weight} %</span>
            </div>
          ))}
        </section>
      ))}
      <Modal open={proponiendo} onClose={() => setProponiendo(false)} title="Proponer tareas" footer={<><Button onClick={() => setProponiendo(false)} disabled={creando}>Cancelar</Button><Button variant="primary" onClick={crearPropuestas} disabled={!marcados.size || creando || busy}>{creando ? "Creando…" : `Crear ${marcados.size} ${marcados.size === 1 ? "tarea" : "tareas"}`}</Button></>}>
        <p className="text-sm" style={{ marginBottom: 10 }}>Una tarea por capítulo de la V{approved?.number} aceptada. Es una propuesta: marca las que quieras y luego ponles fecha y responsable. Lo que cuenta cada una sale del importe del capítulo.</p>
        <div className="proposal-list">{propuesta.map(p => (
          <label key={p.capitulo} className="proposal-row">
            <input type="checkbox" checked={marcados.has(p.capitulo)} onChange={() => setMarcados(prev => { const next = new Set(prev); if (next.has(p.capitulo)) next.delete(p.capitulo); else next.add(p.capitulo); return next; })} />
            <span><strong>{p.capitulo}</strong><small>{p.partidas} partida{p.partidas === 1 ? "" : "s"}</small></span>
            <span className="pl-mono muted">{p.peso} %</span>
          </label>
        ))}</div>
      </Modal>
    </section>
  );
}
