"use client";
import { useState } from "react";
import { Check, FileText, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useWorkspace } from "@/components/workspace-provider";
import { partidasPorCapitulo, totalCapitulo } from "@/lib/presupuesto";
import { can, money, totals, type BudgetVersion, type Project } from "@/lib/domain";

type Via = "whatsapp" | "correo" | "pdf";
const vias: { id: Via; label: string; hint: string; icon: typeof Mail }[] = [
  { id: "whatsapp", label: "Por WhatsApp", hint: "Se abre WhatsApp con el mensaje escrito y adjuntas el PDF.", icon: MessageCircle },
  { id: "correo", label: "Por correo", hint: "Se abre tu correo con el mensaje escrito y adjuntas el PDF.", icon: Mail },
  { id: "pdf", label: "Solo el PDF", hint: "Lo descargas y lo envías como prefieras.", icon: FileText }
];

/** Enviar al cliente: se ve lo que va a recibir y se explica qué pasa con cada versión antes de confirmar. */
export function SendDialog({ open, onClose, project, version, approved, previousSent }: { open: boolean; onClose: () => void; project: Project; version: BudgetVersion; approved?: BudgetVersion; previousSent?: BudgetVersion }) {
  const { actor, busy, send, notify } = useWorkspace();
  const [via, setVia] = useState<Via>("whatsapp");
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const t = totals(version.items);
  const capitulos = [...partidasPorCapitulo(version.items)];
  const mensaje = `Hola. Te envío el presupuesto de ${project.name} (V${version.number}): ${money(t.total)} con IVA. Te lo adjunto en PDF. Cualquier duda me dices.`;
  const pdf = `/imprimir/presupuesto/${version.id}`;
  const destino = via === "whatsapp" ? `https://wa.me/?text=${encodeURIComponent(mensaje)}` : via === "correo" ? `mailto:?subject=${encodeURIComponent(`Presupuesto · ${project.name}`)}&body=${encodeURIComponent(mensaje)}` : pdf;
  const permitido = can(actor.role, "budget.issue");
  const vacia = !version.items.some(i => i.inclusion === "included" && i.quantity > 0);

  function cerrar() { setEnviada(false); onClose(); }
  async function enviar() {
    if (enviando || busy) return;
    setEnviando(true);
    try {
      await send({ type: "budget.issue", version_id: version.id, expected_revision: version.draft_revision });
      setEnviada(true);
      notify(`V${version.number} marcada como enviada`);
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido enviar el presupuesto."); }
    finally { setEnviando(false); }
  }

  if (!enviada && version.status !== "draft") return null;
  if (enviada) return (
    <Modal open={open} onClose={cerrar} title={`V${version.number} lista para el cliente`} footer={<Button variant="primary" onClick={cerrar}>Hecho</Button>}>
      <div className="send-done">
        <span className="send-done-icon" aria-hidden="true"><Check size={20} strokeWidth={2.2} /></span>
        <p>La V{version.number} ya no se puede editar. Plano no envía el mensaje por ti: falta este último paso.</p>
        <div className="send-done-actions">
          <a className="btn btn-secondary" href={pdf} target="_blank" rel="noopener"><FileText size={16} strokeWidth={1.7} aria-hidden="true" />Abrir el PDF</a>
          {via !== "pdf" && <a className="btn btn-primary" href={destino} target="_blank" rel="noopener">{via === "whatsapp" ? <MessageCircle size={16} strokeWidth={1.7} aria-hidden="true" /> : <Mail size={16} strokeWidth={1.7} aria-hidden="true" />}{via === "whatsapp" ? "Abrir WhatsApp" : "Abrir el correo"}</a>}
        </div>
      </div>
    </Modal>
  );

  return (
    <Modal open={open} onClose={cerrar} size="wide" title={`Enviar la V${version.number} al cliente`}>
      <div className="send-grid">
        <section className="send-doc" aria-label="Así le llega al cliente">
          <small>Presupuesto {project.code} · V{version.number}</small>
          <strong>{project.name}</strong>
          <span className="muted">{project.client_name}{project.location ? ` · ${project.location}` : ""}</span>
          <dl>
            {capitulos.map(([capitulo, items]) => <div key={capitulo}><dt>{capitulo}</dt><dd className="pl-mono">{money(totalCapitulo(items))}</dd></div>)}
            <div data-rule><dt>Base</dt><dd className="pl-mono">{money(t.base)}</dd></div>
            <div><dt>IVA</dt><dd className="pl-mono">{money(t.tax)}</dd></div>
            <div data-total><dt>Total</dt><dd className="pl-mono">{money(t.total)}</dd></div>
          </dl>
          <a href={pdf} target="_blank" rel="noopener" className="link-inline">Ver el PDF completo</a>
        </section>
        <div className="send-options">
          <div className="send-vias" role="radiogroup" aria-label="Cómo enviarlo">
            {vias.map(v => { const Icon = v.icon; return (
              <button key={v.id} type="button" role="radio" aria-checked={via === v.id} className="send-via" onClick={() => setVia(v.id)}>
                <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
                <span><strong>{v.label}</strong><small>{v.hint}</small></span>
              </button>
            ); })}
          </div>
          <div className="send-effects">
            <strong>Al enviar</strong>
            <ul>
              <li>La V{version.number} se cierra: ya no se puede editar.</li>
              {previousSent && <li>La V{previousSent.number}, sin respuesta, pasa al historial.</li>}
              {approved ? <li>La V{approved.number} sigue siendo la aceptada hasta que el cliente diga sí.</li> : <li>Cuando el cliente conteste, registras su respuesta.</li>}
            </ul>
          </div>
          {vacia && <p className="text-sm" role="alert" style={{ color: "var(--pl-danger)" }}>Añade al menos una partida con cantidad antes de enviar.</p>}
          {!permitido && <p className="muted text-sm">Tu perfil no puede enviar presupuestos.</p>}
          <Button variant="primary" data-accent="orange" className="send-cta" onClick={enviar} disabled={!permitido || vacia || enviando || busy}>{enviando ? "Enviando…" : via === "pdf" ? "Marcar como enviada" : `Enviar ${via === "whatsapp" ? "por WhatsApp" : "por correo"}`}</Button>
        </div>
      </div>
    </Modal>
  );
}
