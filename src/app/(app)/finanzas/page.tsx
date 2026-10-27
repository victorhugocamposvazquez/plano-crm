"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Wallet, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { ProjectStatus } from "@/components/ui/status";
import { money } from "@/lib/domain";
import { finanzas } from "@/lib/resumen";

/** Lectura económica de la empresa en base sin IVA: aprobado, certificado y pendiente por proyecto. */
export default function FinanzasPage() {
  const { data, loading } = useWorkspace();
  const f = useMemo(() => finanzas(data), [data]);
  const porcentaje = f.aprobadoEnCurso ? Math.round((f.certificado / f.aprobadoEnCurso) * 100) : 0;

  return (
    <div className="page">
      <div>
        <div className="eyebrow"><Wallet size={13} strokeWidth={1.8} aria-hidden="true" /><span>{data.organization_name || "Espacio de trabajo"}</span></div>
        <h1 className="h1">Finanzas.</h1>
        <p className="subtitle">{loading ? "Cargando…" : `${money(f.aprobadoEnCurso)} aprobados en obras en marcha · ${porcentaje} % certificado · importes en base sin IVA`}</p>
      </div>

      <div className="summary summary-4">
        <div><strong>{money(f.aprobadoEnCurso)}</strong><small>aprobado en obras en marcha</small></div>
        <div><strong>{money(f.pendienteCertificar)}</strong><small>pendiente de certificar</small></div>
        <div><strong>{money(f.certificado)}</strong><small>certificaciones en preparación</small></div>
        <div><strong>{money(f.enRevision)}</strong><small>en revisión, sin aprobar</small></div>
      </div>

      {!loading && f.filas.length === 0 && <div className="empty"><strong>Todavía no hay importes</strong><span className="muted text-sm">Aparecen al aprobar o poner en revisión el primer presupuesto.</span></div>}

      {f.filas.length > 0 && (
        <div className="fin-table" role="table" aria-label="Importes por proyecto">
          <div className="fin-row fin-head" role="row"><span role="columnheader">Proyecto</span><span role="columnheader">Aprobado</span><span role="columnheader">Certificado</span><span role="columnheader">Pendiente</span><span role="columnheader">En revisión</span></div>
          {f.filas.map(r => (
            <Link key={r.project.id} href={`/proyectos/${r.project.id}`} className="fin-row" role="row">
              <span role="cell" style={{ minWidth: 0 }}><strong>{r.project.name}</strong><small><ProjectStatus status={r.project.status} />{r.comprasPendientes ? <span className="muted"> · {r.comprasPendientes} compras pendientes</span> : null}</small></span>
              <span role="cell" className="pl-mono" data-label="Aprobado">{r.aprobado ? money(r.aprobado) : "—"}</span>
              <span role="cell" className="pl-mono" data-label="Certificado">{r.certificado ? money(r.certificado) : "—"}</span>
              <span role="cell" className="pl-mono" data-label="Pendiente" style={{ color: r.pendiente ? "var(--pl-ink)" : "var(--pl-muted)" }}>{r.aprobado ? money(r.pendiente) : "—"}</span>
              <span role="cell" className="pl-mono" data-label="En revisión">{r.enRevision ? money(r.enRevision) : "—"}<ArrowUpRight size={14} strokeWidth={1.6} aria-hidden="true" className="fin-arrow" /></span>
            </Link>
          ))}
        </div>
      )}

      <p className="muted text-xs">IVA de lo aprobado en marcha: {money(f.ivaAprobado)}. Facturas emitidas, cobros, pagos a proveedores y márgenes por obra llegarán cuando el dominio incorpore facturación; las certificaciones de hoy son borradores sin validar.</p>
    </div>
  );
}
