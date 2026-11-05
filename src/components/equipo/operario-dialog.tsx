"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { Operario } from "@/lib/domain";
import { oficiosPosibles } from "@/lib/operarios";
import { puestoNombres } from "@/lib/puestos";

type Form = { name: string; phone: string; email: string; company: string; trades: string[]; coste: string; available: boolean; user_id: string; notes: string };
const vacio: Form = { name: "", phone: "", email: "", company: "", trades: [], coste: "", available: true, user_id: "", notes: "" };
const desde = (o: Operario): Form => ({ name: o.name, phone: o.phone, email: o.email, company: o.company, trades: [...o.trades], coste: o.hourly_cost == null ? "" : String(o.hourly_cost / 100).replace(".", ","), available: o.available, user_id: o.user_id ?? "", notes: o.notes });

/**
 * Ficha de un operario: contacto, oficios (las categorías del catálogo que hace), coste por hora, si está disponible
 * y, si tiene cuenta en Plano, cuál es. `operario` null es alta nueva; `oficio` rellena el primero (por ejemplo desde una categoría).
 */
export function OperarioDialog({ open, operario, oficio, onClose }: { open: boolean; operario: Operario | null; oficio?: string; onClose: () => void }) {
  const { data, send, notify, busy } = useWorkspace();
  const [form, setForm] = useState<Form>(vacio);
  const [nuevoOficio, setNuevoOficio] = useState("");
  const [pendiente, setPendiente] = useState(false), [borrar, setBorrar] = useState(false), [fallo, setFallo] = useState("");
  useEffect(() => { if (open) { setForm(operario ? desde(operario) : { ...vacio, trades: oficio ? [oficio] : [] }); setNuevoOficio(""); setBorrar(false); setFallo(""); } }, [open, operario, oficio]);

  const sugeridos = useMemo(() => oficiosPosibles(data).filter(t => !form.trades.includes(t)), [data, form.trades]);
  const cuentas = [{ value: "", label: "Sin cuenta en Plano" }, ...data.members.map(m => ({ value: m.user_id, label: `${m.display_name} · ${puestoNombres[m.position]}` }))];
  const añadirOficio = (t: string) => { const x = t.trim(); if (x && !form.trades.includes(x) && form.trades.length < 20) setForm(f => ({ ...f, trades: [...f.trades, x] })); setNuevoOficio(""); };

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (pendiente || busy) return;
    const coste = form.coste.trim() === "" ? null : Math.round(Number(form.coste.replace(",", ".")) * 100);
    if (coste !== null && !(coste >= 0 && coste <= 100000)) { setFallo("El coste por hora tiene que ser un número entre 0 y 1.000 €."); return; }
    setPendiente(true); setFallo("");
    const campos = { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), company: form.company.trim(), trades: form.trades, hourly_cost: coste, available: form.available, user_id: form.user_id || null, notes: form.notes.trim() };
    try {
      await send(operario ? { type: "operario.update", id: operario.id, ...campos } : { type: "operario.create", ...campos });
      notify(operario ? `Ficha guardada: ${campos.name}` : `Operario añadido: ${campos.name}`);
      onClose();
    } catch (err) { setFallo(err instanceof Error ? err.message : "No se ha podido guardar el operario."); }
    finally { setPendiente(false); }
  }
  async function eliminar() {
    if (!operario || pendiente) return;
    setPendiente(true);
    try { await send({ type: "operario.delete", id: operario.id }); notify(`Operario dado de baja: ${operario.name}. Sus tareas conservan el nombre.`); onClose(); }
    catch (err) { setFallo(err instanceof Error ? err.message : "No se ha podido dar de baja."); }
    finally { setPendiente(false); }
  }

  return <Modal open={open} onClose={onClose} title={operario ? operario.name : "Nuevo operario"} kicker="Equipo" footer={<>
    {operario && (borrar
      ? <span className="catalog-danger"><span className="text-sm">¿Dar de baja?</span><Button variant="ghost" className="danger" onClick={eliminar} disabled={pendiente}>Sí</Button><Button variant="ghost" onClick={() => setBorrar(false)}>No</Button></span>
      : <Button variant="ghost" className="danger catalog-danger" onClick={() => setBorrar(true)} disabled={pendiente}><Trash2 size={15} strokeWidth={1.7} aria-hidden="true" />Dar de baja</Button>)}
    <Button variant="secondary" onClick={onClose} disabled={pendiente}>Cancelar</Button>
    <Button variant="primary" type="submit" form="ficha-operario" disabled={pendiente || busy || !form.name.trim()}>{pendiente ? "Guardando…" : "Guardar"}</Button>
  </>}>
    <form id="ficha-operario" className="form" onSubmit={guardar} style={{ maxWidth: "none" }}>
      <div className="line-grid">
        <label className="field"><span>Nombre</span><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Manuel Rey" required maxLength={120} autoFocus /></label>
        <label className="field"><span>Empresa</span><input type="text" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Propio, autónomo o subcontrata" maxLength={120} /></label>
      </div>
      <div className="line-grid">
        <label className="field"><span>Teléfono</span><input type="tel" inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+34 600 11 22 33" maxLength={40} /></label>
        <label className="field"><span>Correo</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Opcional" maxLength={200} /></label>
      </div>
      <div className="field">
        <span>Oficios</span>
        <div className="operario-oficios" role="group" aria-label="Oficios del operario">
          {form.trades.map(t => <span key={t} className="operario-oficio">{t}<button type="button" aria-label={`Quitar ${t}`} onClick={() => setForm(f => ({ ...f, trades: f.trades.filter(x => x !== t) }))}><X size={13} strokeWidth={1.8} aria-hidden="true" /></button></span>)}
          {form.trades.length === 0 && <small className="muted">Elige las categorías del catálogo que hace: así aparece en ellas.</small>}
        </div>
        {sugeridos.length > 0 && <div className="operario-sugeridos">{sugeridos.slice(0, 12).map(t => <button key={t} type="button" onClick={() => añadirOficio(t)}><Plus size={13} strokeWidth={1.8} aria-hidden="true" />{t}</button>)}</div>}
        <span className="operario-nuevo-oficio"><input type="text" value={nuevoOficio} onChange={e => setNuevoOficio(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); añadirOficio(nuevoOficio); } }} placeholder="Otro oficio" maxLength={120} aria-label="Otro oficio" /><Button variant="secondary" onClick={() => añadirOficio(nuevoOficio)} disabled={!nuevoOficio.trim()}>Añadir</Button></span>
      </div>
      <div className="line-grid">
        <label className="field"><span>Coste por hora</span><span className="unit-input"><input type="text" inputMode="decimal" value={form.coste} onChange={e => setForm({ ...form, coste: e.target.value })} placeholder="Opcional" /><span>€/h</span></span></label>
        <div className="field"><span>Cuenta en Plano</span><Select label="Cuenta en Plano" value={form.user_id} onChange={v => setForm({ ...form, user_id: v })} options={cuentas} placeholder="Sin cuenta en Plano" /></div>
      </div>
      <label className="almacen-check"><input type="checkbox" checked={form.available} onChange={e => setForm({ ...form, available: e.target.checked })} /><span><strong>Disponible</strong><small className="muted">Si no lo está (vacaciones, otra obra), sale al final y marcado.</small></span></label>
      <label className="field"><span>Notas</span><input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Trae contenedor propio, solo mañanas…" maxLength={500} /></label>
      {fallo && <p role="alert" className="auth-error">{fallo}</p>}
    </form>
  </Modal>;
}
