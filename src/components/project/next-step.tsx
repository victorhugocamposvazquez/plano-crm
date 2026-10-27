"use client";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { etapas, type SiguientePaso, type TipoAccion } from "@/lib/siguiente-paso";

/**
 * «Qué toca ahora» en la ficha: la fase visible (visita → entrega), el siguiente paso y su acción principal.
 * La acción la ejecuta la ficha, que es quien tiene los diálogos y los comandos a mano.
 */
export function NextStep({ paso, busy, onAccion }: { paso: SiguientePaso; busy?: boolean; onAccion: (tipo: TipoAccion) => void }) {
  const indice = etapas.findIndex(e => e.id === paso.etapa);
  const terminado = paso.accion === "ninguna";
  return (
    <section className="next-step zone" data-urgencia={paso.urgencia} aria-label="Siguiente paso">
      <ol className="stepper" aria-label="Fase del proyecto">
        {etapas.map((e, i) => (
          <li key={e.id} data-state={terminado || i < indice ? "done" : i === indice ? "current" : "todo"}>
            <span className="stepper-dot">{terminado || i < indice ? <Check size={11} strokeWidth={2.6} aria-hidden="true" /> : null}</span>
            <span className="stepper-label">{e.label}</span>
          </li>
        ))}
      </ol>
      <div className="next-step-body">
        <div style={{ minWidth: 0 }}>
          <small className="next-step-kicker">{terminado ? "Cerrado" : "Siguiente paso"}</small>
          <strong className="next-step-title">{paso.titulo}</strong>
          <span className="next-step-detail muted">{paso.detalle}</span>
        </div>
        {!terminado && <Button variant="primary" onClick={() => onAccion(paso.accion)} disabled={busy} className="next-step-action">{paso.label}<ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" /></Button>}
      </div>
    </section>
  );
}
