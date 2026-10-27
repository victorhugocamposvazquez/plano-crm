"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Ellipsis } from "lucide-react";

export type MenuItem = { id: string; label: string; hint?: string; icon?: ReactNode; disabled?: boolean; danger?: boolean; onSelect: () => void };

/**
 * Menú contextual propio del sistema: botón «···» que despliega una lista con teclado
 * (flechas, Inicio/Fin, Enter, Escape) y cierre al pulsar fuera. No cambia de ruta.
 */
export function Menu({ items, label = "Más acciones", align = "end", size = "md" }: { items: MenuItem[]; label?: string; align?: "start" | "end"; size?: "md" | "sm" }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const enabled = items.map((item, i) => ({ item, i })).filter(x => !x.item.disabled);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function move(delta: number) {
    if (!enabled.length) return;
    const pos = enabled.findIndex(x => x.i === active);
    const next = enabled[(pos + delta + enabled.length) % enabled.length];
    setActive(next.i);
  }

  function onKey(e: KeyboardEvent) {
    if (!open) { if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); setActive(enabled[0]?.i ?? 0); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Home") { e.preventDefault(); setActive(enabled[0]?.i ?? 0); }
    else if (e.key === "End") { e.preventDefault(); setActive(enabled.at(-1)?.i ?? 0); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const item = items[active]; if (item && !item.disabled) { setOpen(false); item.onSelect(); } }
  }

  return (
    <div ref={root} className="menu" onKeyDown={onKey}>
      <button type="button" className={size === "sm" ? "menu-trigger-sm" : "btn btn-icon"} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => { setOpen(v => !v); setActive(enabled[0]?.i ?? 0); }}>
        <Ellipsis size={size === "sm" ? 15 : 19} strokeWidth={1.7} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} role="menu" className="menu-list" data-align={align}>
          {items.map((item, i) => (
            <button key={item.id} type="button" role="menuitem" className="menu-item" data-active={i === active} data-danger={item.danger || undefined} disabled={item.disabled} onMouseEnter={() => setActive(i)} onClick={() => { setOpen(false); item.onSelect(); }}>
              {item.icon && <span className="menu-icon" aria-hidden="true">{item.icon}</span>}
              <span style={{ minWidth: 0 }}><span className="menu-label">{item.label}</span>{item.hint && <small className="muted">{item.hint}</small>}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
