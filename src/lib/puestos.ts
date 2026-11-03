import type { Role } from "./domain";

/**
 * El puesto es lo que una persona hace en GARAL; decide qué ve primero (Hoy, menú, sección inicial de la ficha).
 * No da ni quita permisos: eso sigue en `can()` y en la base de datos. El puesto oficial llega en Actor.position. La preferencia local queda para la demostración y las vistas previas;
 * si no se ha elegido, se deduce del permiso.
 */
export type Puesto = "direccion" | "oficina" | "tienda" | "facturacion" | "materiales" | "jefe_obra" | "equipo";
export type Seccion = "overview" | "budget" | "work" | "purchases" | "documents" | "cobros";

export const puestos: Puesto[] = ["direccion", "oficina", "tienda", "facturacion", "materiales", "jefe_obra", "equipo"];
export const puestoNombres: Record<Puesto, string> = {
  direccion: "Dirección", oficina: "Oficina técnica", tienda: "Tienda", facturacion: "Facturación", materiales: "Materiales", "jefe_obra": "Jefe de obra", equipo: "Equipo de obra"
};
/** Una frase por puesto para el selector: qué verá esa persona al entrar. */
export const puestoDetalle: Record<Puesto, string> = {
  direccion: "Decisiones, cobros y la empresa este mes", oficina: "Presupuestos, planos y catálogo", tienda: "Clientes, visitas y respuestas", facturacion: "Facturas, cobros y gestoría",
  materiales: "Pedidos, recepciones y almacén", "jefe_obra": "Obras del día, tareas y fotos", equipo: "Tus tareas de hoy"
};

/** Permiso que suele acompañar a cada puesto; solo orienta al dar de alta. */
export const permisoPorDefecto: Record<Puesto, Role> = { direccion: "admin", oficina: "office", tienda: "office", facturacion: "office", materiales: "office", "jefe_obra": "manager", equipo: "site" };

/** Sin puesto elegido, el permiso dice cuál es el más probable. */
export function puestoPorDefecto(role: Role): Puesto {
  return role === "admin" ? "direccion" : role === "manager" ? "jefe_obra" : role === "site" ? "equipo" : role === "viewer" ? "direccion" : "oficina";
}

/** Los dos destinos del medio en la barra inferior del móvil (Hoy y Más no cambian). */
export const menuMovil: Record<Puesto, [string, string]> = {
  direccion: ["/proyectos", "/finanzas"], oficina: ["/proyectos", "/agenda"], tienda: ["/proyectos", "/clientes"], facturacion: ["/finanzas", "/proyectos"],
  materiales: ["/compras", "/proyectos"], "jefe_obra": ["/proyectos", "/agenda"], equipo: ["/proyectos", "/agenda"]
};

/** «Tu trabajo» en el menú de escritorio, en orden; el resto va en «Toda la empresa». */
export const trabajo: Record<Puesto, string[]> = {
  direccion: ["/", "/proyectos", "/finanzas", "/agenda"], oficina: ["/", "/proyectos", "/presupuestos", "/catalogo"], tienda: ["/", "/proyectos", "/clientes", "/agenda"],
  facturacion: ["/", "/finanzas", "/proyectos", "/clientes"], materiales: ["/", "/compras", "/proyectos", "/catalogo"], "jefe_obra": ["/", "/proyectos", "/agenda", "/compras"], equipo: ["/", "/proyectos", "/agenda"]
};

/** Dónde abre la ficha de un proyecto cuando la URL no dice sección. */
export const seccionInicial: Record<Puesto, Seccion> = {
  direccion: "overview", oficina: "budget", tienda: "overview", facturacion: "cobros", materiales: "purchases", "jefe_obra": "work", equipo: "work"
};

/** Qué secciones de la ficha son «suyas»: van primero en las pestañas y en el menú. */
export const seccionesDelPuesto: Record<Puesto, Seccion[]> = {
  direccion: ["overview", "budget", "cobros"], oficina: ["budget", "documents", "overview"], tienda: ["overview", "documents", "budget"], facturacion: ["cobros", "budget", "overview"],
  materiales: ["purchases", "work", "overview"], "jefe_obra": ["work", "documents", "purchases"], equipo: ["work", "documents"]
};

export const clavePuesto = (organizationId: string, actorId: string) => `plano.puesto.${organizationId}.${actorId}`;
export const esPuesto = (value: unknown): value is Puesto => typeof value === "string" && (puestos as string[]).includes(value);

export function leerPuesto(organizationId: string, actorId: string, role: Role, fallback: Puesto = puestoPorDefecto(role)): Puesto {
  try { const raw = localStorage.getItem(clavePuesto(organizationId, actorId)); if (raw === "jefe-obra") return "jefe_obra"; if (esPuesto(raw)) return raw; } catch { /* sin almacenamiento */ }
  return fallback;
}
export function guardarPuesto(organizationId: string, actorId: string, puesto: Puesto) {
  try { localStorage.setItem(clavePuesto(organizationId, actorId), puesto); } catch { /* sin almacenamiento */ }
}
