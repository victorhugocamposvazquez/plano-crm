"use client";
import { useState } from "react";
import { Lock, Stamp, GitBranch, Printer } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button, LinkButton } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-provider";
import { can, money, totals, type Budget, type BudgetVersion } from "@/lib/domain";
import { accionesPresupuesto } from "@/lib/presupuesto";

const signed = (cents: number) => `${cents < 0 ? "−" : "+"}${money(Math.abs(cents))}`;

/**
 * Acciones del presupuesto según su estado: cerrar la revisión, aprobarla para obra con referencia,
 * abrir una nueva revisión. El comparador tiene su vista propia. Cada una confirma en un diálogo sobre la ficha.
 */
export function BudgetActions({ budget, approved, working, shown, onEdit, onRevisionCreated }: { budget: Budget; approved?: BudgetVersion; working?: BudgetVersion; shown?: BudgetVersion; onEdit: () => void; onRevisionCreated?: (version: BudgetVersion) => void }) {
  const { actor, busy, send, notify } = useWorkspace();
  const permisos = { guardar: can(actor.role, "budget.save"), aprobar: can(actor.role, "budget.approve") };
  const acciones = accionesPresupuesto(approved, working, permisos);
  const [dialogo, setDialogo] = useState<"" | "cerrar" | "aprobar" | "revisar">("");
  const [texto, setTexto] = useState("");
  const [pending, setPending] = useState(false);
  const base = working ?? approved;
  const delta = approved && working ? totals(working.items).base - totals(approved.items).base : 0;

  function cerrarDialogo() { setDialogo(""); setTexto(""); }

  async function ejecutar() {
    if (pending || busy) return;
    setPending(true);
    try {
      if (dialogo === "cerrar" && working) { await send({ type: "budget.issue", version_id: working.id, expected_revision: working.draft_revision }); notify(`V${working.number} cerrada · lista para aprobar`); }
      if (dialogo === "aprobar" && working) { await send({ type: "budget.approve", version_id: working.id, reference: texto.trim() }); notify(`V${working.number} aprobada para obra`); }
      if (dialogo === "revisar" && base) { const ws = await send({ type: "budget.revise", version_id: base.id, reason: texto.trim() }); const draft = ws.versions.find(v => v.budget_id === budget.id && v.status === "draft"); if (draft) onRevisionCreated?.(draft); notify(`Nueva revisión abierta desde V${base.number}`); }
      cerrarDialogo();
    } catch (e) {
      notify(e instanceof Error ? e.message : "No se ha podido completar la acción.");
    } finally {
      setPending(false);
    }
  }

  const imprimible = shown && shown.items.length > 0 ? shown : undefined;
  if (!acciones.length && !(approved && working) && !imprimible) return null;

  return (
    <>
      <div className="actions-row">
        {imprimible && <LinkButton href={`/imprimir/presupuesto/${imprimible.id}`} variant="secondary" target="_blank" rel="noopener"><Printer size={16} strokeWidth={1.7} aria-hidden="true" />{imprimible.status === "draft" ? `Imprimir borrador V${imprimible.number}` : `PDF de la V${imprimible.number}`}</LinkButton>}
        {acciones.includes("editar") && <Button variant="primary" onClick={onEdit}>Editar presupuesto</Button>}
        {acciones.includes("revisar") && <Button variant="secondary" onClick={() => setDialogo("revisar")}><GitBranch size={16} strokeWidth={1.7} aria-hidden="true" />Nueva revisión</Button>}
        {acciones.includes("cerrar") && working && <Button variant="secondary" onClick={() => setDialogo("cerrar")}><Lock size={16} strokeWidth={1.7} aria-hidden="true" />Cerrar V{working.number}</Button>}
        {acciones.includes("aprobar") && working && <Button variant="primary" onClick={() => setDialogo("aprobar")}><Stamp size={16} strokeWidth={1.7} aria-hidden="true" />Aprobar V{working.number} para obra</Button>}
        {working?.status === "issued" && !acciones.includes("aprobar") && <span className="muted text-xs" style={{ alignSelf: "center" }}>Cerrada · la aprueba oficina o administración.</span>}
      </div>

      <Modal open={dialogo === "cerrar"} onClose={cerrarDialogo} title={`Cerrar la V${working?.number ?? ""}`} footer={<><Button variant="secondary" onClick={cerrarDialogo} disabled={pending}>Cancelar</Button><Button variant="primary" onClick={ejecutar} disabled={pending || busy}>{pending ? "Cerrando…" : "Cerrar revisión"}</Button></>}>
        <p className="text-sm">Al cerrarla, las partidas dejan de poder editarse y la revisión queda lista para aprobar. Si hace falta cambiar algo después, se abre una revisión nueva.</p>
        {working && <p className="muted text-sm" style={{ marginTop: 8 }}>{working.items.filter(i => i.inclusion === "included").length} partidas incluidas · {money(totals(working.items).base)} sin IVA · {money(totals(working.items).total)} con IVA</p>}
      </Modal>

      <Modal open={dialogo === "aprobar"} onClose={cerrarDialogo} title={`Aprobar la V${working?.number ?? ""} para obra`} footer={<><Button variant="secondary" onClick={cerrarDialogo} disabled={pending}>Cancelar</Button><Button variant="primary" onClick={ejecutar} disabled={pending || busy || texto.trim().length < 3}>{pending ? "Aprobando…" : "Aprobar para obra"}</Button></>}>
        <p className="text-sm">La aprobación fija el importe de referencia de la obra{approved ? ` y sustituye a la V${approved.number}` : ""}. Deja constancia de cómo ha aceptado el cliente: no es una firma electrónica, es tu registro.</p>
        <label className="field" style={{ marginTop: 12 }}><span>Referencia de la aceptación</span><input type="text" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Correo del 27 oct · presupuesto firmado en papel · transferencia de señal" autoFocus maxLength={500} /></label>
        {approved && working && <p className="muted text-sm" style={{ marginTop: 10 }}>Diferencia con la aprobada: <strong className="pl-mono">{signed(delta)}</strong> en base.</p>}
      </Modal>

      <Modal open={dialogo === "revisar"} onClose={cerrarDialogo} title={`Nueva revisión desde la V${base?.number ?? ""}`} footer={<><Button variant="secondary" onClick={cerrarDialogo} disabled={pending}>Cancelar</Button><Button variant="primary" onClick={ejecutar} disabled={pending || busy || texto.trim().length < 3}>{pending ? "Abriendo…" : "Abrir revisión"}</Button></>}>
        <p className="text-sm">Se copia la V{base?.number} tal cual a una revisión nueva en borrador{approved ? "; la aprobada sigue vigente hasta que se apruebe la nueva" : ""}.</p>
        <label className="field" style={{ marginTop: 12 }}><span>Motivo del cambio</span><input type="text" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Cambio de pavimento · el cliente añade el baño pequeño" autoFocus maxLength={500} /></label>
      </Modal>


    </>
  );
}
