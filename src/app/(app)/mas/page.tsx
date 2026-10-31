"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, FileText, BookOpen, Package, FolderOpen, Wallet, ChevronRight, UserRound, Palette, FolderDown, ShieldCheck, Sparkles, CircleHelp, Smartphone } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { AccountDialog } from "@/components/account-dialog";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TextSizeToggle } from "@/components/ui/text-size-toggle";
import { roleNames } from "@/lib/domain";
import { veSeccion } from "@/lib/navegacion";

const entradas = [
  { href: "/ayuda", label: "Ayuda", hint: "Cómo se hace un presupuesto, qué es una versión, cómo apunto lo de hoy…", icon: CircleHelp },
  { href: "/instalar", label: "Instalar Plano en el móvil", hint: "Icono en la pantalla de inicio y pantalla completa", icon: Smartphone },
  { href: "/finanzas", label: "Finanzas", hint: "Lo aceptado, lo cobrado y lo que falta por cobrar", icon: Wallet },
  { href: "/catalogo", label: "Catálogo", hint: "Artículos y precios por categoría", icon: BookOpen },
  { href: "/presupuestos", label: "Todos los presupuestos", hint: "De todos los proyectos, por estado", icon: FileText },
  { href: "/compras", label: "Todos los materiales", hint: "De todos los proyectos: por pedir, pedidos y en obra", icon: Package },
  { href: "/documentos", label: "Todos los documentos", hint: "De todos los proyectos: planos, contratos y fotos", icon: FolderOpen },
  { href: "/configuracion/identidad", label: "Identidad de la empresa", hint: "Logo, colores, portada y datos legales de los documentos", icon: Palette },
  { href: "/configuracion/importar", label: "Importar expedientes", hint: "Carga proyectos, presupuestos y documentos desde una carpeta", icon: FolderDown },
  { href: "/configuracion/ejemplos", label: "Proyectos de ejemplo", hint: "Cinco proyectos ficticios para ver Plano con contenido", icon: Sparkles }
];

/** La puerta a las secciones que no están en la barra principal, igual en móvil y escritorio. */
export default function MasPage() {
  const { actor, data, mode } = useWorkspace();
  const [account, setAccount] = useState(false);
  const [superadmin, setSuperadmin] = useState(false);
  useEffect(() => {
    setSuperadmin(false);
    if (mode !== "supabase") return;
    const controller = new AbortController();
    fetch("/sistema/acceso", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (response.ok && !controller.signal.aborted) setSuperadmin((await response.json()).allowed === true);
    }).catch(() => {});
    return () => controller.abort();
  }, [mode, actor.id]);
  const initials = actor.name.split(/[\s·]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");

  return (
    <div className="page">
      <div>
        <div className="eyebrow"><Menu size={13} strokeWidth={1.8} aria-hidden="true" /><span>{data.organization_name || "Espacio de trabajo"}</span></div>
        <h1 className="h1">Más.</h1>
        <p className="subtitle">El resto de secciones, tu cuenta y el tema de la interfaz.</p>
      </div>

      <button type="button" className="more-account zone" onClick={() => setAccount(true)} aria-haspopup="dialog" aria-expanded={account}>
        <span className="avatar avatar-lg" aria-hidden="true">{initials || "·"}</span>
        <span style={{ minWidth: 0, flex: 1 }}><strong>{actor.name}</strong><small className="muted">{roleNames[actor.role]} · {mode === "supabase" ? data.organization_name : "Demostración local"}</small></span>
        <UserRound size={18} strokeWidth={1.6} aria-hidden="true" className="muted" />
      </button>

      <nav className="more-list" aria-label="Secciones">
        {entradas.filter(e => veSeccion(actor.role, e.href)).map(e => { const Icon = e.icon; return (
          <Link key={e.href} href={e.href} className="more-item">
            <span className="more-icon"><Icon size={19} strokeWidth={1.55} aria-hidden="true" /></span>
            <span style={{ minWidth: 0, flex: 1 }}><strong>{e.label}</strong><small className="muted">{e.hint}</small></span>
            <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" className="muted" />
          </Link>
        ); })}
      </nav>

      {superadmin && <Link prefetch={false} href="/sistema" className="more-item"><ShieldCheck size={19} aria-hidden="true"/><span><strong>Supervisión del sistema</strong><small className="muted">Documentación, estado del producto y registro de cambios</small></span><ChevronRight size={16} aria-hidden="true"/></Link>}

      <div className="account-row zone" style={{ padding: "12px 16px" }}>
        <span className="text-sm">Tema de la interfaz</span>
        <ThemeToggle withLabel />
      </div>
      <div className="account-row zone" style={{ padding: "12px 16px" }}>
        <span className="text-sm">Tamaño de la letra</span>
        <TextSizeToggle />
      </div>

      <p className="muted text-xs">Plano · {mode === "supabase" ? "espacio compartido de la empresa" : "modo demostración, los datos viven en este navegador"}.</p>
      <AccountDialog open={account} onClose={() => setAccount(false)} />
    </div>
  );
}
