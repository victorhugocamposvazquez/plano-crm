"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Diálogo sobre la pantalla actual: no cambia de ruta, así que al cerrarlo sigues donde estabas.
 * En móvil se presenta como hoja inferior; en escritorio, centrado o, con `panel`, como panel lateral derecho.
 * Usa <dialog> nativo (foco y Escape).
 */
/** Sin campo que pida el foco, el navegador se lo da a la ✕ y parece seleccionada: se pasa al propio diálogo. */
export function quitarFocoDeCerrar(dialog: HTMLDialogElement) {
  const activo = document.activeElement as HTMLElement | null;
  if (activo?.getAttribute("aria-label") === "Cerrar" && dialog.contains(activo)) { dialog.tabIndex = -1; dialog.focus(); }
}

export function Modal({ open, onClose, title, children, footer, size = "md", panel, kicker }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "md" | "wide"; panel?: "md" | "wide"; kicker?: string }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) { dialog.showModal(); quitarFocoDeCerrar(dialog); }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="modal" data-size={size} data-panel={panel} onClose={e => { if (e.target === e.currentTarget) onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-label={title}>
      <div className="modal-body">
        <span className="modal-handle" aria-hidden="true" />
        <header className="modal-head">
          <div className="modal-title">{kicker && <small>{kicker}</small>}<h2 className="h3">{title}</h2></div>
          <button type="button" className="search-clear" aria-label="Cerrar" onClick={onClose}><X size={15} strokeWidth={1.8} aria-hidden="true" /></button>
        </header>
        <div className="modal-content">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </dialog>
  );
}
