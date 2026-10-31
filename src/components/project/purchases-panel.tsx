"use client";
import { useState, type FormEvent } from "react";
import { Plus, X, Printer } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { Select } from "@/components/ui/select";
import { Pill } from "@/components/ui/status";
import { can, purchaseStatus, type Purchase } from "@/lib/domain";
import { accionesPara, comandoPara, pendienteDeRecibir } from "@/lib/compras";
import { unidades, unidadNombres, type Unidad } from "@/lib/catalogo";
import { pedidosPorProveedor } from "@/lib/hoja-pedido";

/** Lista de materiales de un proyecto con su flujo: por pedir → pedido → recibido → en obra. */
export function PurchasesPanel({ projectId, purchases, showAdd = true, approvedLabel }: { projectId: string; purchases: Purchase[]; showAdd?: boolean; approvedLabel?: string }) {
  const { actor, busy, send, notify } = useWorkspace();
  const canCreate = can(actor.role, "purchase.create");
  const canUpdate = can(actor.role, "purchase.update");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", supplier: "", quantity: "", unit: "ud" as Unidad });
  const [receiving, setReceiving] = useState<{ id: string; value: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const proveedores = pedidosPorProveedor(purchases).filter(g => g.pendientes > 0);

  async function run(p: Purchase, accion: ReturnType<typeof accionesPara>[number]["id"], cantidad = 0) {
    if (busy || pending) return;
    setPending(p.id);
    try { await send(comandoPara(p, accion, cantidad)); setReceiving(null); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido actualizar el material."); }
    finally { setPending(null); }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    const quantity = Number(form.quantity.replace(",", "."));
    if (!(quantity > 0)) { notify("Indica una cantidad mayor que cero."); return; }
    setPending("new");
    try {
      await send({ type: "purchase.create", project_id: projectId, name: form.name.trim(), supplier: form.supplier.trim(), quantity, unit: form.unit });
      notify(`Material añadido: ${form.name.trim()}`);
      setForm({ name: "", supplier: form.supplier, quantity: "", unit: form.unit }); setAdding(false);
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido añadir el material."); }
    finally { setPending(null); }
  }

  const hojas = proveedores.length === 1
    ? <LinkButton href={`/imprimir/pedido/${projectId}?p=${proveedores[0].slug}`} target="_blank" rel="noopener"><Printer size={15} strokeWidth={1.7} aria-hidden="true" />Hoja de pedido · {proveedores[0].supplier}</LinkButton>
    : proveedores.length > 1 ? <Menu label="Hoja de pedido por proveedor" align="end" trigger={<><Printer size={15} strokeWidth={1.7} aria-hidden="true" />Hoja de pedido por proveedor</>} items={proveedores.map(g => ({ id: g.slug, label: g.supplier, hint: `${g.pendientes} por pedir o recibir`, onSelect: () => { window.open(`/imprimir/pedido/${projectId}?p=${g.slug}`, "_blank", "noopener"); } }))} /> : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {showAdd && <div className="pl-head">
        <div><strong className="panel-title">Materiales</strong> <span className="muted">· {approvedLabel ? `para la ${approvedLabel} aceptada` : "de este proyecto"}</span></div>
        <div className="pl-head-actions">{hojas}{showAdd && canCreate && <Button variant="primary" onClick={() => setAdding(v => !v)} aria-expanded={adding}>{adding ? <X size={16} strokeWidth={1.8} aria-hidden="true" /> : <Plus size={16} strokeWidth={1.8} aria-hidden="true" />}{adding ? "Cancelar" : "Material"}</Button>}</div>
      </div>}
      {!showAdd && hojas}

      {adding && canCreate && (
        <form className="form line" onSubmit={create} style={{ maxWidth: "none" }}>
          <label className="field"><span>Material</span><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Porcelánico 60×60 gris" required maxLength={500} autoFocus /></label>
          <div className="line-grid">
            <label className="field"><span>Proveedor</span><input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Almacén o taller" required maxLength={500} /></label>
            <label className="field"><span>Cantidad</span><span className="unit-input"><input type="text" inputMode="decimal" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="32" required /><span>{form.unit}</span></span></label>
            <div className="field"><span>Unidad</span><Select label="Unidad" value={form.unit} onChange={u => setForm({ ...form, unit: u })} options={unidades.map(u => ({ value: u, label: unidadNombres[u] }))} /></div>
          </div>
          <div className="form-actions"><Button type="submit" variant="primary" disabled={pending === "new" || busy || !form.name.trim() || !form.supplier.trim() || !form.quantity}>{pending === "new" ? "Guardando…" : "Añadir a la lista"}</Button></div>
        </form>
      )}

      {purchases.length === 0 && <div className="empty"><strong>Sin materiales previstos</strong><span className="muted text-sm">La lista de materiales sale del presupuesto aceptado: pavimentos, sanitarios, carpinterías, iluminación…</span></div>}

      {purchases.length > 0 && (
        <div className="pl-card material-list">
          <div className="material-row material-head" aria-hidden="true"><span>Material</span><span>Proveedor</span><span>Cantidad</span><span>Estado</span><span /></div>
          {purchases.map(p => {
            const acciones = canUpdate ? accionesPara(p) : [];
            const falta = pendienteDeRecibir(p);
            const tono = p.status === "ordered" ? "info" : p.status === "received" ? "warning" : p.status === "delivered" ? "success" : "warning";
            return (
              <div key={p.id} className="material-row">
                <strong className="material-name">{p.name}<small className="solo-movil-inline"> · {p.supplier}</small></strong>
                <span className="material-supplier">{p.supplier}</span>
                <span className="pl-mono material-qty">{p.status === "ordered" && p.received_quantity > 0 ? `${p.received_quantity} de ${p.quantity} ${p.unit}` : `${p.quantity} ${p.unit}`}</span>
                <span><Pill label={`${purchaseStatus[p.status]}${p.status === "ordered" && p.received_quantity > 0 ? ` · faltan ${falta}` : ""}`} tone={tono} /></span>
                <span className="material-actions">
                  {acciones.length === 0 && <span className="muted" aria-hidden="true">—</span>}
                  {acciones.map(a => a.needsQuantity ? (
                    receiving?.id === p.id ? (
                      <form key={a.id} onSubmit={e => { e.preventDefault(); void run(p, a.id, Number(receiving.value.replace(",", ".")) || 0); }} className="material-receive">
                        <span className="unit-input"><input type="text" inputMode="decimal" value={receiving.value} onChange={e => setReceiving({ id: p.id, value: e.target.value })} aria-label={`Cantidad recibida de ${p.name}`} autoFocus /><span>{p.unit}</span></span>
                        <Button type="submit" variant="primary" disabled={pending === p.id}>Confirmar</Button>
                        <Button variant="ghost" onClick={() => setReceiving(null)}>Cancelar</Button>
                      </form>
                    ) : <Button key={a.id} variant="ghost" className="material-action" disabled={pending === p.id} onClick={() => setReceiving({ id: p.id, value: String(falta) })}>{a.label}</Button>
                  ) : <Button key={a.id} variant="ghost" className="material-action" disabled={pending === p.id} onClick={() => run(p, a.id)}>{a.label}</Button>)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {!canUpdate && purchases.length > 0 && <p className="muted text-xs">Tu perfil puede consultar la lista pero no cambiar estados.</p>}
    </div>
  );
}
