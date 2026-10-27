import { money, type Workspace } from "./domain";
import { normalize, searchProjects } from "./search";
import { categoryNames } from "./documentos";

/**
 * Buscador global (⌘K): proyectos, clientes, presupuestos, documentos, artículos y acciones,
 * con la misma tolerancia a acentos y orden de palabras que el buscador de proyectos.
 */

export type Resultado = { id: string; grupo: "Acciones" | "Proyectos" | "Clientes" | "Presupuestos" | "Documentos" | "Artículos" | "Pantallas"; titulo: string; detalle?: string; href: string };

const acciones: Resultado[] = [
  { id: "a-proyecto", grupo: "Acciones", titulo: "Nuevo proyecto", detalle: "Alta desde oficina", href: "/proyectos?nuevo=1" },
  { id: "a-visita", grupo: "Acciones", titulo: "Estimar en la visita", detalle: "Fotos, alcance y partidas a pie de obra", href: "/proyectos/nueva" },
  { id: "a-tarea", grupo: "Acciones", titulo: "Nueva tarea", detalle: "Agenda de oficios", href: "/agenda?nueva=1" },
  { id: "a-importar", grupo: "Acciones", titulo: "Importar catálogo", detalle: "Desde Excel o CSV", href: "/catalogo?importar=1" },
  { id: "a-identidad", grupo: "Acciones", titulo: "Identidad de la empresa", detalle: "Logo, colores y portada", href: "/configuracion/identidad" }
];

const pantallas: Resultado[] = [
  ["Hoy", "/"], ["Proyectos", "/proyectos"], ["Agenda", "/agenda"], ["Presupuestos", "/presupuestos"], ["Catálogo", "/catalogo"], ["Clientes", "/clientes"], ["Compras", "/compras"], ["Documentos", "/documentos"], ["Finanzas", "/finanzas"]
].map(([titulo, href]) => ({ id: `p-${href}`, grupo: "Pantallas" as const, titulo, href }));

const coincide = (texto: string, terms: string[]) => { const n = normalize(texto); return terms.every(t => n.includes(t)); };

export function buscarGlobal(data: Workspace, query: string, limite = 6): Resultado[] {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (!terms.length) return [...acciones.slice(0, 3), ...pantallas.slice(0, 4)];
  const out: Resultado[] = [];

  for (const hit of searchProjects(data, data.projects, query).slice(0, limite)) {
    out.push({ id: `pr-${hit.project.id}`, grupo: "Proyectos", titulo: hit.project.name, detalle: [hit.project.code, hit.project.client_name, hit.project.location, hit.matchedIn.length ? `coincide en ${hit.matchedIn.join(", ")}` : ""].filter(Boolean).join(" · "), href: `/proyectos/${hit.project.id}` });
  }

  const clientes = [...new Set(data.projects.map(p => p.client_name))].filter(c => coincide(c, terms)).slice(0, limite);
  for (const c of clientes) out.push({ id: `cl-${c}`, grupo: "Clientes", titulo: c, detalle: `${data.projects.filter(p => p.client_name === c).length} proyecto(s)`, href: `/clientes?q=${encodeURIComponent(c)}` });

  for (const b of data.budgets) {
    const p = data.projects.find(x => x.id === b.project_id); if (!p) continue;
    const v = data.versions.filter(x => x.budget_id === b.id).sort((a, z) => z.number - a.number)[0];
    if (!coincide(`${b.title} ${p.name} V${v?.number ?? ""} presupuesto`, terms)) continue;
    out.push({ id: `bu-${b.id}`, grupo: "Presupuestos", titulo: `${b.title} · ${p.name}`, detalle: v ? `V${v.number} · ${money(v.items.reduce((s, i) => s + (i.inclusion === "included" ? i.quantity * i.unit_price : 0), 0))} aprox.` : "", href: `/proyectos/${p.id}?s=budget&p=${b.id}` });
    if (out.filter(r => r.grupo === "Presupuestos").length >= limite) break;
  }

  for (const d of data.documents) {
    const p = data.projects.find(x => x.id === d.project_id); if (!p) continue;
    if (!coincide(`${d.name} ${categoryNames[d.category]} ${p.name}`, terms)) continue;
    out.push({ id: `do-${d.id}`, grupo: "Documentos", titulo: d.name, detalle: `${categoryNames[d.category]} · ${p.name}`, href: `/proyectos/${p.id}?s=documents` });
    if (out.filter(r => r.grupo === "Documentos").length >= limite) break;
  }

  for (const a of data.articles) {
    if (!coincide(`${a.code} ${a.name} ${a.chapter}`, terms)) continue;
    out.push({ id: `ar-${a.id}`, grupo: "Artículos", titulo: a.name, detalle: `${a.chapter} · ${a.code} · ${money(a.unit_price)}/${a.unit}`, href: `/catalogo?q=${encodeURIComponent(a.code)}` });
    if (out.filter(r => r.grupo === "Artículos").length >= limite) break;
  }

  for (const r of [...acciones, ...pantallas]) if (coincide(`${r.titulo} ${r.detalle ?? ""}`, terms)) out.push(r);
  return out;
}

export function agruparResultados(resultados: Resultado[]) {
  const orden: Resultado["grupo"][] = ["Proyectos", "Clientes", "Presupuestos", "Documentos", "Artículos", "Acciones", "Pantallas"];
  return orden.map(grupo => ({ grupo, items: resultados.filter(r => r.grupo === grupo) })).filter(g => g.items.length);
}
