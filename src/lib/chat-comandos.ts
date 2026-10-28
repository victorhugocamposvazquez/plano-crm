import { money, totals, dateLabel, versionStatus, type Workspace } from "./domain";
import { normalize } from "./search";

/**
 * Atajos del chat del proyecto. Se escriben con «/» (/presupuesto) o como frase tal cual
 * («ver último presupuesto»). Cada atajo devuelve una respuesta local (no se guarda como mensaje)
 * con datos del proyecto y acciones a un clic. El diccionario crece aquí; la interfaz lo pinta igual para todos.
 */

export type AccionRespuesta =
  | { kind: "href"; label: string; href: string; nueva?: boolean }
  | { kind: "tarea"; label: string; taskId: string }
  | { kind: "documento"; label: string; documentId: string }
  | { kind: "buscar"; label: string; query: string }
  | { kind: "ayuda"; label: string }
  | { kind: "presupuesto"; label: string; versionId: string };

export type Respuesta = { titulo: string; lineas: string[]; acciones: AccionRespuesta[] };

export type Comando = {
  id: string;
  /** Primera forma es la canónica con «/», el resto son frases o alias que se entienden tal cual. */
  formas: string[];
  descripcion: string;
  ejemplo?: string;
  conArgumento?: boolean;
  ejecutar: (ctx: { data: Workspace; projectId: string; argumento: string }) => Respuesta;
};

const sinArg = (s: string) => normalize(s);

function proyecto(data: Workspace, projectId: string) { return data.projects.find(p => p.id === projectId); }
function versiones(data: Workspace, projectId: string) {
  const budgets = data.budgets.filter(b => b.project_id === projectId);
  return data.versions.filter(v => budgets.some(b => b.id === v.budget_id)).map(v => ({ v, b: budgets.find(b => b.id === v.budget_id)! })).sort((a, z) => z.v.updated_at.localeCompare(a.v.updated_at));
}
const resumenVersion = (data: Workspace, projectId: string, x: ReturnType<typeof versiones>[number]) => {
  const t = totals(x.v.items);
  const aprobada = x.b.approved_version_id === x.v.id;
  return {
    titulo: `V${x.v.number} · ${x.b.title}`,
    lineas: [
      `${aprobada ? "Aprobada para obra" : versionStatus[x.v.status]} · ${dateLabel(x.v.updated_at)} · ${x.v.created_by_name}`,
      `${x.v.items.filter(i => i.inclusion === "included").length} partidas incluidas · base ${money(t.base)} · total ${money(t.total)} con IVA`,
      x.v.change_reason ? `Motivo: ${x.v.change_reason}` : ""
    ].filter(Boolean),
    acciones: [
      { kind: "presupuesto", label: "Ver partidas", versionId: x.v.id },
      ...(x.v.items.length ? [{ kind: "href", label: "PDF", href: `/imprimir/presupuesto/${x.v.id}`, nueva: true } as AccionRespuesta] : [])
    ] as AccionRespuesta[]
  };
};

