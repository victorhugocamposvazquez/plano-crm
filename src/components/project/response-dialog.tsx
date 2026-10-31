"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useWorkspace } from "@/components/workspace-provider";
import { localDate } from "@/lib/hoy";
import { can, dateLabel, money, totals, type BudgetVersion, type Project } from "@/lib/domain";

type Respuesta = "acepta" | "cambios" | "rechaza";
const respuestas: { id: Respuesta; label: string; hint: string; tone: string }[] = [
  { id: "acepta", label: "Sí, lo acepta", hint: "Pasa a ser el aceptado", tone: "success" },
  { id: "cambios", label: "Pide cambios", hint: "Se abre una versión nueva", tone: "warning" },
  { id: "rechaza", label: "No lo acepta", hint: "Queda en el historial con el motivo", tone: "danger" }
];
const medios = ["WhatsApp", "Correo", "Firmado en papel", "Teléfono", "En persona"];

/** Registrar lo que ha dicho el cliente. Antes de confirmar se ve qué cambia en presupuesto, obra, materiales y cobros. */
export function ResponseDialog({ open, onClose, project, version, approved, onNuevaVersion }: { open: boolean; onClose: () => void; project: Project; version: BudgetVersion; approved?: BudgetVersion; onNuevaVersion?: (id: string) => void }) {
  const { data, actor, busy, send, notify } = useWorkspace();
  const [respuesta, setRespuesta] = useState<Respuesta>("acepta");
  const [medio, setMedio] = useState(medios[0]);
  const [fecha, setFecha] = useState(localDate());
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const total = totals(version.items), anterior = approved ? totals(approved.items) : null;
  const pendientes = data.tasks.filter(t => t.project_id === project.id && t.status === "pending").length;
  const sinEntregar = data.purchases.filter(p => p.project_id === project.id && p.status !== "delivered").length;
  const preparado = data.certifications.filter(c => c.project_id === project.id).reduce((s, c) => s + c.amount, 0);
  const puedeAceptar = can(actor.role, "budget.approve"), puedeRevisar = can(actor.role, "budget.revise");
  const permitido = respuesta === "acepta" ? puedeAceptar : puedeRevisar;
  const listo = respuesta === "acepta" ? Boolean(fecha) : texto.trim().length >= 3;

  async function confirmar() {
    if (guardando || busy || !listo) return;
    setGuardando(true);
    try {
      if (respuesta === "acepta") {
        await send({ type: "budget.approve", version_id: version.id, reference: `${medio} · ${dateLabel(fecha)}` });
        notify(`V${version.number} aceptada por el cliente`);
      } else {
        const base = respuesta === "rechaza" && approved ? approved : version;
        const reason = respuesta === "cambios" ? `Cambios pedidos por el cliente: ${texto.trim()}` : `El cliente no aceptó la V${version.number}: ${texto.trim()}`;
        const ws = await send({ type: "budget.revise", version_id: base.id, reason });
        const nueva = ws.versions.find(v => v.budget_id === version.budget_id && v.status === "draft");
        notify(respuesta === "cambios" ? `Cambios anotados en la V${nueva?.number ?? ""}` : `V${version.number} en el historial, con el motivo`);
        if (nueva) onNuevaVersion?.(nueva.id);
      }
      setTexto(""); onClose();
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido registrar la respuesta."); }
    finally { setGuardando(false); }
  }

  const cta = respuesta === "acepta" ? "Marcar como aceptado" : respuesta === "cambios" ? "Abrir versión con los cambios" : "Registrar que no acepta";
  return (
    <Modal open={open} onClose={onClose} size="wide" title={`¿Qué ha dicho el cliente sobre la V${version.number}?`} footer={<><Button onClick={onClose} disabled={guardando}>Cancelar</Button><Button variant="primary" data-accent="orange" onClick={confirmar} disabled={!permitido || !listo || guardando || busy}>{guardando ? "Guardando…" : cta}</Button></>}>
      <p className="muted text-sm" style={{ marginBottom: 12 }}>{version.change_reason} · <span className="pl-mono">{money(total.total)}</span> con IVA · enviada el {dateLabel(version.updated_at)}</p>
      <div className="answer-grid">
        <div className="answer-options" role="radiogroup" aria-label="Respuesta del cliente">
          {respuestas.map(r => <button key={r.id} type="button" role="radio" aria-checked={respuesta === r.id} className="answer-option" data-tone={r.tone} onClick={() => setRespuesta(r.id)}><strong>{r.label}</strong><small>{r.hint}</small></button>)}
        </div>
        <div className="answer-detail">
          {respuesta === "acepta" && <>
            <div className="line-grid">
              <div className="field"><span>Cómo lo aceptó</span><Select label="Cómo lo aceptó" value={medio} onChange={setMedio} options={medios.map(m => ({ value: m, label: m }))} /></div>
              <label className="field"><span>Fecha</span><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required /></label>
            </div>
            <div className="answer-impact">
              <strong>Qué cambia en el proyecto si lo aceptas</strong>
              <dl>
                <div><dt>Presupuesto</dt><dd>{approved && anterior ? <>La V{version.number} sustituye a la V{approved.number}. El importe para obra pasa de <span className="pl-mono">{money(anterior.total)}</span> a <strong className="pl-mono">{money(total.total)}</strong>.</> : <>La V{version.number} pasa a ser la versión con la que se hace la obra: <strong className="pl-mono">{money(total.total)}</strong>.</>}</dd></div>
                <div><dt>Obra</dt><dd>{pendientes ? `Las ${pendientes} tareas pendientes se mantienen.` : "Todavía no hay tareas: podrás proponerlas desde las partidas aceptadas."}</dd></div>
                <div><dt>Materiales</dt><dd>{sinEntregar ? `Revisa ${sinEntregar === 1 ? "el material" : `los ${sinEntregar} materiales`} sin entregar por si cambian con esta versión.` : "No hay materiales pendientes de entregar."}</dd></div>
                <div><dt>Cobros</dt><dd>{preparado ? <>Lo preparado (<span className="pl-mono">{money(preparado)}</span> sin IVA) se mantiene. Quedan <span className="pl-mono">{money(Math.max(0, total.base - preparado))}</span> sin IVA.</> : <>Quedan <span className="pl-mono">{money(total.base)}</span> sin IVA por cobrar.</>}</dd></div>
              </dl>
            </div>
            {!puedeAceptar && <p className="muted text-sm">Solo Oficina o Administración pueden marcarlo como aceptado.</p>}
          </>}
          {respuesta === "cambios" && <>
            <label className="field"><span>Qué pide</span><textarea rows={3} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Prefiere la tarima de gama media y añadir la encimera de cuarzo." maxLength={400} autoFocus /></label>
            <p className="pl-note">Se abre una versión nueva con estos cambios como motivo.{approved ? ` La V${approved.number} sigue aceptada.` : ""}</p>
          </>}
          {respuesta === "rechaza" && <>
            <label className="field"><span>Motivo</span><textarea rows={3} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Precio · se queda con lo que tenía" maxLength={400} autoFocus /></label>
            <p className="pl-note">La V{version.number} pasa al historial con este motivo. {approved ? `La obra sigue con la V${approved.number}, sin cambios, y se abre una versión nueva desde ella por si hay que volver a proponer.` : "Se abre una versión nueva por si hay que volver a proponer."}</p>
          </>}
        </div>
      </div>
    </Modal>
  );
}
