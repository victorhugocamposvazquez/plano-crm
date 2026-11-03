import { budgetHistory } from "./budget-history";
import { money, purchaseStatus, totals, type Actor, type Project, type Workspace } from "./domain";
import { facturasDe, vencidas } from "./facturas";
import { localDate } from "./hoy";
import { enlacePaso, quienActua, type Quien } from "./pasos";
import type { Puesto } from "./puestos";
import { queToca, type TipoAccion } from "./siguiente-paso";
import { esMia, primerNombre } from "./avisos";
import type { Tone } from "@/components/ui/status";

/**
 * «Lo tuyo»: lo que le toca hoy a una persona según su puesto, y lo que espera a otros.
 * Es la única fuente del contador de Hoy, de la barra y del menú, para que los tres digan lo mismo.
 * Una tarea asignada a ti es tuya sea cual sea tu puesto; el resto se reparte por quién lo resuelve.
 */
export type Cosa = { id: string; project?: Project; kicker: string; titulo: string; detalle: string; label: string; href: string; tono: Tone; urgencia: 0 | 1 | 2; para: Puesto[]; quien?: Quien };

const responsable: Record<TipoAccion, Puesto[]> = {
  presupuesto: ["oficina"], editar: ["oficina"], cerrar: ["oficina", "direccion"], aprobar: ["tienda", "direccion"], planificar: ["jefe_obra", "direccion"],
  tareas: ["jefe_obra"], "iniciar-obra": ["jefe_obra", "direccion"], tarea: ["jefe_obra"], certificar: ["facturacion", "direccion"], finalizar: ["direccion", "jefe_obra"], ninguna: []
};

export const tituloTuyo: Record<Puesto, string> = {
  direccion: "Esperan tu decisión", oficina: "Presupuestos que te tocan", tienda: "Clientes que te tocan", facturacion: "Te toca", materiales: "Materiales que te tocan", "jefe_obra": "Tus obras hoy", equipo: "Tus tareas"
};

export function loTuyo(data: Workspace, actor: Actor, puesto: Puesto, hoy = localDate()): { tuyas: Cosa[]; otras: Cosa[] } {
  const yo = primerNombre(actor.name), cosas: Cosa[] = [];
  const proyecto = (id: string) => data.projects.find(p => p.id === id);

  for (const { project, paso } of queToca(data, hoy)) {
    const quien = quienActua(data, project, hoy);
    if (quien === "al-dia") continue;
    const para = quien === "cliente" ? ["tienda"] : [...responsable[paso.accion], ...(quien === "atrasado" ? ["direccion", "jefe_obra"] : [])];
    const kicker = quien === "cliente" ? "Esperando al cliente" : quien === "atrasado" ? "Va atrasado" : paso.titulo;
    cosas.push({ id: `p-${project.id}`, project, kicker, titulo: project.name, detalle: [project.client_name, project.location].filter(Boolean).join(" · "), label: paso.label || "Ver proyecto", href: enlacePaso(project.id, paso), tono: quien === "cliente" ? "info" : quien === "atrasado" ? "danger" : "warning", urgencia: paso.urgencia, para: [...new Set(para)] as Puesto[], quien });
  }

  for (const f of vencidas(facturasDe(data), hoy)) {
    const p = proyecto(f.project_id);
    cosas.push({ id: `f-${f.id}`, project: p, kicker: `Factura vencida · ${money(f.total)}`, titulo: p?.name ?? f.client_name, detalle: `${f.client_name}${f.number ? ` · ${f.number}` : ""}`, label: "Reclamar el cobro", href: `/proyectos/${f.project_id}?s=cobros`, tono: "danger", urgencia: 2, para: ["facturacion", "direccion"] });
  }

  for (const c of data.purchases) {
    const p = proyecto(c.project_id); if (!p || p.status === "completed") continue;
    const cantidad = `${c.quantity} ${c.unit}`;
    if (c.status === "planned") cosas.push({ id: `c-${c.id}`, project: p, kicker: `${purchaseStatus.planned} · ${cantidad}`, titulo: c.name, detalle: `${p.name}${c.supplier ? ` · ${c.supplier}` : ""}`, label: "Pedir", href: `/proyectos/${p.id}?s=purchases`, tono: "warning", urgencia: 1, para: ["materiales"] });
    else if (c.status === "ordered") cosas.push({ id: `c-${c.id}`, project: p, kicker: `Pedido, por recibir · ${c.received_quantity} de ${cantidad}`, titulo: c.name, detalle: `${p.name}${c.supplier ? ` · ${c.supplier}` : ""}`, label: "Recibir", href: `/proyectos/${p.id}?s=purchases`, tono: "info", urgencia: 1, para: ["materiales"] });
    else if (c.status === "received" && c.delivered_quantity < c.received_quantity) cosas.push({ id: `c-${c.id}`, project: p, kicker: "En almacén, sin llevar a obra", titulo: c.name, detalle: p.name, label: "Llevar a obra", href: `/proyectos/${p.id}?s=purchases`, tono: "warning", urgencia: 0, para: ["materiales", "jefe_obra"] });
  }

  for (const t of data.tasks) {
    if (t.status !== "pending" || t.due_date > hoy || !esMia(t.assignee, yo, t.assignee_id, actor.id)) continue;
    const p = proyecto(t.project_id); if (!p) continue;
    const tarde = t.due_date < hoy;
    cosas.push({ id: `t-${t.id}`, project: p, kicker: tarde ? "Tarea atrasada" : "Tu tarea de hoy", titulo: t.title, detalle: `${p.name} · ${t.trade}`, label: "Ver tarea", href: `/proyectos/${p.id}?s=work`, tono: tarde ? "danger" : "success", urgencia: tarde ? 2 : 1, para: ["direccion", "oficina", "tienda", "facturacion", "materiales", "jefe_obra", "equipo"] });
  }

  const orden = (a: Cosa, b: Cosa) => b.urgencia - a.urgencia || a.titulo.localeCompare(b.titulo, "es");
  const tuyas = cosas.filter(c => c.para.includes(puesto)).sort(orden);
  const otras = cosas.filter(c => !c.para.includes(puesto)).sort(orden);
  return { tuyas, otras };
}

/** Resumen corto de quién lleva lo que no es tuyo: «2 del cliente, 1 de obra». */
export function resumenOtras(otras: Cosa[]): string {
  const grupos = new Map<string, number>();
  const nombre = (c: Cosa) => c.quien === "cliente" ? "del cliente" : c.para.includes("materiales") ? "de materiales" : c.para.includes("jefe_obra") || c.para.includes("equipo") ? "de obra" : c.para.includes("facturacion") ? "de facturación" : c.para.includes("oficina") ? "de oficina" : c.para.includes("tienda") ? "de tienda" : "de dirección";
  for (const c of otras) grupos.set(nombre(c), (grupos.get(nombre(c)) ?? 0) + 1);
  return [...grupos].map(([n, k]) => `${k} ${n}`).join(", ");
}

/** Importe aceptado del proyecto, para los textos de Hoy. */
export const aceptadoDe = (data: Workspace, project: Project) => data.budgets.filter(b => b.project_id === project.id).map(b => budgetHistory(b, data.versions).approved).filter(Boolean).reduce((s, v) => s + totals(v!.items).total, 0);