export const comandos: Comando[] = [
  {
    id: "presupuesto", formas: ["/presupuesto", "ver ultimo presupuesto", "ultimo presupuesto", "ver presupuesto", "presupuesto", "detalles del presupuesto", "ver el ultimo presupuesto"],
    descripcion: "La última revisión del presupuesto: estado, importes y acceso directo.",
    ejecutar: ({ data, projectId }) => {
      const [ultima] = versiones(data, projectId);
      if (!ultima) return { titulo: "Sin presupuesto", lineas: ["Este proyecto todavía no tiene ninguna revisión."], acciones: [{ kind: "href", label: "Abrir presupuesto", href: `/proyectos/${projectId}?s=budget` }] };
      return resumenVersion(data, projectId, ultima);
    }
  },
  {
    id: "aprobado", formas: ["/aprobado", "presupuesto aprobado", "ver aprobado", "que esta aprobado", "aprobado"],
    descripcion: "La revisión aprobada para obra, si la hay.",
    ejecutar: ({ data, projectId }) => {
      const x = versiones(data, projectId).find(x => x.b.approved_version_id === x.v.id);
      if (!x) return { titulo: "Nada aprobado todavía", lineas: ["Ninguna revisión está aprobada para obra."], acciones: [{ kind: "href", label: "Ver presupuestos", href: `/proyectos/${projectId}?s=budget` }] };
      return resumenVersion(data, projectId, x);
    }
  },
  {
    id: "versiones", formas: ["/versiones", "versiones", "historial del presupuesto", "todas las revisiones"],
    descripcion: "Todas las revisiones del presupuesto con su estado.",
    ejecutar: ({ data, projectId }) => {
      const lista = versiones(data, projectId);
      return { titulo: `${lista.length} revisiones`, lineas: lista.map(x => `V${x.v.number} · ${x.b.title} · ${x.b.approved_version_id === x.v.id ? "aprobada" : versionStatus[x.v.status].toLowerCase()} · ${money(totals(x.v.items).base)} base`), acciones: lista.slice(0, 4).map(x => ({ kind: "presupuesto", label: `V${x.v.number}`, versionId: x.v.id }) as AccionRespuesta) };
    }
  },
  {
    id: "pdf", formas: ["/pdf", "pdf del presupuesto", "imprimir presupuesto", "generar pdf"],
    descripcion: "Abre el PDF de la última revisión con partidas.",
    ejecutar: ({ data, projectId }) => {
      const x = versiones(data, projectId).find(x => x.v.items.length > 0);
      if (!x) return { titulo: "Sin partidas que imprimir", lineas: ["Añade partidas al presupuesto antes de generar el PDF."], acciones: [] };
      return { titulo: `PDF de la V${x.v.number}`, lineas: [`${x.b.title} · ${money(totals(x.v.items).total)} con IVA`], acciones: [{ kind: "href", label: "Abrir PDF", href: `/imprimir/presupuesto/${x.v.id}`, nueva: true }] };
    }
  },
  {
    id: "tareas", formas: ["/tareas", "tareas pendientes", "que falta", "que queda", "pendientes", "ver tareas"],
    descripcion: "Las tareas pendientes, la más urgente primero.",
    ejecutar: ({ data, projectId }) => {
      const hoy = new Date().toISOString().slice(0, 10);
      const pendientes = data.tasks.filter(t => t.project_id === projectId && t.status === "pending").sort((a, b) => a.due_date.localeCompare(b.due_date));
      if (!pendientes.length) return { titulo: "Sin tareas pendientes", lineas: ["Todo lo planificado está hecho."], acciones: [{ kind: "href", label: "Ver agenda", href: "/agenda" }] };
      return { titulo: `${pendientes.length} tareas pendientes`, lineas: pendientes.slice(0, 6).map(t => `${t.due_date < hoy ? "⚠ " : ""}${dateLabel(t.due_date)} · ${t.title} · ${t.trade}${t.assignee ? ` · ${t.assignee}` : ""}`), acciones: pendientes.slice(0, 3).map(t => ({ kind: "tarea", label: t.title.length > 28 ? `${t.title.slice(0, 26)}…` : t.title, taskId: t.id }) as AccionRespuesta) };
    }
  },
  {
    id: "compras", formas: ["/compras", "compras pendientes", "materiales", "que falta por pedir", "pedidos"],
    descripcion: "Materiales por pedir y pedidos sin recibir.",
    ejecutar: ({ data, projectId }) => {
      const lista = data.purchases.filter(p => p.project_id === projectId && (p.status === "planned" || p.status === "ordered"));
      if (!lista.length) return { titulo: "Nada pendiente de compra", lineas: ["Todo el material está recibido o en obra."], acciones: [{ kind: "href", label: "Ver compras", href: `/proyectos/${projectId}?s=purchases` }] };
      return { titulo: `${lista.length} pendientes de compra`, lineas: lista.map(p => `${p.status === "planned" ? "Por pedir" : "Pedido, sin recibir"} · ${p.name} · ${p.quantity} ${p.unit} · ${p.supplier}`), acciones: [{ kind: "href", label: "Ver compras", href: `/proyectos/${projectId}?s=purchases` }] };
    }
  },
  {
    id: "documentos", formas: ["/documentos", "ultimos documentos", "documentos", "planos", "fotos"],
    descripcion: "Los últimos documentos y fotos del proyecto.",
    ejecutar: ({ data, projectId }) => {
      const docs = data.documents.filter(d => d.project_id === projectId).sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (!docs.length) return { titulo: "Sin documentos", lineas: ["Todavía no hay nada adjunto en este proyecto."], acciones: [{ kind: "href", label: "Ir a Documentos", href: `/proyectos/${projectId}?s=documents` }] };
      return { titulo: `${docs.length} documentos`, lineas: docs.slice(0, 5).map(d => `${dateLabel(d.created_at)} · ${d.name}`), acciones: docs.slice(0, 3).map(d => ({ kind: "documento", label: d.name.length > 24 ? `${d.name.slice(0, 22)}…` : d.name, documentId: d.id }) as AccionRespuesta) };
    }
  },
  {
    id: "cliente", formas: ["/cliente", "cliente", "datos del cliente", "quien es el cliente"],
    descripcion: "El cliente de este proyecto y sus otros proyectos.",
    ejecutar: ({ data, projectId }) => {
      const p = proyecto(data, projectId); if (!p) return { titulo: "Proyecto no encontrado", lineas: [], acciones: [] };
      const otros = data.projects.filter(x => x.client_name === p.client_name && x.id !== projectId);
      return { titulo: p.client_name, lineas: [p.location ? `Obra en ${p.location}` : "", otros.length ? `Otros proyectos: ${otros.map(o => o.name).join(", ")}` : "Es su único proyecto con nosotros."].filter(Boolean), acciones: [{ kind: "href", label: "Ver cliente", href: `/clientes?q=${encodeURIComponent(p.client_name)}` }] };
    }
  },
  {
    id: "estado", formas: ["/estado", "estado del proyecto", "como va", "resumen", "como vamos"],
    descripcion: "Resumen del proyecto: fase, avance, aprobado y en revisión.",
    ejecutar: ({ data, projectId }) => {
      const p = proyecto(data, projectId); if (!p) return { titulo: "Proyecto no encontrado", lineas: [], acciones: [] };
      const tasks = data.tasks.filter(t => t.project_id === projectId); const hechas = tasks.filter(t => t.status === "done").length;
      const lista = versiones(data, projectId); const aprobada = lista.find(x => x.b.approved_version_id === x.v.id); const enCurso = lista.find(x => x.v.status === "draft" || x.v.status === "issued");
      return { titulo: `${p.name} · ${p.code}`, lineas: [`${hechas} de ${tasks.length} tareas hechas`, aprobada ? `Aprobado: V${aprobada.v.number} · ${money(totals(aprobada.v.items).base)} base` : "Nada aprobado todavía", enCurso ? `En revisión: V${enCurso.v.number} · ${money(totals(enCurso.v.items).base)} base` : ""].filter(Boolean), acciones: [{ kind: "href", label: "Abrir ficha", href: `/proyectos/${projectId}` }] };
    }
  },
  {
    id: "buscar", formas: ["/buscar", "buscar"], conArgumento: true, ejemplo: "/buscar pavimento",
    descripcion: "Busca un texto en esta conversación.",
    ejecutar: ({ argumento }) => ({ titulo: argumento ? `Buscar «${argumento}»` : "Buscar en el chat", lineas: argumento ? [] : ["Escribe /buscar y lo que quieras encontrar."], acciones: argumento ? [{ kind: "buscar", label: "Ver coincidencias", query: argumento }] : [] })
  },
  {
    id: "ayuda", formas: ["/ayuda", "ayuda", "atajos", "/?", "que puedo hacer"],
    descripcion: "Esta lista de atajos.",
    ejecutar: () => ({ titulo: "Atajos del chat", lineas: ["Escribe / para ver los atajos, # para enlazar algo del proyecto, o pulsa el clip para adjuntar."], acciones: [{ kind: "ayuda", label: "Ver todos los atajos" }] })
  }
];

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
