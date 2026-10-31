"use client";
import { useEffect, useState } from "react";
import { Check, FileText, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pill } from "@/components/ui/status";
import { Select } from "@/components/ui/select";
import { useWorkspace } from "@/components/workspace-provider";
import { eurosACentimos } from "@/lib/catalogo";
import { etiquetaFactura, facturasDe, recordatorioFactura, vencimientoPorDefecto } from "@/lib/facturas";
import { localDate } from "@/lib/hoy";
import { can, dateLabel, impuestoFactura, money } from "@/lib/domain";

export type FacturaInicial = { project_id?: string; concept?: string; base?: number; certification_id?: string };
const euros = (c: number) => (c / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Crear, editar, enviar y cobrar una factura. El panel lee siempre la factura viva del espacio. */
export function InvoicePanel({ open, onClose, invoiceId, inicial }: { open: boolean; onClose: () => void; invoiceId?: string | null; inicial?: FacturaInicial }) {
  const { data, actor, busy, send, notify } = useWorkspace();
  const [idActual, setIdActual] = useState<string | null>(null);
  const factura = facturasDe(data).find(f => f.id === idActual) ?? null;
  const [form, setForm] = useState({ project_id: "", concept: "", base: "", vat: "21", due: "" });
  const [cobradaEl, setCobradaEl] = useState(localDate());
  const [borrar, setBorrar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const permitido = can(actor.role, "invoice.create");
  // Al entrar por un enlace (un aviso, la ficha de cliente) la factura puede llegar después de abrir el panel.
  const disponible = Boolean(invoiceId && facturasDe(data).some(f => f.id === invoiceId));
  useEffect(() => {
    if (!open) return;
    const f = facturasDe(data).find(x => x.id === invoiceId);
    setIdActual(f?.id ?? null); setBorrar(false); setCobradaEl(localDate());
    setForm(f
      ? { project_id: f.project_id, concept: f.concept, base: euros(f.base), vat: String(f.vat_rate), due: f.due_date ?? vencimientoPorDefecto() }
      : { project_id: inicial?.project_id ?? "", concept: inicial?.concept ?? "", base: inicial?.base ? euros(inicial.base) : "", vat: "21", due: vencimientoPorDefecto() });
  }, [open, invoiceId, disponible]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = eurosACentimos(form.base), vat = Number(form.vat), tax = base ? impuestoFactura(base, vat) : 0;
  const deCobro = Boolean(factura?.certification_id ?? inicial?.certification_id);
  const listo = Boolean(form.project_id && form.concept.trim() && base && base > 0);
  const proyecto = data.projects.find(p => p.id === (factura?.project_id ?? form.project_id));

  async function guardar() {
    const previas = new Set(facturasDe(data).map(f => f.id));
    if (factura) { await send({ type: "invoice.update", id: factura.id, concept: form.concept.trim(), ...(deCobro ? {} : { base: base! }), vat_rate: vat, due_date: form.due || null }); return factura.id; }
    const ws = await send({ type: "invoice.create", project_id: form.project_id, concept: form.concept.trim(), base: base!, vat_rate: vat, due_date: form.due || null, certification_id: inicial?.certification_id ?? null });
    return (ws.invoices ?? []).find(f => !previas.has(f.id))?.id ?? null;
  }
  async function ejecutar(accion: () => Promise<void>, error: string) {
    if (guardando || busy) return;
    setGuardando(true);
    try { await accion(); } catch (e) { notify(e instanceof Error ? e.message : error); } finally { setGuardando(false); }
  }
  const guardarBorrador = () => ejecutar(async () => { await guardar(); notify("Factura guardada en borrador"); onClose(); }, "No se ha podido guardar la factura.");
  const enviar = () => ejecutar(async () => {
    const id = await guardar(); if (!id) throw new Error("No se ha podido preparar la factura.");
    setIdActual(id);
    const ws = await send({ type: "invoice.send", id, due_date: form.due });
    notify(`Factura ${(ws.invoices ?? []).find(f => f.id === id)?.number ?? ""} enviada`);
  }, "No se ha podido enviar la factura.");
  const eliminar = () => factura && ejecutar(async () => { await send({ type: "invoice.delete", id: factura.id }); notify("Borrador eliminado"); onClose(); }, "No se ha podido eliminar el borrador.");
  const cobrar = () => factura && ejecutar(async () => { await send({ type: "invoice.pay", id: factura.id, paid_on: cobradaEl }); notify(`Factura ${factura.number} cobrada`, { label: "Deshacer", run: () => send({ type: "invoice.unpay", id: factura.id }) }); }, "No se ha podido marcar como cobrada.");
  const deshacer = () => factura && ejecutar(async () => { await send({ type: "invoice.unpay", id: factura.id }); notify(`Factura ${factura.number} pendiente de cobro`); }, "No se ha podido deshacer el cobro.");

  if (factura && factura.status !== "draft") {
    const estado = etiquetaFactura(factura);
    return (
      <Modal open={open} onClose={onClose} panel="wide" kicker="Factura" title={factura.number ?? "Factura"} footer={<>
        <a className="btn btn-secondary" href={`/imprimir/factura/${factura.id}`} target="_blank" rel="noopener"><FileText size={16} strokeWidth={1.7} aria-hidden="true" />Ver el PDF</a>
        {factura.status === "sent" && <a className="btn btn-secondary" href={`https://wa.me/?text=${encodeURIComponent(recordatorioFactura(factura))}`} target="_blank" rel="noopener"><MessageCircle size={16} strokeWidth={1.7} aria-hidden="true" />Recordar</a>}
        {factura.status === "paid" && permitido && <Button onClick={deshacer} disabled={guardando || busy}>Deshacer el cobro</Button>}
      </>}>
        <div className="invoice-detail">
          <Pill label={estado.label} tone={estado.tone} />
          <dl className="sum-box"><div><dt>Base</dt><dd className="pl-mono">{money(factura.base)}</dd></div><div><dt>IVA {factura.vat_rate} %</dt><dd className="pl-mono">{money(factura.tax)}</dd></div><div data-total><dt>Total</dt><dd className="pl-mono">{money(factura.total)}</dd></div></dl>
          <dl className="facts">
            <div><dt>Concepto</dt><dd>{factura.concept}</dd></div>
            <div><dt>Cliente</dt><dd>{factura.client_name}</dd></div>
            <div><dt>Proyecto</dt><dd>{proyecto?.name ?? "—"}</dd></div>
            <div><dt>Fecha</dt><dd>{factura.issue_date ? dateLabel(factura.issue_date) : "—"}</dd></div>
            <div><dt>Vence</dt><dd>{factura.due_date ? dateLabel(factura.due_date) : "—"}</dd></div>
            {factura.paid_on && <div><dt>Cobrada el</dt><dd>{dateLabel(factura.paid_on)}</dd></div>}
          </dl>
          {factura.status === "sent" && permitido && <section className="invoice-pay" aria-label="Marcar como cobrada">
            <label className="field"><span>Fecha de cobro</span><input type="date" value={cobradaEl} onChange={e => setCobradaEl(e.target.value)} /></label>
            <Button variant="primary" onClick={cobrar} disabled={guardando || busy || !cobradaEl}><Check size={16} strokeWidth={1.9} aria-hidden="true" />Marcar como cobrada</Button>
          </section>}
          <p className="pl-note">Una factura enviada no se edita ni se borra, para que la numeración no tenga huecos. Plano la registra y le hace seguimiento: no sustituye a la factura oficial.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} panel="wide" kicker={factura ? "Borrador" : "Nueva"} title="Factura" footer={<>
      {factura && (borrar
        ? <span className="catalog-danger"><span className="text-sm">¿Eliminar?</span><Button variant="ghost" className="danger" onClick={eliminar} disabled={guardando || busy}>Sí</Button><Button variant="ghost" onClick={() => setBorrar(false)}>No</Button></span>
        : <Button variant="ghost" className="danger catalog-danger" onClick={() => setBorrar(true)} disabled={guardando || busy}><Trash2 size={15} strokeWidth={1.7} aria-hidden="true" />Eliminar</Button>)}
      <Button onClick={guardarBorrador} disabled={!permitido || !listo || guardando || busy}>Guardar borrador</Button>
      <Button variant="primary" data-accent="orange" onClick={enviar} disabled={!permitido || !listo || !form.due || guardando || busy}>{guardando ? "Guardando…" : "Enviar factura"}</Button>
    </>}>
      {!permitido ? <p className="text-sm">Solo Oficina o Administración pueden crear facturas.</p> : <form className="form" style={{ maxWidth: "none" }} onSubmit={e => e.preventDefault()}>
        {factura || inicial?.project_id
          ? <div className="field"><span>Proyecto</span><strong className="invoice-project">{proyecto?.name}{proyecto ? ` · ${proyecto.client_name}` : ""}</strong></div>
          : <div className="field"><span>Proyecto</span><Select label="Proyecto" value={form.project_id} onChange={v => setForm({ ...form, project_id: v })} options={data.projects.map(p => ({ value: p.id, label: p.name, hint: p.client_name }))} placeholder="Elegir proyecto…" /></div>}
        <label className="field"><span>Concepto</span><input type="text" value={form.concept} onChange={e => setForm({ ...form, concept: e.target.value })} placeholder="Cobro parcial · demolición y tabiquería" maxLength={500} autoFocus={!inicial?.concept && !factura} /></label>
        <div className="line-grid">
          <label className="field"><span>Base</span><span className="unit-input"><input type="text" inputMode="decimal" value={form.base} disabled={deCobro} onChange={e => setForm({ ...form, base: e.target.value })} placeholder="4.068,74" aria-invalid={form.base !== "" && !base ? true : undefined} /><span>€</span></span></label>
          <div className="field"><span>IVA</span><Select label="IVA" value={form.vat} onChange={v => setForm({ ...form, vat: v })} options={[{ value: "21", label: "21 %" }, { value: "10", label: "10 %", hint: "Vivienda con requisitos" }, { value: "4", label: "4 %" }, { value: "0", label: "0 %" }]} /></div>
        </div>
        <label className="field"><span>Vence</span><input type="date" value={form.due} min={localDate()} onChange={e => setForm({ ...form, due: e.target.value })} /></label>
        {deCobro && <p className="muted text-xs">El importe sale del cobro preparado.</p>}
        <dl className="sum-box"><div><dt>Base</dt><dd className="pl-mono">{money(base ?? 0)}</dd></div><div><dt>IVA {form.vat} %</dt><dd className="pl-mono">{money(tax)}</dd></div><div data-total><dt>Total</dt><dd className="pl-mono">{money((base ?? 0) + tax)}</dd></div></dl>
        <p className="pl-note">Al enviarla recibe su número (serie anual, sin huecos) y ya no se puede editar ni borrar. Plano la registra y le hace seguimiento: no sustituye a la factura oficial.</p>
      </form>}
    </Modal>
  );
}
