"use client";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { roleNames, type OrganizationMember, type Role } from "@/lib/domain";
import { permisoPorDefecto, puestoDetalle, puestoNombres, puestos, type Puesto } from "@/lib/puestos";

const permisos = (Object.keys(roleNames) as Role[]).map(r => ({ value: r, label: roleNames[r] }));
const puestosOpciones = puestos.map(p => ({ value: p, label: puestoNombres[p], hint: puestoDetalle[p] }));

/** Alta de una cuenta que entra en Plano, o cambio de puesto y permiso de una que ya existe. */
export function CuentaDialog({ open, miembro, onClose }: { open: boolean; miembro: OrganizationMember | null; onClose: () => void }) {
  const { send, refresh, notify, busy } = useWorkspace();
  const formId = `ficha-cuenta-${useId().replace(/:/g, "")}`;
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [puesto, setPuesto] = useState<Puesto>("oficina");
  const [permiso, setPermiso] = useState<Role>("office");
  const [pendiente, setPendiente] = useState(false);
  const [fallo, setFallo] = useState("");
  useEffect(() => {
    if (!open) return;
    setNombre(miembro?.display_name ?? "");
    setCorreo("");
    setClave("");
    setPuesto(miembro?.position ?? "oficina");
    setPermiso(miembro?.role ?? "office");
    setFallo("");
  }, [open, miembro]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (pendiente || busy) return;
    setPendiente(true); setFallo("");
    try {
      if (miembro) {
        await send({ type: "member.update", user_id: miembro.user_id, position: puesto, role: permiso });
        notify(`Puesto y permiso actualizados: ${miembro.display_name}`);
      } else {
        const response = await fetch("/api/equipo/cuentas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nombre.trim(), email: correo.trim(), password: clave, position: puesto, role: permiso }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "No se ha podido crear la cuenta.");
        await refresh();
        notify(`${nombre.trim()} ya puede entrar con ${correo.trim()} y la contraseña que has escrito.`);
      }
      onClose();
    } catch (err) { setFallo(err instanceof Error ? err.message : "No se ha podido guardar."); }
    finally { setPendiente(false); }
  }

  return <Modal open={open} onClose={onClose} title={miembro ? miembro.display_name : "Nueva cuenta"} kicker="Equipo" footer={<>
    <Button variant="secondary" onClick={onClose} disabled={pendiente}>Cancelar</Button>
    <Button variant="primary" type="submit" form={formId} disabled={pendiente || busy || (!miembro && (!nombre.trim() || !correo.trim() || clave.length < 8))}>{pendiente ? "Guardando…" : miembro ? "Guardar" : "Crear cuenta"}</Button>
  </>}>
    <form id={formId} className="form" onSubmit={guardar} style={{ maxWidth: "none" }}>
      {!miembro && <>
        <label className="field"><span>Nombre</span><input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Marta García" required maxLength={80} autoFocus /></label>
        <label className="field"><span>Correo</span><input type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="marta@garal.es" required autoComplete="off" maxLength={254} /></label>
        <label className="field"><span>Contraseña</span><input type="password" value={clave} onChange={e => setClave(e.target.value)} placeholder="Al menos 8 caracteres" required minLength={8} maxLength={72} autoComplete="new-password" />
          <small className="muted">Se la dices tú. Con ese correo y esa contraseña entra en Plano.</small>
        </label>
      </>}
      <div className="field"><span>Puesto</span><Select label="Puesto" value={puesto} onChange={p => { setPuesto(p); if (!miembro) setPermiso(permisoPorDefecto[p]); }} options={puestosOpciones} /></div>
      <div className="field"><span>Permiso</span><Select label="Permiso" value={permiso} onChange={setPermiso} options={permisos} />
        <small className="muted">El puesto dice qué ve primero. El permiso dice qué puede cambiar.</small>
      </div>
      {fallo && <p role="alert" className="auth-error">{fallo}</p>}
    </form>
  </Modal>;
}
