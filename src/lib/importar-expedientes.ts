import { z } from "zod";
import { itemSchema, type Workspace, type Command, type Document, type BudgetItem } from "./domain";

/**
 * Importación de expedientes (proyectos, presupuestos y documentos) desde un paquete JSON preparado fuera de la app
 * más la carpeta con los archivos. Todo entra por los comandos del dominio, como si lo tecleara una persona:
 * nada toca la base de datos por detrás. Pensado para cargar los expedientes reales de GARAL en producción.
 */

const texto = (max: number) => z.string().trim().min(1).max(max);
export const paqueteSchema = z.object({
  schema_version: z.literal(1),
  origen: z.string().max(200),
  generado: z.string().max(40).optional(),
  proyectos: z.array(z.object({
    name: texto(500), client_name: texto(500), location: z.string().trim().max(500).default(""),
    kind: z.enum(["integral", "partial", "carpentry"]), carpeta: z.string().max(300).optional(),
    presupuestos: z.array(z.object({
      title: texto(120), source: z.string().max(400).optional(),
      items: z.array(itemSchema.omit({ id: true })).max(500),
      notes: z.string().max(5000).default("")
    })).max(100),
    documentos: z.array(z.object({
      path: texto(500), name: texto(300),
      category: z.enum(["plan", "contract", "technical", "before", "during", "after", "other"]),
      mime: z.string().max(100), size: z.number().int().min(0)
    })).max(500),
    omitidos: z.array(z.string().max(300)).default([])
  })).min(1).max(500)
});
export type Paquete = z.infer<typeof paqueteSchema>;
export type ProyectoPaquete = Paquete["proyectos"][number];

/** Lee y valida el paquete; devuelve un mensaje en llano si no vale. */
export function leerPaquete(raw: unknown): { paquete: Paquete } | { error: string } {
  const r = paqueteSchema.safeParse(raw);
  if (r.success) return { paquete: r.data };
  const i = r.error.issues[0];
  return { error: `El paquete no tiene el formato esperado (${i.path.join(".") || "raíz"}: ${i.message}).` };
}

export type Plan = { proyecto: ProyectoPaquete; estado: "nuevo" | "existe"; existenteId?: string; archivosEncontrados: number; archivosFaltan: string[] };
/** Qué pasará con cada proyecto del paquete: los que ya existen (mismo nombre y cliente) se dejan como están. `disponibles` son claves de `claveArchivo`. */
export function planificar(paquete: Paquete, data: Workspace, disponibles: Set<string>): Plan[] {
  return paquete.proyectos.map(proyecto => {
    const existente = data.projects.find(p => p.name === proyecto.name && p.client_name === proyecto.client_name);
    const faltan = proyecto.documentos.filter(d => !disponibles.has(claveArchivo(d.path))).map(d => d.name);
    return { proyecto, estado: existente ? "existe" : "nuevo", existenteId: existente?.id, archivosEncontrados: proyecto.documentos.length - faltan.length, archivosFaltan: faltan };
  });
}
export function resumen(plan: Plan[]) {
  const nuevos = plan.filter(p => p.estado === "nuevo");
  return {
    nuevos: nuevos.length, existentes: plan.length - nuevos.length,
    presupuestos: nuevos.reduce((s, p) => s + p.proyecto.presupuestos.length, 0),
    partidas: nuevos.reduce((s, p) => s + p.proyecto.presupuestos.reduce((t, b) => t + b.items.length, 0), 0),
    documentos: nuevos.reduce((s, p) => s + p.archivosEncontrados, 0),
    faltan: nuevos.reduce((s, p) => s + p.archivosFaltan.length, 0)
  };
}

/**
 * Clave con la que se casan los archivos del paquete y los de la carpeta elegida: carpeta del expediente + nombre
 * de archivo, en minúsculas. Así da igual desde qué nivel se elija la carpeta (HUGO, archivos, Descargas…).
 */
