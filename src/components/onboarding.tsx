"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, X, Sparkles } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { useBranding } from "@/lib/use-branding";
import { primerosPasos, mostrarPrimerosPasos, claveOcultar } from "@/lib/primeros-pasos";

/** Guía de arranque para una organización nueva: cuatro pasos con enlace, se oculta sola al completarse o a mano. */
export function Onboarding() {
  const { data, loading } = useWorkspace();
  const [branding, , ready] = useBranding();
  const [oculto, setOculto] = useState(true);
  useEffect(() => { try { setOculto(localStorage.getItem(claveOcultar(data.organization_id)) === "1"); } catch { setOculto(false); } }, [data.organization_id]);
  const pasos = useMemo(() => primerosPasos(data, branding), [data, branding]);
  if (loading || !ready || !mostrarPrimerosPasos(pasos, data, oculto)) return null;
  const hechos = pasos.filter(p => p.done).length;

  function ocultar() { try { localStorage.setItem(claveOcultar(data.organization_id), "1"); } catch {} setOculto(true); }

  return (
    <section className="onboarding zone" aria-label="Primeros pasos">
      <header>
        <span><Sparkles size={15} strokeWidth={1.8} aria-hidden="true" /><strong>Primeros pasos en Plano</strong><small className="muted"> · {hechos} de {pasos.length}</small></span>
        <button type="button" className="search-clear" aria-label="Ocultar la guía" title="Ocultar" onClick={ocultar}><X size={14} strokeWidth={1.8} aria-hidden="true" /></button>
      </header>
      <ol>
        {pasos.map((p, i) => (
          <li key={p.id} data-done={p.done}>
            <span className="onboarding-mark">{p.done ? <Check size={13} strokeWidth={2.4} aria-hidden="true" /> : <span className="pl-mono">{i + 1}</span>}</span>
            <span style={{ minWidth: 0, flex: 1 }}><strong>{p.label}</strong><small className="muted">{p.hint}</small></span>
            {!p.done && <Link href={p.href} className="btn btn-ghost" style={{ height: 34, flex: "0 0 auto" }}>Ir<ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></Link>}
          </li>
        ))}
      </ol>
    </section>
  );
}
