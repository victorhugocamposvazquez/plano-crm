import { createDemo } from "./demo";
import type { BudgetItem, Command, Workspace } from "./domain";

/**
 * Proyectos de ejemplo: los mismos cinco del modo demo (los que se ven en preview), creados en el espacio de trabajo
 * real por los comandos de siempre. Así producción puede enseñarse con contenido sin tocar la base de datos a mano.
 * Lo que ya existe (mismo nombre y cliente) no se toca, así que se puede repetir sin duplicar.
 */
export type Deps = {
  data: Workspace;
  send: (command: Command) => Promise<Workspace>;
  uuid?: () => string;
  onProgreso?: (mensaje: string) => void;
};
export type Resultado = { proyectos: number; presupuestos: number; tareas: number; compras: number; articulos: number; omitidos: string[]; errores: string[] };
export type Vista = { name: string; client_name: string; kind: Workspace["projects"][number]["kind"]; status: Workspace["projects"][number]["status"]; versiones: number; tareas: number; compras: number; existe: boolean };

const UNIDADES: BudgetItem["unit"][] = ["m²", "ml", "ud", "h", "global"];
const unidad = (u: string): BudgetItem["unit"] => (UNIDADES as string[]).includes(u) ? (u as BudgetItem["unit"]) : "ud";
const mensaje = (e: unknown) => (e instanceof Error ? e.message : "error");
const existe = (ws: Workspace, name: string, client_name: string) => ws.projects.some(x => x.name === name && x.client_name === client_name);

/** Qué trae cada proyecto de ejemplo y si ya está en el espacio de trabajo. */
export function previsualizar(data: Workspace): Vista[] {
  const demo = createDemo();
  return demo.projects.map(p => {
    const presupuestos = demo.budgets.filter(b => b.project_id === p.id).map(b => b.id);
    return {
      name: p.name, client_name: p.client_name, kind: p.kind, status: p.status,
      versiones: demo.versions.filter(v => presupuestos.includes(v.budget_id)).length,
      tareas: demo.tasks.filter(t => t.project_id === p.id).length,
      compras: demo.purchases.filter(c => c.project_id === p.id).length,
      existe: existe(data, p.name, p.client_name)
    };
  });
}

/** Artículos de ejemplo que faltan en el catálogo (por código). */
export function articulosQueFaltan(data: Workspace) {
  return createDemo().articles.filter(a => !data.articles.some(x => x.code === a.code));
}

