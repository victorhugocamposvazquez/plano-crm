/**
 * Identidad de la organización dentro de Plano: lo que sale en los documentos que ve el cliente
 * (presupuestos, hojas de pedido, certificaciones). Plano es SaaS: cada empresa configura la suya.
 *
 * Hoy se guarda en el navegador por organización (`plano.branding.<org>`); cuando el dominio tenga
 * `organization.branding` (JSON + logo en Storage) este módulo leerá de ahí sin cambiar la interfaz.
 */

export type Branding = {
  /** Nombre comercial que encabeza los documentos. */
  trade_name: string;
  /** Razón social, CIF/NIF y dirección fiscal: van al pie legal. */
  legal_name: string;
  tax_id: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  /** Logo como data URL (PNG/SVG/JPG/WebP, ≤ 300 KB). Vacío = marca tipográfica con el nombre. */
  logo_data_url: string;
  /** Colores en hex. El principal marca encabezados y filetes; el acento, detalles pequeños. */
  primary_color: string;
  accent_color: string;
  /** Portada opcional de los presupuestos: claim e imagen de fondo (data URL). */
  cover_enabled: boolean;
  cover_claim: string;
  cover_image_data_url: string;
  /** Texto fijo que se añade a todo presupuesto (validez, forma de pago, exclusiones generales). */
  default_terms: string;
  /** Línea libre del pie (registro mercantil, seguro RC, nº de licencia…). */
  footer_note: string;
};

export const brandingPorDefecto: Branding = {
  trade_name: "", legal_name: "", tax_id: "", address: "", phone: "", email: "", website: "",
  logo_data_url: "", primary_color: "#101214", accent_color: "#E85D1F",
  cover_enabled: false, cover_claim: "Cada obra, bajo control.", cover_image_data_url: "",
  default_terms: "Presupuesto válido 30 días. Precios sin IVA salvo indicación. No incluye licencias ni tasas municipales. Las cantidades se certificarán según medición real en obra.",
  footer_note: ""
};

/** Paleta sugerida para quien no tenga color corporativo definido; cualquier hex vale. */
export const paletaSugerida = ["#101214", "#1F3A5F", "#0F766E", "#7C2D12", "#4C1D95", "#9A3412", "#166534", "#B91C1C", "#E85D1F", "#2563EB", "#CA8A04", "#6B7280"];

export const HEX = /^#([0-9a-f]{6})$/i;
export const esHex = (value: string) => HEX.test(value.trim());
export const normalizarHex = (value: string) => { const v = value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) return `#${v.replace("#", "").toUpperCase()}`; return null; };

/** Texto que lee bien sobre un color: negro o blanco según luminancia relativa (WCAG). */
export function textoSobre(hex: string): "#000000" | "#FFFFFF" {
  const m = normalizarHex(hex); if (!m) return "#000000";
  const [r, g, b] = [1, 3, 5].map(i => parseInt(m.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? "#000000" : "#FFFFFF";
}

const clave = (orgId: string) => `plano.branding.${orgId || "demo"}`;

/** Rellena huecos con los valores por defecto y descarta colores inválidos o tipos raros. */
export function completarBranding(parcial: Partial<Branding> | null | undefined, nombreOrganizacion = ""): Branding {
  const b: Branding = { ...brandingPorDefecto, ...(parcial ?? {}) };
  if (!b.trade_name) b.trade_name = nombreOrganizacion;
  if (!esHex(b.primary_color)) b.primary_color = brandingPorDefecto.primary_color;
  if (!esHex(b.accent_color)) b.accent_color = brandingPorDefecto.accent_color;
  for (const k of Object.keys(brandingPorDefecto) as (keyof Branding)[]) {
    if (typeof b[k] !== typeof brandingPorDefecto[k]) (b as unknown as Record<string, unknown>)[k] = brandingPorDefecto[k];
  }
  return b;
}

export function cargarBranding(orgId: string, nombreOrganizacion = ""): Branding {
  try { const raw = localStorage.getItem(clave(orgId)); return completarBranding(raw ? JSON.parse(raw) : null, nombreOrganizacion); }
  catch { return completarBranding(null, nombreOrganizacion); }
}

export function guardarBranding(orgId: string, branding: Branding) {
  localStorage.setItem(clave(orgId), JSON.stringify(branding));
  window.dispatchEvent(new StorageEvent("storage", { key: clave(orgId) }));
}

export const esClaveBranding = (key: string | null) => Boolean(key && key.startsWith("plano.branding."));

/** Problemas que impiden guardar, con texto para la interfaz. */
export function validarBranding(b: Branding): string[] {
  const out: string[] = [];
  if (!b.trade_name.trim()) out.push("Falta el nombre comercial.");
  if (!esHex(b.primary_color)) out.push("El color principal debe ser un hex de 6 cifras, por ejemplo #1F3A5F.");
  if (!esHex(b.accent_color)) out.push("El color de acento debe ser un hex de 6 cifras.");
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) out.push("El correo no parece válido.");
  if (b.logo_data_url.length > 420_000) out.push("El logo pesa demasiado: usa un PNG o SVG de menos de 300 KB.");
  if (b.cover_image_data_url.length > 2_800_000) out.push("La imagen de portada pesa demasiado: menos de 2 MB.");
  return out;
}

/** Líneas del pie legal, sin huecos. */
export function lineasLegales(b: Branding) {
  const fiscal = [b.legal_name, b.tax_id ? `CIF ${b.tax_id}` : "", b.address].filter(Boolean).join(" · ");
  const contacto = [b.phone, b.email, b.website].filter(Boolean).join(" · ");
  return [fiscal, contacto, b.footer_note].filter(Boolean);
}
