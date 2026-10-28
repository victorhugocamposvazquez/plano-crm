"use client";
import { useEffect,useRef,useState } from "react";
import type { SceneSelection,SpatialScene,VisualAsset } from "@/lib/visual/schema";
import type { createSpaceViewer } from "@/lib/visual/viewer";
import styles from "./espacio.module.css";
export type SpaceViewer=ReturnType<typeof createSpaceViewer>;
export function SpaceView({scene,assets,selection,selected,onSelect,onReady}:{
  scene:SpatialScene;assets:VisualAsset[];selection:SceneSelection;selected:string;
  onSelect:(id:string)=>void;onReady:(viewer:SpaceViewer|null)=>void;
}) {
  const host=useRef<HTMLDivElement>(null),instance=useRef<SpaceViewer|null>(null);
  const latest=useRef({selection,selected,onSelect});latest.current={selection,selected,onSelect};
  const [status,setStatus]=useState<"loading"|"ready"|"failed">("loading");
  useEffect(()=>{
    let cancelled=false;setStatus("loading");
    import("@/lib/visual/viewer").then(({createSpaceViewer})=>{
      if(cancelled || !host.current) return;
      instance.current=createSpaceViewer(host.current,scene,assets,latest.current.selection,id=>latest.current.onSelect(id),()=>{setStatus("failed");onReady(null);});
      instance.current.update(latest.current.selection,latest.current.selected);setStatus("ready");onReady(instance.current);
    }).catch(()=>{if(!cancelled){setStatus("failed");onReady(null);}});
    return ()=>{cancelled=true;instance.current?.dispose();instance.current=null;onReady(null);};
  },[scene,assets,onReady]);
  useEffect(()=>{instance.current?.update(selection,selected);},[selection,selected]);
  return <div className={styles.stage}>
    <div ref={host} className={styles.canvasHost}/>
    {status!=="ready" && <div className={styles.fallback} role="status">{status==="loading" ? "Preparando vista 3D…" : "La vista 3D no está disponible en este navegador. Puedes seguir comparando artículos y precios en la lista."}</div>}
    <span className={styles.viewStatus} aria-live="polite">{status==="ready"?"Vista 3D lista":status==="failed"?"Vista de artículos disponible":"Cargando"}</span>
    <span className={styles.sceneBadge}>Espacio ficticio · representación genérica</span>
  </div>;
}
