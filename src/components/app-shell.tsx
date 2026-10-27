"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Layers2, CalendarDays, FileText, BookOpen, Users, Package, FolderOpen, Wallet, Menu, SquarePen, LogOut } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useWorkspace } from "@/components/workspace-provider";
import { roleNames } from "@/lib/domain";

const iconProps = { size: 19, strokeWidth: 1.55, "aria-hidden": true } as const;

/** Las cuatro primeras entradas son las de la navegación inferior en móvil. */
const items = [
  { href: "/", label: "Hoy", icon: House, primary: true, exact: true },
  { href: "/proyectos", label: "Proyectos", icon: Layers2, primary: true },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, primary: true },
  { href: "/presupuestos", label: "Presupuestos", icon: FileText },
  { href: "/catalogo", label: "Catálogo de precios", icon: BookOpen },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/compras", label: "Compras", icon: Package },
  { href: "/documentos", label: "Documentos", icon: FolderOpen },
  { href: "/economico", label: "Económico", icon: Wallet },
  { href: "/mas", label: "Más", icon: Menu, primary: true }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { actor, notice, mode, notify } = useWorkspace();
  const [leaving, setLeaving] = useState(false);
  const initials = actor.name.split(/[\s·]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

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
  const signOutButton = mode === "supabase" && (
    <button type="button" className="nav-signout" onClick={signOut} disabled={leaving} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut {...iconProps} /></button>
  );

  return (
    <div className="shell">
      <nav className="nav" aria-label="Principal">
        <Link href="/" className="nav-brand" aria-label="Inicio"><Brand /></Link>
        {items.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <Link key={item.href} href={item.href} className="nav-item" data-primary={item.primary || undefined} aria-current={active ? "page" : undefined} aria-label={item.label} title={item.label}>
              <span className="nav-icon"><Icon {...iconProps} /></span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        <div className="nav-foot">
          <span className="avatar" aria-hidden="true">{initials || "·"}</span>
          <span className="text-sm nav-user">{actor.name}<small className="muted" style={{ display: "block" }}>{roleNames[actor.role]}</small></span>
          <ThemeToggle />
          {signOutButton}
        </div>
      </nav>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header className="topbar">
          <Link href="/" aria-label="Inicio" style={{ color: "inherit", textDecoration: "none" }}><Brand /></Link>
          <div className="topbar-tools">
            <Link href="/proyectos/nueva" aria-label="Nueva visita" style={{ color: "inherit", display: "inline-flex" }}><SquarePen {...iconProps} /></Link>
            <ThemeToggle />
            {signOutButton}
            <span className="avatar" aria-label={actor.name}>{initials || "·"}</span>
          </div>
        </header>
        <main className="shell-main">{children}</main>
      </div>

      {notice && <div className="notice" role="status">{notice}</div>}
    </div>
  );
}
