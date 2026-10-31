"use client";
import { useState } from "react";
import { FileText, GitBranch, MessageCircle, Pencil, Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-provider";
import { can, money, totals, type Budget, type BudgetVersion, type Project } from "@/lib/domain";

/**
 * Lo que se puede hacer con la versión que se está viendo. Cambia con su estado: el borrador se envía,
 * el enviado espera respuesta y las demás solo se leen. En móvil la acción principal queda fija abajo.
 */
export function BudgetActions({ project, budget, approved, working, shown, onEdit, onSend, onResponse, onAdd, onRevisionCreated }: { project: Project; budget: Budget; approved?: BudgetVersion; working?: BudgetVersion; shown: BudgetVersion; onEdit: () => void; onSend: () => void; onResponse: () => void; onAdd?: () => void; onRevisionCreated?: (version: BudgetVersion) => void }) {
  const { actor, busy, send, notify } = useWorkspace();
  const [revisando, setRevisando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pending, setPending] = useState(false);
  const esBorrador = shown.status === "draft" && shown.id === working?.id;
  const esEnviado = shown.status === "issued" && shown.id === working?.id;
  const puedeEditar = can(actor.role, "budget.save"), puedeRevisar = can(actor.role, "budget.revise"), puedeEnviar = can(actor.role, "budget.issue");
  const hayBorrador = working?.status === "draft";
  const pdf = shown.items.length > 0 ? `/imprimir/presupuesto/${shown.id}` : null;
  const recordatorio = `Hola. ¿Has podido ver el presupuesto de ${project.name} (V${shown.number}, ${money(totals(shown.items).total)} con IVA)? Dime si tienes cualquier duda.`;

  async function crearVersion() {
    if (pending || busy || motivo.trim().length < 3) return;
    setPending(true);
    try {
      const ws = await send({ type: "budget.revise", version_id: shown.id, reason: motivo.trim() });
      const draft = ws.versions.find(v => v.budget_id === budget.id && v.status === "draft");
      if (draft) onRevisionCreated?.(draft);
      notify(`Versión nueva creada desde la V${shown.number}`);
      setRevisando(false); setMotivo("");
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido crear la versión."); }
    finally { setPending(false); }
  }

  return (
    <div className="budget-side-actions">
      {esBorrador && puedeEnviar && shown.items.length > 0 && <div className="budget-actions-bar">{onAdd && <Button className="solo-movil-flex" onClick={onAdd}><Plus size={16} strokeWidth={1.9} aria-hidden="true" />Añadir</Button>}<Button variant="primary" data-accent="orange" onClick={onSend}>Enviar V{shown.number} al cliente</Button></div>}
      {esBorrador && puedeEditar && <Button variant={shown.items.length > 0 ? "secondary" : "primary"} onClick={onEdit}><Pencil size={16} strokeWidth={1.7} aria-hidden="true" />Editar partidas</Button>}
      {esEnviado && <div className="budget-actions-bar"><Button variant="primary" data-accent="orange" onClick={onResponse}>Registrar respuesta del cliente</Button></div>}
      {esEnviado && <a className="btn btn-secondary" href={`https://wa.me/?text=${encodeURIComponent(recordatorio)}`} target="_blank" rel="noopener"><MessageCircle size={16} strokeWidth={1.7} aria-hidden="true" />Recordar al cliente</a>}
      {pdf && <a className="btn btn-secondary" href={pdf} target="_blank" rel="noopener"><FileText size={16} strokeWidth={1.7} aria-hidden="true" />{esBorrador ? "Ver el PDF" : `PDF de la V${shown.number}`}</a>}
      {!esBorrador && !hayBorrador && puedeRevisar && <Button onClick={() => setRevisando(true)}><GitBranch size={16} strokeWidth={1.7} aria-hidden="true" />Partir de esta versión</Button>}
      {!esBorrador && <p className="budget-side-note">{esEnviado ? "Enviada: ya no se edita. Si hay cambios, se hacen en una versión nueva." : "Solo lectura. Una versión enviada o aceptada no se edita nunca."}</p>}

      <Modal open={revisando} onClose={() => setRevisando(false)} title={`Versión nueva desde la V${shown.number}`} footer={<><Button onClick={() => setRevisando(false)} disabled={pending}>Cancelar</Button><Button variant="primary" onClick={crearVersion} disabled={pending || busy || motivo.trim().length < 3}>{pending ? "Creando…" : "Crear la versión nueva"}</Button></>}>
        <p className="text-sm">Se copia la V{shown.number} tal cual a una versión nueva que puedes editar{approved ? `; la V${approved.number} sigue aceptada hasta que el cliente acepte la nueva` : ""}.</p>
        <label className="field" style={{ marginTop: 12 }}><span>Motivo del cambio</span><input type="text" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Cambio de pavimento · el cliente añade el baño pequeño" autoFocus maxLength={500} /></label>
      </Modal>
    </div>
  );
}
