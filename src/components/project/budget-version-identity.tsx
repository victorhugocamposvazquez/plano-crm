import type { BudgetVersion } from "@/lib/domain";
import { versionState, versionTimestamp } from "@/lib/budget-history";
import "@/styles/budget-identity.css";

/** Mismos datos y significado en resumen, versiones, listado y consulta desde el chat. */
export function BudgetVersionIdentity({ version, currentId, approvedId, showUpdated = false }: { version: BudgetVersion; currentId?: string; approvedId?: string | null; showUpdated?: boolean }) {
  const current = version.id === currentId;
  return <span className="version-identity">
    <span className="version-identity-line"><strong>V{version.number}</strong>{current ? <span className="version-identity-current"><span className="pulse-dot" aria-hidden="true"/>Actual</span> : <span className="version-identity-previous">{version.id===approvedId?"Para obra":"Anterior"}</span>}</span>
    <span className="version-identity-state">{versionState(version,approvedId)}</span>
    <span className="version-identity-date">Creada <time dateTime={version.created_at}>{versionTimestamp(version.created_at)}</time></span>
    {showUpdated && versionTimestamp(version.updated_at)!==versionTimestamp(version.created_at) && <span className="version-identity-date">Editada <time dateTime={version.updated_at}>{versionTimestamp(version.updated_at)}</time></span>}
  </span>;
}