export function claveArchivo(ruta: string): string {
  // macOS guarda los nombres con acentos descompuestos (NFD); el paquete los trae compuestos (NFC). Se igualan.
  const partes = ruta.normalize("NFC").split("/").filter(Boolean);
  return partes.slice(-2).join("/").toLowerCase();
}
/** Compatibilidad: ruta sin la carpeta elegida ni «archivos». */
export function rutaPaquete(rutaRelativa: string): string {
  const partes = rutaRelativa.split("/").filter(Boolean);
  const i = partes.indexOf("archivos");
  return (i >= 0 ? partes.slice(i + 1) : partes.slice(1)).join("/");
}

export type Deps = {
  data: Workspace;
  send: (command: Command) => Promise<Workspace>;
  upload: (file: File, projectId: string, category: Document["category"]) => Promise<void>;
  /** Archivos de la carpeta elegida, indexados por `claveArchivo`. */
  archivos: Map<string, File>;
  uuid?: () => string;
  onProgreso?: (mensaje: string) => void;
};
export type Resultado = { proyectos: number; presupuestos: number; documentos: number; omitidos: string[]; errores: string[] };

/** Ejecuta el plan en orden: proyecto → sus presupuestos (V1 en borrador) → sus documentos. Sigue aunque algo falle y lo anota. */
export async function ejecutar(plan: Plan[], deps: Deps): Promise<Resultado> {
  const uuid = deps.uuid ?? (() => crypto.randomUUID());
  const r: Resultado = { proyectos: 0, presupuestos: 0, documentos: 0, omitidos: [], errores: [] };
  let ws = deps.data;
  const log = (m: string) => deps.onProgreso?.(m);
  for (const p of plan) {
    const { proyecto } = p;
    if (p.estado === "existe") { r.omitidos.push(`${proyecto.name}: ya existía, no se ha tocado.`); continue; }
    try {
      log(`Creando ${proyecto.name}…`);
      ws = await deps.send({ type: "project.create", name: proyecto.name, client_name: proyecto.client_name, location: proyecto.location, kind: proyecto.kind });
      const creado = ws.projects.filter(x => x.name === proyecto.name && x.client_name === proyecto.client_name).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (!creado) throw new Error("no se ha podido localizar el proyecto recién creado");
      r.proyectos++;
      for (const b of proyecto.presupuestos) {
        try {
          log(`${proyecto.name} · presupuesto «${b.title}»…`);
          ws = await deps.send({ type: "budget.create", project_id: creado.id, title: b.title });
          const budget = ws.budgets.filter(x => x.project_id === creado.id).sort((a, c) => c.created_at.localeCompare(a.created_at))[0];
          const version = budget ? ws.versions.find(v => v.budget_id === budget.id && v.status === "draft") : undefined;
          if (!version) throw new Error("no se ha abierto la V1");
          const items: BudgetItem[] = b.items.map(i => ({ ...i, id: uuid() }));
          ws = await deps.send({ type: "budget.save", version_id: version.id, expected_revision: version.draft_revision, items, notes: b.notes });
          r.presupuestos++;
        } catch (e) { r.errores.push(`${proyecto.name} · «${b.title}»: ${e instanceof Error ? e.message : "error"}`); }
      }
      for (const d of proyecto.documentos) {
        const file = deps.archivos.get(claveArchivo(d.path));
        if (!file) { r.omitidos.push(`${proyecto.name} · ${d.name}: no está en la carpeta elegida.`); continue; }
        try { log(`${proyecto.name} · subiendo ${d.name}…`); await deps.upload(file, creado.id, d.category); r.documentos++; }
        catch (e) { r.errores.push(`${proyecto.name} · ${d.name}: ${e instanceof Error ? e.message : "no se ha podido subir"}`); }
      }
      for (const o of proyecto.omitidos) r.omitidos.push(`${proyecto.name} · ${o}: fuera del límite de 50 MB, no se importa.`);
      if (proyecto.presupuestos.some(b => b.items.length) && creado.status === "lead") { try { ws = await deps.send({ type: "project.status", id: creado.id, status: "estimating" }); } catch { /* el estado es secundario */ } }
    } catch (e) { r.errores.push(`${proyecto.name}: ${e instanceof Error ? e.message : "error"}`); }
  }
  return r;
}
