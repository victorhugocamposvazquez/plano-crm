"use client";
import { useSyncExternalStore } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace-provider";
import { PlanoEn3d } from "@/components/capture/plano-en-3d";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
/** Plano en 3D: la planta de ejemplo (nave frigorífica) o la que se lea de un PDF subido, levantada con sus alturas para presupuestar la instalación con el catálogo. */
export default function Planta3dPage() {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const { id } = useParams<{ id: string }>(), params = useSearchParams(), { data, loading } = useWorkspace();
  if (!hydrated || loading) return <p className="muted">Cargando el proyecto…</p>;
  const project = data.projects.find(p => p.id === id);
  if (!project) return <div className="empty"><strong>Proyecto no encontrado</strong></div>;
  return <PlanoEn3d key={id} project={project} budgetId={params.get("p")} />;
}
