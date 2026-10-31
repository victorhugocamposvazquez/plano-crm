import type { Role } from "./domain";

/**
 * Qué secciones ve cada perfil. Lo que un perfil no puede tocar y no necesita consultar no se enseña:
 * el equipo de obra trabaja con Hoy, Proyectos y Agenda, y sus materiales y documentos viven en cada proyecto; la configuración de la
 * empresa es de oficina y administración. Los permisos reales siguen en `can()`; esto solo ordena el menú.
 */
const configuracion = ["/configuracion/identidad", "/configuracion/importar", "/configuracion/ejemplos"];
const ocultas: Record<Role, string[]> = {
  admin: [],
  office: [],
  manager: configuracion,
  site: ["/clientes", "/presupuestos", "/catalogo", "/finanzas", "/ajustes", ...configuracion],
  viewer: configuracion
};

export function veSeccion(role: Role, href: string) {
  return !ocultas[role].some(h => href === h || href.startsWith(`${h}/`) || href.startsWith(`${h}?`));
}
