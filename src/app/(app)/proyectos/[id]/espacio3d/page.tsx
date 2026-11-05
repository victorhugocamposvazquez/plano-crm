"use client";
import { useSyncExternalStore } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace-provider";
import { Espacio3d } from "@/components/capture/espacio-3d";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
/** Propuesta en 3D: el espacio de ejemplo con los materiales del catálogo, por voz, texto o toque, y paso al presupuesto. */
export default function Espacio3dPage() {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const { id } = useParams<{ id: string }>(), params = useSearchParams(), { data, loading } = useWorkspace();
  if (!hydrated || loading) return <p className="muted">Cargando el proyecto…</p>;
  const project = data.projects.find(p => p.id === id);
  if (!project) return <div className="empty"><strong>Proyecto no encontrado</strong></div>;
  return <Espacio3d key={id} project={project} budgetId={params.get("p")} />;
}
