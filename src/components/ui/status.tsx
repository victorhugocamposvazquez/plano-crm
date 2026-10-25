import type { Project, BudgetVersion, Purchase } from "@/lib/domain";
import { projectStatus, versionStatus, purchaseStatus } from "@/lib/domain";

export type Tone = "muted" | "ink" | "warning" | "blue";

/** Estado como texto + punto. El color acompaña, nunca sustituye al texto (docs/sistema-diseno.md §7). */
export function Status({ label, tone = "muted" }: { label: string; tone?: Tone }) {
  return <span className="status" data-tone={tone}>{label}</span>;
}

export function ProjectStatus({ status }: { status: Project["status"] }) {
  const tone: Tone = status === "active" ? "blue" : "muted";
  return <Status label={projectStatus[status]} tone={tone} />;
}

export function VersionStatus({ status }: { status: BudgetVersion["status"] }) {
  const tone: Tone = status === "approved" ? "ink" : "muted";
  return <Status label={versionStatus[status]} tone={tone} />;
}

export function PurchaseStatus({ status }: { status: Purchase["status"] }) {
  const tone: Tone = status === "ordered" ? "blue" : status === "received" ? "warning" : status === "delivered" ? "ink" : "muted";
  return <Status label={purchaseStatus[status]} tone={tone} />;
}

export function Meter({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} data-done={clamped >= 100}>
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}
