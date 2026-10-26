import type { Document, Project } from "./domain";

export type Category = Document["category"];

export const categoryNames: Record<Category, string> = {
  plan: "Planos", contract: "Contratos y presupuestos firmados", technical: "Documentación técnica",
  before: "Fotos de antes", during: "Fotos durante la obra", after: "Fotos de entrega", other: "Otros"
};

export const categoryOrder: Category[] = ["plan", "contract", "technical", "before", "during", "after", "other"];

/** Tipos admitidos por el backend de Codex (docs/backend.md): PDF, JPG, PNG, WebP y MP4, hasta 50 MiB. */
export const acceptedTypes = "application/pdf,image/jpeg,image/png,image/webp,video/mp4";
export const maxBytes = 50 * 1024 * 1024;

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}

export function isImage(doc: Pick<Document, "mime_type">) { return doc.mime_type.startsWith("image/"); }
export function isVideo(doc: Pick<Document, "mime_type">) { return doc.mime_type.startsWith("video/"); }

/**
 * Plantilla del expediente: qué documentación debería existir según el tipo de proyecto.
 * Es una lista de comprobación, no una validación: un archivo subido no equivale a documentación aprobada.
 */
export function requiredCategories(kind: Project["kind"]): Category[] {
  if (kind === "carpentry") return ["technical", "contract", "before", "after"];
  if (kind === "partial") return ["contract", "before", "after"];
  return ["plan", "contract", "technical", "before", "after"];
}

export type ChecklistRow = { category: Category; label: string; count: number; state: "pending" | "attached" };

export function checklist(kind: Project["kind"], documents: Document[]): ChecklistRow[] {
  return requiredCategories(kind).map(category => {
    const count = documents.filter(d => d.category === category).length;
    return { category, label: categoryNames[category], count, state: count ? "attached" : "pending" };
  });
}

export function groupByCategory(documents: Document[]) {
  const groups = new Map<Category, Document[]>();
  for (const category of categoryOrder) {
    const list = documents.filter(d => d.category === category).sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (list.length) groups.set(category, list);
  }
  return groups;
}
