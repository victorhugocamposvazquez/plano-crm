"use client";
import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import { PurchaseStatus } from "@/components/ui/status";
import { can, type Purchase } from "@/lib/domain";
import { accionesPara, comandoPara, pendienteDeRecibir } from "@/lib/compras";
import { unidades, unidadNombres, type Unidad } from "@/lib/catalogo";

/** Lista de materiales de un proyecto con su flujo: por pedir → pedido → recibido → en obra. */
export function PurchasesPanel({ projectId, purchases, showAdd = true }: { projectId: string; purchases: Purchase[]; showAdd?: boolean }) {
  const { actor, busy, send, notify } = useWorkspace();
  const canCreate = can(actor.role, "purchase.create");
  const canUpdate = can(actor.role, "purchase.update");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", supplier: "", quantity: "", unit: "ud" as Unidad });
  const [receiving, setReceiving] = useState<{ id: string; value: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {showAdd && canCreate && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={() => setAdding(v => !v)} aria-expanded={adding}>{adding ? <X size={16} strokeWidth={1.8} aria-hidden="true" /> : <Plus size={16} strokeWidth={1.8} aria-hidden="true" />}{adding ? "Cancelar" : "Añadir material"}</Button>
        </div>
      )}

      {adding && canCreate && (
        <form className="form line" onSubmit={create} style={{ maxWidth: "none" }}>
          <label className="field"><span>Material</span><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Porcelánico 60×60 gris" required maxLength={500} autoFocus /></label>
          <div className="line-grid">
            <label className="field"><span>Proveedor</span><input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Almacén o taller" required maxLength={500} /></label>
            <label className="field"><span>Cantidad</span><span className="unit-input"><input type="text" inputMode="decimal" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="32" required /><span>{form.unit}</span></span></label>
            <label className="field"><span>Unidad</span><select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value as Unidad })}>{unidades.map(u => <option key={u} value={u}>{unidadNombres[u]}</option>)}</select></label>
          </div>
          <div className="form-actions"><Button type="submit" variant="primary" disabled={pending === "new" || busy || !form.name.trim() || !form.supplier.trim() || !form.quantity}>{pending === "new" ? "Guardando…" : "Añadir a la lista"}</Button></div>
        </form>
      )}

      {purchases.length === 0 && <div className="empty"><strong>Sin materiales previstos</strong><span className="muted text-sm">La lista de compras se vincula al presupuesto aprobado: pavimentos, sanitarios, carpinterías, iluminación…</span></div>}

      {purchases.length > 0 && (
        <div style={{ borderTop: "var(--pl-hairline) solid var(--pl-line)" }}>
          {purchases.map(p => {
            const acciones = canUpdate ? accionesPara(p) : [];
            const falta = pendienteDeRecibir(p);
            return (
              <div key={p.id} className="purchase">
                <div className="purchase-main">
                  <span style={{ minWidth: 0 }}>
                    <strong>{p.name}</strong>
                    <small className="muted text-xs" style={{ display: "block", marginTop: 3 }}>{p.supplier} · <span className="pl-mono">{p.quantity} {p.unit}</span>{p.status === "ordered" && p.received_quantity > 0 ? ` · recibido ${p.received_quantity}, faltan ${falta}` : ""}{p.status === "delivered" ? " · entregado en obra" : ""}</small>
                  </span>
                  <PurchaseStatus status={p.status} />
                </div>
                {acciones.length > 0 && (
                  <div className="purchase-actions">
                    {acciones.map(a => a.needsQuantity ? (
                      receiving?.id === p.id ? (
                        <form key={a.id} onSubmit={e => { e.preventDefault(); void run(p, a.id, Number(receiving.value.replace(",", ".")) || 0); }} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span className="unit-input" style={{ height: 40, width: 150 }}><input type="text" inputMode="decimal" value={receiving.value} onChange={e => setReceiving({ id: p.id, value: e.target.value })} aria-label={`Cantidad recibida de ${p.name}`} autoFocus /><span>{p.unit}</span></span>
                          <Button type="submit" variant="primary" disabled={pending === p.id} style={{ height: 40 }}>Confirmar recepción</Button>
                          <Button variant="ghost" onClick={() => setReceiving(null)} style={{ height: 40 }}>Cancelar</Button>
                        </form>
                      ) : <Button key={a.id} variant="secondary" style={{ height: 40 }} disabled={pending === p.id} onClick={() => setReceiving({ id: p.id, value: String(falta) })}>{a.label}</Button>
                    ) : (
                      <Button key={a.id} variant={a.id === "entregar" ? "primary" : "secondary"} style={{ height: 40 }} disabled={pending === p.id} onClick={() => run(p, a.id)}>{a.label}</Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!canUpdate && purchases.length > 0 && <p className="muted text-xs">Tu perfil puede consultar la lista pero no cambiar estados.</p>}
    </div>
  );
}
