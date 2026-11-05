/**
 * Parte de trabajo para un operario: lo que necesita saber de una tarea (obra, dirección, fecha, qué hacer, a quién llamar,
 * qué material hay) en un enlace que se abre sin cuenta ni registro.
 * El contenido va dentro del propio enlace, tras «#»: no se guarda en el servidor ni viaja en la petición, y quien tenga
 * el enlace lo ve. Por eso no lleva datos del cliente. Es una foto del momento en que se envía: si cambia algo, se manda otro.
 */
import { z } from "zod";
import { enlaceWhatsapp } from "./operarios";

export const parteSchema = z.object({
  v: z.literal(1),
  empresa: z.string().max(120),
  obra: z.string().max(200),
  direccion: z.string().max(300),
  tarea: z.string().min(1).max(500),
  oficio: z.string().max(120),
  fecha: z.iso.date(),
  para: z.string().max(120),
  contacto: z.string().max(120),
  telefono: z.string().max(40),
  notas: z.string().max(800),
  material: z.array(z.string().max(160)).max(8),
  enviado: z.string().max(40)
});
export type Parte = z.infer<typeof parteSchema>;

const aBase64Url = (texto: string) => { const bytes = new TextEncoder().encode(texto); let bin = ""; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const deBase64Url = (b64: string) => { const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/")); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); };

export const codificarParte = (p: Parte) => aBase64Url(JSON.stringify(p));
/** Lo que hay tras «#» en el enlace, o null si está roto o manipulado. */
export function leerParte(hash: string): Parte | null {
  try { const r = parteSchema.safeParse(JSON.parse(deBase64Url(hash.replace(/^#/, "")))); return r.success ? r.data : null; } catch { return null; }
}
export const enlaceParte = (origen: string, p: Parte) => `${origen.replace(/\/$/, "")}/parte#${codificarParte(p)}`;

const fechaTexto = (iso: string) => new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00`));
/** El mensaje de WhatsApp: corto, legible sin abrir el enlace, y el enlace al final. */
export function mensajeParte(p: Parte, enlace: string): string {
  return [
    `Hola${p.para ? ` ${p.para.split(" ")[0]}` : ""}, te paso el trabajo${p.empresa ? ` de ${p.empresa}` : ""}:`,
    `• ${p.tarea}`,
    `• ${fechaTexto(p.fecha).replace(/^./, c => c.toUpperCase())}${p.obra ? ` · ${p.obra}` : ""}`,
    p.direccion ? `• ${p.direccion}` : "",
    p.contacto ? `• Contacto: ${p.contacto}${p.telefono ? ` (${p.telefono})` : ""}` : "",
    "",
    `Todo el detalle, cómo llegar y el material: ${enlace}`
  ].filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== "")).join("\n");
}
export const whatsappParte = (telefono: string, p: Parte, enlace: string) => enlaceWhatsapp(telefono, mensajeParte(p, enlace));
export const mapaDe = (direccion: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;

/** Evento de calendario (.ics) para que el operario lo guarde en su móvil: día completo. */
export function calendarioParte(p: Parte): string {
  const d = p.fecha.replace(/-/g, ""), siguiente = new Date(`${p.fecha}T12:00:00`); siguiente.setDate(siguiente.getDate() + 1);
  const fin = `${siguiente.getFullYear()}${String(siguiente.getMonth() + 1).padStart(2, "0")}${String(siguiente.getDate()).padStart(2, "0")}`;
  const esc = (t: string) => t.replace(/[\\;,]/g, m => `\\${m}`).replace(/\n/g, "\\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Plano//Parte//ES", "BEGIN:VEVENT", `UID:${d}-${Math.abs([...p.tarea].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7))}@plano`,
    `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${fin}`, `SUMMARY:${esc(p.tarea)}`, `LOCATION:${esc(p.direccion)}`,
    `DESCRIPTION:${esc([p.obra, p.notas, p.contacto && `Contacto: ${p.contacto} ${p.telefono}`].filter(Boolean).join("\n"))}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
