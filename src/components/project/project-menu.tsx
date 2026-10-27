"use client";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Footprints, ListPlus, Receipt, ArrowLeftRight, MessageSquare } from "lucide-react";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useWorkspace } from "@/components/workspace-provider";
import { can, money, totals, projectStatus, type Project, type BudgetVersion } from "@/lib/domain";
import { oficios, oficiosHabituales, personas } from "@/lib/agenda";
import { eurosACentimos } from "@/lib/catalogo";
import { localDate } from "@/lib/hoy";

type Dialogo = "" | "estado" | "tarea" | "certificacion";
const estados = Object.keys(projectStatus) as Project["status"][];

/**
 * Menú «···» de la ficha: lo que se hace con el proyecto y no cabe en la cabecera.
 * Cambiar de fase, planificar una tarea, abrir un borrador de certificación, ir a la visita o al chat.
 */
export function ProjectMenu({ project, approvedVersion, puedeEstimar, onChat }: { project: Project; approvedVersion?: BudgetVersion; puedeEstimar: boolean; onChat: () => void }) {
  const router = useRouter();
  const { data, actor, busy, send, notify } = useWorkspace();
  const [dialogo, setDialogo] = useState<Dialogo>("");
  const [pending, setPending] = useState(false);
  const [estado, setEstado] = useState<Project["status"]>(project.status);
  const [tarea, setTarea] = useState({ title: "", trade: "", assignee: "", due_date: localDate(), weight: "10" });
  const [cert, setCert] = useState({ title: "", amount: "" });
  const listaOficios = useMemo(() => { const o = oficios(data.tasks); return o.length ? o : oficiosHabituales; }, [data.tasks]);
  const listaPersonas = useMemo(() => personas(data.tasks), [data.tasks]);
  const reservado = data.certifications.filter(c => approvedVersion && c.budget_version_id === approvedVersion.id).reduce((s, c) => s + c.amount, 0);
  const saldo = approvedVersion ? totals(approvedVersion.items).base - reservado : 0;
  const importe = eurosACentimos(cert.amount);

  function abrir(d: Dialogo) { setEstado(project.status); setDialogo(d); }
  function cerrar() { setDialogo(""); setPending(false); }

  async function cambiarEstado() {
    if (pending || busy || estado === project.status) return;
    setPending(true);
    try { await send({ type: "project.status", id: project.id, status: estado }); notify(`Proyecto en ${projectStatus[estado].toLowerCase()}`); setDialogo(""); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido cambiar el estado."); }
    finally { setPending(false); }
  }

  async function crearTarea(event: FormEvent) {
    event.preventDefault();
    if (pending || busy) return;
    setPending(true);
    try {
      await send({ type: "task.create", project_id: project.id, title: tarea.title.trim(), trade: tarea.trade.trim(), assignee: tarea.assignee.trim(), due_date: tarea.due_date, weight: Math.min(100, Math.max(1, Number(tarea.weight) || 10)) });
      notify(`Tarea planificada: ${tarea.title.trim()}`);
      setTarea({ title: "", trade: tarea.trade, assignee: tarea.assignee, due_date: tarea.due_date, weight: "10" });
      setDialogo("");
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido crear la tarea."); }
    finally { setPending(false); }
  }

  async function crearCertificacion(event: FormEvent) {
    event.preventDefault();
    if (pending || busy || !approvedVersion || importe === null || importe <= 0) return;
    setPending(true);
    try {
      await send({ type: "certification.create", project_id: project.id, budget_version_id: approvedVersion.id, title: cert.title.trim(), amount: importe });
      notify(`Borrador de certificación: ${money(importe)}`);
      setCert({ title: "", amount: "" });
      setDialogo("");
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido crear la certificación."); }
    finally { setPending(false); }
  }

  const items = [
    { id: "estado", label: "Cambiar de fase", hint: `Ahora: ${projectStatus[project.status]}`, icon: <ArrowLeftRight size={16} strokeWidth={1.7} />, disabled: !can(actor.role, "project.status"), onSelect: () => abrir("estado") },
    { id: "tarea", label: "Planificar tarea", hint: "Oficio, responsable y fecha", icon: <ListPlus size={16} strokeWidth={1.7} />, disabled: !can(actor.role, "task.create"), onSelect: () => abrir("tarea") },
    { id: "certificacion", label: "Nueva certificación", hint: approvedVersion ? `Saldo ${money(saldo)} de la V${approvedVersion.number}` : "Necesita un presupuesto aprobado", icon: <Receipt size={16} strokeWidth={1.7} />, disabled: !approvedVersion || !can(actor.role, "certification.create"), onSelect: () => abrir("certificacion") },
    ...(puedeEstimar ? [{ id: "visita", label: "Estimar en visita", hint: "Fotos, alcance y partidas a pie de obra", icon: <Footprints size={16} strokeWidth={1.7} />, onSelect: () => router.push(`/proyectos/nueva?proyecto=${project.id}`) }] : []),
    { id: "chat", label: "Abrir el chat", hint: "Conversación del equipo", icon: <MessageSquare size={16} strokeWidth={1.7} />, onSelect: onChat }
  ];

  return (
    <>
      <Menu items={items} label="Más acciones del proyecto" />

      <Modal open={dialogo === "estado"} onClose={cerrar} title="Cambiar de fase" footer={<><Button variant="secondary" onClick={cerrar} disabled={pending}>Cancelar</Button><Button variant="primary" onClick={cambiarEstado} disabled={pending || busy || estado === project.status}>{pending ? "Guardando…" : "Cambiar"}</Button></>}>
        <p className="text-sm">La fase ordena la lista de proyectos y los avisos de Hoy. La aprobación del presupuesto y las tareas no cambian solas con ella.</p>
        <div className="segments" style={{ marginTop: 12 }} role="radiogroup" aria-label="Fase">
          {estados.map(s => <button key={s} type="button" role="radio" className="segment" aria-checked={estado === s} aria-pressed={estado === s} onClick={() => setEstado(s)}><span>{projectStatus[s]}</span>{s === project.status && <small className="muted">actual</small>}</button>)}
        </div>
      </Modal>

      <Modal open={dialogo === "tarea"} onClose={cerrar} title={`Planificar tarea · ${project.name}`} footer={<><Button variant="secondary" onClick={cerrar} disabled={pending}>Cancelar</Button><Button variant="primary" type="submit" form="nueva-tarea" disabled={pending || busy || !tarea.title.trim() || !tarea.trade.trim() || !tarea.due_date}>{pending ? "Guardando…" : "Planificar"}</Button></>}>
        <form id="nueva-tarea" className="form" onSubmit={crearTarea} style={{ maxWidth: "none" }}>
          <label className="field"><span>Tarea</span><input type="text" value={tarea.title} onChange={e => setTarea({ ...tarea, title: e.target.value })} placeholder="Replantear tabiquería con el electricista" required maxLength={500} autoFocus /></label>
          <div className="line-grid">
            <div className="field"><span>Oficio</span><Select label="Oficio" value={tarea.trade} onChange={v => setTarea({ ...tarea, trade: v })} options={listaOficios.map(o => ({ value: o, label: o }))} placeholder="Elegir oficio…" /></div>
            <label className="field"><span>Fecha</span><input type="date" value={tarea.due_date} onChange={e => setTarea({ ...tarea, due_date: e.target.value })} required /></label>
          </div>
          <div className="line-grid">
            <label className="field"><span>Responsable</span><input list="personas-ficha" type="text" value={tarea.assignee} onChange={e => setTarea({ ...tarea, assignee: e.target.value })} placeholder="Nombre o equipo" maxLength={120} /><datalist id="personas-ficha">{listaPersonas.map(p => <option key={p} value={p} />)}</datalist></label>
            <label className="field"><span>Peso en el avance</span><span className="unit-input"><input type="number" inputMode="numeric" min={1} max={100} value={tarea.weight} onChange={e => setTarea({ ...tarea, weight: e.target.value })} /><span>%</span></span></label>
          </div>
          <p className="muted text-xs">El peso reparte el avance del proyecto entre sus tareas. Se ve también en la Agenda.</p>
        </form>
      </Modal>

      <Modal open={dialogo === "certificacion"} onClose={cerrar} title="Nueva certificación" footer={<><Button variant="secondary" onClick={cerrar} disabled={pending}>Cancelar</Button><Button variant="primary" type="submit" form="nueva-cert" disabled={pending || busy || !cert.title.trim() || importe === null || importe <= 0 || importe > saldo}>{pending ? "Guardando…" : "Crear borrador"}</Button></>}>
        <form id="nueva-cert" className="form" onSubmit={crearCertificacion} style={{ maxWidth: "none" }}>
          <p className="text-sm">Borrador sobre la V{approvedVersion?.number} aprobada ({approvedVersion ? money(totals(approvedVersion.items).base) : "—"} sin IVA). Queda <strong className="pl-mono">{money(saldo)}</strong> por certificar. La validación y la factura llegarán con el dominio.</p>
          <label className="field"><span>Concepto</span><input type="text" value={cert.title} onChange={e => setCert({ ...cert, title: e.target.value })} placeholder="Certificación 1 · demoliciones y albañilería" required maxLength={500} autoFocus /></label>
          <label className="field"><span>Importe sin IVA</span><span className="unit-input"><input type="text" inputMode="decimal" value={cert.amount} onChange={e => setCert({ ...cert, amount: e.target.value })} placeholder="4.500,00" required aria-invalid={cert.amount !== "" && (importe === null || importe > saldo) ? true : undefined} /><span>€</span></span></label>
          {importe !== null && importe > saldo && <p className="text-xs" role="alert" style={{ color: "var(--pl-danger)" }}>Supera el saldo del presupuesto aprobado.</p>}
        </form>
      </Modal>
    </>
  );
}
