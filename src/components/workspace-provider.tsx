"use client";
import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { applyCommand, type Workspace, type Actor, type Command, type Document, type Role } from "@/lib/domain";
import { guardarPuesto, leerPuesto, puestoPorDefecto, type Puesto } from "@/lib/puestos";
import { createDemo, demoActor } from "@/lib/demo";
import { supabaseConfigured } from "@/lib/supabase/browser";
import { readLocalFile, saveLocalFile } from "@/lib/local-files";

const key = "plano.workspace.v1";
/** En la demostración se puede entrar con otro permiso para probar Plano como cada persona del equipo. */
const demoRoleKey = "plano.demo.permiso";
const roles: Role[] = ["admin", "office", "manager", "site", "viewer"];
function demoRole(fallback: Role = demoActor.role): Role { try { const raw = localStorage.getItem(demoRoleKey); return roles.includes(raw as Role) ? (raw as Role) : fallback; } catch { return fallback; } }
type Context = { data: Workspace; actor: Actor; mode: "demo" | "supabase"; loading: boolean; error: string; notice: string; busy: boolean; refresh: () => Promise<void>; send: (command: Command) => Promise<Workspace>; upload: (file: File, projectId: string, category: Document["category"]) => Promise<Document>; fileUrl: (document: Document) => Promise<string>; puesto: Puesto; cambiarPuesto: (puesto: Puesto) => void; verComo: ((role: Role) => void) | null; notify: (message: string, action?: NoticeAction) => void; noticeAction: NoticeAction | null; dismissNotice: () => void };
/** Acción opcional de un aviso: «Deshacer» para lo reversible (completar una tarea, moverla de día, quitar un filtro). */
export type NoticeAction = { label: string; run: () => unknown };
const WorkspaceContext = createContext<Context | null>(null);
function savedDemo(): Workspace {
  const raw = localStorage.getItem(key);
  if (!raw) return createDemo();
  const parsed = JSON.parse(raw);
  if (!parsed.organization_id || !Array.isArray(parsed.projects) || !Array.isArray(parsed.versions) || !Array.isArray(parsed.certifications)) throw new Error("No se ha podido abrir la demostración guardada. Conserva los datos del navegador y contacta con soporte.");
  // Completa la demo antigua sin vincular nombres libres a UUID por suposición.
  parsed.members ??= createDemo().members;
  // Almacén (nov 2026): la demo antigua recibe los dos materiales de ejemplo con sus movimientos, y el pedido de placas se liga.
  if (!parsed.articles.some((x: Workspace["articles"][number]) => x.stocked)) {
    const demo = createDemo(), nuevos = demo.articles.filter(x => x.stocked && !parsed.articles.some((y: Workspace["articles"][number]) => y.code === x.code));
    parsed.articles.push(...nuevos);
    parsed.stock_movements = [...(parsed.stock_movements ?? []), ...(demo.stock_movements ?? []).filter(m => nuevos.some(x => x.id === m.article_id))];
    const ligado = demo.purchases.find(x => x.article_id), pedido = ligado && parsed.purchases.find((x: Workspace["purchases"][number]) => x.id === ligado.id);
    if (pedido && pedido.article_id === undefined && nuevos.some(x => x.id === ligado.article_id)) pedido.article_id = ligado.article_id;
  }
  // Propuesta en 3D (nov 2026): la demo antigua recibe las alternativas de suelo, pared y mobiliario.
  if (!parsed.articles.some((x: Workspace["articles"][number]) => x.code === "EQU-001")) {
    const extra = createDemo().articles.filter(x => ["PAV-002", "PAV-003", "PIN-002", "CAR-003", "EQU-001"].includes(x.code) && !parsed.articles.some((y: Workspace["articles"][number]) => y.code === x.code || y.id === x.id));
    parsed.articles.push(...extra);
  }
  // Stock de las alternativas del 3D (nov 2026): porcelánico, mueble auxiliar y estanterías se guardan en la nave.
  if (!parsed.articles.some((x: Workspace["articles"][number]) => x.code === "EQU-001" && x.stocked)) {
    const demo = createDemo();
    for (const x of demo.articles.filter(a => a.stocked && ["PAV-002", "CAR-003", "EQU-001"].includes(a.code))) {
      const guardado = parsed.articles.find((y: Workspace["articles"][number]) => y.id === x.id);
      if (guardado && !guardado.stocked) Object.assign(guardado, { stocked: true, stock_qty: x.stock_qty, stock_min: x.stock_min, stock_location: x.stock_location });
      if (guardado) parsed.stock_movements = [...(parsed.stock_movements ?? []), ...(demo.stock_movements ?? []).filter(m => m.article_id === x.id && !(parsed.stock_movements ?? []).some((y: { id: string }) => y.id === m.id))];
    }
  }
  // Tareas con lista (nov 2026): la tarea de replanteo de la demo recibe su descripción y su lista de ejemplo.
  if (!parsed.tasks.some((t: Workspace["tasks"][number]) => t.checklist?.length)) {
    const t = parsed.tasks.find((x: Workspace["tasks"][number]) => x.id === "00000000-0000-4000-8000-000000000202"), ejemplo = createDemo().tasks.find(x => x.id === "00000000-0000-4000-8000-000000000202");
    if (t && ejemplo) { t.description ??= ejemplo.description; t.checklist = ejemplo.checklist; }
  }
  // Subtareas asignadas (nov 2026): las del replanteo de ejemplo reciben a quién van, si aún no lo tenían.
  { const t = parsed.tasks.find((x: Workspace["tasks"][number]) => x.id === "00000000-0000-4000-8000-000000000202"), ejemplo = createDemo().tasks.find(x => x.id === "00000000-0000-4000-8000-000000000202");
    for (const p of t?.checklist ?? []) { const e = ejemplo?.checklist?.find(x => x.id === p.id); if (e?.assignee && !p.assignee) Object.assign(p, { assignee: e.assignee, assignee_id: e.assignee_id, operario_id: e.operario_id }); } }
  // Operarios (nov 2026): la demo antigua recibe los de ejemplo.
  parsed.operarios ??= createDemo().operarios;
  parsed.tasks = parsed.tasks.map((t: Workspace["tasks"][number]) => ({...t,assignee_id:t.assignee_id ?? null}));
  parsed.purchases = parsed.purchases.map((p: Workspace["purchases"][number]) => ({...p,assignee_id:p.assignee_id ?? null,assignee:p.assignee ?? ""}));
  return parsed;
}
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const mode = supabaseConfigured() ? "supabase" : "demo";
  const [data, setData] = useState<Workspace>(() => ({ organization_id: "", organization_name: "PLANO", members: [], projects: [], articles: [], budgets: [], versions: [], tasks: [], purchases: [], documents: [], messages: [], activities: [], certifications: [] }));
  const [actor,setActor] = useState<Actor>(demoActor);
  const [puesto,setPuesto] = useState<Puesto>(puestoPorDefecto(demoActor.role));
  const [loading,setLoading] = useState(true), [error,setError] = useState(""), [notice,setNotice] = useState(""), [noticeAction,setNoticeAction] = useState<NoticeAction | null>(null), [busy,setBusy] = useState(false);
  const lock = useRef(false);
  const pendingRequest = useRef<{ body: string; id: string } | null>(null);
  const notify = useCallback((message: string, action?: NoticeAction) => { setNotice(message); setNoticeAction(action ?? null); }, []);
  const dismissNotice = useCallback(() => { setNotice(""); setNoticeAction(null); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => { setNotice(""); setNoticeAction(null); }, noticeAction ? 7000 : 5500); return () => clearTimeout(timer); }, [notice, noticeAction]);
  const refresh = useCallback(async () => {
    try {
      if (mode === "demo") {
        // La demostración se lee al instante: se espera un momento para no adelantarse a la hidratación de la página.
        await new Promise<void>(resolve => { const seguir = () => setTimeout(resolve, 60); if (document.readyState === "complete") seguir(); else window.addEventListener("load", seguir, { once: true }); });
        const next = savedDemo(); if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(next)); setData(next); const me=next.members.find(m=>m.user_id===demoActor.id)!; const role=demoRole(me.role); setActor({id:me.user_id,name:me.display_name,role,position:role===me.role?me.position:puestoPorDefecto(role)});
      } else {
        const response = await fetch("/api/workspace", { cache: "no-store" });
        if (response.status === 401) { window.location.assign("/login"); return; }
        const body = await response.json(); if (!response.ok) throw new Error(body.error || "No se ha podido cargar el espacio.");
        setData(body.workspace); setActor(body.actor);
      }
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Error de conexión."); }
    finally { setLoading(false); }
  }, [mode]);
  // El puesto real viene del servidor. Cambiar la vista previa no modifica puesto ni permisos.
  useEffect(() => { if (data.organization_id) setPuesto(mode==="demo" ? leerPuesto(data.organization_id,actor.id,actor.role,actor.position) : actor.position); }, [data.organization_id, actor.id, actor.role, actor.position, mode]);
  const cambiarPuesto = useCallback((next: Puesto) => { setPuesto(next); if (mode === "demo" && data.organization_id) guardarPuesto(data.organization_id, actor.id, next); }, [data.organization_id, actor.id, mode]);
  const verComo = mode === "demo" ? (role: Role) => { try { localStorage.setItem(demoRoleKey, role); } catch { /* sin almacenamiento */ } setActor(a => ({ ...a, role, position:puestoPorDefecto(role) })); } : null;
  useEffect(() => { void refresh(); const onStorage = (e: StorageEvent) => { if (e.key === key) void refresh(); }; window.addEventListener("storage", onStorage); return () => window.removeEventListener("storage", onStorage); }, [refresh]);
  async function send(command: Command): Promise<Workspace> {
    if (lock.current) throw new Error("Espera a que termine el guardado anterior.");
    if (error) throw new Error("Recarga el espacio antes de guardar cambios.");
    lock.current = true; setBusy(true);
    try {
      let next: Workspace;
      if (mode === "demo") { next = applyCommand(savedDemo(), command, actor); localStorage.setItem(key, JSON.stringify(next)); }
      else {
        const serialized = JSON.stringify(command);
        if (pendingRequest.current?.body !== serialized) pendingRequest.current = { body: serialized, id: crypto.randomUUID() };
        const response = await fetch("/api/commands", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": pendingRequest.current.id }, body: serialized });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || "No se pudo guardar el cambio."); next = result.workspace; if(result.actor)setActor(result.actor);
        pendingRequest.current = null;
      }
      if(mode==="demo"){const me=next.members.find(m=>m.user_id===actor.id);if(me){const role=demoRole(me.role);setActor({...actor,name:me.display_name,position:role===me.role?me.position:puestoPorDefecto(role),role});}}
      setData(next); return next;
    } finally { lock.current = false; setBusy(false); }
  }
  async function upload(file: File, projectId: string, category: Document["category"]) {
    if (file.size === 0 || file.size > 50 * 1024 * 1024) throw new Error("El archivo debe tener contenido y ocupar como máximo 50 MB.");
    const supported = ["application/pdf", "image/jpeg", "image/png", "image/webp", "video/mp4"];
    if (!supported.includes(file.type)) throw new Error("Admite PDF, JPG, PNG, WebP y MP4. Los DWG se incorporarán mediante el flujo de importación.");
    if (mode === "demo") {
      const path = `${data.organization_id}/${projectId}/${crypto.randomUUID()}`;
      await saveLocalFile(path, file);
      const next = await send({ type: "document.add", project_id: projectId, name: file.name, category, storage_path: path, mime_type: file.type, size_bytes: file.size });
      const document = next.documents.find(d => d.storage_path === path);
      if (!document) throw new Error("No se ha podido vincular el archivo al proyecto.");
      return document;
    } else {
      const response = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, name: file.name, category, mime_type: file.type, size_bytes: file.size }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      const { createClient } = await import("@/lib/supabase/browser");
      const { error: uploadError } = await createClient().storage.from("project-files").uploadToSignedUrl(result.path, result.token, file, { contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);
      const next = await send({ type: "document.add", project_id: projectId, name: file.name, category, storage_path: result.path, mime_type: file.type, size_bytes: file.size });
      const document = next.documents.find(d => d.storage_path === result.path);
      if (!document) throw new Error("No se ha podido vincular el archivo al proyecto.");
      return document;
    }
  }
  async function fileUrl(document: Document) {
    if (mode === "demo") { const file = await readLocalFile(document.storage_path); if (!file) throw new Error("El archivo ya no está disponible en este navegador."); return URL.createObjectURL(file); }
    const response = await fetch(`/api/documents/${document.id}`); const body = await response.json(); if (!response.ok) throw new Error(body.error); return body.url as string;
  }
  return <WorkspaceContext.Provider value={{ data, actor, mode, loading, error, notice, noticeAction, dismissNotice, busy, refresh, send, upload, fileUrl, notify, puesto, cambiarPuesto, verComo }}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace() { const value = useContext(WorkspaceContext); if (!value) throw new Error("WorkspaceProvider missing"); return value; }
/** Puesto actual con respaldo por si una prueba monta la pantalla sin proveedor completo. */
export function usePuesto(): Puesto { const { puesto, actor } = useWorkspace(); return puesto ?? actor?.position ?? puestoPorDefecto(actor?.role ?? "office"); }
