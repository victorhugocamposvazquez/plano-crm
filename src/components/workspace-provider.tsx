"use client";
import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { applyCommand, type Workspace, type Actor, type Command, type Document } from "@/lib/domain";
import { createDemo, demoActor } from "@/lib/demo";
import { supabaseConfigured } from "@/lib/supabase/browser";
import { readLocalFile, saveLocalFile } from "@/lib/local-files";

const key = "plano.workspace.v1";
type Context = { data: Workspace; actor: Actor; mode: "demo" | "supabase"; loading: boolean; error: string; notice: string; busy: boolean; refresh: () => Promise<void>; send: (command: Command) => Promise<Workspace>; upload: (file: File, projectId: string, category: Document["category"]) => Promise<Document>; fileUrl: (document: Document) => Promise<string>; notify: (message: string, action?: NoticeAction) => void; noticeAction: NoticeAction | null; dismissNotice: () => void };
/** Acción opcional de un aviso: «Deshacer» para lo reversible (completar una tarea, moverla de día, quitar un filtro). */
export type NoticeAction = { label: string; run: () => unknown };
const WorkspaceContext = createContext<Context | null>(null);
function savedDemo(): Workspace {
  const raw = localStorage.getItem(key);
  if (!raw) return createDemo();
  const parsed = JSON.parse(raw);
  if (!parsed.organization_id || !Array.isArray(parsed.projects) || !Array.isArray(parsed.versions) || !Array.isArray(parsed.certifications)) throw new Error("No se ha podido abrir la demostración guardada. Conserva los datos del navegador y contacta con soporte.");
  return parsed;
}
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const mode = supabaseConfigured() ? "supabase" : "demo";
  const [data, setData] = useState<Workspace>(() => ({ organization_id: "", organization_name: "PLANO", projects: [], articles: [], budgets: [], versions: [], tasks: [], purchases: [], documents: [], messages: [], activities: [], certifications: [] }));
  const [actor,setActor] = useState<Actor>(demoActor);
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
        const next = savedDemo(); if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(next)); setData(next);
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
        const result = await response.json(); if (!response.ok) throw new Error(result.error || "No se pudo guardar el cambio."); next = result.workspace;
        pendingRequest.current = null;
      }
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
  return <WorkspaceContext.Provider value={{ data, actor, mode, loading, error, notice, noticeAction, dismissNotice, busy, refresh, send, upload, fileUrl, notify }}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace() { const value = useContext(WorkspaceContext); if (!value) throw new Error("WorkspaceProvider missing"); return value; }
