"use client";
import { useCallback, useEffect, useState } from "react";
import type { Traza } from "@/lib/voz";

/** Con `?vozdebug=1` en la URL, guarda lo que hace el dictado para verlo en el propio móvil. */
export function useTrazaVoz(): { lineas: string[]; traza: Traza | undefined } {
  const [activa, setActiva] = useState(false);
  const [lineas, setLineas] = useState<string[]>([]);
  useEffect(() => { setActiva(new URLSearchParams(window.location.search).has("vozdebug")); }, []);
  const anotar = useCallback<Traza>(l => setLineas(prev => [...prev.slice(-29), l]), []);
  return { lineas, traza: activa ? anotar : undefined };
}

export function TrazaVoz({ lineas }: { lineas: string[] }) {
  if (!lineas.length) return null;
  return <pre className="v360-traza" aria-label="Diagnóstico del dictado">{lineas.join("\n")}</pre>;
}
