"use client";
import { useState } from "react";
import Link from "next/link";
import { LogOut, Building2, ShieldCheck, Database, FlaskConical, Palette } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useWorkspace } from "@/components/workspace-provider";
import { roleNames } from "@/lib/domain";

/**
 * Panel de cuenta: se abre desde el avatar y reúne quién eres, con qué perfil y en qué organización,
 * el tema de la interfaz y el cierre de sesión. No cambia de ruta.
 */
export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actor, data, mode, notify } = useWorkspace();
  const [leaving, setLeaving] = useState(false);
  const initials = actor.name.split(/[\s·]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");

  async function signOut() {
    if (leaving) return;
    setLeaving(true);
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { notify(result.error || "No se ha podido cerrar la sesión."); return; }
      window.location.assign(typeof result.redirect === "string" ? result.redirect : "/login");
    } catch {
      notify("Sin conexión: no se ha podido cerrar la sesión.");
    } finally {
      setLeaving(false);
    }
  }

  const footer = mode === "supabase"
    ? <Button variant="secondary" onClick={signOut} disabled={leaving}><LogOut size={16} strokeWidth={1.7} aria-hidden="true" />{leaving ? "Cerrando…" : "Cerrar sesión"}</Button>
    : <span className="muted text-xs">Modo demostración: no hay sesión que cerrar. Los datos viven solo en este navegador.</span>;

  return (
    <Modal open={open} onClose={onClose} title="Tu cuenta" footer={footer}>
      <div className="account">
        <div className="account-id">
          <span className="avatar avatar-lg" aria-hidden="true">{initials || "·"}</span>
          <div style={{ minWidth: 0 }}>
            <strong className="account-name">{actor.name}</strong>
            <span className="muted text-sm">{roleNames[actor.role]}</span>
          </div>
        </div>
        <dl className="account-facts">
          <div><dt><Building2 size={15} strokeWidth={1.7} aria-hidden="true" />Organización</dt><dd>{data.organization_name || "—"}</dd></div>
          <div><dt><ShieldCheck size={15} strokeWidth={1.7} aria-hidden="true" />Perfil</dt><dd>{roleNames[actor.role]}<small className="muted">{actor.role === "admin" || actor.role === "office" ? " · aprueba presupuestos y certificaciones" : actor.role === "site" ? " · tareas, mensajes, documentos y recepciones" : actor.role === "viewer" ? " · solo consulta" : ""}</small></dd></div>
          <div><dt>{mode === "supabase" ? <Database size={15} strokeWidth={1.7} aria-hidden="true" /> : <FlaskConical size={15} strokeWidth={1.7} aria-hidden="true" />}Datos</dt><dd>{mode === "supabase" ? "Espacio compartido de la empresa" : "Demostración local"}</dd></div>
        </dl>
        {(actor.role === "admin" || actor.role === "office") && <Link href="/configuracion/identidad" className="account-link" onClick={onClose}><Palette size={16} strokeWidth={1.7} aria-hidden="true" /><span style={{ flex: 1 }}>Identidad de la empresa<small className="muted">Logo, colores y portada de los documentos</small></span></Link>}
        <div className="account-row">
          <span>Tema de la interfaz</span>
          <ThemeToggle withLabel />
        </div>
      </div>
    </Modal>
  );
}
