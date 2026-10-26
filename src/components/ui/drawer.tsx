"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Panel lateral: en escritorio se abre a la derecha sin tapar la pantalla; en móvil ocupa la altura completa.
 * Para conversaciones y herramientas que se usan mientras se mira otra cosa (chat del proyecto).
 */
export function Drawer({ open, onClose, title, subtitle, children, footer }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="drawer" onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-label={title}>
      <div className="drawer-body">
        <header className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="h3">{title}</h2>
            {subtitle && <p className="muted text-xs" style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</p>}
          </div>
          <button type="button" className="search-clear" aria-label="Cerrar" onClick={onClose}><X size={15} strokeWidth={1.8} aria-hidden="true" /></button>
        </header>
        <div className="drawer-content">{children}</div>
        {footer && <footer className="drawer-foot">{footer}</footer>}
      </div>
    </dialog>
  );
}
