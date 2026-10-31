import type { Workspace } from "./domain";
import { normalize } from "./search";

/**
 * Consultas del chat del proyecto. Se abren desde los accesos rápidos bajo la conversación, escribiendo «/»
 * (/presupuesto) o la frase tal cual («ver último presupuesto»). Cada consulta abre una vista encima del chat
 * con lo mismo que se vería yendo a la ficha; al cerrarla se sigue en la conversación. El diccionario crece aquí.
 */

export type VistaChat =
  | { kind: "presupuesto"; versionId: string }
  | { kind: "versiones" }
  | { kind: "pdf"; versionId: string }
  | { kind: "tareas" }
  | { kind: "compras" }
  | { kind: "documentos" }
  | { kind: "cliente" }
  | { kind: "estado" }
  | { kind: "buscar"; query: string }
  | { kind: "ayuda" }
  | { kind: "aviso"; texto: string };

export type Comando = {
  id: string;
  /** Primera forma es la canónica con «/», el resto son frases o alias que se entienden tal cual. */
  formas: string[];
  /** Etiqueta corta para el acceso rápido bajo el chat; sin ella no aparece como acceso. */
  acceso?: string;
  descripcion: string;
  ejemplo?: string;
  conArgumento?: boolean;
  abrir: (ctx: { data: Workspace; projectId: string; argumento: string }) => VistaChat;
};

const sinArg = (s: string) => normalize(s);

function versiones(data: Workspace, projectId: string) {
  const budgets = data.budgets.filter(b => b.project_id === projectId);
  return data.versions.filter(v => budgets.some(b => b.id === v.budget_id)).map(v => ({ v, b: budgets.find(b => b.id === v.budget_id)! })).sort((a, z) => z.v.updated_at.localeCompare(a.v.updated_at));
}

export const comandos: Comando[] = [
  {
    id: "presupuesto", acceso: "Presupuesto", formas: ["/presupuesto", "ver ultimo presupuesto", "ultimo presupuesto", "ver presupuesto", "presupuesto", "detalles del presupuesto", "ver el ultimo presupuesto"],
    descripcion: "El último presupuesto con sus partidas e importes.",
    abrir: ({ data, projectId }) => { const [ultima] = versiones(data, projectId); return ultima ? { kind: "presupuesto", versionId: ultima.v.id } : { kind: "versiones" }; }
  },
  {
    id: "aprobado", formas: ["/aprobado", "presupuesto aprobado", "ver aprobado", "que esta aprobado", "aprobado"],
    descripcion: "El presupuesto aceptado, si lo hay.",
    abrir: ({ data, projectId }) => { const x = versiones(data, projectId).find(x => x.b.approved_version_id === x.v.id); return x ? { kind: "presupuesto", versionId: x.v.id } : { kind: "aviso", texto: "Todavía no hay ningún presupuesto aprobado para obra." }; }
  },
  {
    id: "versiones", formas: ["/versiones", "versiones", "historial del presupuesto", "todas las revisiones"],
    descripcion: "Todas las revisiones del presupuesto con su estado.",
    abrir: () => ({ kind: "versiones" })
  },
  {
    id: "pdf", formas: ["/pdf", "pdf del presupuesto", "imprimir presupuesto", "generar pdf", "ver pdf"],
    descripcion: "El documento del último presupuesto tal como lo verá el cliente.",
    abrir: ({ data, projectId }) => { const x = versiones(data, projectId).find(x => x.v.items.length > 0); return x ? { kind: "pdf", versionId: x.v.id } : { kind: "aviso", texto: "Añade partidas al presupuesto antes de generar el documento." }; }
  },
  {
    id: "tareas", acceso: "Tareas", formas: ["/tareas", "tareas pendientes", "que falta", "que queda", "pendientes", "ver tareas", "tareas"],
    descripcion: "Las tareas del proyecto; se pueden marcar hechas desde aquí.",
    abrir: () => ({ kind: "tareas" })
  },
  {
    id: "compras", acceso: "Materiales", formas: ["/compras", "compras", "compras pendientes", "materiales", "que falta por pedir", "pedidos"],
    descripcion: "Los materiales: por pedir, pedidos y recibidos.",
    abrir: () => ({ kind: "compras" })
  },
  {
    id: "documentos", acceso: "Documentos", formas: ["/documentos", "ultimos documentos", "documentos", "planos", "fotos"],
    descripcion: "Los documentos y fotos del proyecto.",
    abrir: () => ({ kind: "documentos" })
  },
  {
    id: "cliente", acceso: "Cliente", formas: ["/cliente", "cliente", "datos del cliente", "quien es el cliente"],
    descripcion: "El cliente de este proyecto y sus otros proyectos.",
    abrir: () => ({ kind: "cliente" })
  },
  {
    id: "estado", acceso: "Cómo va", formas: ["/estado", "estado del proyecto", "como va", "resumen", "como vamos", "estado"],
    descripcion: "Resumen del proyecto: fase, siguiente paso, avance e importes.",
    abrir: () => ({ kind: "estado" })
  },
  {
    id: "buscar", formas: ["/buscar", "buscar"], conArgumento: true, ejemplo: "/buscar pavimento",
    descripcion: "Busca un texto en esta conversación.",
    abrir: ({ argumento }) => (argumento ? { kind: "buscar", query: argumento } : { kind: "aviso", texto: "Escribe /buscar y lo que quieras encontrar, o pulsa la lupa." })
  },
  {
    id: "ayuda", formas: ["/ayuda", "ayuda", "atajos", "/?", "que puedo hacer"],
    descripcion: "Cómo se usa el chat.",
    abrir: () => ({ kind: "ayuda" })
  }
];

/** Los accesos rápidos bajo la conversación, en el orden del diccionario. */
export const accesosRapidos = comandos.filter(c => c.acceso);

/** Si el texto es un atajo («/presupuesto», «ver último presupuesto», «/buscar tarima»), lo devuelve con su argumento. */
export function interpretar(texto: string): { comando: Comando; argumento: string } | null {
  const t = sinArg(texto);
  if (!t) return null;
  for (const c of comandos) {
    for (const forma of c.formas) {
      const f = sinArg(forma);
      if (t === f) return { comando: c, argumento: "" };
      if (c.conArgumento && t.startsWith(`${f} `)) return { comando: c, argumento: texto.trim().slice(forma.length).trim() };
    }
  }
  return null;
}

/** Sugerencias mientras se escribe: con «/» todas las que empiecen igual; con texto, las frases que lo contengan. */
export function sugerir(texto: string, limite = 6): Comando[] {
  const t = sinArg(texto);
  if (!t) return comandos.slice(0, limite);
  const porBarra = texto.trim().startsWith("/");
  if (porBarra) { const q = texto.trim().toLowerCase().split(" ")[0]; return comandos.filter(c => c.formas.some(f => f.startsWith("/") && f.toLowerCase().startsWith(q))).slice(0, limite); }
  return comandos.filter(c => c.formas.some(f => { const n = sinArg(f); return n.includes(t) || t.includes(n); })).slice(0, limite);
}
