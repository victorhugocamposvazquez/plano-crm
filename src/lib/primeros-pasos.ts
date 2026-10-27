import type { Workspace } from "./domain";
import type { Branding } from "./branding";

/**
 * Primeros pasos de una organización nueva en Plano. Se enseña en «Hoy» mientras quede algo por hacer
 * y el espacio sea todavía pequeño; cada paso lleva a la pantalla donde se resuelve.
 */

export type Paso = { id: "identidad" | "catalogo" | "proyecto" | "presupuesto"; label: string; hint: string; href: string; done: boolean };

export function primerosPasos(data: Workspace, branding: Branding): Paso[] {
  const identidad = Boolean(branding.trade_name.trim()) && Boolean(branding.legal_name.trim() || branding.logo_data_url || branding.tax_id.trim());
  const catalogo = data.articles.length >= 5;
  const proyecto = data.projects.length >= 1;
  const presupuesto = data.versions.some(v => v.items.length > 0);
  return [
    { id: "identidad", label: "Pon la identidad de la empresa", hint: "Logo, colores y datos legales que saldrán en los presupuestos.", href: "/configuracion/identidad", done: identidad },
    { id: "catalogo", label: "Carga el catálogo de precios", hint: "Importa el tarifario desde Excel (CSV) o añade los artículos a mano.", href: "/catalogo?importar=1", done: catalogo },
    { id: "proyecto", label: "Crea el primer proyecto", hint: "Desde oficina con «Nuevo proyecto» o a pie de obra con la visita.", href: "/proyectos?nuevo=1", done: proyecto },
    { id: "presupuesto", label: "Haz el primer presupuesto", hint: "Partidas del catálogo con la guía por capítulos; después, PDF para el cliente.", href: "/presupuestos", done: presupuesto }
  ];
}

/** Se muestra mientras falte algo y la organización siga siendo pequeña (hasta 3 proyectos). */
export function mostrarPrimerosPasos(pasos: Paso[], data: Workspace, ocultado: boolean) {
  return !ocultado && pasos.some(p => !p.done) && data.projects.length <= 3;
}

export const claveOcultar = (orgId: string) => `plano.primeros-pasos.ocultos.${orgId || "demo"}`;
