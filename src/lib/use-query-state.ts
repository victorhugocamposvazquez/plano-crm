"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Estado de navegación en la URL (pestaña, filtro, búsqueda, día…), para que «atrás», recargar y
 * compartir el enlace devuelvan la misma vista. Sustituye la entrada del historial (no la apila):
 * cambiar de filtro no debe obligar a pulsar «atrás» diez veces.
 */
export function useQueryState<T extends string>(key: string, fallback: T): [T, (value: T | "") => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = (params.get(key) as T | null) ?? fallback;
  const set = useCallback((next: T | "") => {
    const search = new URLSearchParams(params.toString());
    if (!next || next === fallback) search.delete(key); else search.set(key, next);
    const query = search.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [params, router, pathname, key, fallback]);
  return [value, set];
}

/** Seleccionar versión, vista y pareja de comparación es una única navegación: no se pisan parámetros entre sí. */
export function useQueryPatch() {
  const pathname=usePathname();
  return useCallback((patch:Record<string,string|null|undefined>)=>{
    const search=new URLSearchParams(window.location.search);
    for(const [key,value] of Object.entries(patch))if(value)search.set(key,value);else search.delete(key);
    // Estas vistas leen el mismo espacio ya cargado. La API nativa integrada por Next actualiza useSearchParams sin pedir otra página al servidor.
    window.history.replaceState(null,"",search.size?`${pathname}?${search}`:pathname);
  },[pathname]);
}
