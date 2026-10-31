"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Footprints } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { can, kindNames, type Project } from "@/lib/domain";

const vacio = { name: "", client_name: "", location: "", kind: "integral" as Project["kind"] };

/**
 * Alta de un proyecto desde oficina o administración: solo los datos de partida, sin presupuesto.
 * El proyecto nace en el paso «Visita» y el presupuesto se abre después desde su ficha.
 * La estimación en la visita (/proyectos/nueva) es la otra puerta de entrada, no la única.
 */
export function NewProjectDialog({ open, onClose, cliente = "" }: { open: boolean; onClose: () => void; cliente?: string }) {
  const router = useRouter();
  const { data, actor, busy, send, notify } = useWorkspace();
  const allowed = can(actor.role, "project.create");
  const [form, setForm] = useState(vacio);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open && cliente) setForm(f => (f.client_name ? f : { ...f, client_name: cliente })); }, [open, cliente]);
  const ok = form.name.trim().length > 0 && form.client_name.trim().length > 0;

  function close() { setForm(vacio); setError(""); onClose(); }

  async function crear(event: FormEvent) {
    event.preventDefault();
    if (!ok || saving || busy) return;
    setSaving(true); setError("");
    const name = form.name.trim(); const client = form.client_name.trim();
    try {
      const ws = await send({ type: "project.create", name, client_name: client, location: form.location.trim(), kind: form.kind });
      const nuevos = ws.projects.filter(p => p.name === name && p.client_name === client && !data.projects.some(x => x.id === p.id));
      const project = (nuevos.length ? nuevos : ws.projects.filter(p => p.name === name && p.client_name === client)).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      notify(`Proyecto creado · ${name}`);
      setForm(vacio);
      onClose();
      router.push(project ? `/proyectos/${project.id}` : "/proyectos");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido crear el proyecto.");
    } finally {
      setSaving(false);
    }
  }

  const footer = allowed ? (
    <>
      <Button variant="secondary" onClick={close} disabled={saving}>Cancelar</Button>
      <Button variant="primary" type="submit" form="nuevo-proyecto" disabled={!ok || saving || busy}>{saving ? "Creando…" : "Crear proyecto"}</Button>
    </>
  ) : <Button variant="secondary" onClick={close}>Cerrar</Button>;

  return (
    <Modal open={open} onClose={close} title="Nuevo proyecto" footer={footer}>
      {!allowed ? (
        <p className="muted text-sm">Tu perfil no puede dar de alta proyectos. Pide a oficina o administración que lo creen.</p>
      ) : (
        <form id="nuevo-proyecto" className="form" onSubmit={crear} style={{ maxWidth: "none" }}>
          <label className="field"><span>Proyecto</span><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Reforma de baño · C/ Mayor 12" autoFocus required maxLength={200} /></label>
          <label className="field"><span>Cliente</span><input type="text" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} autoComplete="off" required maxLength={200} /></label>
          <label className="field"><span>Dirección de la obra <small className="muted">· opcional</small></span><input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Calle, número, piso · municipio" autoComplete="off" maxLength={500} /></label>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ padding: 0, marginBottom: 6 }}>Tipo</legend>
            <div className="segments">{(Object.keys(kindNames) as Project["kind"][]).map(kind => <button key={kind} type="button" className="segment" aria-pressed={form.kind === kind} onClick={() => setForm({ ...form, kind })}><span>{kindNames[kind]}</span></button>)}</div>
          </fieldset>
          {error && <p className="text-sm" role="alert" style={{ color: "var(--pl-danger)" }}>{error}</p>}
          <p className="muted text-xs">Entra como contacto; el presupuesto se abre después desde la ficha. Si estás en la obra con el cliente, <Link href="/proyectos/nueva" className="link-inline" onClick={close}><Footprints size={12} strokeWidth={1.9} aria-hidden="true" />estima en la visita</Link> y sal con una cifra.</p>
        </form>
      )}
    </Modal>
  );
}
