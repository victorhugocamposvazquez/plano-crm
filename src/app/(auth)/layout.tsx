import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Acceso" };

/** Pantallas de acceso: sin proveedor del espacio ni navegación, para no cargar datos antes de tener sesión. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="auth">{children}</div>;
}
