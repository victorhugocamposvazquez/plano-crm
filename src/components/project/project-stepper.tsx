import { Check } from "lucide-react";
import { pasoDe, pasos } from "@/lib/pasos";
import type { Project } from "@/lib/domain";

/** El camino Visita → Presupuesto → Obra → Entregado, siempre igual. Pulsarlo abre el cambio de fase si el perfil puede. */
export function ProjectStepper({ status, progress, onCambiar }: { status: Project["status"]; progress: number; onCambiar?: () => void }) {
  const actual = pasos.findIndex(p => p.id === pasoDe(status));
  const terminado = status === "completed";
  const contenido = pasos.map((p, i) => {
    const estado = terminado || i < actual ? "done" : i === actual ? "current" : "todo";
    return (
      <span key={p.id} className="step" data-state={estado} aria-current={estado === "current" ? "step" : undefined}>
        <span className="step-mark" aria-hidden="true">{estado === "done" && <Check size={11} strokeWidth={2.6} />}</span>
        {p.label}{p.id === "obra" && estado === "current" ? ` · ${progress} %` : ""}
      </span>
    );
  });
  return onCambiar
    ? <button type="button" className="steps" aria-label={`Fase del proyecto: ${pasos[actual]?.label}. Cambiar de fase`} aria-haspopup="dialog" title="Cambiar de fase" onClick={onCambiar}>{contenido}</button>
    : <div className="steps" role="group" aria-label={`Fase del proyecto: ${pasos[actual]?.label}`}>{contenido}</div>;
}
