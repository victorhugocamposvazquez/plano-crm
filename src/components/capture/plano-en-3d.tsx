"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/domain";
import { plantaEjemplo } from "@/lib/planta-ejemplo";
import type { Planta } from "@/lib/planta3d";
import { leerPlanta, PlanoSinTexto, type InformeLectura, type PlanoLeido } from "@/lib/planta-lector";
import { Planta3d } from "./planta-3d";

export type Subida = { planta: Planta; informe: InformeLectura; archivo: string };
export type FaseLectura = "abrir" | "texto" | "trazos" | "medir" | "error";
export type Lectura = { fase: FaseLectura; archivo: string; plano: PlanoLeido | null; rotulos?: number; error?: string; sinTexto?: boolean };

const clave = (projectId: string) => `plano.planta3d.subida.${projectId}`;
const espera = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
function guardada(k: string): Subida | null {
  try { const s = JSON.parse(localStorage.getItem(k) ?? "null"); return s?.planta?.recintos?.length && s.informe && typeof s.archivo === "string" ? s : null; } catch { return null; }
}

/**
 * Plano en 3D con su plano: el de ejemplo o el PDF que se suba. El PDF se lee en el navegador (no sale del equipo);
 * la planta leída se recuerda por proyecto y se estrena con la conversión de 2D a 3D.
 */
export function PlanoEn3d({ project, budgetId }: { project: Project; budgetId: string | null }) {
  const k = clave(project.id);
  const [subida, setSubida] = useState<Subida | null>(null);
  const [cargado, setCargado] = useState(false);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [estreno, setEstreno] = useState(0);
  const turno = useRef(0);
  useEffect(() => { setSubida(guardada(k)); setCargado(true); }, [k]);
  useEffect(() => () => { turno.current++; }, []);

  const subir = useCallback(async (file: File) => {
    const mio = ++turno.current, vivo = () => turno.current === mio, archivo = file.name;
    const pon = (l: Omit<Lectura, "archivo">) => { if (vivo()) setLectura({ ...l, archivo }); };
    pon({ fase: "abrir", plano: null });
    try {
      if (file.type && file.type !== "application/pdf") throw new Error("Sube el plano en PDF.");
      const { leerArchivoPlanta } = await import("@/lib/planta-lector-pdf");
      const plano = await leerArchivoPlanta(file, fase => pon({ fase, plano: null }));
      if (!vivo()) return;
      pon({ fase: "medir", plano, rotulos: plano.textos.length });
      const sinPrisa = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 2600;
      // La lectura cede el paso entre pasos largos para que el haz no se pare; y el plano se deja ver un momento aunque el equipo sea rápido.
      const [leida] = await Promise.all([leerPlanta(plano, archivo.replace(/\.pdf$/i, ""), () => espera(16)), espera(sinPrisa)]);
      if (!vivo()) return;
      const nueva: Subida = { ...leida, archivo };
      try { localStorage.setItem(k, JSON.stringify(nueva)); } catch { /* sin almacenamiento: vale para esta sesión */ }
      setSubida(nueva); setEstreno(n => n + 1); setLectura(null);
    } catch (e) {
      pon({ fase: "error", plano: null, sinTexto: e instanceof PlanoSinTexto, error: e instanceof Error && e.message ? e.message : "No se ha podido leer este plano." });
    }
  }, [k]);
  const cerrar = useCallback(() => { turno.current++; setLectura(null); }, []);
  const quitar = useCallback(() => { try { localStorage.removeItem(k); } catch { /* nada que quitar */ } setSubida(null); }, [k]);

  if (!cargado) return <p className="muted">Cargando el plano…</p>;
  const planta = subida?.planta ?? plantaEjemplo;
  return <Planta3d key={`${planta.id}.${estreno}`} project={project} planta={planta} budgetId={budgetId} informe={subida?.informe ?? null} archivo={subida?.archivo} estreno={estreno > 0}
    lectura={lectura} alSubir={subir} alCerrarLectura={cerrar} alQuitar={subida ? quitar : undefined} />;
}
