"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowUp, Hash, FileText, ListChecks, Package, Receipt, X, Paperclip } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { TaskDialog } from "@/components/project/task-dialog";
import { can, type Message, type Task } from "@/lib/domain";
import { parseMessage, encodeRef, referenciables, filtrarReferencias, destinoRef, type Ref, type RefOption } from "@/lib/chat-refs";
import { agruparMensajes, iniciales, tonoAutor } from "@/lib/chat-grupos";

const time = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
const iconFor = (type: Ref["type"]) => type === "v" ? Receipt : type === "d" ? FileText : type === "t" ? ListChecks : type === "c" ? Package : Hash;
const etiquetaDia = (iso: string) => { const hoy = new Date().toISOString().slice(0, 10); const ayer = new Date(Date.now() - 864e5).toISOString().slice(0, 10); return iso === hoy ? "Hoy" : iso === ayer ? "Ayer" : day.format(new Date(`${iso}T12:00:00`)).replace(/^./, c => c.toUpperCase()); };

/**
 * Conversación del proyecto con aspecto de chat: bloques por autor con avatar, burbujas (las propias a la
 * derecha en color de acción), separadores de día, y compositor redondeado con # para enlazar revisiones,
 * documentos, tareas y compras. Editar, borrar, reaccionar y adjuntar llegarán con los comandos del dominio.
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
  const grupos = useMemo(() => agruparMensajes(messages, actor.name), [messages, actor.name]);
  const options = useMemo(() => referenciables(data, projectId), [data, projectId]);
  const matches = useMemo(() => filtrarReferencias(options, picker.query).slice(0, 8), [options, picker.query]);
  const participantes = useMemo(() => [...new Set(messages.map(m => m.author_name))], [messages]);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = body.trim();
    if (!text || sending || busy) return;
    setSending(true);
    try { await send({ type: "message.send", project_id: projectId, body: text }); setBody(""); setPicker({ open: false, query: "", active: 0 }); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido enviar el mensaje."); }
    finally { setSending(false); textarea.current?.focus(); }
  }

  function insert(option: RefOption) {
    const token = encodeRef(option);
    setBody(prev => { const at = prev.lastIndexOf("#"); const base = picker.open && at >= 0 ? prev.slice(0, at) : prev; return `${base}${base && !base.endsWith(" ") ? " " : ""}${token} `; });
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
    // Enter envía; Mayús+Enter hace salto de línea (como cualquier chat).
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); }
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
    <div className="chat chat-window">
      <div className="chat-list" role="log" aria-label="Mensajes del proyecto" aria-live="polite">
        {grupos.length === 0 && <div className="chat-empty"><strong>Sin mensajes todavía</strong><span className="muted text-sm">Lo que se escriba aquí lo ve todo el equipo del proyecto. Escribe # para enlazar un presupuesto, un documento, una tarea o una compra.</span></div>}
        {grupos.map(g => {
          const showDay = g.day !== lastDay; lastDay = g.day;
          return (
            <div key={g.id}>
              {showDay && <div className="chat-day"><span>{etiquetaDia(g.day)}</span></div>}
              <div className="msg-group" data-mine={g.mine}>
                {!g.mine && <span className="msg-avatar" data-tone={tonoAutor(g.author)} aria-hidden="true">{iniciales(g.author)}</span>}
                <div className="msg-stack">
                  {!g.mine && <span className="msg-author">{g.author}</span>}
                  {g.items.map((m, i) => (
                    <article key={m.id} className="msg" data-mine={g.mine} data-first={i === 0} data-last={i === g.items.length - 1}>
                      <p>{parseMessage(m.body).map((part, j) => part.kind === "text" ? <span key={j}>{part.text}</span> : <RefChip key={j} r={part.ref} />)}</p>
                      <time dateTime={m.created_at}>{time.format(new Date(m.created_at))}</time>
                    </article>
                  ))}
                </div>
              </div>
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
            <button type="button" className="composer-tool" aria-label="Adjuntar (próximamente)" title="Adjuntar fotos y PDF llegará con el dominio; de momento, súbelos en Documentos y enlázalos con #" disabled><Paperclip size={16} strokeWidth={1.7} aria-hidden="true" /></button>
            <textarea ref={textarea} value={body} onChange={e => onChange(e.target.value)} onKeyDown={onKey} rows={1} placeholder="Escribe al equipo…" aria-label="Nuevo mensaje" maxLength={5000} />
            <button type="submit" className="composer-send" aria-label="Enviar mensaje" disabled={!body.trim() || sending || busy}><ArrowUp size={17} strokeWidth={2} aria-hidden="true" /></button>
          </div>
          <div className="composer-hint muted text-xs"><span>Enter envía · Mayús+Enter salto de línea · # enlaza</span>{participantes.length > 0 && <span>{participantes.length} participante{participantes.length === 1 ? "" : "s"}</span>}</div>
        </form>
      ) : <p className="muted text-xs">Tu perfil puede leer la conversación pero no escribir.</p>}

      <TaskDialog task={openTask ? data.tasks.find(t => t.id === openTask.id) ?? null : null} onClose={() => setOpenTask(null)} />
    </div>
  );
}
