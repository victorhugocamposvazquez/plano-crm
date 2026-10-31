import { budgetHistory } from "./budget-history";
import { localDate } from "./hoy";
import { totals, type Workspace } from "./domain";

/**
 * Finanzas por periodo con lo que hay en el dominio: lo aceptado, los cobros preparados y lo enviado.
 * Importes sin IVA. Facturas y gastos no existen todavía (docs/PREGUNTAS.md): no se aproximan ni se inventan.
 */
export type Periodo = "semana" | "mes" | "trimestre" | "ano";
export const periodos: { id: Periodo; label: string }[] = [{ id: "semana", label: "Semana" }, { id: "mes", label: "Mes" }, { id: "trimestre", label: "Trimestre" }, { id: "ano", label: "Año" }];

const dia = (iso: string) => new Date(`${iso}T12:00:00`);
const sumar = (fecha: Date, dias: number) => { const d = new Date(fecha); d.setDate(d.getDate() + dias); return d; };
const lunes = (fecha: Date) => sumar(fecha, -((fecha.getDay() + 6) % 7));
const nombreMes = new Intl.DateTimeFormat("es-ES", { month: "short" });
const mesLargo = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });
const corto = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
const limpiar = (t: string) => t.replace(".", "");
const capital = (t: string) => t.replace(/^./, c => c.toUpperCase());

export type Tramo = { etiqueta: string; desde: string; hasta: string };
export type Rango = { desde: string; hasta: string; etiqueta: string; tramos: Tramo[] };

function tramosDeMeses(inicio: Date, n: number): Tramo[] {
  return Array.from({ length: n }, (_, i) => {
    const a = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1, 12), b = new Date(inicio.getFullYear(), inicio.getMonth() + i + 1, 0, 12);
    return { etiqueta: capital(limpiar(nombreMes.format(a))), desde: localDate(a), hasta: localDate(b) };
  });
}

/** El periodo que toca: `desplazamiento` 0 es el actual; −1 el anterior. */
export function rangoPeriodo(periodo: Periodo, desplazamiento = 0, hoy = localDate()): Rango {
  const base = dia(hoy);
  if (periodo === "semana") {
    const a = sumar(lunes(base), 7 * desplazamiento);
    const tramos = Array.from({ length: 7 }, (_, i) => { const d = sumar(a, i), iso = localDate(d); return { etiqueta: capital(limpiar(new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(d))), desde: iso, hasta: iso }; });
    return { desde: tramos[0].desde, hasta: tramos[6].hasta, etiqueta: `${limpiar(corto.format(a))} – ${limpiar(corto.format(sumar(a, 6)))}`, tramos };
  }
  if (periodo === "mes") {
    const a = new Date(base.getFullYear(), base.getMonth() + desplazamiento, 1, 12), fin = new Date(a.getFullYear(), a.getMonth() + 1, 0, 12);
    const tramos: Tramo[] = [];
    for (let d = new Date(a), n = 1; d <= fin; d = sumar(d, 7), n++) { const h = sumar(d, 6); tramos.push({ etiqueta: `S${n}`, desde: localDate(d), hasta: localDate(h > fin ? fin : h) }); }
    return { desde: localDate(a), hasta: localDate(fin), etiqueta: capital(mesLargo.format(a)), tramos };
  }
  if (periodo === "trimestre") {
    const trimestre = Math.floor(base.getMonth() / 3) + desplazamiento;
    const a = new Date(base.getFullYear(), trimestre * 3, 1, 12), tramos = tramosDeMeses(a, 3);
    return { desde: tramos[0].desde, hasta: tramos[2].hasta, etiqueta: `${Math.floor(a.getMonth() / 3) + 1}.º trimestre ${a.getFullYear()}`, tramos };
  }
  const a = new Date(base.getFullYear() + desplazamiento, 0, 1, 12), tramos = tramosDeMeses(a, 12);
  return { desde: tramos[0].desde, hasta: tramos[11].hasta, etiqueta: String(a.getFullYear()), tramos };
}

export type Serie = "aceptado" | "cobros" | "enviado";
export const seriesFinanzas: { id: Serie; label: string; color: string }[] = [
  { id: "aceptado", label: "Aceptado", color: "var(--pl-series-1)" },
  { id: "cobros", label: "Cobros preparados", color: "var(--pl-series-2)" },
  { id: "enviado", label: "Enviado al cliente", color: "var(--pl-series-3)" }
];

