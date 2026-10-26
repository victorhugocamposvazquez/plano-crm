"use client";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * «Volver» que respeta de dónde vienes: si hay historial dentro de Plano vuelve a esa pantalla
 * (con sus filtros, porque viven en la URL); si has entrado directo, va al destino de respaldo.
 */
export function BackLink({ fallback, children }: { fallback: string; children: ReactNode }) {
  const router = useRouter();
  function go(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const cameFromPlano = typeof document !== "undefined" && document.referrer.startsWith(window.location.origin) && window.history.length > 1;
    if (cameFromPlano) router.back(); else router.push(fallback);
  }
  return (
    <a href={fallback} onClick={go} className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
      <ArrowLeft size={13} strokeWidth={1.8} aria-hidden="true" />{children}
    </a>
  );
}
