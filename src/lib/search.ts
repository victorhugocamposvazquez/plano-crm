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
    { label: "obra", text: `${project.code} ${project.name}` },
    { label: "dirección", text: project.location },
    { label: "cliente", text: project.client_name },
    { label: "tipo", text: kindNames[project.kind] },
    { label: "fase", text: projectStatus[project.status] },
    { label: "partidas", text: items.join(" ") },
    { label: "proveedores", text: data.purchases.filter(p => p.project_id === project.id).map(p => `${p.name} ${p.supplier}`).join(" ") },
    { label: "documentos", text: data.documents.filter(d => d.project_id === project.id).map(d => d.name).join(" ") },
    { label: "tareas", text: data.tasks.filter(t => t.project_id === project.id).map(t => `${t.title} ${t.trade} ${t.assignee}`).join(" ") },
    { label: "chat", text: data.messages.filter(m => m.project_id === project.id).map(m => `${m.author_name} ${m.body}`).join(" ") }
  ].filter(f => f.text.trim());
}

export type SearchHit = { project: Project; matchedIn: string[] };

/**
 * Cada palabra de la consulta debe aparecer en algún campo de la obra (en cualquier orden).
 * Devuelve en qué campos ha coincidido para explicárselo a quien busca.
 */
export function searchProjects(data: Workspace, projects: Project[], query: string): SearchHit[] {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (!terms.length) return projects.map(project => ({ project, matchedIn: [] }));
  return projects.flatMap(project => {
    const fields = projectFields(data, project).map(f => ({ ...f, norm: normalize(f.text) }));
    const matched = new Set<string>();
    for (const term of terms) {
      const hits = fields.filter(f => f.norm.includes(term));
      if (!hits.length) return [];
      hits.forEach(h => matched.add(h.label));
    }
    return [{ project, matchedIn: [...matched] }];
  });
}
