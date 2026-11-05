"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Loader2, MessageCircle, Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { can, type Task } from "@/lib/domain";
import { enlaceVivo, estadoEnvio } from "@/lib/parte-vivo";
import { enlaceParte, mensajeParte, whatsappParte, type Parte } from "@/lib/parte";
import { haceOficio } from "@/lib/operarios";

const claveTelefono = "plano.parte.telefono";
const leerTelefono = () => { try { return localStorage.getItem(claveTelefono) ?? ""; } catch { return ""; } };
const cifra = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);

/**
 * Enviar a un operario, por WhatsApp, el parte de una tarea. Primero se crea el parte vivo (enlace con token, sin cuenta):
 * el operario ve la tarea al día, «Cómo llegar», a quién llamar y el material, y puede marcarla hecha, escribir y subir fotos.
 * Si no se puede crear (por ejemplo, sin la migración), se envía el parte de solo lectura. Sin `task`, primero se elige la tarea.
 */
export function EnviarParte({ open, projectId, task, onClose, onNuevaTarea }: { open: boolean; projectId: string; task?: Task | null; onClose: () => void; onNuevaTarea?: () => void }) {
  const { data, actor, notify, send, busy } = useWorkspace();
  const project = data.projects.find(p => p.id === projectId);
  const pendientes = useMemo(() => data.tasks.filter(t => t.project_id === projectId && t.status === "pending").sort((a, b) => a.due_date.localeCompare(b.due_date)), [data.tasks, projectId]);
  const [tareaId, setTareaId] = useState(""), [para, setPara] = useState(""), [telefono, setTelefono] = useState(""), [direccion, setDireccion] = useState(""), [notas, setNotas] = useState("");
  const [material, setMaterial] = useState<string[]>([]), [copiado, setCopiado] = useState(false);
  const [vivo, setVivo] = useState<string>(""), [soloLectura, setSoloLectura] = useState(false), [creando, setCreando] = useState(false);
  const puedeVivo = can(actor.role, "parte.create");
  const tarea = task ?? pendientes.find(t => t.id === tareaId) ?? null;
  const operarios = useMemo(() => [...(data.operarios ?? [])].sort((a, b) => Number(Boolean(tarea && haceOficio(b, tarea.trade))) - Number(Boolean(tarea && haceOficio(a, tarea.trade))) || Number(b.available) - Number(a.available) || a.name.localeCompare(b.name, "es")), [data.operarios, tarea]);
  const materialObra = useMemo(() => data.purchases.filter(p => p.project_id === projectId).map(p => ({ id: p.id, texto: `${p.name} · ${cifra(p.quantity)} ${p.unit}${p.status === "delivered" ? " (en obra)" : p.status === "received" ? " (en la nave)" : p.status === "ordered" ? " (pedido)" : ""}`, enObra: p.status === "delivered" })), [data.purchases, projectId]);

  useEffect(() => {
    if (!open) return;
    const t = task ?? pendientes[0] ?? null;
    setTareaId(t?.id ?? ""); setPara(t?.operario_id ?? ""); setDireccion(project?.location ?? ""); setNotas(""); setCopiado(false); setVivo(""); setSoloLectura(!puedeVivo);
    const mio = (data.operarios ?? []).find(o => o.user_id === actor.id)?.phone;
    setTelefono(mio || leerTelefono());
    setMaterial(materialObra.filter(m => m.enObra).map(m => m.id));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && !task) { const t = pendientes.find(x => x.id === tareaId); if (t) setPara(t.operario_id ?? ""); } }, [tareaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const operario = operarios.find(o => o.id === para);
  const parte: Parte | null = tarea ? {
    v: 1, empresa: data.organization_name.slice(0, 120), obra: (project?.name ?? "").slice(0, 200), direccion: direccion.trim().slice(0, 300),
    tarea: tarea.title.slice(0, 500), oficio: tarea.trade.slice(0, 120), fecha: tarea.due_date, para: (operario?.name ?? (tarea.assignee || "")).slice(0, 120),
    contacto: actor.name.split(" · ")[0].slice(0, 120), telefono: telefono.trim().slice(0, 40), notas: notas.trim().slice(0, 800),
    material: materialObra.filter(m => material.includes(m.id)).slice(0, 8).map(m => m.texto.slice(0, 160)),
    enviado: new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date())
  } : null;
  // Cambiar algo después de crear el enlace vivo obliga a crear otro: el parte guarda lo escrito al enviarlo.
  useEffect(() => { setVivo(""); setCopiado(false); }, [tareaId, para, direccion, telefono, notas, material.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const enlace = !parte || typeof window === "undefined" ? "" : soloLectura ? enlaceParte(window.location.origin, parte) : vivo;
  async function crearVivo() {
    if (!tarea || !parte || creando || busy) return;
    setCreando(true);
    const id = crypto.randomUUID();
    try {
      const ws = await send({ type: "parte.create", id, task_id: tarea.id, operario_id: operario?.id ?? null, snapshot: { direccion: parte.direccion, notas: parte.notas, contacto: parte.contacto, telefono: parte.telefono, para: parte.para, material: parte.material } });
      const token = ws.task_shares?.find(x => x.id === id)?.token;
      if (!token) throw new Error("sin token");
      setVivo(enlaceVivo(window.location.origin, token));
    } catch { setSoloLectura(true); notify("No se ha podido crear el enlace con respuesta: se enviará uno de solo lectura (sin marcar hecha ni fotos)."); }
    finally { setCreando(false); }
  }
  const whatsapp = parte ? whatsappParte(operario?.phone ?? "", parte, enlace) : "";

  function recordarTelefono() { try { if (telefono.trim()) localStorage.setItem(claveTelefono, telefono.trim()); } catch { /* sin almacenamiento */ } }
  async function copiar() {
    if (!enlace) return;
    try { await navigator.clipboard.writeText(enlace); setCopiado(true); notify("Enlace de la tarea copiado"); } catch { notify("No se ha podido copiar. Mantén pulsado el enlace para copiarlo."); }
  }

  return <Modal open={open} onClose={onClose} title="Enviar tarea por WhatsApp" kicker={project?.name} footer={<>
    {!enlace && parte && <Button variant="primary" onClick={() => void crearVivo()} disabled={creando || busy}>{creando ? <Loader2 size={15} className="spin" aria-hidden="true" /> : <Link2 size={15} strokeWidth={1.7} aria-hidden="true" />}{creando ? "Creando…" : "Crear el enlace"}</Button>}
    {enlace && <Button variant="secondary" onClick={() => void copiar()}>{copiado ? <Check size={15} strokeWidth={1.8} aria-hidden="true" /> : <Copy size={15} strokeWidth={1.7} aria-hidden="true" />}{copiado ? "Copiado" : "Copiar enlace"}</Button>}
    {enlace && whatsapp && <a className="btn btn-primary" href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => { recordarTelefono(); notify(`Tarea enviada${operario ? ` a ${operario.name}` : ""}`); onClose(); }}><MessageCircle size={16} strokeWidth={1.7} aria-hidden="true" />Abrir WhatsApp</a>}
  </>}>
    <div className="form" style={{ maxWidth: "none" }} onSubmit={e => e.stopPropagation()}>
      {!task && (pendientes.length
        ? <div className="field"><span>Tarea</span><Select label="Tarea" value={tareaId} onChange={setTareaId} options={pendientes.map(t => ({ value: t.id, label: t.title, hint: `${t.trade} · ${t.due_date.split("-").reverse().join("/")}` }))} placeholder="Elige la tarea" /></div>
        : <p className="muted text-sm" style={{ margin: 0 }}>No hay tareas pendientes en este proyecto.</p>)}
      {!task && onNuevaTarea && <button type="button" className="chip enviar-nueva" onClick={onNuevaTarea}><Plus size={14} strokeWidth={1.8} aria-hidden="true" />Crear una tarea nueva y enviarla</button>}
      {tarea && <>
        <div className="field"><span>Para</span><Select label="Para" value={para} onChange={setPara} options={[{ value: "", label: "Elegir en WhatsApp", hint: "Sin teléfono guardado" }, ...operarios.map(o => ({ value: o.id, label: o.name, hint: [o.trades.join(", "), o.phone || "sin teléfono", !o.available && "no disponible"].filter(Boolean).join(" · ") }))]} placeholder="Elegir en WhatsApp" /></div>
        {operario && !operario.phone && <p className="muted text-sm" style={{ margin: 0 }}>{operario.name} no tiene teléfono en su ficha: WhatsApp te dejará elegir a quién enviarlo.</p>}
        <label className="field"><span>Dirección de la obra</span><input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle, número, piso y localidad" maxLength={300} /></label>
        <label className="field"><span>Tu teléfono, por si tiene dudas</span><input type="tel" inputMode="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+34 600 00 00 00" maxLength={40} /></label>
        <label className="field"><span>A tener en cuenta</span><textarea rows={3} value={notas} onChange={e => setNotas(e.target.value)} maxLength={800} placeholder="Llave en portería, aparcar en la calle de atrás, trae escalera…" /></label>
        {materialObra.length > 0 && <fieldset className="parte-elegir-material">
          <legend>Material que verá</legend>
          {materialObra.map(m => <label key={m.id} className="almacen-check"><input type="checkbox" checked={material.includes(m.id)} onChange={e => setMaterial(l => e.target.checked ? [...l, m.id] : l.filter(x => x !== m.id))} /><span>{m.texto}</span></label>)}
        </fieldset>}
        {parte && <details className="editor-advanced"><summary>Ver el mensaje</summary><pre className="parte-previa">{mensajeParte(parte, "[enlace al parte]")}</pre></details>}
        <p className="muted text-xs" style={{ margin: 0 }}>{soloLectura
          ? "Enlace de solo lectura: se abre sin cuenta y enseña la tarea, la dirección, tu nombre y teléfono y el material marcado. No lleva datos del cliente ni precios."
          : "El enlace se abre sin cuenta: el operario ve la tarea al día y puede marcarla como hecha, escribir al equipo (llega al chat) y subir fotos (llegan a Planos y fotos). No ve datos del cliente ni precios. Caduca en 30 días y lo puedes anular desde la tarea."}</p>
      </>}
    </div>
  </Modal>;
}

/** Partes enviados de una tarea: a quién, cuándo, si lo ha abierto o marcado hecho, y cómo copiar el enlace o anularlo. */
export function PartesEnviados({ taskId }: { taskId: string }) {
  const { data, actor, send, notify, busy } = useWorkspace();
  const ahora = new Date().toISOString();
  const lista = (data.task_shares ?? []).filter(s => s.task_id === taskId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!lista.length) return null;
  const puede = can(actor.role, "parte.revoke");
  const fecha = (iso: string) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  async function copiar(token: string) { try { await navigator.clipboard.writeText(enlaceVivo(window.location.origin, token)); notify("Enlace de la tarea copiado"); } catch { notify("No se ha podido copiar el enlace."); } }
  async function anular(id: string) { try { await send({ type: "parte.revoke", id }); notify("Enlace anulado: ya no funciona."); } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido anular."); } }
  return <section className="partes-enviados" aria-label="Envíos por WhatsApp">
    <h4>Enviada por WhatsApp</h4>
    {lista.map(s => { const e = estadoEnvio(s, ahora), activo = !s.revoked_at && s.expires_at > ahora; return <div key={s.id} className="parte-enviado">
      <span><strong>{s.snapshot.para || "Sin destinatario"}</strong><small>{fecha(s.created_at)} · {s.created_by_name.split(" · ")[0]}{s.photos_count ? ` · ${s.photos_count} ${s.photos_count === 1 ? "foto" : "fotos"}` : ""}{s.messages_count ? ` · ${s.messages_count} ${s.messages_count === 1 ? "mensaje" : "mensajes"}` : ""}</small></span>
      <span className="operario-estado" data-tone={e.tono === "success" ? "success" : e.tono === "warning" ? "warning" : undefined}>{e.texto}</span>
      {activo && <span className="parte-enviado-acciones">
        <button type="button" className="btn btn-ghost" onClick={() => void copiar(s.token)}>Copiar</button>
        {puede && <button type="button" className="btn btn-ghost danger" onClick={() => void anular(s.id)} disabled={busy}>Anular</button>}
      </span>}
    </div>; })}
  </section>;
}
