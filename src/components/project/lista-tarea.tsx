"use client";
import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Plus, UserRound, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { asignacionSubtarea, opcionesAsignar, valorSubtarea } from "@/components/equipo/responsable-field";
import { useWorkspace } from "@/components/workspace-provider";
import { can, type PuntoLista, type Task } from "@/lib/domain";
import { progresoLista, puntoNuevo } from "@/lib/lista-tarea";

const MAX = 50;

/** Barra de avance de la lista: «2 de 5» y una barra fina. */
export function AvanceLista({ lista }: { lista: PuntoLista[] | undefined }) {
  const p = progresoLista(lista);
  if (!p) return null;
  return <span className="lista-avance" title="Subtareas hechas" data-completa={p.hechos === p.total || undefined}>
    <span className="lista-avance-barra" aria-hidden="true"><i style={{ width: `${Math.round((p.hechos / p.total) * 100)}%` }} /></span>
    <span>{p.hechos} de {p.total}</span>
  </span>;
}

/** A quién va una subtarea, en pequeño, para quien no puede cambiarlo. */
function Asignada({ p }: { p: PuntoLista }) {
  return p.assignee ? <span className="subtarea-quien"><UserRound size={13} strokeWidth={1.8} aria-hidden="true" />{p.assignee}</span> : null;
}

/**
 * Editor de las subtareas de una tarea, tipo Trello: añadir con Intro (o pegar varias líneas de golpe), marcar, corregir y quitar.
 * Con `puedeAsignar` (Administración), cada subtarea se asigna a un operario o a una persona; si no, se ve a quién va.
 */
export function ChecklistEditor({ value, onChange, puedeAsignar = false }: { value: PuntoLista[]; onChange: (l: PuntoLista[]) => void; puedeAsignar?: boolean }) {
  const { data } = useWorkspace();
  const opciones = puedeAsignar ? opcionesAsignar(data) : [];
  const [nuevo, setNuevo] = useState("");
  const añadir = (textos: string[]) => {
    const limpios = textos.map(t => t.replace(/^\s*(?:[-*•]|\[\s?[xX ]?\]|\d+[.)])\s*/, "").trim()).filter(Boolean);
    if (!limpios.length) return;
    onChange([...value, ...limpios.slice(0, MAX - value.length).map(puntoNuevo)]);
    setNuevo("");
  };
  const alPegar = (e: ClipboardEvent<HTMLInputElement>) => {
    const texto = e.clipboardData.getData("text");
    if (texto.includes("\n")) { e.preventDefault(); añadir(texto.split(/\r?\n/)); }
  };
  const alTeclear = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); añadir([nuevo]); } };
  return <div className="lista-editor">
    {value.length > 0 && <ul className="lista-puntos">
      {value.map((p, i) => <li key={p.id}>
        <input type="checkbox" checked={p.done} onChange={e => onChange(value.map(x => x.id === p.id ? { ...x, done: e.target.checked } : x))} aria-label={`Hecho: ${p.text}`} />
        <input type="text" className="lista-texto" value={p.text} maxLength={300} onChange={e => onChange(value.map(x => x.id === p.id ? { ...x, text: e.target.value } : x))} onBlur={() => { if (!p.text.trim()) onChange(value.filter(x => x.id !== p.id)); }} aria-label={`Subtarea ${i + 1}`} data-hecho={p.done || undefined} />
        {puedeAsignar
          ? <span className="subtarea-asignar"><Select size="sm" label={`Asignar ${p.text}`} value={valorSubtarea(p)} onChange={v => onChange(value.map(x => { if (x.id !== p.id) return x; const { assignee: _a, assignee_id: _b, operario_id: _c, ...resto } = x; void _a; void _b; void _c; return { ...resto, ...asignacionSubtarea(v, data) }; }))} options={opciones} placeholder="Sin asignar" /></span>
          : <Asignada p={p} />}
        <button type="button" className="lista-quitar" onClick={() => onChange(value.filter(x => x.id !== p.id))} aria-label={`Quitar ${p.text}`}><X size={15} strokeWidth={1.8} aria-hidden="true" /></button>
      </li>)}
    </ul>}
    {value.length < MAX && <div className="lista-nuevo">
      <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
      <input type="text" value={nuevo} onChange={e => setNuevo(e.target.value)} onKeyDown={alTeclear} onPaste={alPegar} maxLength={300} placeholder={value.length ? "Otra subtarea… (Intro para añadir)" : "Añade una subtarea: «Proteger el suelo», «Retirar escombro»…"} aria-label="Nueva subtarea" />
      {nuevo.trim() && <button type="button" className="btn btn-ghost" onClick={() => añadir([nuevo])}>Añadir</button>}
    </div>}
    {value.length === 0 && <small className="muted">También puedes pegar una lista entera, una línea por subtarea.{puedeAsignar ? " Cada una se puede asignar a otra persona." : ""}</small>}
  </div>;
}

/** Las subtareas de una tarea ya creada: cada una se marca al momento (también el equipo de obra); Administración las asigna. */
export function ListaTarea({ task }: { task: Task }) {
  const { data, actor, send, notify, busy } = useWorkspace();
  const [marcando, setMarcando] = useState("");
  const lista = task.checklist ?? [];
  if (!lista.length) return null;
  const puede = can(actor.role, "task.check"), puedeAsignar = can(actor.role, "task.subassign");
  const opciones = puedeAsignar ? opcionesAsignar(data) : [];
  async function asignar(p: PuntoLista, valor: string) {
    try { const q = asignacionSubtarea(valor, data); await send({ type: "task.subassign", id: task.id, item_id: p.id, ...(q.operario_id ? { operario_id: q.operario_id } : q.assignee_id ? { assignee_id: q.assignee_id } : {}) }); notify(q.assignee ? `Subtarea asignada a ${q.assignee}` : "Subtarea sin asignar"); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido asignar la subtarea."); }
  }
  async function marcar(p: PuntoLista, done: boolean) {
    if (marcando || busy) return;
    setMarcando(p.id);
    try { await send({ type: "task.check", id: task.id, item_id: p.id, done }); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido marcar la subtarea."); }
    finally { setMarcando(""); }
  }
  return <section className="lista-tarea" aria-label="Subtareas">
    <div className="lista-tarea-cabeza"><h4>Subtareas</h4><AvanceLista lista={lista} /></div>
    <ul className="lista-puntos lista-puntos-ver">
      {lista.map(p => <li key={p.id}>
        <label>
          <input type="checkbox" checked={p.done} disabled={!puede || Boolean(marcando)} onChange={e => void marcar(p, e.target.checked)} />
          <span data-hecho={p.done || undefined}>{p.text}</span>
        </label>
        {puedeAsignar
          ? <span className="subtarea-asignar"><Select size="sm" label={`Asignar ${p.text}`} value={valorSubtarea(p)} onChange={v => void asignar(p, v)} options={opciones} placeholder="Sin asignar" /></span>
          : <Asignada p={p} />}
      </li>)}
    </ul>
  </section>;
}
