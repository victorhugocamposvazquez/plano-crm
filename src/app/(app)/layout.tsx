import { Suspense, type ReactNode } from "react";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { AppShell } from "@/components/app-shell";

/**
 * Rutas privadas: cargan el espacio de trabajo y la navegación. Sin sesión, el proveedor redirige a /login.
 * El Suspense permite que las pantallas lean su estado de la URL (useSearchParams) sin bloquear la prerenderización.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <AppShell>
        <Suspense fallback={<p className="muted">Cargando…</p>}>{children}</Suspense>
      </AppShell>
    </WorkspaceProvider>
  );
}
