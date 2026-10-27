/**
 * Presentación de un presupuesto concreto: lo que cambia de un cliente a otro aunque la identidad
 * de la empresa sea la misma. Logo del cliente, imagen de portada propia, título de portada y
 * una carta breve de presentación. Se guarda por presupuesto; cuando el dominio tenga
 * `budgets.presentation` leerá de ahí.
 */

export type Presentacion = {
  client_logo_data_url: string;
  cover_image_data_url: string;
  cover_title: string;
  intro: string;
};

export const presentacionVacia: Presentacion = { client_logo_data_url: "", cover_image_data_url: "", cover_title: "", intro: "" };

const clave = (budgetId: string) => `plano.presentacion.${budgetId}`;

export function completarPresentacion(parcial: Partial<Presentacion> | null | undefined): Presentacion {
  const p: Presentacion = { ...presentacionVacia, ...(parcial ?? {}) };
  for (const k of Object.keys(presentacionVacia) as (keyof Presentacion)[]) if (typeof p[k] !== "string") p[k] = "";
  return p;
}

export function cargarPresentacion(budgetId: string): Presentacion {
  try { const raw = localStorage.getItem(clave(budgetId)); return completarPresentacion(raw ? JSON.parse(raw) : null); }
  catch { return { ...presentacionVacia }; }
}

export function guardarPresentacion(budgetId: string, p: Presentacion) {
  if (JSON.stringify(p) === JSON.stringify(presentacionVacia)) localStorage.removeItem(clave(budgetId));
  else localStorage.setItem(clave(budgetId), JSON.stringify(p));
}

export const tienePresentacion = (p: Presentacion) => JSON.stringify(p) !== JSON.stringify(presentacionVacia);

/** Problemas que impiden guardar. */
export function validarPresentacion(p: Presentacion): string[] {
  const out: string[] = [];
  if (p.client_logo_data_url.length > 420_000) out.push("El logo del cliente pesa demasiado: menos de 300 KB.");
  if (p.cover_image_data_url.length > 2_800_000) out.push("La imagen de portada pesa demasiado: menos de 2 MB.");
  if (p.intro.length > 1200) out.push("La presentación es demasiado larga: máximo 1200 caracteres.");
  return out;
}
