"use client";
import { useMemo } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { Select } from "@/components/ui/select";
import { OperarioCard } from "@/components/equipo/operario-card";
import type { Task, Workspace } from "@/lib/domain";
import { haceOficio } from "@/lib/operarios";
import { puestoNombres } from "@/lib/puestos";

/** Responsable elegido: nadie, una cuenta («m:<user_id>»), un operario («op:<id>») u otra persona escrita a mano («otra»). */
export type Responsable = { valor: string; libre: string };
export const sinResponsable: Responsable = { valor: "", libre: "" };

/** El responsable de una tarea ya creada, para editarla. */
export function responsableDe(t: Pick<Task, "assignee" | "assignee_id" | "operario_id">, data: Pick<Workspace, "operarios" | "members">): Responsable {
  if (t.operario_id && (data.operarios ?? []).some(o => o.id === t.operario_id)) return { valor: `op:${t.operario_id}`, libre: "" };
  if (t.assignee_id && data.members.some(m => m.user_id === t.assignee_id)) return { valor: `m:${t.assignee_id}`, libre: "" };
  return t.assignee ? { valor: "otra", libre: t.assignee } : sinResponsable;
}
/** Los campos del comando task.create / task.update para ese responsable. */
export function asignacion(r: Responsable): { operario_id?: string | null; assignee_id?: string | null; assignee?: string } {
  if (r.valor.startsWith("op:")) return { operario_id: r.valor.slice(3) };
  if (r.valor.startsWith("m:")) return { assignee_id: r.valor.slice(2) };
  return { assignee_id: null, assignee: r.valor === "otra" ? r.libre.trim() : "" };
}
export const nombreResponsable = (r: Responsable, data: Pick<Workspace, "operarios" | "members">) =>
  r.valor.startsWith("op:") ? (data.operarios ?? []).find(o => o.id === r.valor.slice(3))?.name ?? ""
    : r.valor.startsWith("m:") ? data.members.find(m => m.user_id === r.valor.slice(2))?.display_name ?? ""
      : r.valor === "otra" ? r.libre.trim() : "";

/**
 * Selector de responsable para las tareas. Primero los operarios que hacen ese oficio (disponibles antes), luego las cuentas de Plano,
 * después el resto de operarios y «Otra persona o equipo…». Con un operario elegido enseña su contacto.
 */
export function ResponsableField({ value, onChange, oficio, mensaje }: { value: Responsable; onChange: (r: Responsable) => void; oficio?: string; mensaje?: string }) {
  const { data } = useWorkspace();
  const operarios = useMemo(() => [...(data.operarios ?? [])].sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name, "es")), [data.operarios]);
  const delOficio = oficio ? operarios.filter(o => haceOficio(o, oficio)) : [];
  const resto = operarios.filter(o => !delOficio.includes(o));
  // Quien es a la vez cuenta y operario sale una vez, como operario (lleva su teléfono).
  const esOperario = (userId: string) => operarios.some(o => o.user_id === userId);
  const opOpcion = (o: typeof operarios[number]) => ({ value: `op:${o.id}`, label: `${o.name}${o.trades.length ? ` · ${o.trades.join(", ")}` : ""}`, hint: o.available ? (o.company || "Disponible") : "No disponible" });
  const opciones = [
    { value: "", label: "Sin asignar" },
    ...delOficio.map(opOpcion),
    ...[...data.members].sort((a, b) => a.display_name.localeCompare(b.display_name, "es")).filter(m => !esOperario(m.user_id)).map(m => ({ value: `m:${m.user_id}`, label: `${m.display_name} · ${puestoNombres[m.position]}` })),
    ...resto.map(opOpcion),
    { value: "otra", label: "Otra persona o equipo…" }
  ];
  const operario = value.valor.startsWith("op:") ? operarios.find(o => o.id === value.valor.slice(3)) : undefined;
  return <>
    <div className="field"><span>Responsable</span><Select label="Responsable" value={value.valor} onChange={v => onChange({ valor: v, libre: v === "otra" ? value.libre : "" })} options={opciones} placeholder="Sin asignar" /></div>
    {value.valor === "otra" && <label className="field"><span>Quién</span><input type="text" value={value.libre} onChange={e => onChange({ ...value, libre: e.target.value })} placeholder="Electricista de Ferrer, cuadrilla de pintura…" maxLength={120} /></label>}
    {operario && <OperarioCard operario={operario} compacta mensaje={mensaje} sinWhatsapp />}
  </>;
}

/** Opciones para asignar una subtarea: «Sin asignar», operarios (op:) y personas de la empresa (m:); quien es las dos cosas sale como operario. */
export function opcionesAsignar(data: Pick<Workspace, "operarios" | "members">): { value: string; label: string; hint?: string }[] {
  const operarios = [...(data.operarios ?? [])].sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name, "es"));
  const esOperario = (userId: string) => operarios.some(o => o.user_id === userId);
  return [
    { value: "", label: "Sin asignar" },
    ...operarios.map(o => ({ value: `op:${o.id}`, label: o.name, hint: o.trades.join(", ") || "Operario" })),
    ...[...data.members].filter(m => !esOperario(m.user_id)).sort((a, b) => a.display_name.localeCompare(b.display_name, "es")).map(m => ({ value: `m:${m.user_id}`, label: m.display_name, hint: puestoNombres[m.position] }))
  ];
}
/** El valor del selector para una subtarea ya asignada. */
export const valorSubtarea = (p: { operario_id?: string | null; assignee_id?: string | null }) => p.operario_id ? `op:${p.operario_id}` : p.assignee_id ? `m:${p.assignee_id}` : "";
/** Los campos de la subtarea para ese valor, con el nombre para enseñarlo antes de guardar. */
export function asignacionSubtarea(valor: string, data: Pick<Workspace, "operarios" | "members">): { operario_id?: string; assignee_id?: string; assignee?: string } {
  if (valor.startsWith("op:")) { const o = (data.operarios ?? []).find(x => x.id === valor.slice(3)); return o ? { operario_id: o.id, assignee: o.name } : {}; }
  if (valor.startsWith("m:")) { const m = data.members.find(x => x.user_id === valor.slice(2)); return m ? { assignee_id: m.user_id, assignee: m.display_name } : {}; }
  return {};
}
