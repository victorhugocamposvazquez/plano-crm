/**
 * Cuentas del calendario de los campos de fecha, con fechas locales «AAAA-MM-DD» (sin horas ni zonas).
 * La semana empieza en lunes, como en España.
 */
const aFecha = (iso: string) => new Date(`${iso}T12:00:00`);
const aIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const esFecha = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(aFecha(v).getTime());
export function sumarDiasIso(iso: string, dias: number): string { const d = aFecha(iso); d.setDate(d.getDate() + dias); return aIso(d); }
export function sumarMeses(iso: string, meses: number): string {
  const d = aFecha(iso), dia = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + meses);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).getDate();
  d.setDate(Math.min(dia, ultimo));
  return aIso(d);
}
export const inicioMes = (iso: string) => `${iso.slice(0, 7)}-01`;
export const mismoMes = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);
/** 0 = lunes … 6 = domingo. */
export const diaSemana = (iso: string) => (aFecha(iso).getDay() + 6) % 7;

/** Las 42 casillas (6 semanas) del mes que contiene `iso`, empezando en el lunes de la primera semana. */
export function casillasMes(iso: string): string[] {
  const primero = inicioMes(iso), desde = sumarDiasIso(primero, -diaSemana(primero));
  return Array.from({ length: 42 }, (_, i) => sumarDiasIso(desde, i));
}

export const fueraDeRango = (iso: string, min?: string, max?: string) => Boolean((min && iso < min) || (max && iso > max));
/** Mantiene la fecha dentro de los límites. */
export const ajustar = (iso: string, min?: string, max?: string) => (min && iso < min ? min : max && iso > max ? max : iso);

const nombreMes = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });
const largo = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const corto = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const mayuscula = (t: string) => t.charAt(0).toLocaleUpperCase("es-ES") + t.slice(1);
/** «Noviembre de 2026». */
export const tituloMes = (iso: string) => mayuscula(nombreMes.format(aFecha(iso)));
/** «jueves, 5 de noviembre de 2026», para lectores de pantalla. */
export const fechaLarga = (iso: string) => largo.format(aFecha(iso));
/** «Hoy · jue, 5 nov 2026», «Mañana · …» o «vie, 6 nov 2026», para el campo. */
export function fechaCampo(iso: string, hoy: string): string {
  const texto = corto.format(aFecha(iso)).replace(/\./g, "");
  return iso === hoy ? `Hoy · ${texto}` : iso === sumarDiasIso(hoy, 1) ? `Mañana · ${texto}` : iso === sumarDiasIso(hoy, -1) ? `Ayer · ${texto}` : texto;
}
