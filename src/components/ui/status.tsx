import type { Project, BudgetVersion, Purchase } from "@/lib/domain";
import { projectStatus, versionStatus, purchaseStatus } from "@/lib/domain";

/**
 * Tonos semánticos del sistema (docs/sistema-diseno.md §2b):
 * success = conseguido / en marcha sin problemas · info = en curso, pedido · warning = pendiente, revisar ·
 * danger = vencido, rechazado · ink = referencia aprobada · muted = sin novedad.
 */
export type Tone = "muted" | "ink" | "success" | "info" | "warning" | "danger" | "blue";

/** Estado como texto + punto. El color acompaña, nunca sustituye al texto (docs/sistema-diseno.md §7). */
export function Status({ label, tone = "muted" }: { label: string; tone?: Tone }) {
  return <span className="status" data-tone={tone === "blue" ? "info" : tone}>{label}</span>;
}

/** Píldora con fondo tintado: para estados que deben destacar en listas densas. */
export function Pill({ label, tone = "muted" }: { label: string; tone?: Tone }) {
  return <span className="pill" data-tone={tone === "blue" ? "info" : tone}>{label}</span>;
}

export function ProjectStatus({ status }: { status: Project["status"] }) {
  const tone: Tone = status === "active" ? "info" : status === "completed" ? "success" : "muted";
  return <Status label={projectStatus[status]} tone={tone} />;
}

export function VersionStatus({ status }: { status: BudgetVersion["status"] }) {
  const tone: Tone = status === "approved" ? "success" : status === "issued" ? "info" : "muted";
  return <Status label={versionStatus[status]} tone={tone} />;
}

export function PurchaseStatus({ status }: { status: Purchase["status"] }) {
  const tone: Tone = status === "ordered" ? "info" : status === "received" ? "warning" : status === "delivered" ? "success" : "muted";
  return <Status label={purchaseStatus[status]} tone={tone} />;
}

export type MeterTone = "success" | "warning" | "danger" | "neutral";

/** Barra de avance. Verde por defecto (lo hecho), ámbar si hay plazos vencidos, rojo si la entrega ha pasado. */
export function Meter({ value, label, tone = "success" }: { value: number; label: string; tone?: MeterTone }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} data-tone={tone} data-done={clamped >= 100}>
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** Tono del avance de un proyecto a partir de sus plazos: vencidos → ámbar; finalizado → verde. */
export function progressTone(input: { overdue: number; done: boolean }): MeterTone {
  if (input.done) return "success";
  return input.overdue > 0 ? "warning" : "success";
}
