"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Contenedor de un desplegable propio: se cierra al pulsar fuera o con Escape. El contenido lo pone quien lo usa. */
export function Popover({ open, onClose, trigger, children, className = "", panelClassName = "", align = "start", side = "bottom" }: { open: boolean; onClose: () => void; trigger: ReactNode; children: ReactNode; className?: string; panelClassName?: string; align?: "start" | "end" | "stretch"; side?: "top" | "bottom" }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const fuera = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) onClose(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", escape); };
  }, [open, onClose]);
  return (
    <div ref={root} className={`popover ${className}`.trim()}>
      {trigger}
      {open && <div className={`popover-panel ${panelClassName}`.trim()} data-align={align} data-side={side}>{children}</div>}
    </div>
  );
}
