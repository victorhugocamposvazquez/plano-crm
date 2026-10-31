"use client";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * «Volver» que respeta de dónde vienes: si hay historial dentro de Plano vuelve a esa pantalla
 * (con sus filtros, porque viven en la URL); si has entrado directo, va al destino de respaldo.
 * `compact`: en móvil solo queda la flecha, como objetivo táctil de 44 px (cabecera compacta de la ficha).
 */
export function BackLink({ fallback, children, compact = false }: { fallback: string; children: ReactNode; compact?: boolean }) {
  const router = useRouter();
  function go(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const cameFromPlano = typeof document !== "undefined" && document.referrer.startsWith(window.location.origin) && window.history.length > 1;
    if (cameFromPlano) router.back(); else router.push(fallback);
  }
  return (
    <a href={fallback} onClick={go} className="muted back-link" data-compact={compact || undefined} style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
      <ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" className="back-link-arrow" /><span className="back-link-text">{children}</span>
    </a>
  );
}
