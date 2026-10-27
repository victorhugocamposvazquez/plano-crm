"use client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { buscarGlobal, agruparResultados, type Resultado } from "@/lib/buscador";

/**
 * Buscador global: ⌘K / Ctrl+K o la lupa. Proyectos, clientes, presupuestos, documentos, artículos y acciones,
 * con teclado (↑↓ Enter Esc). Al elegir, navega y cierra; no pierde la pantalla de origen (atrás funciona).
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { data } = useWorkspace();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const resultados = useMemo(() => buscarGlobal(data, query), [data, query]);
  const grupos = useMemo(() => agruparResultados(resultados), [resultados]);
  const planos = useMemo(() => grupos.flatMap(g => g.items), [grupos]);

  useEffect(() => {
    const d = dialog.current; if (!d) return;
    if (open && !d.open) { d.showModal(); setQuery(""); setActive(0); setTimeout(() => input.current?.focus(), 0); }
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => { setActive(0); }, [query]);

  function ir(r: Resultado) { onClose(); router.push(r.href); }

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(planos.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); const r = planos[active]; if (r) ir(r); }
  }

  return (
    <dialog ref={dialog} className="palette" onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-label="Buscar en Plano">
      <div className="palette-body" onKeyDown={onKey}>
        <label className="palette-input">
          <Search size={18} strokeWidth={1.8} aria-hidden="true" />
          <input ref={input} type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar proyecto, cliente, calle, artículo… o una acción" aria-label="Buscar" autoComplete="off" spellCheck={false} />
          <button type="button" className="search-clear" aria-label="Cerrar" onClick={onClose}><X size={14} strokeWidth={1.8} aria-hidden="true" /></button>
        </label>
        <div className="palette-list" role="listbox" aria-label="Resultados">
          {planos.length === 0 && <p className="muted text-sm" style={{ padding: "14px 16px" }}>Nada coincide con «{query}». Prueba con parte de la calle, el cliente o el código.</p>}
          {grupos.map(g => (
            <div key={g.grupo} className="palette-group">
              <div className="palette-group-label">{g.grupo}</div>
              {g.items.map(r => { const i = planos.indexOf(r); return (
                <button key={r.id} type="button" role="option" aria-selected={i === active} className="palette-item" onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => ir(r)}>
                  <span style={{ minWidth: 0 }}><span className="palette-title">{r.titulo}</span>{r.detalle && <small className="muted">{r.detalle}</small>}</span>
                  {i === active && <CornerDownLeft size={14} strokeWidth={1.8} aria-hidden="true" className="muted" />}
                </button>
              ); })}
            </div>
          ))}
        </div>
        <div className="palette-foot muted text-xs"><span>↑↓ moverse · Enter abrir · Esc cerrar</span><span className="pl-mono">⌘K</span></div>
      </div>
    </dialog>
  );
}
