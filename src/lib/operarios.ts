/**
 * Operarios: quién hace cada oficio, cómo se le localiza y si está disponible. Los oficios son las categorías del catálogo
 * («Demoliciones», «Pintura»…): así una actuación del catálogo sabe qué operarios la hacen.
 */
import type { Operario, Workspace } from "./domain";
import { normalizar } from "./busqueda";

/** Teléfono para marcar: solo dígitos y el «+» inicial. Los españoles de 9 cifras sin prefijo llevan +34. */
export function telefonoE164(phone: string): string {
  const limpio = phone.trim().replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (!limpio) return "";
  if (limpio.startsWith("+")) return limpio;
  if (limpio.startsWith("00")) return `+${limpio.slice(2)}`;
  return /^[6789]\d{8}$/.test(limpio) ? `+34${limpio}` : limpio;
}
export const enlaceLlamar = (phone: string) => { const t = telefonoE164(phone); return t ? `tel:${t}` : ""; };
/** Enlace de WhatsApp (wa.me) con el mensaje ya escrito; sin teléfono, abre WhatsApp para elegir a quién. */
export function enlaceWhatsapp(phone: string, texto = ""): string {
  const t = telefonoE164(phone).replace(/^\+/, "");
  const q = texto ? `?text=${encodeURIComponent(texto)}` : "";
  return t ? `https://wa.me/${t}${q}` : `https://wa.me/${q}`;
}

/** Un oficio del operario casa con una categoría del catálogo aunque cambie el plural o un acento («Demolición» ~ «Demoliciones»). */
export function haceOficio(o: Pick<Operario, "trades">, categoria: string): boolean {
  const c = normalizar(categoria).trim();
  if (!c) return false;
  return o.trades.some(t => { const x = normalizar(t).trim(); return x === c || (x.length >= 5 && c.length >= 5 && x.slice(0, 6) === c.slice(0, 6)); });
}
/** Quién hace una categoría del catálogo: primero los disponibles, luego por nombre. */
export function operariosDe(categoria: string, operarios: Operario[]): Operario[] {
  return operarios.filter(o => haceOficio(o, categoria)).sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name, "es"));
}

/** Los oficios que se ofrecen al editar un operario: las categorías del catálogo y lo ya escrito en otros operarios. */
export function oficiosPosibles(data: Pick<Workspace, "articles" | "operarios">): string[] {
  return [...new Set([...data.articles.map(a => a.chapter), ...(data.operarios ?? []).flatMap(o => o.trades)].map(t => t.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const costeHora = (o: Pick<Operario, "hourly_cost">) => o.hourly_cost == null ? "" : `${euros.format(o.hourly_cost / 100)}/h`;
/** «Derribos Rey · Demoliciones» o «Pintura». */
export const resumenOperario = (o: Pick<Operario, "company" | "trades">) => [o.company, o.trades.join(", ")].filter(Boolean).join(" · ");
