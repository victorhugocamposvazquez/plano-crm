"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, FileText, BookOpen, Users, Package, FolderOpen, Wallet, ChevronRight, UserRound } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { AccountDialog } from "@/components/account-dialog";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { roleNames } from "@/lib/domain";

const entradas = [
  { href: "/presupuestos", label: "Presupuestos", hint: "Todos los presupuestos, por estado", icon: FileText },
  { href: "/catalogo", label: "Catálogo", hint: "Artículos y precios por categoría", icon: BookOpen },
  { href: "/clientes", label: "Clientes", hint: "Quién tiene obra y por cuánto", icon: Users },
  { href: "/compras", label: "Compras", hint: "Materiales por pedir, pedidos y en obra", icon: Package },
  { href: "/documentos", label: "Documentos", hint: "Planos, contratos, fotos y vídeos", icon: FolderOpen },
  { href: "/finanzas", label: "Finanzas", hint: "Aprobado, certificado y pendiente", icon: Wallet }
];

/** En móvil es la puerta a las secciones que no caben en la barra inferior; en escritorio repite el menú lateral. */
export default function MasPage() {
  const { actor, data, mode } = useWorkspace();
  const [account, setAccount] = useState(false);
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
        {entradas.map(e => { const Icon = e.icon; return (
          <Link key={e.href} href={e.href} className="more-item">
            <span className="more-icon"><Icon size={19} strokeWidth={1.55} aria-hidden="true" /></span>
            <span style={{ minWidth: 0, flex: 1 }}><strong>{e.label}</strong><small className="muted">{e.hint}</small></span>
            <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" className="muted" />
          </Link>
        ); })}
      </nav>

      <div className="account-row zone" style={{ padding: "12px 16px" }}>
        <span className="text-sm">Tema de la interfaz</span>
        <ThemeToggle withLabel />
      </div>

      <p className="muted text-xs">Plano · {mode === "supabase" ? "espacio compartido de la empresa" : "modo demostración, los datos viven en este navegador"}.</p>
      <AccountDialog open={account} onClose={() => setAccount(false)} />
    </div>
  );
}
