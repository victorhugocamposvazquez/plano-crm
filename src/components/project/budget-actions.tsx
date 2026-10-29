"use client";
import { useState } from "react";
import { Lock, Stamp, GitBranch, Printer, Pencil } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-provider";
import { can, money, totals, type Budget, type BudgetVersion } from "@/lib/domain";
import { accionesPresupuesto } from "@/lib/presupuesto";

const signed = (cents: number) => `${cents < 0 ? "−" : "+"}${money(Math.abs(cents))}`;

/**
 * Acciones del presupuesto según su estado. Una sola acción principal («Editar partidas» en borrador,
 * «Aprobar Vn para obra» cuando está cerrada) en una barra que en móvil queda fija abajo; el resto
 * (imprimir, cerrar la revisión, abrir una nueva) en el menú «···» de la versión. Cerrar y aprobar
 * confirman siempre en un diálogo sobre la ficha, porque no tienen vuelta atrás.
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
  const items: MenuItem[] = [
    ...(imprimible ? [{ id: "imprimir", label: imprimible.status === "draft" ? `Imprimir borrador V${imprimible.number}` : `PDF de la V${imprimible.number}`, hint: "Se abre en otra pestaña", icon: <Printer size={16} strokeWidth={1.7} />, onSelect: () => { window.open(`/imprimir/presupuesto/${imprimible.id}`, "_blank", "noopener"); } }] : []),
    ...(acciones.includes("revisar") ? [{ id: "revisar", label: "Nueva revisión", hint: `Copia la V${base?.number ?? ""} a un borrador nuevo`, icon: <GitBranch size={16} strokeWidth={1.7} />, onSelect: () => setDialogo("revisar") }] : []),
    ...(acciones.includes("cerrar") && working ? [{ id: "cerrar", label: `Cerrar V${working.number}…`, hint: "Deja de editarse y queda lista para aprobar", icon: <Lock size={16} strokeWidth={1.7} />, onSelect: () => setDialogo("cerrar") }] : [])
  ];
  const principal = acciones.includes("editar") ? "editar" : acciones.includes("aprobar") && working ? "aprobar" : null;
  if (!items.length && !principal && working?.status !== "issued") return null;

  return (
    <>
      {items.length > 0 && <span className="budget-actions-menu"><Menu items={items} label={`Más opciones de la V${shown?.number ?? ""}`} /></span>}
      {principal === "editar" && <div className="budget-actions-bar"><Button variant="primary" onClick={onEdit}><Pencil size={16} strokeWidth={1.7} aria-hidden="true" />Editar partidas</Button></div>}
      {principal === "aprobar" && working && <div className="budget-actions-bar"><Button variant="primary" onClick={() => setDialogo("aprobar")}><Stamp size={16} strokeWidth={1.7} aria-hidden="true" />Aprobar V{working.number} para obra</Button></div>}
      {working?.status === "issued" && !principal && <span className="muted text-xs budget-actions-note">Cerrada · la aprueba oficina o administración.</span>}

      <Modal open={dialogo === "cerrar"} onClose={cerrarDialogo} title={`Cerrar la V${working?.number ?? ""}`} footer={<><Button variant="secondary" onClick={cerrarDialogo} disabled={pending}>Cancelar</Button><Button variant="primary" onClick={ejecutar} disabled={pending || busy}>{pending ? "Cerrando…" : "Cerrar revisión"}</Button></>}>
        <p className="text-sm">Al cerrarla, las partidas dejan de poder editarse y la revisión queda lista para el PDF y la aprobación del cliente. Si hace falta cambiar algo después, se abre una revisión nueva{approved ? `; la V${approved.number} sigue aprobada para obra mientras tanto` : ""}.</p>
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
