"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, CircleHelp, LogOut, Search, Settings, ShieldCheck, Smartphone, Users, Wallet } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { ThemePicker } from "@/components/ui/theme-toggle";
import { TextSizeSwitch } from "@/components/ui/text-size-toggle";
import { CommandPalette } from "@/components/command-palette";
import { roleNames } from "@/lib/domain";
import { iniciales } from "@/lib/pasos";
import { veSeccion } from "@/lib/navegacion";
import { facturasDe, vencidas } from "@/lib/facturas";

/** Tu cuenta y lo que no cabe en la barra inferior: en móvil, Clientes, Catálogo, Finanzas y Ajustes viven aquí. */
export default function MasPage() {
  const { actor, data, mode, notify } = useWorkspace();
  const [superadmin, setSuperadmin] = useState(false);
  const [buscar, setBuscar] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  useEffect(() => {
    setSuperadmin(false);
    if (mode !== "supabase") return;
    const controller = new AbortController();
    fetch("/sistema/acceso", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (response.ok && !controller.signal.aborted) setSuperadmin((await response.json()).allowed === true);
    }).catch(() => {});
    return () => controller.abort();
  }, [mode, actor.id]);
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
  const fueraDePlazo = vencidas(facturasDe(data)).length;
  const entradas = [
    { href: "/clientes", label: "Clientes", icon: Users, aviso: "" },
    { href: "/catalogo", label: "Catálogo", icon: BookOpen, aviso: "" },
    { href: "/finanzas", label: "Finanzas", icon: Wallet, aviso: fueraDePlazo ? `${fueraDePlazo} ${fueraDePlazo === 1 ? "vencida" : "vencidas"}` : "" },
    { href: "/ajustes", label: "Ajustes de la empresa", icon: Settings, aviso: "" }
  ].filter(e => veSeccion(actor.role, e.href));
  return (
    <div className="page mas-page">
      <h1 className="pl-title">Más</h1>
      <div className="pl-card mas-account"><span className="avatar avatar-ink avatar-big" aria-hidden="true">{iniciales(actor.name)}</span><span><strong>{actor.name}</strong><small>{roleNames[actor.role]} · {data.organization_name}</small></span></div>
      <nav className="pl-card mas-list" aria-label="Secciones">
        {entradas.map(e => { const Icon = e.icon; return <Link key={e.href} href={e.href} className="mas-row"><Icon size={18} strokeWidth={1.6} aria-hidden="true" /><span>{e.label}</span>{e.aviso && <em>{e.aviso}</em>}<ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" /></Link>; })}
        <button type="button" className="mas-row" onClick={() => setBuscar(true)}><Search size={18} strokeWidth={1.6} aria-hidden="true" /><span>Buscar en Plano</span><ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" /></button>
        {superadmin && <Link prefetch={false} href="/sistema" className="mas-row"><ShieldCheck size={18} strokeWidth={1.6} aria-hidden="true" /><span>Supervisión del sistema</span><ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" /></Link>}
      </nav>
      <section className="pl-card mas-list" aria-label="Preferencias">
        <div className="mas-row mas-pref"><span>Tema</span><ThemePicker /></div>
        <div className="mas-row mas-pref"><span>Letra grande</span><TextSizeSwitch /></div>
        <Link href="/ayuda" className="mas-row"><CircleHelp size={18} strokeWidth={1.6} aria-hidden="true" /><span>Ayuda</span><ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" /></Link>
        <Link href="/instalar" className="mas-row"><Smartphone size={18} strokeWidth={1.6} aria-hidden="true" /><span>Instalar Plano en el móvil</span><ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" /></Link>
      </section>
      {mode === "supabase" ? <button type="button" className="mas-exit" onClick={salir} disabled={saliendo}><LogOut size={16} strokeWidth={1.7} aria-hidden="true" />{saliendo ? "Cerrando…" : "Cerrar sesión"}</button> : <p className="muted text-xs">Modo demostración: los datos viven en este navegador.</p>}
      <CommandPalette open={buscar} onClose={() => setBuscar(false)} />
    </div>
  );
}
