"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Diálogo sobre la pantalla actual: no cambia de ruta, así que al cerrarlo sigues donde estabas.
 * En móvil se presenta como hoja inferior; en escritorio, centrado. Usa <dialog> nativo (foco y Escape).
 */
export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="modal" onClose={e => { if (e.target === e.currentTarget) onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-label={title}>
      <div className="modal-body">
        <span className="modal-handle" aria-hidden="true" />
        <header className="modal-head">
          <h2 className="h3">{title}</h2>
          <button type="button" className="search-clear" aria-label="Cerrar" onClick={onClose}><X size={15} strokeWidth={1.8} aria-hidden="true" /></button>
        </header>
        <div className="modal-content">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </dialog>
  );
}
