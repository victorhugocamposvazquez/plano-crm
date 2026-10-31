"use client";
import { useEffect, useState } from "react";
import { Share, EllipsisVertical, Check } from "lucide-react";

/** Instalar Plano en el móvil: icono en la pantalla de inicio y pantalla completa, sin barra de dirección. */
export default function InstalarPage() {
  const [instalada, setInstalada] = useState(false);
  const [plataforma, setPlataforma] = useState<"iphone" | "android" | "otro">("otro");
  useEffect(() => {
    setInstalada(window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const ua = navigator.userAgent;
    setPlataforma(/iPhone|iPad|iPod/.test(ua) ? "iphone" : /Android/.test(ua) ? "android" : "otro");
  }, []);
  return (
    <div className="page">
      <div>
        <h1 className="pl-title">Plano en tu móvil</h1>
        <p className="subtitle">Con icono en la pantalla de inicio y sin barra de dirección. No hay que descargar nada de la tienda: dos pasos desde el navegador.</p>
      </div>

      {instalada && <div className="next-card" role="status"><span className="next-card-kicker">Listo</span><span className="next-card-title"><Check size={18} strokeWidth={2} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 6 }} />Plano ya está instalada en este dispositivo</span><span className="next-card-meta">Ábrela desde el icono de la pantalla de inicio.</span></div>}

      <section className="help-item" data-primero={plataforma === "iphone" || undefined}>
        <h2 className="h3">iPhone o iPad (Safari)</h2>
        <ol className="help-steps">
          <li>Abre Plano en Safari y toca el botón de compartir <Share size={15} strokeWidth={1.8} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> (abajo, en el centro).</li>
          <li>Baja en la lista y toca «Añadir a pantalla de inicio». Confirma con «Añadir».</li>
        </ol>
      </section>

      <section className="help-item" data-open>
        <h2 className="h3">Android (Chrome)</h2>
        <ol className="help-steps">
          <li>Abre Plano en Chrome y toca el menú <EllipsisVertical size={15} strokeWidth={1.8} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> (arriba a la derecha).</li>
          <li>Toca «Instalar aplicación» o «Añadir a pantalla de inicio» y confirma.</li>
        </ol>
      </section>

      <p className="muted text-xs">Plano sigue necesitando conexión: la instalación da el icono y la pantalla completa, no el trabajo sin cobertura.</p>
    </div>
  );
}
