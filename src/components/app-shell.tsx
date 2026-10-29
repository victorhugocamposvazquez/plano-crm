"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Layers2, CalendarDays, Users, Menu, Plus, Search, FileText, BookOpen, Package, FolderOpen, Wallet } from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import { Brand } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AccountDialog } from "@/components/account-dialog";
import { useWorkspace } from "@/components/workspace-provider";
import { roleNames } from "@/lib/domain";
import { veSeccion } from "@/lib/navegacion";

const iconProps = { size: 19, strokeWidth: 1.55, "aria-hidden": true } as const;

/** Las cuatro primeras entradas son las de la navegación inferior en móvil. */
/** En móvil, cinco entradas (las marcadas como principales); en tablet y escritorio, el menú completo. */
const items = [
  { href: "/", label: "Hoy", icon: House, primary: true, exact: true },
  { href: "/proyectos", label: "Proyectos", icon: Layers2, primary: true },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, primary: true },
  { href: "/clientes", label: "Clientes", icon: Users, primary: true },
  { href: "/presupuestos", label: "Presupuestos", icon: FileText },
  { href: "/catalogo", label: "Catálogo", icon: BookOpen },
  { href: "/compras", label: "Compras", icon: Package },
  { href: "/documentos", label: "Documentos", icon: FolderOpen },
  { href: "/finanzas", label: "Finanzas", icon: Wallet },
  { href: "/mas", label: "Más", icon: Menu, primary: true }
];
const secundarias = ["/presupuestos", "/catalogo", "/compras", "/documentos", "/finanzas", "/configuracion", "/sistema", "/laboratorio"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { actor, notice, noticeAction, dismissNotice } = useWorkspace();
  const visibles = items.filter(item => veSeccion(actor.role, item.href));
  const [account, setAccount] = useState(false);
  const [search, setSearch] = useState(false);
  // ⌘K / Ctrl+K abre el buscador desde cualquier pantalla.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(v => !v); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const initials = actor.name.split(/[\s·]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <div className="shell">
      <nav className="nav" aria-label="Principal">
        <Link prefetch={false} href="/" className="nav-brand" aria-label="Inicio"><Brand /></Link>
        <button type="button" className="nav-search" onClick={() => setSearch(true)} aria-label="Buscar en Plano" title="Buscar (⌘K)"><Search size={17} strokeWidth={1.7} aria-hidden="true" /><span>Buscar…</span><span className="pl-mono">⌘K</span></button>
        {visibles.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact) || (item.href === "/mas" && secundarias.some(h => isActive(h, false)) && !visibles.some(o => o.href !== "/mas" && isActive(o.href, o.exact)));
          return (
            <Link key={item.href} prefetch={false} href={item.href} className="nav-item" data-primary={item.primary || undefined} aria-current={active ? "page" : undefined} aria-label={item.label} title={item.label}>
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
          <Link prefetch={false} href="/" aria-label="Inicio" style={{ color: "inherit", textDecoration: "none" }}><Brand /></Link>
          <div className="topbar-tools">
            <button type="button" className="topbar-search" onClick={() => setSearch(true)} aria-label="Buscar en Plano"><Search size={19} strokeWidth={1.6} aria-hidden="true" /></button>
            <Link prefetch={false} href="/proyectos?nuevo=1" aria-label="Nuevo proyecto" title="Nuevo proyecto" className="topbar-new"><Plus size={18} strokeWidth={1.9} aria-hidden="true" /></Link>
            <ThemeToggle />
            <button type="button" className="avatar avatar-button" onClick={() => setAccount(true)} aria-label={`Tu cuenta · ${actor.name}`} aria-haspopup="dialog" aria-expanded={account}>{initials || "·"}</button>
          </div>
        </header>
        <main className="shell-main">{children}</main>
      </div>

      <AccountDialog open={account} onClose={() => setAccount(false)} />
      <CommandPalette open={search} onClose={() => setSearch(false)} />
      {notice && <div className="notice" role="status"><span>{notice}</span>{noticeAction && <button type="button" className="notice-action" onClick={() => { const run = noticeAction.run; dismissNotice(); void run(); }}>{noticeAction.label}</button>}</div>}
    </div>
  );
}
