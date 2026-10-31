"use client";
import { useState } from "react";
import Link from "next/link";
import { CircleHelp, LogOut, Palette, Settings } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TextSizeToggle } from "@/components/ui/text-size-toggle";
import { roleNames } from "@/lib/domain";
import { iniciales } from "@/lib/pasos";
import { veSeccion } from "@/lib/navegacion";

const perfilDetalle = { admin: "aprueba presupuestos y cobros", office: "aprueba presupuestos y cobros", manager: "lleva las obras", site: "tareas, mensajes y documentos", viewer: "solo consulta" } as const;

/** Lo que se abre desde el avatar: quién eres, cómo se ve la aplicación, atajos y cerrar sesión. */
export function AccountMenu({ onClose }: { onClose: () => void }) {
  const { actor, data, mode, notify } = useWorkspace();
  const [saliendo, setSaliendo] = useState(false);
  async function salir() {
    if (saliendo) return;
    setSaliendo(true);
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { notify(result.error || "No se ha podido cerrar la sesión."); return; }
      window.location.assign(typeof result.redirect === "string" ? result.redirect : "/login");
    } catch { notify("Sin conexión: no se ha podido cerrar la sesión."); }
    finally { setSaliendo(false); }
  }
  return (
    <div className="account-menu">
      <div className="account-menu-id">
        <span className="avatar avatar-ink" aria-hidden="true">{iniciales(actor.name)}</span>
        <span className="account-menu-name"><strong>{actor.name}</strong><small>{roleNames[actor.role]}</small></span>
      </div>
      <dl className="account-menu-facts">
        <div><dt>Empresa</dt><dd>{data.organization_name || "—"}</dd></div>
        <div><dt>Perfil</dt><dd>{roleNames[actor.role]} · {perfilDetalle[actor.role]}</dd></div>
      </dl>
      <div className="account-menu-row"><span>Tema</span><ThemeToggle withLabel /></div>
      <div className="account-menu-row"><span>Letra grande</span><TextSizeToggle /></div>
      <nav className="account-menu-links" aria-label="Accesos de la cuenta">
        {veSeccion(actor.role, "/ajustes") && <Link href="/ajustes" onClick={onClose}><Settings size={16} strokeWidth={1.7} aria-hidden="true" />Ajustes</Link>}
        {veSeccion(actor.role, "/configuracion/identidad") && <Link href="/configuracion/identidad" onClick={onClose}><Palette size={16} strokeWidth={1.7} aria-hidden="true" />Logo y colores de la empresa</Link>}
        <Link href="/ayuda" onClick={onClose}><CircleHelp size={16} strokeWidth={1.7} aria-hidden="true" />Ayuda</Link>
      </nav>
      {mode === "supabase"
        ? <button type="button" className="account-menu-exit" onClick={salir} disabled={saliendo}><LogOut size={16} strokeWidth={1.7} aria-hidden="true" />{saliendo ? "Cerrando…" : "Cerrar sesión"}</button>
        : <p className="account-menu-note">Modo demostración: los datos viven solo en este navegador.</p>}
    </div>
  );
}
