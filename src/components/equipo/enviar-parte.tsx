"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { Task } from "@/lib/domain";
import { enlaceParte, mensajeParte, whatsappParte, type Parte } from "@/lib/parte";
import { haceOficio } from "@/lib/operarios";

const claveTelefono = "plano.parte.telefono";
const leerTelefono = () => { try { return localStorage.getItem(claveTelefono) ?? ""; } catch { return ""; } };
const cifra = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);

/**
 * Enviar a un operario, por WhatsApp, el parte de una tarea: un enlace que se abre sin cuenta con la tarea, la fecha,
 * la dirección y «Cómo llegar», a quién llamar, notas y el material de la obra. Sin `task`, primero se elige la tarea del proyecto.
 */
export function EnviarParte({ open, projectId, task, onClose }: { open: boolean; projectId: string; task?: Task | null; onClose: () => void }) {
  const { data, actor, notify } = useWorkspace();
  const project = data.projects.find(p => p.id === projectId);
  const pendientes = useMemo(() => data.tasks.filter(t => t.project_id === projectId && t.status === "pending").sort((a, b) => a.due_date.localeCompare(b.due_date)), [data.tasks, projectId]);
  const [tareaId, setTareaId] = useState(""), [para, setPara] = useState(""), [telefono, setTelefono] = useState(""), [direccion, setDireccion] = useState(""), [notas, setNotas] = useState("");
  const [material, setMaterial] = useState<string[]>([]), [copiado, setCopiado] = useState(false);
  const tarea = task ?? pendientes.find(t => t.id === tareaId) ?? null;
  const operarios = useMemo(() => [...(data.operarios ?? [])].sort((a, b) => Number(Boolean(tarea && haceOficio(b, tarea.trade))) - Number(Boolean(tarea && haceOficio(a, tarea.trade))) || Number(b.available) - Number(a.available) || a.name.localeCompare(b.name, "es")), [data.operarios, tarea]);
  const materialObra = useMemo(() => data.purchases.filter(p => p.project_id === projectId).map(p => ({ id: p.id, texto: `${p.name} · ${cifra(p.quantity)} ${p.unit}${p.status === "delivered" ? " (en obra)" : p.status === "received" ? " (en la nave)" : p.status === "ordered" ? " (pedido)" : ""}`, enObra: p.status === "delivered" })), [data.purchases, projectId]);

  useEffect(() => {
    if (!open) return;
    const t = task ?? pendientes[0] ?? null;
    setTareaId(t?.id ?? ""); setPara(t?.operario_id ?? ""); setDireccion(project?.location ?? ""); setNotas(""); setCopiado(false);
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
  const enlace = parte && typeof window !== "undefined" ? enlaceParte(window.location.origin, parte) : "";
  const whatsapp = parte ? whatsappParte(operario?.phone ?? "", parte, enlace) : "";

  function recordarTelefono() { try { if (telefono.trim()) localStorage.setItem(claveTelefono, telefono.trim()); } catch { /* sin almacenamiento */ } }
  async function copiar() {
    if (!enlace) return;
    try { await navigator.clipboard.writeText(enlace); setCopiado(true); notify("Enlace del parte copiado"); } catch { notify("No se ha podido copiar. Mantén pulsado el enlace para copiarlo."); }
  }

  return <Modal open={open} onClose={onClose} title="Enviar parte por WhatsApp" kicker={project?.name} footer={<>
    <Button variant="secondary" onClick={() => void copiar()} disabled={!enlace}>{copiado ? <Check size={15} strokeWidth={1.8} aria-hidden="true" /> : <Copy size={15} strokeWidth={1.7} aria-hidden="true" />}{copiado ? "Copiado" : "Copiar enlace"}</Button>
    {whatsapp ? <a className="btn btn-primary" href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => { recordarTelefono(); notify(`Parte enviado${operario ? ` a ${operario.name}` : ""}`); onClose(); }}><MessageCircle size={16} strokeWidth={1.7} aria-hidden="true" />Abrir WhatsApp</a> : <Button variant="primary" disabled>Abrir WhatsApp</Button>}
  </>}>
    <div className="form" style={{ maxWidth: "none" }}>
      {!task && (pendientes.length
        ? <div className="field"><span>Tarea</span><Select label="Tarea" value={tareaId} onChange={setTareaId} options={pendientes.map(t => ({ value: t.id, label: t.title, hint: `${t.trade} · ${t.due_date.split("-").reverse().join("/")}` }))} placeholder="Elige la tarea" /></div>
        : <p className="muted text-sm" style={{ margin: 0 }}>No hay tareas pendientes en este proyecto. Crea una y vuelve a enviarla.</p>)}
      {tarea && <>
        <div className="field"><span>Para</span><Select label="Para" value={para} onChange={setPara} options={[{ value: "", label: "Elegir en WhatsApp", hint: "Sin teléfono guardado" }, ...operarios.map(o => ({ value: o.id, label: o.name, hint: [o.trades.join(", "), o.phone || "sin teléfono", !o.available && "no disponible"].filter(Boolean).join(" · ") }))]} placeholder="Elegir en WhatsApp" /></div>
        {operario && !operario.phone && <p className="muted text-sm" style={{ margin: 0 }}>{operario.name} no tiene teléfono en su ficha: WhatsApp te dejará elegir a quién enviarlo.</p>}
        <label className="field"><span>Dirección de la obra</span><input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle, número, piso y localidad" maxLength={300} /></label>
        <label className="field"><span>Tu teléfono, por si tiene dudas</span><input type="tel" inputMode="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+34 600 00 00 00" maxLength={40} /></label>
        <label className="field"><span>A tener en cuenta</span><textarea rows={3} value={notas} onChange={e => setNotas(e.target.value)} maxLength={800} placeholder="Llave en portería, aparcar en la calle de atrás, trae escalera…" /></label>
        {materialObra.length > 0 && <fieldset className="parte-elegir-material">
          <legend>Material que ve en el parte</legend>
          {materialObra.map(m => <label key={m.id} className="almacen-check"><input type="checkbox" checked={material.includes(m.id)} onChange={e => setMaterial(l => e.target.checked ? [...l, m.id] : l.filter(x => x !== m.id))} /><span>{m.texto}</span></label>)}
        </fieldset>}
        {parte && <details className="editor-advanced"><summary>Ver el mensaje</summary><pre className="parte-previa">{mensajeParte(parte, "[enlace al parte]")}</pre></details>}
        <p className="muted text-xs" style={{ margin: 0 }}>El enlace se abre sin cuenta. Quien lo tenga ve la tarea, la dirección, tu nombre y teléfono y el material marcado; no lleva datos del cliente ni precios.</p>
      </>}
    </div>
  </Modal>;
}
