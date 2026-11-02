"use client";
import { useSyncExternalStore } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace-provider";
import { RoomCapture } from "@/components/capture/room-capture";
const subscribe=()=>()=>{};
const clientSnapshot=()=>true;
const serverSnapshot=()=>false;
export default function CapturaPage(){
  const hydrated=useSyncExternalStore(subscribe,clientSnapshot,serverSnapshot);
  const {id}=useParams<{id:string}>(),params=useSearchParams(),{data,loading}=useWorkspace();
  if(!hydrated || loading)return <p className="muted">Cargando el proyecto…</p>;
  const project=data.projects.find(p=>p.id===id);
  if(!project)return <div className="empty"><strong>Proyecto no encontrado</strong></div>;
  return <RoomCapture key={id} project={project} budgetId={params.get("p")}/>;
}
