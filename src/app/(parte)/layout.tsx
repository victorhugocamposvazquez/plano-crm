import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Parte de trabajo", robots: { index: false, follow: false } };

/** Parte de trabajo para operarios: se abre sin cuenta ni sesión; no carga el espacio de la empresa. */
export default function ParteLayout({ children }: { children: ReactNode }) {
  return <main className="parte-root">{children}</main>;
}
