"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Check } from "lucide-react";

export type SelectOption<T extends string> = { value: T; label: string; hint?: string };

/**
 * Selector propio del sistema (sustituye al <select> nativo): botón + lista desplegable con teclado
 * (flechas, Inicio/Fin, Enter, Escape), cierre al pulsar fuera y la misma altura que los campos.
 */
export function Select<T extends string>({ value, onChange, options, label, placeholder = "Elegir…", size = "md", className = "" }: {
  value: T | ""; onChange: (value: T) => void; options: SelectOption<T>[]; label: string; placeholder?: string; size?: "sm" | "md"; className?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex(o => o.value === value)));
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) { const i = options.findIndex(o => o.value === value); setActive(i >= 0 ? i : 0); }
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function pick(i: number) { const o = options[i]; if (!o) return; onChange(o.value); setOpen(false); }

  function onKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!open) { setOpen(true); return; } setActive(i => Math.min(options.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))); }
    else if (e.key === "Home" && open) { e.preventDefault(); setActive(0); }
    else if (e.key === "End" && open) { e.preventDefault(); setActive(options.length - 1); }
    else if ((e.key === "Enter" || e.key === " ") && open) { e.preventDefault(); pick(active); }
    else if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); }
  }

  return (
    <div ref={root} className={`select ${className}`.trim()} data-size={size} data-open={open}>
      <button type="button" className="select-button" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} aria-label={label} onClick={() => setOpen(v => !v)} onKeyDown={onKey}>
        <span className={selected ? "" : "muted"}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && (
        <ul id={`${id}-list`} role="listbox" className="select-list" aria-label={label} aria-activedescendant={`${id}-${active}`}>
          {options.map((o, i) => (
            <li key={o.value} id={`${id}-${i}`} role="option" aria-selected={o.value === value} data-index={i} data-active={i === active} className="select-option" onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => pick(i)}>
              <span style={{ minWidth: 0 }}><span style={{ display: "block" }}>{o.label}</span>{o.hint && <small className="muted text-xs">{o.hint}</small>}</span>
              {o.value === value && <Check size={15} strokeWidth={2} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
