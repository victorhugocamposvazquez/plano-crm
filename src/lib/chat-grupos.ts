import type { Message } from "./domain";

/** Mensajes seguidos del mismo autor en menos de cinco minutos se pintan como un bloque, como en cualquier chat. */
export type Grupo = { id: string; author: string; mine: boolean; day: string; items: Message[] };

export function agruparMensajes(messages: Message[], yo: string, ventanaMs = 5 * 60 * 1000): Grupo[] {
  const ordenados = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const grupos: Grupo[] = [];
  for (const m of ordenados) {
    const day = m.created_at.slice(0, 10);
    const ultimo = grupos.at(-1);
    const previo = ultimo?.items.at(-1);
    if (ultimo && previo && ultimo.author === m.author_name && ultimo.day === day && new Date(m.created_at).getTime() - new Date(previo.created_at).getTime() <= ventanaMs) ultimo.items.push(m);
    else grupos.push({ id: m.id, author: m.author_name, mine: m.author_name === yo, day, items: [m] });
  }
  return grupos;
}

export const iniciales = (name: string) => name.split(/[\s·]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "·";

/** Color estable por autor para el avatar (tonos del sistema, no hex sueltos). */
export function tonoAutor(name: string): 1 | 2 | 3 | 4 | 5 {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ((h % 5) + 1) as 1 | 2 | 3 | 4 | 5;
}
