"use client";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * «Volver» que respeta de dónde vienes solo si el referrer es el mismo destino que el fallback
 * (p. ej. lista de proyectos con filtros). Si vienes de un flujo (visita, plano) o de fuera,
 * va al destino de respaldo: así no reabre pantallas ya cerradas.
 * `compact`: en móvil solo queda la flecha, como objetivo táctil de 44 px (cabecera compacta de la ficha).
 */
export function BackLink({ fallback, children, compact = false }: { fallback: string; children: ReactNode; compact?: boolean }) {
  const router = useRouter();
  function go(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    try {
      const dest = new URL(fallback, window.location.origin);
      const ref = document.referrer ? new URL(document.referrer) : null;
      if (ref && ref.origin === window.location.origin && ref.pathname === dest.pathname && window.history.length > 1) {
        router.back();
        return;
      }
    } catch { /* fallback abajo */ }
    router.push(fallback);
  }
  return (
    <a href={fallback} onClick={go} className="muted back-link" data-compact={compact || undefined} style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
      <ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" className="back-link-arrow" /><span className="back-link-text">{children}</span>
    </a>
  );
}
