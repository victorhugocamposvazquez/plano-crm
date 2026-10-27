import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { PrintTheme } from "@/components/documents/print-theme";

export const metadata: Metadata = { title: "Documento" };

/** Documentos imprimibles: cargan el espacio (misma sesión) pero sin navegación, siempre en tema claro. */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <PrintTheme />
      <div className="print-root"><Suspense fallback={<p className="muted">Cargando…</p>}>{children}</Suspense></div>
    </WorkspaceProvider>
  );
}
