"use client";
import { Mail, MessageCircle, Pencil, Phone, UserCheck } from "lucide-react";
import type { Operario, OrganizationMember } from "@/lib/domain";
import { costeHora, enlaceLlamar, enlaceWhatsapp, resumenOperario } from "@/lib/operarios";
import { iniciales } from "@/lib/pasos";

/** Tarjeta de un operario: quién es, qué hace, si está disponible y cómo localizarle con un toque. */
export function OperarioCard({ operario: o, cuenta, onEditar, compacta = false, mensaje }: { operario: Operario; cuenta?: OrganizationMember; onEditar?: () => void; compacta?: boolean; mensaje?: string }) {
  const llamar = enlaceLlamar(o.phone), whatsapp = o.phone ? enlaceWhatsapp(o.phone, mensaje) : "";
  return <article className="operario-card" data-compacta={compacta || undefined} data-no-disponible={!o.available || undefined}>
    <div className="operario-cabeza">
      <span className="msg-avatar" aria-hidden="true">{iniciales(o.name)}</span>
      <span className="operario-nombre">
        <strong>{o.name}</strong>
        <small>{resumenOperario(o) || "Sin oficio"}{costeHora(o) ? ` · ${costeHora(o)}` : ""}</small>
      </span>
      <span className="operario-estado" data-tone={o.available ? "success" : "warning"}>{o.available ? "Disponible" : "No disponible"}</span>
    </div>
    {!compacta && (o.notes || cuenta) && <p className="operario-notas">
      {cuenta && <span><UserCheck size={14} strokeWidth={1.7} aria-hidden="true" />Con cuenta: {cuenta.display_name}</span>}
      {o.notes && <span>{o.notes}</span>}
    </p>}
    <div className="operario-acciones">
      {llamar && <a className="btn btn-secondary" href={llamar} aria-label={`Llamar a ${o.name}`}><Phone size={15} strokeWidth={1.7} aria-hidden="true" />Llamar</a>}
      {whatsapp && <a className="btn btn-secondary" href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${o.name}`}><MessageCircle size={15} strokeWidth={1.7} aria-hidden="true" />WhatsApp</a>}
      {!compacta && o.email && <a className="btn btn-ghost" href={`mailto:${o.email}`} aria-label={`Correo a ${o.name}`}><Mail size={15} strokeWidth={1.7} aria-hidden="true" />Correo</a>}
      {!o.phone && !o.email && <small className="muted">Sin teléfono ni correo.</small>}
      {onEditar && <button type="button" className="btn btn-ghost operario-editar" onClick={onEditar} aria-label={`Editar ficha de ${o.name}`}><Pencil size={15} strokeWidth={1.7} aria-hidden="true" />Editar</button>}
    </div>
  </article>;
}
