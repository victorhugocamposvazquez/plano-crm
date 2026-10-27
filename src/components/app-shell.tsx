"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Layers2, CalendarDays, FileText, BookOpen, Users, Package, FolderOpen, Wallet, Menu, Plus } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AccountDialog } from "@/components/account-dialog";
import { useWorkspace } from "@/components/workspace-provider";
import { roleNames } from "@/lib/domain";

const iconProps = { size: 19, strokeWidth: 1.55, "aria-hidden": true } as const;

/** Las cuatro primeras entradas son las de la navegación inferior en móvil. */
const items = [
  { href: "/", label: "Hoy", icon: House, primary: true, exact: true },
  { href: "/proyectos", label: "Proyectos", icon: Layers2, primary: true },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, primary: true },
  { href: "/presupuestos", label: "Presupuestos", icon: FileText },
  { href: "/catalogo", label: "Catálogo", icon: BookOpen },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/compras", label: "Compras", icon: Package },
  { href: "/documentos", label: "Documentos", icon: FolderOpen },
  { href: "/finanzas", label: "Finanzas", icon: Wallet },
  { href: "/mas", label: "Más", icon: Menu, primary: true }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { actor, notice } = useWorkspace();
  const [account, setAccount] = useState(false);
  const initials = actor.name.split(/[\s·]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

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
          <button type="button" className="nav-account" onClick={() => setAccount(true)} aria-haspopup="dialog" aria-expanded={account} title="Tu cuenta">
            <span className="avatar" aria-hidden="true">{initials || "·"}</span>
            <span className="text-sm nav-user">{actor.name}<small className="muted" style={{ display: "block" }}>{roleNames[actor.role]}</small></span>
          </button>
          <ThemeToggle />
        </div>
      </nav>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header className="topbar">
          <Link href="/" aria-label="Inicio" style={{ color: "inherit", textDecoration: "none" }}><Brand /></Link>
          <div className="topbar-tools">
            <Link href="/proyectos?nuevo=1" aria-label="Nuevo proyecto" title="Nuevo proyecto" className="topbar-new"><Plus size={18} strokeWidth={1.9} aria-hidden="true" /></Link>
            <ThemeToggle />
            <button type="button" className="avatar avatar-button" onClick={() => setAccount(true)} aria-label={`Tu cuenta · ${actor.name}`} aria-haspopup="dialog" aria-expanded={account}>{initials || "·"}</button>
          </div>
        </header>
        <main className="shell-main">{children}</main>
      </div>

      <AccountDialog open={account} onClose={() => setAccount(false)} />
      {notice && <div className="notice" role="status">{notice}</div>}
    </div>
  );
}
