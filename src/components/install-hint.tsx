"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Smartphone, X } from "lucide-react";

const KEY = "plano.instalar.ocultar";

/** Aviso de una sola vez en Hoy: en móvil, desde el navegador y sin instalar, enseña que Plano puede ir en la pantalla de inicio. */
export function InstallHint() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const movil = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
      setVisible(movil && !standalone && localStorage.getItem(KEY) !== "1");
    } catch { setVisible(false); }
  }, []);
  if (!visible) return null;
  return (
    <div className="install-hint zone" role="note">
      <Smartphone size={18} strokeWidth={1.6} aria-hidden="true" />
      <span style={{ flex: 1, minWidth: 0 }}><strong>Plano puede ir en tu pantalla de inicio</strong><small className="muted">Con icono y a pantalla completa. <Link href="/instalar">Ver cómo</Link></small></span>
      <button type="button" className="search-clear" aria-label="No volver a mostrar" onClick={() => { try { localStorage.setItem(KEY, "1"); } catch {} setVisible(false); }}><X size={14} strokeWidth={1.8} aria-hidden="true" /></button>
    </div>
  );
}
