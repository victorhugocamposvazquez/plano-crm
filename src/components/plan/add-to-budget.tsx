"use client";
import Link from "next/link";
import { Footprints, LayoutTemplate, Plus, ChevronRight } from "lucide-react";

/**
 * «Añadir al presupuesto»: las puertas para aportar partidas al presupuesto que haya, cuando haga falta.
 * No es una elección de inicio: hoy a mano, mañana desde el plano, después con la visita. Todo acaba en la misma revisión.
 */
export function AddToBudget({ planoHref, visitaHref, onManual, haPresupuesto, borradorPlano }: { planoHref: string; visitaHref?: string; onManual: () => void; haPresupuesto: boolean; borradorPlano?: boolean }) {
  return (
    <section className="add-budget" aria-label="Añadir al presupuesto">
      <div className="section-label" style={{ marginTop: 0 }}><span>Añadir al presupuesto</span><span className="muted text-xs">{haPresupuesto ? "a la revisión abierta" : "se abrirá la V1"}</span></div>
      <Link href={planoHref} className="opt-row">
        <span className="opt-ico" data-tone="blue"><LayoutTemplate size={18} strokeWidth={1.7} aria-hidden="true" /></span>
        <span className="opt-text"><strong>Desde un plano</strong><small>{borradorPlano ? "Tienes un plano a medias · continuar" : "Sube el PDF: Plano mide las paredes y propone partidas. Tú las revisas antes de añadirlas."}</small></span>
        <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" className="muted" />
      </Link>
      {visitaHref && (
        <Link href={visitaHref} className="opt-row">
          <span className="opt-ico" data-tone="warning"><Footprints size={18} strokeWidth={1.7} aria-hidden="true" /></span>
          <span className="opt-text"><strong>Con fotos y medidas de la visita</strong><small>Lo que apuntes en la obra se convierte en partidas propuestas.</small></span>
          <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" className="muted" />
        </Link>
      )}
      <button type="button" className="opt-row" onClick={onManual}>
        <span className="opt-ico"><Plus size={18} strokeWidth={1.8} aria-hidden="true" /></span>
        <span className="opt-text"><strong>A mano</strong><small>Una partida del catálogo o libre, como hasta ahora.</small></span>
        <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" className="muted" />
      </button>
    </section>
  );
}