/** Crea catálogo, proyectos, presupuestos (con su V1 aprobada y V2 en borrador donde toca), tareas, compras y mensajes. Sigue aunque algo falle y lo anota. */
export async function cargarEjemplos(deps: Deps): Promise<Resultado> {
  const demo = createDemo();
  const uuid = deps.uuid ?? (() => crypto.randomUUID());
  const log = (m: string) => deps.onProgreso?.(m);
  const r: Resultado = { proyectos: 0, presupuestos: 0, tareas: 0, compras: 0, articulos: 0, omitidos: [], errores: [] };
  let ws = deps.data;

  for (const a of articulosQueFaltan(ws)) {
    try {
      log(`Catálogo · ${a.name}…`);
      ws = await deps.send({ type: "article.create", code: a.code, name: a.name, chapter: a.chapter, unit: unidad(a.unit), unit_price: a.unit_price, vat_rate: a.vat_rate });
      r.articulos++;
    } catch (e) { r.errores.push(`Artículo ${a.code}: ${mensaje(e)}`); }
  }

  for (const p of demo.projects) {
    if (existe(ws, p.name, p.client_name)) { r.omitidos.push(`${p.name}: ya existía, no se ha tocado.`); continue; }
    try {
      log(`Creando ${p.name}…`);
      ws = await deps.send({ type: "project.create", name: p.name, client_name: p.client_name, location: p.location, kind: p.kind });
      const creado = ws.projects.filter(x => x.name === p.name && x.client_name === p.client_name).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (!creado) throw new Error("no se ha podido localizar el proyecto recién creado");
      r.proyectos++;
      if (creado.status !== p.status) ws = await deps.send({ type: "project.status", id: creado.id, status: p.status });

      for (const b of demo.budgets.filter(b => b.project_id === p.id)) {
        try {
          log(`${p.name} · presupuesto «${b.title}»…`);
          ws = await deps.send({ type: "budget.create", project_id: creado.id, title: b.title });
          const budget = ws.budgets.filter(x => x.project_id === creado.id).sort((a, c) => c.created_at.localeCompare(a.created_at))[0];
          if (!budget) throw new Error("no se ha creado el presupuesto");
          let anterior: string | null = null;
          // La misma partida debe conservar su identidad entre V1 y V2.
          const itemIds = new Map<string,string>();
          for (const v of demo.versions.filter(v => v.budget_id === b.id).sort((a, c) => a.number - c.number)) {
            let borrador = ws.versions.find(x => x.budget_id === budget.id && x.status === "draft");
            if (!borrador && anterior) {
              ws = await deps.send({ type: "budget.revise", version_id: anterior, reason: v.change_reason });
              borrador = ws.versions.find(x => x.budget_id === budget.id && x.status === "draft");
            }
            if (!borrador) throw new Error(`no se ha abierto la V${v.number}`);
            const items: BudgetItem[] = v.items.map(i => {
              if(!itemIds.has(i.id))itemIds.set(i.id,uuid());
              return { ...i, id: itemIds.get(i.id)! };
            });
            ws = await deps.send({ type: "budget.save", version_id: borrador.id, expected_revision: borrador.draft_revision, items, notes: v.notes });
            if (v.status !== "draft") {
              const guardada = ws.versions.find(x => x.id === borrador.id);
              if (!guardada) throw new Error(`se ha perdido la V${v.number}`);
              ws = await deps.send({ type: "budget.issue", version_id: guardada.id, expected_revision: guardada.draft_revision });
              if (v.status !== "issued") ws = await deps.send({ type: "budget.approve", version_id: guardada.id, reference: v.approval_reference || "Aprobación de ejemplo" });
            }
            anterior = borrador.id;
          }
          r.presupuestos++;
        } catch (e) { r.errores.push(`${p.name} · «${b.title}»: ${mensaje(e)}`); }
      }

      for (const t of demo.tasks.filter(t => t.project_id === p.id)) {
        try {
          ws = await deps.send({ type: "task.create", project_id: creado.id, title: t.title, trade: t.trade, assignee: t.assignee, due_date: t.due_date, weight: t.weight });
          if (t.status === "done") {
            const creada = ws.tasks.find(x => x.project_id === creado.id && x.title === t.title && x.status === "pending");
            if (creada) ws = await deps.send({ type: "task.toggle", id: creada.id, status: "done" });
          }
          r.tareas++;
        } catch (e) { r.errores.push(`${p.name} · tarea «${t.title}»: ${mensaje(e)}`); }
      }

      for (const c of demo.purchases.filter(c => c.project_id === p.id)) {
        try {
          ws = await deps.send({ type: "purchase.create", project_id: creado.id, name: c.name, supplier: c.supplier, quantity: c.quantity, unit: unidad(c.unit) });
          if (c.status !== "planned") {
            const creada = ws.purchases.find(x => x.project_id === creado.id && x.name === c.name && x.status === "planned");
            if (creada) ws = await deps.send({ type: "purchase.update", id: creada.id, status: c.status, received_quantity: c.received_quantity, delivered_quantity: c.delivered_quantity });
          }
          r.compras++;
        } catch (e) { r.errores.push(`${p.name} · compra «${c.name}»: ${mensaje(e)}`); }
      }

      for (const m of demo.messages.filter(m => m.project_id === p.id)) {
        try { ws = await deps.send({ type: "message.send", project_id: creado.id, body: m.body }); } catch (e) { r.errores.push(`${p.name} · mensaje: ${mensaje(e)}`); }
      }
    } catch (e) { r.errores.push(`${p.name}: ${mensaje(e)}`); }
  }
  return r;
}
