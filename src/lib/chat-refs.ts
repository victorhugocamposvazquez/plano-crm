import type { Workspace } from "./domain";

/**
 * Referencias dentro de un mensaje del chat. Se guardan en el propio texto con la forma
 * [[tipo:id|etiqueta]] para no depender de cambios en el dominio: el backend sigue viendo una cadena.
 * Tipos: v (revisión de presupuesto), d (documento), t (tarea), c (compra), p (proyecto).
 */

export type RefType = "v" | "d" | "t" | "c" | "p";
export type Ref = { type: RefType; id: string; label: string };
export type Part = { kind: "text"; text: string } | { kind: "ref"; ref: Ref };

const TOKEN = /\[\[([vdtcp]):([A-Za-z0-9-]+)\|([^\]|]{1,120})\]\]/g;

export function encodeRef(ref: Ref) {
  return `[[${ref.type}:${ref.id}|${ref.label.replace(/[\[\]|]/g, " ").replace(/\s+/g, " ").trim()}]]`;
}

/** Divide el cuerpo en texto plano y referencias, en orden. */
export function parseMessage(body: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of body.matchAll(TOKEN)) {
    const index = m.index ?? 0;
    if (index > last) parts.push({ kind: "text", text: body.slice(last, index) });
    parts.push({ kind: "ref", ref: { type: m[1] as RefType, id: m[2], label: m[3] } });
    last = index + m[0].length;
  }
  if (last < body.length) parts.push({ kind: "text", text: body.slice(last) });
  return parts;
}

/** Texto sin marcas, para previsualizaciones y búsquedas. */
export function plainText(body: string) {
  return body.replace(TOKEN, (_, __, ___, label: string) => label);
}

export type RefOption = Ref & { group: string; hint?: string };

/** Qué se puede referenciar desde el chat de un proyecto: sus revisiones, documentos, tareas y compras. */
export function referenciables(data: Workspace, projectId: string): RefOption[] {
  const out: RefOption[] = [];
  for (const b of data.budgets.filter(b => b.project_id === projectId)) {
    for (const v of data.versions.filter(v => v.budget_id === b.id).sort((a, z) => z.number - a.number)) {
      const estado = v.id === b.approved_version_id ? "aprobada para obra" : v.status === "draft" ? "en revisión" : v.status === "issued" ? "cerrada" : "anterior";
      out.push({ type: "v", id: v.id, label: `V${v.number} · ${b.title}`, group: "Presupuesto", hint: `${estado} · ${v.change_reason}` });
    }
  }
  for (const d of data.documents.filter(d => d.project_id === projectId)) out.push({ type: "d", id: d.id, label: d.name, group: "Documentos", hint: d.category });
  for (const t of data.tasks.filter(t => t.project_id === projectId)) out.push({ type: "t", id: t.id, label: t.title, group: "Tareas", hint: `${t.trade} · ${t.status === "done" ? "hecha" : t.due_date}` });
  for (const c of data.purchases.filter(c => c.project_id === projectId)) out.push({ type: "c", id: c.id, label: c.name, group: "Compras", hint: c.supplier });
  return out;
}

/** Busca entre las referencias por texto, sin acentos. */
export function filtrarReferencias(options: RefOption[], query: string) {
  const q = query.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (!q) return options;
  return options.filter(o => `${o.label} ${o.hint ?? ""} ${o.group}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q));
}

/** Enlace de destino de una referencia dentro de la ficha del proyecto (el chat no te saca de ella). */
export function destinoRef(ref: Ref, data: Workspace, projectId: string): { href: string } | { task: string } | { document: string } {
  if (ref.type === "t") return { task: ref.id };
  if (ref.type === "d") return { document: ref.id };
  if (ref.type === "v") { const v = data.versions.find(x => x.id === ref.id); return { href: `/proyectos/${projectId}?s=budget${v ? `&p=${v.budget_id}` : ""}` }; }
  if (ref.type === "c") return { href: `/proyectos/${projectId}?s=purchases` };
  return { href: `/proyectos/${ref.id}` };
}
