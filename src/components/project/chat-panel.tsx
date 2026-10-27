"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowUp, Hash, FileText, ListChecks, Package, Receipt, X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { TaskDialog } from "@/components/project/task-dialog";
import { can, type Message, type Task } from "@/lib/domain";
import { parseMessage, encodeRef, referenciables, filtrarReferencias, destinoRef, type Ref, type RefOption } from "@/lib/chat-refs";

const time = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
const iconFor = (type: Ref["type"]) => type === "v" ? Receipt : type === "d" ? FileText : type === "t" ? ListChecks : type === "c" ? Package : Hash;

/**
 * Conversación del proyecto. Los mensajes pueden referenciar revisiones del presupuesto, documentos, tareas y
 * compras del propio proyecto (botón # o tecla #): la referencia abre el destino sin salir de la ficha.
 * Editar, borrar y reaccionar llegarán con los comandos del dominio; aquí no se simulan.
 */
export function ChatPanel({ projectId, messages }: { projectId: string; messages: Message[] }) {
  const { data, actor, busy, send, notify, fileUrl } = useWorkspace();
  const allowed = can(actor.role, "message.send");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [picker, setPicker] = useState<{ open: boolean; query: string; active: number }>({ open: false, query: "", active: 0 });
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const ordered = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const options = useMemo(() => referenciables(data, projectId), [data, projectId]);
  const matches = useMemo(() => filtrarReferencias(options, picker.query).slice(0, 8), [options, picker.query]);

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [ordered.length]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = body.trim();
    if (!text || sending || busy) return;
    setSending(true);
    try { await send({ type: "message.send", project_id: projectId, body: text }); setBody(""); setPicker({ open: false, query: "", active: 0 }); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido enviar el mensaje."); }
    finally { setSending(false); }
  }

  function insert(option: RefOption) {
    const token = encodeRef(option);
    setBody(prev => {
      // Sustituye el «#consulta» que se estaba escribiendo por la referencia elegida.
      const at = prev.lastIndexOf("#");
      const base = picker.open && at >= 0 ? prev.slice(0, at) : prev;
      return `${base}${base && !base.endsWith(" ") ? " " : ""}${token} `;
    });
    setPicker({ open: false, query: "", active: 0 });
    textarea.current?.focus();
  }

  function onChange(value: string) {
    setBody(value);
    const at = value.lastIndexOf("#");
    if (at >= 0 && (at === 0 || /\s/.test(value[at - 1])) && !value.slice(at).includes("]]")) setPicker({ open: true, query: value.slice(at + 1), active: 0 });
    else if (picker.open) setPicker({ open: false, query: "", active: 0 });
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (picker.open && matches.length) {
      if (event.key === "ArrowDown") { event.preventDefault(); setPicker(p => ({ ...p, active: (p.active + 1) % matches.length })); return; }
      if (event.key === "ArrowUp") { event.preventDefault(); setPicker(p => ({ ...p, active: (p.active - 1 + matches.length) % matches.length })); return; }
      if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); insert(matches[picker.active]); return; }
      if (event.key === "Escape") { event.preventDefault(); setPicker({ open: false, query: "", active: 0 }); return; }
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void submit(); }
  }

  async function openRef(ref: Ref) {
    const dest = destinoRef(ref, data, projectId);
    if ("task" in dest) { const t = data.tasks.find(x => x.id === dest.task); if (t) setOpenTask(t); else notify("Esa tarea ya no existe."); return; }
    if ("document" in dest) {
      const doc = data.documents.find(d => d.id === dest.document);
      if (!doc) { notify("Ese documento ya no está en el proyecto."); return; }
      try { const url = await fileUrl(doc); window.open(url, "_blank", "noopener"); } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido abrir el documento."); }
    }
  }

  const RefChip = ({ r }: { r: Ref }) => {
    const Icon = iconFor(r.type);
    const dest = destinoRef(r, data, projectId);
    const exists = r.type === "v" ? data.versions.some(v => v.id === r.id) : r.type === "d" ? data.documents.some(d => d.id === r.id) : r.type === "t" ? data.tasks.some(t => t.id === r.id) : r.type === "c" ? data.purchases.some(c => c.id === r.id) : true;
    const content = <><Icon size={12} strokeWidth={1.9} aria-hidden="true" />{r.label}</>;
    if (!exists) return <span className="ref-chip" data-missing="true" title="Ya no existe en el proyecto">{content}</span>;
    if ("href" in dest) return <Link href={dest.href} className="ref-chip">{content}</Link>;
    return <button type="button" className="ref-chip" onClick={() => openRef(r)}>{content}</button>;
  };

  let lastDay = "";
  return (
    <div className="chat">
      <div className="chat-list" role="log" aria-label="Mensajes del proyecto" aria-live="polite">
        {ordered.length === 0 && <div className="empty"><strong>Sin mensajes</strong><span className="muted text-sm">Lo que se escriba aquí lo ve todo el equipo del proyecto. Escribe # para enlazar un presupuesto, un documento, una tarea o una compra.</span></div>}
        {ordered.map(message => {
          const date = new Date(message.created_at);
          const label = day.format(date);
          const showDay = label !== lastDay; lastDay = label;
          const mine = message.author_name === actor.name;
          return (
            <div key={message.id}>
              {showDay && <div className="chat-day"><span>{label.replace(/^./, c => c.toUpperCase())}</span></div>}
              <article className="msg" data-mine={mine}>
                <header><strong>{mine ? "Tú" : message.author_name}</strong><time dateTime={message.created_at}>{time.format(date)}</time></header>
                <p>{parseMessage(message.body).map((part, i) => part.kind === "text" ? <span key={i}>{part.text}</span> : <RefChip key={i} r={part.ref} />)}</p>
              </article>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      {allowed ? (
        <form className="composer-wrap" onSubmit={submit}>
          {picker.open && (
            <div className="ref-picker" role="listbox" aria-label="Referencias del proyecto">
              {matches.length === 0 && <div className="muted text-xs" style={{ padding: "8px 10px" }}>Nada coincide con «{picker.query}».</div>}
              {matches.map((o, i) => { const Icon = iconFor(o.type); return (
                <button key={`${o.type}-${o.id}`} type="button" role="option" aria-selected={i === picker.active} className="ref-option" onMouseEnter={() => setPicker(p => ({ ...p, active: i }))} onMouseDown={e => e.preventDefault()} onClick={() => insert(o)}>
                  <Icon size={15} strokeWidth={1.7} aria-hidden="true" />
                  <span style={{ minWidth: 0 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span><small className="muted text-xs">{o.group}{o.hint ? ` · ${o.hint}` : ""}</small></span>
                </button>
              ); })}
              <div className="ref-picker-foot"><span className="muted text-xs">↑↓ elegir · Enter insertar · Esc cerrar</span><button type="button" className="search-clear" aria-label="Cerrar referencias" onClick={() => setPicker({ open: false, query: "", active: 0 })}><X size={13} strokeWidth={1.8} aria-hidden="true" /></button></div>
            </div>
          )}
          <div className="composer">
            <button type="button" className="composer-tool" aria-label="Insertar referencia" title="Enlazar presupuesto, documento, tarea o compra" onClick={() => { setPicker({ open: true, query: "", active: 0 }); setBody(b => `${b}${b && !b.endsWith(" ") ? " " : ""}#`); textarea.current?.focus(); }}><Hash size={17} strokeWidth={1.7} aria-hidden="true" /></button>
            <textarea ref={textarea} value={body} onChange={e => onChange(e.target.value)} onKeyDown={onKey} rows={1} placeholder="Escribe al equipo… # para enlazar" aria-label="Nuevo mensaje" maxLength={5000} />
            <button type="submit" className="btn btn-round" aria-label="Enviar mensaje" disabled={!body.trim() || sending || busy}><ArrowUp size={16} strokeWidth={1.8} aria-hidden="true" /></button>
          </div>
        </form>
      ) : <p className="muted text-xs">Tu perfil puede leer la conversación pero no escribir.</p>}

      <TaskDialog task={openTask ? data.tasks.find(t => t.id === openTask.id) ?? null : null} onClose={() => setOpenTask(null)} />
    </div>
  );
}
