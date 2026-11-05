"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { OperarioDialog } from "@/components/equipo/operario-dialog";
import { opcionesAsignar } from "@/components/equipo/responsable-field";
import { normalizar } from "@/lib/busqueda";
import { iniciales } from "@/lib/pasos";

/**
 * Elegir a quién va algo (una subtarea): operarios y personas de la empresa, con buscador,
 * y «Nuevo operario» para darlo de alta en el momento y asignárselo nada más guardarlo.
 */
export function AsignarDialog({ open, titulo, valor, onPick, onClose }: { open: boolean; titulo: string; valor: string; onPick: (valor: string) => void; onClose: () => void }) {
  const { data } = useWorkspace();
  const [buscar, setBuscar] = useState("");
  const [alta, setAlta] = useState(false);
  const antes = useRef<Set<string> | null>(null);
  const buscarId = useId();
  useEffect(() => { if (open) setBuscar(""); else antes.current = null; }, [open]);

  // Al guardar un operario nuevo desde aquí, se asigna solo.
  useEffect(() => {
    if (!antes.current) return;
    const nuevo = (data.operarios ?? []).find(o => !antes.current!.has(o.id));
    if (nuevo) { antes.current = null; onPick(`op:${nuevo.id}`); }
  }, [data.operarios, onPick]);

  const opciones = useMemo(() => opcionesAsignar(data).filter(o => o.value), [data]);
  const lista = buscar.trim() ? opciones.filter(o => normalizar(`${o.label} ${o.hint ?? ""}`).includes(normalizar(buscar.trim()))) : opciones;

  // Se abre desde formularios (crear o editar la tarea): se pinta fuera de ellos para no anidar el formulario del operario.
  if (typeof document === "undefined") return null;
  return createPortal(<>
    <Modal open={open && !alta} onClose={onClose} title="Asignar a" kicker={titulo} footer={<Button variant="secondary" onClick={onClose}>Cancelar</Button>}>
      <div className="asignar">
        <label className="sr-only" htmlFor={buscarId}>Buscar persona</label>
        <input id={buscarId} type="search" className="asignar-buscar" value={buscar} onChange={e => setBuscar(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (lista.length === 1) onPick(lista[0].value); } }} placeholder="Buscar por nombre u oficio" autoFocus />
        <div className="asignar-lista" role="listbox" aria-label="Personas">
          {lista.map(o => <button key={o.value} type="button" role="option" aria-selected={o.value === valor} onClick={() => onPick(o.value)}>
            <span className="msg-avatar" aria-hidden="true">{iniciales(o.label)}</span>
            <span><strong>{o.label}</strong>{o.hint && <small>{o.hint}</small>}</span>
            {o.value === valor && <Check size={16} strokeWidth={1.9} aria-hidden="true" />}
          </button>)}
          {lista.length === 0 && <p className="muted text-sm" style={{ margin: 0, padding: "8px 4px" }}>Nadie coincide. Puedes darlo de alta como operario.</p>}
        </div>
        <button type="button" className="chip" onClick={() => { antes.current = new Set((data.operarios ?? []).map(o => o.id)); setAlta(true); }}><Plus size={14} strokeWidth={1.8} aria-hidden="true" />Nuevo operario</button>
      </div>
    </Modal>
    <OperarioDialog open={alta} operario={null} onClose={() => setAlta(false)} />
  </>, document.body);
}
