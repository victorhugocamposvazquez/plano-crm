"use client";
import { useSyncExternalStore } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace-provider";
import { Planta3d } from "@/components/capture/planta-3d";
import { plantaEjemplo } from "@/lib/planta-ejemplo";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
/** Plano en 3D: la planta de ejemplo (nave frigorífica) levantada con sus alturas, para presupuestar la instalación con el catálogo. */
export default function Planta3dPage() {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const { id } = useParams<{ id: string }>(), params = useSearchParams(), { data, loading } = useWorkspace();
  if (!hydrated || loading) return <p className="muted">Cargando el proyecto…</p>;
  const project = data.projects.find(p => p.id === id);
  if (!project) return <div className="empty"><strong>Proyecto no encontrado</strong></div>;
  return <Planta3d key={id} project={project} planta={plantaEjemplo} budgetId={params.get("p")} />;
}
