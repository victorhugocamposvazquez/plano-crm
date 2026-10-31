import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter";
import "@fontsource-variable/archivo";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@/styles/tokens.css";
import "@/styles/ui.css";
import "@/styles/plano-app.css";
import { appearanceBootScript } from "@/lib/appearance";

export const metadata: Metadata = {
  title: { default: "Plano", template: "%s · Plano" },
  description: "CRM de reformas: de la primera visita a la entrega de llaves.",
  applicationName: "Plano",
  appleWebApp: {
    capable: true,
    title: "Plano",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#191a1c" }
  ]
};

/** Raíz común: fuentes y tokens. El proveedor del espacio y el armazón viven en el grupo (app); /login queda fuera. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Aplica el tema guardado antes del primer pintado para que no parpadee. */}
        <script dangerouslySetInnerHTML={{ __html: appearanceBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
