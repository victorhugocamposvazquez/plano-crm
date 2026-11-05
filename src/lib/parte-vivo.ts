/**
 * Parte vivo: lo que ve y puede hacer un operario con el enlace `/p/<token>`, sin cuenta.
 * Con Supabase lo resuelven las funciones `parte_*` de la base de datos (migración 202611050003); en la demostración,
 * estas mismas reglas sobre el espacio guardado en este navegador. Aquí solo lo puro, para probarlo.
 */
import type { Document, Message, TaskShare, Workspace } from "./domain";

export type VistaParte =
  | { estado: "no_valido" }
  | { estado: "ok"; empresa: string; obra: string; direccion: string; tarea: string; oficio: string; fecha: string; hecha: boolean; hecha_el: string | null; para: string; contacto: string; telefono: string; notas: string; material: string[]; fotos: number; mensajes: number; caduca: string };

export const MAX_MENSAJES = 30, MAX_FOTOS = 20, MAX_FOTO_BYTES = 15 * 1024 * 1024;
export const tokenValido = (t: string) => /^[0-9a-f]{64}$/.test(t);
export const enlaceVivo = (origen: string, token: string) => `${origen.replace(/\/$/, "")}/p/${token}`;

function parte(ws: Workspace, token: string, ahora: string): TaskShare | undefined {
  if (!tokenValido(token)) return undefined;
  return (ws.task_shares ?? []).find(s => s.token === token && !s.revoked_at && s.expires_at > ahora && ws.tasks.some(t => t.id === s.task_id));
}
const quien = (s: TaskShare, ws: Workspace) => `${s.snapshot.para || ws.tasks.find(t => t.id === s.task_id)?.assignee || "Operario"} · parte`.slice(0, 120);

/** Lo que enseña la página: la tarea al día y lo escrito al enviarla. Nunca el cliente ni precios. */
export function vistaParte(ws: Workspace, token: string, ahora: string): VistaParte {
  const s = parte(ws, token, ahora);
  if (!s) return { estado: "no_valido" };
  const t = ws.tasks.find(x => x.id === s.task_id)!, p = ws.projects.find(x => x.id === t.project_id);
  return { estado: "ok", empresa: ws.organization_name, obra: p?.name ?? "", direccion: s.snapshot.direccion || p?.location || "", tarea: t.title, oficio: t.trade, fecha: t.due_date,
    hecha: t.status === "done", hecha_el: s.done_at, para: s.snapshot.para || t.assignee, contacto: s.snapshot.contacto, telefono: s.snapshot.telefono, notas: s.snapshot.notas,
    material: s.snapshot.material, fotos: s.photos_count, mensajes: s.messages_count, caduca: s.expires_at };
}

function alChat(ws: Workspace, s: TaskShare, body: string, ahora: string, uuid: () => string) {
  const t = ws.tasks.find(x => x.id === s.task_id)!;
  const m: Message = { id: uuid(), organization_id: ws.organization_id, project_id: t.project_id, body: body.slice(0, 5000), author_name: quien(s, ws), created_at: ahora };
  ws.messages.push(m);
}

/** El operario da la tarea por hecha; la nota llega al chat del proyecto. Repetirlo no hace nada. */
export function parteHecho(previo: Workspace, token: string, nota: string, ahora: string, uuid: () => string): Workspace {
  const ws = structuredClone(previo), s = parte(ws, token, ahora);
  if (!s) throw new Error("Este enlace ya no es válido.");
  const t = ws.tasks.find(x => x.id === s.task_id)!;
  if (t.status !== "done") {
    t.status = "done"; s.done_at = ahora;
    const n = nota.trim().slice(0, 1000);
    alChat(ws, s, `Hecho: ${t.title}${n ? `\n${n}` : ""}`, ahora, uuid);
    ws.activities.unshift({ id: uuid(), organization_id: ws.organization_id, project_id: t.project_id, text: `Completada desde el parte: ${t.title}`, actor_name: s.snapshot.para || "Operario", created_at: ahora });
  }
  return ws;
}

/** Una duda o un imprevisto del operario, al chat del proyecto. */
export function parteMensaje(previo: Workspace, token: string, texto: string, ahora: string, uuid: () => string): Workspace {
  const ws = structuredClone(previo), s = parte(ws, token, ahora);
  if (!s) throw new Error("Este enlace ya no es válido.");
  const t = texto.trim().slice(0, 1000);
  if (!t) throw new Error("Escribe el mensaje.");
  if (s.messages_count >= MAX_MENSAJES) throw new Error("Has enviado muchos mensajes desde este enlace. Llama a tu contacto.");
  alChat(ws, s, t, ahora, uuid); s.messages_count += 1;
  return ws;
}

/** Una foto ya guardada (`path`) pasa a ser documento «Durante la obra» del proyecto, con aviso en el chat. */
export function parteFoto(previo: Workspace, token: string, foto: { path: string; mime: string; size: number; nombre: string }, ahora: string, uuid: () => string): Workspace {
  const ws = structuredClone(previo), s = parte(ws, token, ahora);
  if (!s) throw new Error("Este enlace ya no es válido.");
  if (s.photos_count >= MAX_FOTOS) throw new Error(`Ya se han subido ${MAX_FOTOS} fotos desde este enlace.`);
  if (!/^image\/(jpeg|png|webp)$/.test(foto.mime) || foto.size <= 0 || foto.size > MAX_FOTO_BYTES) throw new Error("Solo fotos JPG, PNG o WebP de hasta 15 MB.");
  const t = ws.tasks.find(x => x.id === s.task_id)!;
  const d: Document = { id: uuid(), organization_id: ws.organization_id, project_id: t.project_id, name: `${foto.nombre.trim() || "Foto"} · ${t.title}`.slice(0, 500), category: "during", storage_path: foto.path, mime_type: foto.mime, size_bytes: foto.size, created_at: ahora };
  ws.documents.push(d); s.photos_count += 1;
  alChat(ws, s, `Ha subido una foto de «${t.title}». Está en Planos y fotos.`, ahora, uuid);
  return ws;
}

/** Estado del parte para quien lo envió: «visto», «hecho», «anulado» o «caducado». */
export function estadoEnvio(s: TaskShare, ahora: string): { texto: string; tono: "success" | "info" | "muted" | "warning" } {
  if (s.revoked_at) return { texto: "Anulado", tono: "muted" };
  if (s.expires_at <= ahora) return { texto: "Caducado", tono: "muted" };
  if (s.done_at) return { texto: "Hecho desde el parte", tono: "success" };
  if (s.seen_at) return { texto: "Abierto", tono: "info" };
  return { texto: "Sin abrir", tono: "warning" };
}
