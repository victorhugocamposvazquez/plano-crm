"use client";
import { useSyncExternalStore } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace-provider";
import { PlanFlow } from "@/components/plan/plan-flow";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** «Presupuestar desde un plano»: flujo guiado dentro de la ficha. Lo que sale se añade al presupuesto que haya. */
export default function PlanoPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { data, loading } = useWorkspace();
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const project = data.projects.find(p => p.id === id);
  if (!hydrated || loading) return <p className="muted">Cargando el proyecto…</p>;
  if (!project) return <div className="empty"><strong>Ese proyecto no existe</strong></div>;
  return <PlanFlow project={project} budgetId={params.get("p")} />;
}
