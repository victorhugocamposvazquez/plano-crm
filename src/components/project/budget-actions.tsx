"use client";
import { useState } from "react";
import { Lock, Stamp, GitBranch, Diff, Printer } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button, LinkButton } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-provider";
import { can, money, totals, compareVersions, lineTotal, type Budget, type BudgetVersion } from "@/lib/domain";
import { accionesPresupuesto, describirCambio } from "@/lib/presupuesto";

const signed = (cents: number) => `${cents < 0 ? "−" : "+"}${money(Math.abs(cents))}`;

/**
 * Acciones del presupuesto según su estado: cerrar la revisión, aprobarla para obra con referencia,
 * abrir una nueva revisión y ver el comparador completo. Cada una confirma en un diálogo sobre la ficha.
 */
export function BudgetActions({ budget, approved, working, shown, onEdit }: { budget: Budget; approved?: BudgetVersion; working?: BudgetVersion; shown?: BudgetVersion; onEdit: () => void }) {
  const { actor, busy, send, notify } = useWorkspace();
  const permisos = { guardar: can(actor.role, "budget.save"), aprobar: can(actor.role, "budget.approve") };
  const acciones = accionesPresupuesto(approved, working, permisos);
  const [dialogo, setDialogo] = useState<"" | "cerrar" | "aprobar" | "revisar" | "cambios">("");
  const [texto, setTexto] = useState("");
  const [pending, setPending] = useState(false);
  const base = working ?? approved;
  const cambios = approved && working ? compareVersions(approved, working) : [];
  const delta = cambios.reduce((s, c) => s + c.delta, 0);

  function cerrarDialogo() { setDialogo(""); setTexto(""); }

  async function ejecutar() {
    if (pending || busy) return;
    setPending(true);
    try {
      if (dialogo === "cerrar" && working) { await send({ type: "budget.issue", version_id: working.id, expected_revision: working.draft_revision }); notify(`V${working.number} cerrada · lista para aprobar`); }
      if (dialogo === "aprobar" && working) { await send({ type: "budget.approve", version_id: working.id, reference: texto.trim() }); notify(`V${working.number} aprobada para obra`); }
      if (dialogo === "revisar" && base) { await send({ type: "budget.revise", version_id: base.id, reason: texto.trim() }); notify(`Nueva revisión abierta desde V${base.number}`); }
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
        {approved && working && <Button variant="secondary" onClick={() => setDialogo("cambios")}><Diff size={16} strokeWidth={1.7} aria-hidden="true" />Ver cambios completos</Button>}
        {acciones.includes("editar") && <Button variant="secondary" onClick={onEdit}>Editar partidas</Button>}
        {acciones.includes("revisar") && <Button variant="secondary" onClick={() => setDialogo("revisar")}><GitBranch size={16} strokeWidth={1.7} aria-hidden="true" />Nueva revisión</Button>}
        {acciones.includes("cerrar") && working && <Button variant="primary" onClick={() => setDialogo("cerrar")}><Lock size={16} strokeWidth={1.7} aria-hidden="true" />Cerrar V{working.number}</Button>}
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

      <Modal open={dialogo === "cambios"} onClose={cerrarDialogo} title={`Cambios de la V${working?.number ?? ""} respecto a la V${approved?.number ?? ""}`} footer={<Button variant="secondary" onClick={cerrarDialogo}>Cerrar</Button>}>
        {cambios.length === 0 ? <p className="muted text-sm">Sin diferencias: la V{working?.number} es igual que la aprobada.</p> : (
          <div className="changes">
            {cambios.map(c => (
              <article key={c.id} className="change" data-kind={c.kind}>
                <header><strong>{(c.after ?? c.before)?.description}</strong><span className="pl-mono" style={{ color: c.delta > 0 ? "var(--pl-warning)" : c.delta < 0 ? "var(--pl-success)" : "var(--pl-muted)" }}>{c.delta ? signed(c.delta) : "±0"}</span></header>
                <ul>{describirCambio(c).map((t, i) => <li key={i}>{t}</li>)}</ul>
                {c.kind === "changed" && c.after && <small className="muted">Ahora: {c.after.quantity} {c.after.unit} × {money(c.after.unit_price)}{c.after.adjustment_percent ? ` · ajuste ${c.after.adjustment_percent} %` : ""} = {money(lineTotal(c.after))}</small>}
              </article>
            ))}
            <div className="totals" style={{ marginTop: 4 }}>
              <span><small>V{approved?.number} aprobada</small><strong className="pl-mono">{approved ? money(totals(approved.items).base) : "—"}</strong></span>
              <span><small>V{working?.number}</small><strong className="pl-mono">{working ? money(totals(working.items).base) : "—"}</strong></span>
              <span><small>Diferencia en base</small><strong className="pl-mono">{signed(delta)}</strong></span>
            </div>
          </div>
        )}
        <p className="muted text-xs" style={{ marginTop: 10 }}>Presupuesto «{budget.title}» · importes en base sin IVA.</p>
      </Modal>
    </>
  );
}
