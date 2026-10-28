"use client";
import { useRouter } from "next/navigation";
import { Camera, LayoutTemplate, Pencil, ChevronDown } from "lucide-react";
import { LinkButton, Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";

/**
 * Las tres formas de aportar al presupuesto, siempre a mano en la cabecera de la ficha, junto al chat:
 * a mano, desde un plano o desde fotos. En móvil se pliegan en un solo botón «Presupuestar».
 */
export function BudgetDoors({ planoHref, fotosHref, onManual }: { planoHref: string; fotosHref: string; onManual: () => void }) {
  const router = useRouter();
  return (
    <>
      <span className="doors-wide" role="group" aria-label="Añadir al presupuesto">
        <Button variant="secondary" onClick={onManual} title="Partidas a mano, con el catálogo"><Pencil size={16} strokeWidth={1.6} aria-hidden="true" />A mano</Button>
        <LinkButton href={planoHref} variant="secondary" title="Sube el plano y Plano mide las paredes"><LayoutTemplate size={16} strokeWidth={1.6} aria-hidden="true" />Desde un plano</LinkButton>
        <LinkButton href={fotosHref} variant="secondary" title="Fotos de la obra, notas y una cifra orientativa"><Camera size={16} strokeWidth={1.6} aria-hidden="true" />Desde fotos</LinkButton>
      </span>
      <span className="doors-compact">
        <Menu label="Presupuestar" align="end" trigger={<><Pencil size={16} strokeWidth={1.6} aria-hidden="true" />Presupuestar<ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" /></>} items={[
          { id: "mano", label: "A mano", hint: "Partidas con el catálogo", icon: <Pencil size={16} strokeWidth={1.7} />, onSelect: onManual },
          { id: "plano", label: "Desde un plano", hint: "Sube el PDF y Plano mide las paredes", icon: <LayoutTemplate size={16} strokeWidth={1.7} />, onSelect: () => router.push(planoHref) },
          { id: "fotos", label: "Desde fotos", hint: "Cámara o galería, notas y cifra orientativa", icon: <Camera size={16} strokeWidth={1.7} />, onSelect: () => router.push(fotosHref) }
        ]} />
      </span>
    </>
  );
}
