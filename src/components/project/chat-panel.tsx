"use client";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { can, type Message } from "@/lib/domain";

const time = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });

/** Conversación del proyecto: la ven todos los perfiles con acceso; cada mensaje queda con autor y hora. */
export function ChatPanel({ projectId, messages }: { projectId: string; messages: Message[] }) {
  const { actor, busy, send, notify } = useWorkspace();
  const allowed = can(actor.role, "message.send");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const ordered = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [ordered.length]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = body.trim();
    if (!text || sending || busy) return;
    setSending(true);
    try { await send({ type: "message.send", project_id: projectId, body: text }); setBody(""); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido enviar el mensaje."); }
    finally { setSending(false); }
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void submit(); }
  }

  let lastDay = "";
  return (
    <div className="chat">
      <div className="chat-list" role="log" aria-label="Mensajes del proyecto" aria-live="polite">
        {ordered.length === 0 && <div className="empty"><strong>Sin mensajes</strong><span className="muted text-sm">Lo que se escriba aquí lo ve todo el equipo del proyecto y queda guardado con fecha y autor.</span></div>}
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
                <p>{message.body}</p>
              </article>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      {allowed ? (
        <form className="composer" onSubmit={submit}>
          <textarea value={body} onChange={e => setBody(e.target.value)} onKeyDown={onKey} rows={1} placeholder="Escribe al equipo del proyecto…" aria-label="Nuevo mensaje" maxLength={5000} />
          <button type="submit" className="btn btn-round" aria-label="Enviar mensaje" disabled={!body.trim() || sending || busy}><ArrowUp size={16} strokeWidth={1.8} aria-hidden="true" /></button>
        </form>
      ) : <p className="muted text-xs">Tu perfil puede leer la conversación pero no escribir.</p>}
    </div>
  );
}
