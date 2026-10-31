"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, Footprints, Layers2, ListPlus, Receipt, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { InvoicePanel } from "@/components/project/invoice-panel";
import { useWorkspace } from "@/components/workspace-provider";
import { localDate } from "@/lib/hoy";
import { can, type Role } from "@/lib/domain";

type Panel = "tarea" | "factura";
type Opcion = { id: string; label: string; hint: string; icon: typeof Layers2; permitido: (role: Role) => boolean; href?: string; panel?: Panel };

/** Lo que se crea desde «+ Nuevo». Cliente y proyecto van juntos: un cliente existe con su primer proyecto. */
export const opcionesCrear: Opcion[] = [
  { id: "proyecto", label: "Proyecto", hint: "Desde la oficina, con su cliente y su dirección", icon: Layers2, href: "/proyectos?nuevo=1", permitido: role => can(role, "project.create") },
  { id: "visita", label: "Visita", hint: "A pie de obra: fotos, notas y una cifra orientativa", icon: Footprints, href: "/proyectos/nueva", permitido: role => can(role, "project.create") },
  { id: "tarea", label: "Tarea", hint: "Qué, de qué proyecto y cuándo", icon: ListPlus, panel: "tarea", permitido: role => can(role, "task.create") },
  { id: "cliente", label: "Cliente", hint: "Se da de alta con su primer proyecto", icon: Users, href: "/proyectos?nuevo=1", permitido: role => can(role, "project.create") },
  { id: "articulo", label: "Artículo", hint: "Para el catálogo", icon: BookOpen, href: "/catalogo?nuevo=1", permitido: role => can(role, "article.create") },
  { id: "factura", label: "Factura", hint: "De un proyecto, con base, IVA y total", icon: Receipt, panel: "factura", permitido: role => can(role, "invoice.create") }
];

export function opcionesPara(role: Role) { return opcionesCrear.filter(o => o.permitido(role)); }

/** Lista de «+ Nuevo»; sirve igual en el desplegable del menú y en la hoja del móvil. */
export function QuickCreateList({ onElegir }: { onElegir: (opcion: Opcion) => void }) {
  const { actor } = useWorkspace();
  return (
    <div className="new-list" role="menu" aria-label="Crear">
      {opcionesPara(actor.role).map(o => { const Icon = o.icon; return (
        <button key={o.id} type="button" role="menuitem" className="new-item" onClick={() => onElegir(o)}>
          <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
          <span><strong>{o.label}</strong><small>{o.hint}</small></span>
        </button>
      ); })}
    </div>
  );
}

/** Abre el destino de una opción de «+ Nuevo» y conserva los paneles laterales de tarea y de cobro. */
export function useQuickCreate() {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel | null>(null);
  return { panel, cerrar: () => setPanel(null), elegir: (o: Opcion) => { if (o.panel) setPanel(o.panel); else if (o.href) router.push(o.href); } };
}

export function QuickCreatePanels({ panel, onClose, fecha }: { panel: Panel | null; onClose: () => void; fecha?: string }) {
  return <><TareaPanel open={panel === "tarea"} onClose={onClose} fecha={fecha} /><InvoicePanel open={panel === "factura"} onClose={onClose} /></>;
}

function TareaPanel({ open, onClose, fecha }: { open: boolean; onClose: () => void; fecha?: string }) {
  const { data, busy, send, notify } = useWorkspace();
  const [form, setForm] = useState({ project_id: "", title: "", due_date: localDate() });
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (open) setForm(f => ({ ...f, due_date: fecha || localDate(), project_id: f.project_id || data.projects.find(p => p.status === "active")?.id || data.projects[0]?.id || "" })); }, [open, data.projects, fecha]);
  async function crear(event: FormEvent) {
    event.preventDefault();
    if (guardando || busy) return;
    setGuardando(true);
    try {
      await send({ type: "task.create", project_id: form.project_id, title: form.title.trim(), trade: "Coordinación", assignee: "", due_date: form.due_date, weight: 10 });
      notify(`Tarea planificada: ${form.title.trim()}`);
      setForm(f => ({ ...f, title: "" }));
      onClose();
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido crear la tarea."); }
    finally { setGuardando(false); }
  }
  return (
    <Modal open={open} onClose={onClose} panel="md" kicker="Nuevo" title="Tarea" footer={<><Button onClick={onClose} disabled={guardando}>Cancelar</Button><Button variant="primary" type="submit" form="panel-tarea" disabled={guardando || busy || !form.title.trim() || !form.project_id}>{guardando ? "Guardando…" : "Crear tarea"}</Button></>}>
      <form id="panel-tarea" className="form" onSubmit={crear} style={{ maxWidth: "none" }}>
        <div className="field"><span>Proyecto</span><Select label="Proyecto" value={form.project_id} onChange={v => setForm({ ...form, project_id: v })} options={data.projects.map(p => ({ value: p.id, label: p.name, hint: p.client_name }))} placeholder="Elegir proyecto…" /></div>
        <label className="field"><span>Qué hay que hacer</span><input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Replantear tabiquería con el electricista" required maxLength={500} autoFocus /></label>
        <label className="field"><span>Cuándo</span><input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} required /></label>
        <p className="muted text-xs">Con esto basta. El oficio y el responsable se ponen luego en la tarea, si hacen falta.</p>
      </form>
    </Modal>
  );
}
