import type { Document, Message, Workspace } from "./domain";
import { normalize } from "./search";
import { parseMessage, plainText, type Ref } from "./chat-refs";

/**
 * Lo que una conversación larga necesita para ser usable: buscar en los mensajes, saber quién participa
 * y encontrar de un vistazo lo compartido (fotos, documentos, presupuestos, tareas, compras, enlaces).
 */

const quitar = (s: string) => normalize(s);

/** Mensajes cuyo texto (sin marcas) contiene todas las palabras de la consulta. */
export function buscarMensajes(messages: Message[], query: string): Set<string> {
  const terms = quitar(query).split(" ").filter(Boolean);
  if (!terms.length) return new Set();
  return new Set(messages.filter(m => !m.deleted_at && terms.every(t => quitar(plainText(m.body)).includes(t))).map(m => m.id));
}

/** Trocea un texto marcando las coincidencias (sin distinguir acentos ni mayúsculas) para resaltarlas. */
export function trozos(text: string, query: string): { text: string; hit: boolean }[] {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [{ text, hit: false }];
  const folded = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  // Si la normalización cambia longitudes (raro con acentos combinados ya quitados), se renuncia al resaltado.
  if (folded.length !== text.length) return [{ text, hit: false }];
  const marcas = new Array<boolean>(text.length).fill(false);
  for (const t of terms) {
    const q = t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    let i = folded.indexOf(q);
    while (q && i >= 0) { for (let k = i; k < i + q.length; k++) marcas[k] = true; i = folded.indexOf(q, i + q.length); }
  }
  const out: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = out.at(-1);
    if (last && last.hit === marcas[i]) last.text += text[i]; else out.push({ text: text[i], hit: marcas[i] });
  }
  return out;
}

export type Participante = { name: string; mensajes: number; ultimo: string };

export function participantes(messages: Message[]): Participante[] {
  const map = new Map<string, Participante>();
  for (const m of messages) {
    const p = map.get(m.author_name) ?? { name: m.author_name, mensajes: 0, ultimo: m.created_at };
    p.mensajes++; if (m.created_at > p.ultimo) p.ultimo = m.created_at;
    map.set(m.author_name, p);
  }
  return [...map.values()].sort((a, b) => b.ultimo.localeCompare(a.ultimo));
}

export type Compartidos = { fotos: Document[]; documentos: Document[]; referencias: Record<"v" | "t" | "c" | "k" | "p", Ref[]>; enlaces: string[] };

/** Todo lo que se ha compartido en la conversación, sin repetir, lo más reciente primero. */
export function elementosCompartidos(messages: Message[], data: Workspace): Compartidos {
  const vistos = new Set<string>();
  const fotos: Document[] = []; const documentos: Document[] = [];
  const referencias: Compartidos["referencias"] = { v: [], t: [], c: [], k: [], p: [] };
  const enlaces: string[] = [];
  for (const m of [...messages].filter(x => !x.deleted_at).sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    for (const part of parseMessage(m.body)) {
      if (part.kind === "text") {
        for (const url of part.text.match(/https?:\/\/[^\s)]+/g) ?? []) if (!vistos.has(url)) { vistos.add(url); enlaces.push(url); }
        continue;
      }
      const key = `${part.ref.type}:${part.ref.id}`;
      if (vistos.has(key)) continue; vistos.add(key);
      if (part.ref.type === "d") {
        const doc = data.documents.find(d => d.id === part.ref.id); if (!doc) continue;
        (doc.mime_type.startsWith("image/") ? fotos : documentos).push(doc);
      } else referencias[part.ref.type].push(part.ref);
    }
  }
  return { fotos, documentos, referencias, enlaces };
}
