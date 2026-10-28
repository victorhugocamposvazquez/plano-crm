import type { Workspace } from "./domain";
import { normalize } from "./search";

/**
 * Referencias dentro de un mensaje del chat. Se guardan en el propio texto con la forma
 * [[tipo:id|etiqueta]] para no depender de cambios en el dominio: el backend sigue viendo una cadena.
 * Tipos: v (revisión de presupuesto), d (documento), t (tarea), c (compra), p (proyecto), k (cliente).
 */

export type RefType = "v" | "d" | "t" | "c" | "p" | "k";
export type Ref = { type: RefType; id: string; label: string };
export type Part = { kind: "text"; text: string } | { kind: "ref"; ref: Ref };

const TOKEN = /\[\[([vdtcpk]):([A-Za-z0-9-]+)\|([^\]|]{1,120})\]\]/g;

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

/** Categorías del selector «#», en el orden en que se ofrecen. */
export const categorias: { type: RefType; label: string; hint: string }[] = [
  { type: "v", label: "Presupuesto", hint: "Una revisión de este proyecto" },
  { type: "d", label: "Documento", hint: "Plano, contrato, foto o PDF" },
  { type: "t", label: "Tarea", hint: "De la agenda del proyecto" },
  { type: "c", label: "Compra", hint: "Material o pedido" },
  { type: "k", label: "Cliente", hint: "Su ficha y sus proyectos" },
  { type: "p", label: "Proyecto", hint: "Otro proyecto de la empresa" }
];
export const nombreCategoria = (type: RefType) => categorias.find(c => c.type === type)?.label ?? "Referencia";

export type RefOption = Ref & { group: string; hint?: string };

/** Identificador estable de un cliente a partir de su nombre (no hay entidad cliente todavía). */
export const clienteId = (name: string) => normalize(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cliente";

/** Qué se puede referenciar desde el chat de un proyecto: sus revisiones, documentos, tareas y compras, los clientes y otros proyectos. */
export function referenciables(data: Workspace, projectId: string): RefOption[] {
  const out: RefOption[] = [];
  for (const b of data.budgets.filter(b => b.project_id === projectId)) {
    for (const v of data.versions.filter(v => v.budget_id === b.id).sort((a, z) => z.number - a.number)) {
      const estado = v.id === b.approved_version_id ? "aprobada para obra" : v.status === "draft" ? "en revisión" : v.status === "issued" ? "cerrada" : "anterior";
      out.push({ type: "v", id: v.id, label: `V${v.number} · ${b.title}`, group: "Presupuesto", hint: `${estado} · ${v.change_reason}` });
    }
  }
  for (const d of data.documents.filter(d => d.project_id === projectId)) out.push({ type: "d", id: d.id, label: d.name, group: "Documento", hint: d.category });
  for (const t of data.tasks.filter(t => t.project_id === projectId)) out.push({ type: "t", id: t.id, label: t.title, group: "Tarea", hint: `${t.trade} · ${t.status === "done" ? "hecha" : t.due_date}` });
  for (const c of data.purchases.filter(c => c.project_id === projectId)) out.push({ type: "c", id: c.id, label: c.name, group: "Compra", hint: c.supplier });
  const propio = data.projects.find(p => p.id === projectId);
  const clientes = [...new Set(data.projects.map(p => p.client_name).filter(Boolean))].sort((a, b) => (a === propio?.client_name ? -1 : b === propio?.client_name ? 1 : a.localeCompare(b, "es")));
  for (const name of clientes) out.push({ type: "k", id: clienteId(name), label: name, group: "Cliente", hint: `${(n => `${n} proyecto${n === 1 ? "" : "s"}`)(data.projects.filter(p => p.client_name === name).length)}${name === propio?.client_name ? " · este proyecto" : ""}` });
  for (const p of data.projects.filter(p => p.id !== projectId)) out.push({ type: "p", id: p.id, label: p.name, group: "Proyecto", hint: `${p.code} · ${p.client_name}` });
  return out;
}

/** Busca entre las referencias por texto, sin acentos; opcionalmente dentro de una categoría. */
export function filtrarReferencias(options: RefOption[], query: string, type?: RefType | null) {
  const q = query.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const base = type ? options.filter(o => o.type === type) : options;
  if (!q) return base;
  return base.filter(o => `${o.label} ${o.hint ?? ""} ${o.group}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q));
}

/** Enlace de destino de una referencia dentro de la ficha del proyecto (el chat no te saca de ella). */
export function destinoRef(ref: Ref, data: Workspace, projectId: string): { href: string } | { task: string } | { document: string } {
  if (ref.type === "t") return { task: ref.id };
  if (ref.type === "d") return { document: ref.id };
  if (ref.type === "v") { const v = data.versions.find(x => x.id === ref.id); return { href: `/proyectos/${projectId}?s=budget${v ? `&p=${v.budget_id}` : ""}` }; }
  if (ref.type === "c") return { href: `/proyectos/${projectId}?s=purchases` };
  if (ref.type === "k") return { href: `/clientes?q=${encodeURIComponent(ref.label)}` };
  return { href: `/proyectos/${ref.id}` };
}
