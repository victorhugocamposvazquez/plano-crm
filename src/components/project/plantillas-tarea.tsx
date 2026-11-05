"use client";
import { LayoutList, Sparkles } from "lucide-react";
import { Menu } from "@/components/ui/menu";
import type { PuntoLista } from "@/lib/domain";
import { aplicarPlantilla, plantillasTarea, sugerirPlantilla, type PlantillaTarea } from "@/lib/plantillas-tarea";

/**
 * Plantillas de subtareas junto al editor: la sugerida por el título como chip («Añadir las de Pintar paredes»)
 * y todas en «Plantillas». Al aplicar una se añaden sus subtareas (sin repetir) y, si el oficio estaba sin elegir, el suyo.
 */
export function PlantillasTarea({ titulo, subtareas, onAplicar }: { titulo: string; subtareas: PuntoLista[]; onAplicar: (lista: PuntoLista[], plantilla: PlantillaTarea) => void }) {
  const sugerida = sugerirPlantilla(titulo);
  const yaAplicada = (p: PlantillaTarea) => p.subtareas.every(s => subtareas.some(x => x.text.trim().toLocaleLowerCase("es") === s.toLocaleLowerCase("es")));
  const aplicar = (p: PlantillaTarea) => onAplicar(aplicarPlantilla(subtareas, p), p);
  return <div className="plantillas-tarea">
    {sugerida && !yaAplicada(sugerida) && <button type="button" className="chip plantilla-sugerida" onClick={() => aplicar(sugerida)}><Sparkles size={14} strokeWidth={1.8} aria-hidden="true" />Añadir las de «{sugerida.nombre}» · {sugerida.subtareas.length}</button>}
    <Menu size="md" label="Plantillas de subtareas" align="start" trigger={<><LayoutList size={15} strokeWidth={1.7} aria-hidden="true" />Plantillas</>}
      items={plantillasTarea.map(p => ({ id: p.id, label: p.nombre, hint: `${p.subtareas.length} subtareas · ${p.oficio}${yaAplicada(p) ? " · ya añadidas" : ""}`, disabled: yaAplicada(p), onSelect: () => aplicar(p) }))} />
  </div>;
}
