import type { ReactNode } from "react";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { AppShell } from "@/components/app-shell";

/** Rutas privadas: cargan el espacio de trabajo y la navegación. Sin sesión, el proveedor redirige a /login. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
