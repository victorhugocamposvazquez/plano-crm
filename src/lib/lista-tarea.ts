/** Lista de comprobación de las tareas: cuánto lleva hecho y cómo decirlo. */
import type { PuntoLista } from "./domain";

export function progresoLista(lista: PuntoLista[] | undefined): { hechos: number; total: number } | null {
  if (!lista?.length) return null;
  return { hechos: lista.filter(p => p.done).length, total: lista.length };
}
/** «2 de 5», o null si no hay lista. */
export const textoProgreso = (lista: PuntoLista[] | undefined) => { const p = progresoLista(lista); return p ? `${p.hechos} de ${p.total}` : null; };
/** Punto nuevo con id propio, para poder marcarlo y reordenarlo antes de guardar. */
export const puntoNuevo = (text: string): PuntoLista => ({ id: crypto.randomUUID().slice(0, 12), text: text.trim().slice(0, 300), done: false });
