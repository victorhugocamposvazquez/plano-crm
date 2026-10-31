"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, Check, Footprints, Layers2, ListPlus, Receipt, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useWorkspace } from "@/components/workspace-provider";
import { budgetHistory } from "@/lib/budget-history";
import { eurosACentimos } from "@/lib/catalogo";
import { localDate } from "@/lib/hoy";
import { can, money, totals, type Role } from "@/lib/domain";

type Panel = "tarea" | "cobro";
type Opcion = { id: string; label: string; hint: string; icon: typeof Layers2; permitido: (role: Role) => boolean; href?: string; panel?: Panel };

/** Lo que se crea desde «+ Nuevo». Cliente y proyecto van juntos: un cliente existe con su primer proyecto. */
export const opcionesCrear: Opcion[] = [
  { id: "proyecto", label: "Proyecto", hint: "Desde la oficina, con su cliente y su dirección", icon: Layers2, href: "/proyectos?nuevo=1", permitido: role => can(role, "project.create") },
  { id: "visita", label: "Visita", hint: "A pie de obra: fotos, notas y una cifra orientativa", icon: Footprints, href: "/proyectos/nueva", permitido: role => can(role, "project.create") },
  { id: "tarea", label: "Tarea", hint: "Qué, de qué proyecto y cuándo", icon: ListPlus, panel: "tarea", permitido: role => can(role, "task.create") },
  { id: "cliente", label: "Cliente", hint: "Se da de alta con su primer proyecto", icon: Users, href: "/proyectos?nuevo=1", permitido: role => can(role, "project.create") },
  { id: "articulo", label: "Artículo", hint: "Para el catálogo", icon: BookOpen, href: "/catalogo?nuevo=1", permitido: role => can(role, "article.create") },
  { id: "cobro", label: "Cobro", hint: "De un proyecto con presupuesto aceptado", icon: Receipt, panel: "cobro", permitido: role => can(role, "certification.create") }
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

export function QuickCreatePanels({ panel, onClose }: { panel: Panel | null; onClose: () => void }) {
  return <><TareaPanel open={panel === "tarea"} onClose={onClose} /><CobroPanel open={panel === "cobro"} onClose={onClose} /></>;
}

function TareaPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, busy, send, notify } = useWorkspace();
  const [form, setForm] = useState({ project_id: "", title: "", due_date: localDate() });
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (open) setForm(f => ({ ...f, due_date: localDate(), project_id: f.project_id || data.projects.find(p => p.status === "active")?.id || data.projects[0]?.id || "" })); }, [open, data.projects]);
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

function CobroPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, busy, send, notify } = useWorkspace();
  const aceptados = data.budgets.flatMap(b => { const v = budgetHistory(b, data.versions).approved; const p = data.projects.find(x => x.id === b.project_id); return v && p ? [{ version: v, project: p, budget: b }] : []; });
  const [versionId, setVersionId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [importe, setImporte] = useState("");
  const [guardando, setGuardando] = useState(false);
  const elegido = aceptados.find(a => a.version.id === versionId);
  const preparado = elegido ? data.certifications.filter(c => data.versions.find(v => v.id === c.budget_version_id)?.budget_id === elegido.budget.id).reduce((s, c) => s + c.amount, 0) : 0;
  const saldo = elegido ? totals(elegido.version.items).base - preparado : 0;
  const base = eurosACentimos(importe);
  const iva = base === null ? 0 : Math.round(base * 0.21);
  async function crear(event: FormEvent) {
    event.preventDefault();
    if (guardando || busy || !elegido || base === null || base <= 0 || base > saldo) return;
    setGuardando(true);
    try {
      await send({ type: "certification.create", project_id: elegido.project.id, budget_version_id: elegido.version.id, title: titulo.trim(), amount: base });
      notify(`Cobro preparado: ${money(base)} sin IVA`);
      setTitulo(""); setImporte(""); onClose();
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido preparar el cobro."); }
    finally { setGuardando(false); }
  }
  return (
    <Modal open={open} onClose={onClose} panel="md" kicker="Nuevo" title="Cobro" footer={<><Button onClick={onClose} disabled={guardando}>Cancelar</Button><Button variant="primary" type="submit" form="panel-cobro" disabled={guardando || busy || !elegido || !titulo.trim() || base === null || base <= 0 || base > saldo}><Check size={16} strokeWidth={1.8} aria-hidden="true" />{guardando ? "Guardando…" : "Preparar cobro"}</Button></>}>
      {aceptados.length === 0
        ? <p className="text-sm">Todavía no hay proyectos con un presupuesto aceptado. El cobro se prepara sobre lo que el cliente ya ha aceptado.</p>
        : <form id="panel-cobro" className="form" onSubmit={crear} style={{ maxWidth: "none" }}>
          <div className="field"><span>Proyecto</span><Select label="Proyecto" value={versionId} onChange={setVersionId} options={aceptados.map(a => ({ value: a.version.id, label: a.project.name, hint: `V${a.version.number} · ${a.budget.title}` }))} placeholder="Elegir proyecto…" /></div>
          <label className="field"><span>Concepto</span><input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Cobro parcial · demolición y tabiquería" required maxLength={500} /></label>
          <label className="field"><span>Importe sin IVA</span><span className="unit-input"><input type="text" inputMode="decimal" value={importe} onChange={e => setImporte(e.target.value)} placeholder="4.068,74" required aria-invalid={importe !== "" && (base === null || base > saldo) ? true : undefined} /><span>€</span></span></label>
          {elegido && <p className="muted text-xs">Quedan <span className="pl-mono">{money(saldo)}</span> sin IVA por preparar de la V{elegido.version.number}.</p>}
          {base !== null && base > saldo && elegido && <p className="text-xs" role="alert" style={{ color: "var(--pl-danger)" }}>Supera lo que queda por cobrar de este presupuesto.</p>}
          {base !== null && <dl className="sum-box"><div><dt>Base</dt><dd className="pl-mono">{money(base)}</dd></div><div><dt>IVA 21 %</dt><dd className="pl-mono">{money(iva)}</dd></div><div data-total><dt>Total</dt><dd className="pl-mono">{money(base + iva)}</dd></div></dl>}
          <p className="muted text-xs">Queda como borrador: todavía no es una factura emitida.</p>
        </form>}
    </Modal>
  );
}
