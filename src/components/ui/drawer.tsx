"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { quitarFocoDeCerrar } from "./modal";

/**
 * Panel lateral: en escritorio se abre a la derecha sin tapar la pantalla; en móvil ocupa la altura completa.
 * Para conversaciones y herramientas que se usan mientras se mira otra cosa (chat del proyecto).
 */
export function Drawer({ open, onClose, title, subtitle, children, footer, size = "md", floating = false }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; size?: "md" | "wide"; floating?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Flotante: se abre sin bloquear la pantalla de debajo, que sigue viéndose y usándose. El resto, como diálogo.
    if (open && !dialog.open) { if (floating) { dialog.show(); (document.activeElement as HTMLElement | null)?.blur(); } else { dialog.showModal(); quitarFocoDeCerrar(dialog); } }
    if (!open && dialog.open) dialog.close();
  }, [open, floating]);
  useEffect(() => {
    if (!open || !floating) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !document.querySelector("dialog[open]:modal")) onClose(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open, floating, onClose]);

  return (
    <dialog ref={ref} className="drawer" data-size={size} data-floating={floating || undefined} onClose={e => { if (e.target === e.currentTarget) onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-label={title}>
      <div className="drawer-body">
        {!floating && <header className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="h3">{title}</h2>
            {subtitle && <p className="muted text-xs" style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</p>}
          </div>
          <button type="button" className="search-clear" aria-label="Cerrar" onClick={onClose}><X size={15} strokeWidth={1.8} aria-hidden="true" /></button>
        </header>}
        <div className="drawer-content">{children}</div>
        {footer && <footer className="drawer-foot">{footer}</footer>}
      </div>
    </dialog>
  );
}
