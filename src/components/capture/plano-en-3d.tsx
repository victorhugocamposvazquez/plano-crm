"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileUp } from "lucide-react";
import { useBanda } from "@/components/band";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/domain";
import { plantaEjemplo } from "@/lib/planta-ejemplo";
import type { Planta } from "@/lib/planta3d";
import { leerPlanta, PlanoSinTexto, type InformeLectura, type PlanoLeido } from "@/lib/planta-lector";
import { LecturaPlano } from "./escaner-plano";
import { Planta3d } from "./planta-3d";
import "@/styles/visita-360.css";
import "@/styles/espacio-3d.css";
import "@/styles/planta-3d.css";

export type Subida = { planta: Planta; informe: InformeLectura; archivo: string };
export type FaseLectura = "abrir" | "texto" | "trazos" | "medir" | "error";
export type Lectura = { fase: FaseLectura; archivo: string; plano: PlanoLeido | null; rotulos?: number; error?: string; sinTexto?: boolean };

const clave = (projectId: string) => `plano.planta3d.subida.${projectId}`;
const claveEjemplo = (projectId: string) => `plano.planta3d.ejemplo.${projectId}`;
const espera = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
function guardada(k: string): Subida | null {
  try { const s = JSON.parse(localStorage.getItem(k) ?? "null"); return s?.planta?.recintos?.length && s.informe && typeof s.archivo === "string" ? s : null; } catch { return null; }
}

/**
 * Plano en 3D con su plano. Empieza vacío: el primer paso es subir el PDF, que se lee en el navegador (no sale del equipo);
 * la planta leída se recuerda por proyecto y se estrena con la conversión de 2D a 3D. La planta de ejemplo solo se abre si se pide.
 */
export function PlanoEn3d({ project, budgetId }: { project: Project; budgetId: string | null }) {
  const k = clave(project.id);
  const [subida, setSubida] = useState<Subida | null>(null);
  const [ejemplo, setEjemplo] = useState(false);
  // El dibujo recién leído se guarda solo en memoria: sirve para que la conversión arranque sobre el plano original.
  const [dibujo, setDibujo] = useState<PlanoLeido | null>(null);
  const [cargado, setCargado] = useState(false);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [estreno, setEstreno] = useState(0);
  const turno = useRef(0);
  const salida = `/proyectos/${project.id}?s=budget${budgetId ? `&p=${budgetId}` : ""}`;
  useBanda({ label: project.name, href: salida });
  useEffect(() => { setSubida(guardada(k)); try { setEjemplo(localStorage.getItem(claveEjemplo(project.id)) === "1"); } catch { /* sin almacenamiento */ } setCargado(true); }, [k, project.id]);
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
      setSubida(nueva); setDibujo(plano); setEstreno(n => n + 1); setLectura(null);
    } catch (e) {
      pon({ fase: "error", plano: null, sinTexto: e instanceof PlanoSinTexto, error: e instanceof Error && e.message ? e.message : "No se ha podido leer este plano." });
    }
  }, [k]);
  const cerrar = useCallback(() => { turno.current++; setLectura(null); }, []);
  const quitar = useCallback(() => { try { localStorage.removeItem(k); } catch { /* nada que quitar */ } setSubida(null); setDibujo(null); }, [k]);
  const verEjemplo = useCallback((ver: boolean) => {
    try { if (ver) localStorage.setItem(claveEjemplo(project.id), "1"); else localStorage.removeItem(claveEjemplo(project.id)); } catch { /* vale para esta sesión */ }
    setEjemplo(ver); if (ver) setEstreno(n => n + 1);
  }, [project.id]);

  if (!cargado) return <p className="muted">Cargando el plano…</p>;
  if (!subida && !ejemplo) {
    const leyendo = lectura && lectura.fase !== "error";
    const elegir = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void subir(f); };
    return <div className="page v360 e3d p3d">
      <header className="v360-head">
        <div>
          <Link prefetch={false} href={salida} className="flow-back solo-escritorio"><ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" /><span>{project.name}</span></Link>
          <h1>Plano en 3D</h1>
          <p>Sube el plano de la instalación y Plano lo levanta en 3D para presupuestar encima con el catálogo.</p>
        </div>
      </header>
      <div className="e3d-stage p3d-vacio" data-conversion={leyendo || undefined} data-aviso={!leyendo || undefined}>
        {lectura ? <LecturaPlano lectura={lectura} alElegir={f => void subir(f)} alCerrar={cerrar} /> : <div className="p3d-inicio">
          <FileUp size={26} strokeWidth={1.55} aria-hidden="true" />
          <strong>Sube el plano de la instalación</strong>
          <p>En PDF y con texto, exportado desde el programa de dibujo. Plano lee los recintos, los equipos y las tuberías, y los levanta a la altura rotulada. El archivo no sale de tu equipo.</p>
          <div>
            <label className="btn btn-primary p3d-subir"><span>Subir un plano</span><input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={elegir} /></label>
            <Button variant="secondary" onClick={() => verEjemplo(true)}>Ver un ejemplo</Button>
          </div>
        </div>}
      </div>
    </div>;
  }
  const planta = subida?.planta ?? plantaEjemplo;
  return <Planta3d key={`${planta.id}.${estreno}`} project={project} planta={planta} budgetId={budgetId} informe={subida?.informe ?? null} archivo={subida?.archivo} plano={subida ? dibujo : null} estreno={estreno > 0}
    lectura={lectura} alSubir={subir} alCerrarLectura={cerrar} alQuitar={subida ? quitar : () => verEjemplo(false)} />;
}