type Evento = { fecha: string; importe: number };
export function eventos(data: Workspace, projectId = ""): Record<Serie, Evento[]> {
  const delProyecto = (id: string) => !projectId || id === projectId;
  const proyectoDe = (budgetId: string) => data.budgets.find(b => b.id === budgetId)?.project_id ?? "";
  return {
    aceptado: data.versions.filter(v => v.approved_at && delProyecto(proyectoDe(v.budget_id))).map(v => ({ fecha: v.approved_at!.slice(0, 10), importe: totals(v.items).base })),
    cobros: data.certifications.filter(c => delProyecto(c.project_id)).map(c => ({ fecha: c.created_at.slice(0, 10), importe: c.amount })),
    enviado: data.versions.filter(v => v.status === "issued" && delProyecto(proyectoDe(v.budget_id))).map(v => ({ fecha: v.updated_at.slice(0, 10), importe: totals(v.items).base }))
  };
}

const sumaEntre = (lista: Evento[], desde: string, hasta: string) => lista.filter(e => e.fecha >= desde && e.fecha <= hasta).reduce((s, e) => s + e.importe, 0);

export function resumenPeriodo(data: Workspace, periodo: Periodo, desplazamiento: number, projectId = "") {
  const rango = rangoPeriodo(periodo, desplazamiento), anterior = rangoPeriodo(periodo, desplazamiento - 1), ev = eventos(data, projectId);
  const valores = (serie: Serie) => rango.tramos.map(t => sumaEntre(ev[serie], t.desde, t.hasta));
  const total = (serie: Serie, r: Rango) => sumaEntre(ev[serie], r.desde, r.hasta);
  const budgets = data.budgets.filter(b => !projectId || b.project_id === projectId).map(b => ({ b, h: budgetHistory(b, data.versions) }));
  const aceptadoHoy = budgets.reduce((s, { h }) => s + (h.approved ? totals(h.approved.items).base : 0), 0);
  const preparadoHoy = data.certifications.filter(c => !projectId || c.project_id === projectId).reduce((s, c) => s + c.amount, 0);
  return {
    rango, nombreAnterior: anterior.etiqueta,
    series: { aceptado: valores("aceptado"), cobros: valores("cobros"), enviado: valores("enviado") },
    aceptado: { ahora: total("aceptado", rango), antes: total("aceptado", anterior) },
    cobros: { ahora: total("cobros", rango), antes: total("cobros", anterior) },
    pendiente: Math.max(0, aceptadoHoy - preparadoHoy),
    porcentaje: aceptadoHoy ? Math.round((100 * preparadoHoy) / aceptadoHoy) : 0,
    sinRespuesta: budgets.reduce((s, { h }) => s + (h.working?.status === "issued" ? totals(h.working.items).base : 0), 0),
    borradores: budgets.reduce((s, { h }) => s + (h.working?.status === "draft" ? totals(h.working.items).base : 0), 0)
  };
}

/** Texto de comparación con el periodo anterior; sin base de comparación no se inventa un porcentaje. */
export function comparar(ahora: number, antes: number) {
  if (!antes) return ahora ? "Sin datos en el periodo anterior" : "Igual que el periodo anterior";
  const p = Math.round((100 * (ahora - antes)) / antes);
  return p === 0 ? "Igual que el periodo anterior" : `${p > 0 ? "+" : "−"}${Math.abs(p)} % que el periodo anterior`;
}

/** CSV para la gestoría: separador «;» y coma decimal, como lo abre Excel en España. */
export function csvGestoria(data: Workspace, projectId = "") {
  const euros = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const celda = (t: string) => `"${t.replace(/"/g, '""')}"`;
  const filas = data.certifications.filter(c => !projectId || c.project_id === projectId).map(c => {
    const p = data.projects.find(x => x.id === c.project_id);
    return [c.created_at.slice(0, 10), celda(p?.client_name ?? ""), celda(p?.name ?? ""), celda(c.title), "Borrador", euros(c.amount)].join(";");
  });
  return ["Fecha;Cliente;Proyecto;Concepto;Estado;Base sin IVA", ...filas].join("\n");
}
