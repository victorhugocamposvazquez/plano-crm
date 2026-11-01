"use client";
import Link from "next/link";
import { BookOpen, ChevronRight, CircleHelp, FolderDown, Palette, Smartphone, Sparkles, Users } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { veSeccion } from "@/lib/navegacion";

const entradas = [
  { href: "/configuracion/identidad", label: "Identidad de la empresa", hint: "Logo, colores y datos legales del PDF", icon: Palette },
  { href: "/catalogo?importar=1", label: "Subir tarifa de proveedor", hint: "Importa artículos y precios desde un Excel o CSV", icon: BookOpen },
  { href: "/configuracion/importar", label: "Importar proyectos antiguos", hint: "Carga proyectos, presupuestos y documentos desde una carpeta", icon: FolderDown },
  { href: "/configuracion/ejemplos", label: "Proyectos de ejemplo", hint: "Cinco proyectos ficticios para ver Plano con contenido", icon: Sparkles },
  { href: "/ayuda", label: "Ayuda", hint: "Cómo se hace un presupuesto, qué es una versión…", icon: CircleHelp },
  { href: "/instalar", label: "Instalar Plano en el móvil", hint: "Icono en la pantalla de inicio y pantalla completa", icon: Smartphone }
];

/** Ajustes: lo que se configura una vez y no se toca cada día. */
export default function AjustesPage() {
  const { actor } = useWorkspace();
  return (
    <div className="page settings-page">
      <div><h1 className="pl-title">Ajustes</h1><p className="pl-sub">Lo que se configura una vez y no se toca cada día.</p></div>
      <div className="pl-card settings-list">
        {entradas.filter(e => veSeccion(actor.role, e.href.split("?")[0])).map(e => { const Icon = e.icon; return (
          <Link key={e.href} href={e.href} className="settings-row">
            <Icon size={18} strokeWidth={1.6} aria-hidden="true" />
            <span><strong>{e.label}</strong><small>{e.hint}</small></span>
            <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" />
          </Link>
        ); })}
      </div>
      <p className="muted text-sm"><Users size={14} strokeWidth={1.7} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 6 }} />Quién puede enviar presupuestos y marcarlos como aceptados depende del perfil de cada persona: Administración y Oficina pueden aceptarlos.</p>
    </div>
  );
}
