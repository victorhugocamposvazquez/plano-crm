"use client";
import { createContext, useContext, useEffect, useRef } from "react";

/**
 * La banda fija del móvil hace de «Volver»: cada pantalla dice a dónde se vuelve desde ella y qué acción corta lleva a la derecha.
 * Si una pantalla no dice nada, el armazón deduce la vuelta por la ruta. En escritorio la banda no existe.
 */
export type Banda = { label: string; href?: string; onClick?: () => void; accion?: { label: string; onClick: () => void } };
export const BandContext = createContext<{ banda: Banda | null; setBanda: (b: Banda | null) => void }>({ banda: null, setBanda: () => {} });

export function useBanda(banda: Banda | null) {
  const { setBanda } = useContext(BandContext);
  // Las funciones cambian en cada render: se guardan en una referencia y la banda solo se vuelve a publicar cuando cambian los textos.
  const actual = useRef(banda);
  actual.current = banda;
  const clave = banda ? `${banda.label}|${banda.href ?? ""}|${banda.accion?.label ?? ""}` : "";
  useEffect(() => {
    const b = actual.current;
    setBanda(b ? { label: b.label, href: b.href, onClick: b.onClick && (() => actual.current?.onClick?.()), accion: b.accion && { label: b.accion.label, onClick: () => actual.current?.accion?.onClick() } } : null);
    return () => setBanda(null);
  }, [clave, setBanda]);
}
