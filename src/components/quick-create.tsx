"use client";
import { useRouter } from "next/navigation";
import { Building2, Footprints, ListPlus, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useWorkspace } from "@/components/workspace-provider";
import { can, type Role } from "@/lib/domain";

type Opcion = { id: string; label: string; hint: string; href: string; icon: typeof Building2; tone?: "ink" | "blue" | "warning"; permitido: (role: Role) => boolean };

/** Las tres cosas que se crean en Plano, explicadas: todos los «+» de la app llevan a uno de estos tres destinos. */
export const opcionesCrear: Opcion[] = [
  { id: "proyecto", label: "Nuevo proyecto", hint: "Desde la oficina, con los datos del cliente y la obra.", href: "/proyectos?nuevo=1", icon: Building2, tone: "ink", permitido: role => can(role, "project.create") },
  { id: "visita", label: "Visita a pie de obra", hint: "Fotos, notas y una cifra orientativa; crea el proyecto si no existe.", href: "/proyectos/nueva", icon: Footprints, tone: "warning", permitido: role => can(role, "project.create") },
  { id: "tarea", label: "Tarea", hint: "Para hoy o para un día: qué hay que hacer y cuándo.", href: "/agenda?nueva=1", icon: ListPlus, tone: "blue", permitido: role => can(role, "task.create") }
];

export function opcionesPara(role: Role) { return opcionesCrear.filter(o => o.permitido(role)); }

/** Hoja «¿Qué quieres hacer?» que abre el «+» de la barra superior. */
export function QuickCreate({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { actor } = useWorkspace();
  const opciones = opcionesPara(actor.role);
  return (
    <Modal open={open} onClose={onClose} title="¿Qué quieres hacer?">
      <div className="action-sheet">
        {opciones.map(o => { const Icon = o.icon; return (
          <button key={o.id} type="button" className="opt-row" onClick={() => { onClose(); router.push(o.href); }}>
            <span className="opt-ico" data-tone={o.tone}><Icon size={18} strokeWidth={1.7} aria-hidden="true" /></span>
            <span className="opt-text"><strong>{o.label}</strong><small>{o.hint}</small></span>
            <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" className="muted" />
          </button>
        ); })}
      </div>
    </Modal>
  );
}
