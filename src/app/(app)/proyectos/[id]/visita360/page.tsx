"use client";
import { useSyncExternalStore } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace-provider";
import { Visita360 } from "@/components/capture/visita-360";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
/** Visita 360: recorrer la estancia en una foto esférica, decir o tocar qué va en cada sitio y pasarlo al presupuesto. */
export default function Visita360Page() {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const { id } = useParams<{ id: string }>(), params = useSearchParams(), { data, loading } = useWorkspace();
  if (!hydrated || loading) return <p className="muted">Cargando el proyecto…</p>;
  const project = data.projects.find(p => p.id === id);
  if (!project) return <div className="empty"><strong>Proyecto no encontrado</strong></div>;
  return <Visita360 key={id} project={project} budgetId={params.get("p")} />;
}
