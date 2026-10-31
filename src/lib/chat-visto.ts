import type { Message } from "./domain";

/** Qué ha visto cada persona en este dispositivo: no hay «leído» en el dominio, así que el contador es local. */
const clave = "plano.chat.visto";
type Visto = { desde: string; proyectos: Record<string, string> };

function leer(): Visto {
  try {
    const raw = JSON.parse(localStorage.getItem(clave) ?? "null");
    if (raw && typeof raw.desde === "string" && raw.proyectos && typeof raw.proyectos === "object") return raw;
  } catch {}
  const inicial = { desde: new Date().toISOString(), proyectos: {} };
  try { localStorage.setItem(clave, JSON.stringify(inicial)); } catch {}
  return inicial;
}

export function marcarVisto(projectId: string, momento = new Date().toISOString()) {
  const visto = leer();
  visto.proyectos[projectId] = momento;
  try { localStorage.setItem(clave, JSON.stringify(visto)); window.dispatchEvent(new Event("plano:chat-visto")); } catch {}
}

export function sinLeerPorProyecto(messages: Message[], yo: string) {
  const visto = leer();
  const cuenta = new Map<string, number>();
  for (const m of messages) {
    if (m.deleted_at || m.author_name === yo) continue;
    if (m.created_at > (visto.proyectos[m.project_id] ?? visto.desde)) cuenta.set(m.project_id, (cuenta.get(m.project_id) ?? 0) + 1);
  }
  return cuenta;
}
