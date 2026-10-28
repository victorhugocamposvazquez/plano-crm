import type { MetadataRoute } from "next";

/** Manifiesto PWA: iconos generados en `icon.tsx` («PLA / NO■» sobre azul). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Plano",
    short_name: "Plano",
    description: "CRM de reformas: de la primera visita a la entrega de llaves.",
    start_url: "/",
    display: "standalone",
    background_color: "#16232E",
    theme_color: "#ffffff",
    lang: "es",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
