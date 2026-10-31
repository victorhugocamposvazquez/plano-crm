import { coincidePalabra, leerConsulta, normalizar } from "./busqueda";
import { kindNames, projectStatus, type Project, type Workspace } from "./domain";

/** Normaliza para buscar: minúsculas, sin acentos ni signos. «C/ Mayor» y «calle mayor» coinciden. */
export function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(c\/|calle|avda\.?|avenida|pza\.?|plaza|n\.?º|num\.?)\b/g, " ").replace(/[^a-z0-9ñ€%,.-]+/g, " ").trim();
}

export type SearchField = { label: string; text: string };

/** Todo lo que identifica una obra para una persona de administración: dónde, de quién, qué se hace y con quién. */
export function projectFields(data: Workspace, project: Project): SearchField[] {
  const budgetIds = data.budgets.filter(b => b.project_id === project.id).map(b => b.id);
  const versions = data.versions.filter(v => budgetIds.includes(v.budget_id));
  const items = [...new Set(versions.flatMap(v => v.items.map(i => `${i.chapter} ${i.description}`)))];
  return [
    { label: "proyecto", text: `${project.code} ${project.name}` },
    { label: "dirección", text: project.location },
    { label: "cliente", text: project.client_name },
    { label: "tipo", text: kindNames[project.kind] },
    { label: "fase", text: projectStatus[project.status] },
    { label: "partidas", text: items.join(" ") },
    { label: "proveedores", text: data.purchases.filter(p => p.project_id === project.id).map(p => `${p.name} ${p.supplier}`).join(" ") },
    { label: "documentos", text: data.documents.filter(d => d.project_id === project.id).map(d => d.name).join(" ") },
    { label: "tareas", text: data.tasks.filter(t => t.project_id === project.id).map(t => `${t.title} ${t.trade} ${t.assignee}`).join(" ") },
    { label: "chat", text: data.messages.filter(m => m.project_id === project.id && !m.deleted_at).map(m => `${m.author_name} ${m.body}`).join(" ") }
  ].filter(f => f.text.trim());
}

export type SearchHit = { project: Project; matchedIn: string[] };

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * Un término coincide si empieza una palabra del campo («05» encuentra «cliente 05», no «PL-005»;
 * «cli» encuentra «cliente»). Así «cliente 05» no arrastra proyectos cuyo código contiene «05».
 */
export function matchesTerm(normalizedField: string, term: string) {
  return new RegExp(`(^|[\\s-])${escapeRegExp(term)}`).test(normalizedField);
}

/**
 * Cada palabra de la consulta debe empezar alguna palabra de algún campo de la obra (en cualquier orden).
 * Devuelve en qué campos ha coincidido para explicárselo a quien busca.
 */
export function searchProjects(data: Workspace, projects: Project[], query: string): SearchHit[] {
  const terms = leerConsulta(normalize(query)).terminos;
  if (!terms.length) return projects.map(project => ({ project, matchedIn: [] }));
  return projects.flatMap(project => {
    const fields = projectFields(data, project).map(f => ({ ...f, norm: normalize(f.text), words: normalizar(normalize(f.text)).split(/[^a-z0-9ñ]+/).filter(Boolean) }));
    const matched = new Set<string>();
    for (const term of terms) {
      const hits = fields.filter(f => matchesTerm(f.norm, term) || f.words.some(w => coincidePalabra(term, w)));
      if (!hits.length) return [];
      hits.forEach(h => matched.add(h.label));
    }
    return [{ project, matchedIn: [...matched] }];
  });
}
