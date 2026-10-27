"use client";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { cargarBranding, guardarBranding, esClaveBranding, completarBranding, type Branding } from "./branding";

/** Identidad de la organización actual, con recarga cuando cambia en otra pestaña. */
export function useBranding(): [Branding, (next: Branding) => void, boolean] {
  const { data } = useWorkspace();
  const [branding, setBranding] = useState<Branding>(() => completarBranding(null, data.organization_name));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setBranding(cargarBranding(data.organization_id, data.organization_name)); setReady(true);
    const sync = (e: StorageEvent) => { if (esClaveBranding(e.key)) setBranding(cargarBranding(data.organization_id, data.organization_name)); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [data.organization_id, data.organization_name]);

  const save = useCallback((next: Branding) => { guardarBranding(data.organization_id, next); setBranding(next); }, [data.organization_id]);
  return [branding, save, ready];
}
