"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, LayoutGrid, AtSign, Camera, MapPin, ListPlus, ArrowUp, Hash, FileText, ListChecks, Package, Receipt, X, Paperclip, Pencil, Trash2, Check, SmilePlus, Loader2, Image as ImageIcon, ExternalLink, Download, Search, Info, CircleHelp, ArrowLeft, Users, Layers2, Link2, ChevronRight, Slash, Sparkles, Activity } from "lucide-react";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { Popover } from "@/components/ui/popover";
import { useWorkspace } from "@/components/workspace-provider";
import { TaskDialog } from "@/components/project/task-dialog";
import { ChatPeek } from "@/components/project/chat-peek";
import { iniciales as inicialesProyecto } from "@/lib/pasos";
import { localDate } from "@/lib/hoy";
import { can, dateLabel, type Document, type Message, type Task } from "@/lib/domain";
import { isImage, formatSize } from "@/lib/documentos";
import { parseMessage, encodeRef, referenciables, filtrarReferencias, destinoRef, categorias, nombreCategoria, type Ref, type RefOption, type RefType } from "@/lib/chat-refs";
import { agruparMensajes, iniciales, tonoAutor } from "@/lib/chat-grupos";
import { buscarMensajes, trozos, participantes as listarParticipantes, elementosCompartidos } from "@/lib/chat-busqueda";
import { comandos, accesosRapidos, interpretar, sugerir, type Comando, type VistaChat } from "@/lib/chat-comandos";

const time = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
const EMOJIS = ["👍", "✅", "❤️", "👀", "🙏", "⚠️"] as const;
type Emoji = (typeof EMOJIS)[number];
const adjuntables = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const iconFor = (type: RefType) => type === "v" ? Receipt : type === "d" ? FileText : type === "t" ? ListChecks : type === "c" ? Package : type === "k" ? Users : type === "p" ? Layers2 : Hash;
const iconoAcceso: Record<string, typeof Receipt> = { presupuesto: Receipt, tareas: ListChecks, compras: Package, documentos: FileText, cliente: Users, estado: Activity };
const etiquetaDia = (iso: string) => { const hoy = new Date().toISOString().slice(0, 10); const ayer = new Date(Date.now() - 864e5).toISOString().slice(0, 10); return iso === hoy ? "Hoy" : iso === ayer ? "Ayer" : day.format(new Date(`${iso}T12:00:00`)).replace(/^./, c => c.toUpperCase()); };
type Picker = { open: boolean; query: string; cat: RefType | null; active: number };
const pickerCerrado: Picker = { open: false, query: "", cat: null, active: 0 };
type Peek = Exclude<VistaChat, { kind: "buscar" } | { kind: "ayuda" } | { kind: "aviso" }>;

/**
 * Conversación del proyecto. Cabecera con participantes, la lupa siempre visible e información (lo compartido);
 * burbujas por autor con reacciones, edición y borrado; adjuntos con previsualización; «#» para mencionar
 * algo del proyecto por categoría y accesos rápidos / «/» para consultar (presupuesto, tareas, compras…)
 * en un modal encima del chat: lo mismo que se vería en la ficha, sin salir de la conversación.
 */
export function ChatPanel({ projectId, messages, title, subtitle, onClose }: { projectId: string; messages: Message[]; title?: string; subtitle?: string; onClose?: () => void }) {
  const { data, actor, busy, send, notify, fileUrl, upload } = useWorkspace();
  const allowed = can(actor.role, "message.send");
  const puedeBorrarAjenos = actor.role === "admin" || actor.role === "office";
  const [vista, setVista] = useState<"chat" | "info">("chat");
  const [peek, setPeek] = useState<Peek | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [ayuda, setAyuda] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingAttach, setPendingAttach] = useState<{ name: string; since: string } | null>(null);
  const [adjuntos, setAdjuntos] = useState<Document[]>([]);
  const [preview, setPreview] = useState<{ doc: Document; url: string | null } | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [picker, setPicker] = useState<Picker>(pickerCerrado);
  const [cmdActive, setCmdActive] = useState(0);
  const [adjuntarAbierto, setAdjuntarAbierto] = useState(false);
  const [mencionAbierta, setMencionAbierta] = useState(false);
  const fotoInput = useRef<HTMLInputElement>(null);
  const chipsRef = useRef<HTMLElement>(null);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const lightbox = useRef<HTMLDialogElement>(null);
  const attachInput = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const buscador = useRef<HTMLInputElement>(null);

  const grupos = useMemo(() => agruparMensajes(messages, actor.name), [messages, actor.name]);
  const options = useMemo(() => referenciables(data, projectId), [data, projectId]);
  const matches = useMemo(() => filtrarReferencias(options, picker.query, picker.cat).slice(0, 10), [options, picker.query, picker.cat]);
  const conteoCat = useMemo(() => Object.fromEntries(categorias.map(c => [c.type, options.filter(o => o.type === c.type).length])) as Record<RefType, number>, [options]);
  const gente = useMemo(() => listarParticipantes(messages), [messages]);
  // A quién se puede mencionar: quien ya ha escrito y quien tiene tareas en esta obra.
  const equipo = useMemo(() => [...new Set([...gente.map(p => p.name.split(" · ")[0]), ...data.tasks.filter(t => t.project_id === projectId && t.assignee).map(t => t.assignee)])].filter(n => n !== actor.name.split(" · ")[0]), [gente, data.tasks, projectId, actor.name]);
  const compartidos = useMemo(() => elementosCompartidos(messages, data), [messages, data]);
  const coincidencias = useMemo(() => (buscando ? buscarMensajes(messages, consulta) : null), [buscando, consulta, messages]);
  const sugerencias = useMemo(() => (body.trim().startsWith("/") && !picker.open ? sugerir(body, 8) : []), [body, picker.open]);
  const atajoExacto = useMemo(() => (!body.trim().startsWith("/") && !picker.open ? interpretar(body) : null), [body, picker.open]);

  useEffect(() => { const d = lightbox.current; if (!d) return; if (preview && !d.open) d.showModal(); if (!preview && d.open) d.close(); }, [preview]);
  useEffect(() => { if (vista === "chat" && !buscando) end.current?.scrollIntoView({ block: "end" }); }, [messages.length, vista, buscando]);
  useEffect(() => { if (buscando) setTimeout(() => buscador.current?.focus(), 0); }, [buscando]);
  useEffect(() => { setCmdActive(0); }, [body]);
  // Cuando el documento recién subido aparece en el espacio, queda como adjunto del mensaje que se está escribiendo.
  useEffect(() => {
    if (!pendingAttach) return;
    const doc = data.documents.filter(d => d.project_id === projectId && d.name === pendingAttach.name && d.created_at >= pendingAttach.since).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!doc) return;
    setAdjuntos(prev => (prev.some(d => d.id === doc.id) ? prev : [...prev, doc]));
    setPendingAttach(null); textarea.current?.focus();
  }, [data.documents, pendingAttach, projectId]);

  async function previsualizar(doc: Document) {
    setPreview({ doc, url: null });
    try { const url = await fileUrl(doc); setPreview(p => (p && p.doc.id === doc.id ? { doc, url } : p)); }
    catch (e) { setPreview(null); notify(e instanceof Error ? e.message : "No se ha podido abrir el documento."); }
  }

  /** Toda consulta se resuelve encima del chat: modal, búsqueda, ayuda o un aviso. Nunca una navegación. */
  function abrirVista(v: VistaChat) {
    if (v.kind === "buscar") { setVista("chat"); setBuscando(true); setConsulta(v.query); return; }
    if (v.kind === "ayuda") { setAyuda(true); return; }
    if (v.kind === "aviso") { notify(v.texto); return; }
    setPeek(v);
  }
  function consultar(comando: Comando, argumento = "") {
    abrirVista(comando.abrir({ data, projectId, argumento }));
    setBody(""); setPicker(pickerCerrado);
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (sending || busy) return;
    const texto = body.trim();
    if (!adjuntos.length) {
      if (texto.startsWith("/")) { const inter = interpretar(texto); if (inter) { consultar(inter.comando, inter.argumento); return; } const sug = sugerencias[cmdActive] ?? sugerencias[0]; if (sug) { consultar(sug); return; } notify("Esa consulta no existe. Escribe / para ver las disponibles."); return; }
      if (atajoExacto) { consultar(atajoExacto.comando, atajoExacto.argumento); return; }
    }
    const text = [adjuntos.map(d => encodeRef({ type: "d", id: d.id, label: d.name })).join(" "), texto].filter(Boolean).join(" ");
    if (!text) return;
    setSending(true);
    try { await send({ type: "message.send", project_id: projectId, body: text }); setBody(""); setAdjuntos([]); setPicker(pickerCerrado); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido enviar el mensaje."); }
    finally { setSending(false); textarea.current?.focus(); }
  }

  function insert(option: RefOption) {
    const token = encodeRef(option);
    setBody(prev => { const at = prev.lastIndexOf("#"); const base = picker.open && at >= 0 ? prev.slice(0, at) : prev; return `${base}${base && !base.endsWith(" ") ? " " : ""}${token} `; });
    setPicker(pickerCerrado);
    textarea.current?.focus();
  }

  function onChange(value: string) {
    setBody(value);
    setMencionAbierta(/(^|\s)@$/.test(value));
    const at = value.lastIndexOf("#");
    if (at >= 0 && (at === 0 || /\s/.test(value[at - 1])) && !value.slice(at).includes("]]")) setPicker(p => ({ open: true, query: value.slice(at + 1), cat: p.open ? p.cat : null, active: 0 }));
    else if (picker.open) setPicker(pickerCerrado);
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (picker.open) {
      const total = picker.cat || picker.query ? matches.length : categorias.length;
      if (event.key === "ArrowDown") { event.preventDefault(); setPicker(p => ({ ...p, active: total ? (p.active + 1) % total : 0 })); return; }
      if (event.key === "ArrowUp") { event.preventDefault(); setPicker(p => ({ ...p, active: total ? (p.active - 1 + total) % total : 0 })); return; }
      if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); if (!picker.cat && !picker.query) setPicker(p => ({ ...p, cat: categorias[p.active].type, active: 0 })); else if (matches[picker.active]) insert(matches[picker.active]); return; }
      if (event.key === "Backspace" && picker.cat && !picker.query) { event.preventDefault(); setPicker(p => ({ ...p, cat: null, active: 0 })); return; }
      if (event.key === "Escape") { event.preventDefault(); setPicker(pickerCerrado); return; }
    }
    if (sugerencias.length) {
      if (event.key === "ArrowDown") { event.preventDefault(); setCmdActive(a => (a + 1) % sugerencias.length); return; }
      if (event.key === "ArrowUp") { event.preventDefault(); setCmdActive(a => (a - 1 + sugerencias.length) % sugerencias.length); return; }
      if (event.key === "Tab") { event.preventDefault(); setBody(`${sugerencias[cmdActive].formas[0]} `); return; }
      if (event.key === "Escape") { event.preventDefault(); setBody(""); return; }
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); }
  }

  async function guardarEdicion() {
    if (!editing || working) return;
    const text = editing.body.trim(); if (!text) return;
    setWorking(editing.id);
    try { await send({ type: "message.edit", id: editing.id, body: text }); setEditing(null); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido editar el mensaje."); }
    finally { setWorking(null); }
  }
  async function borrar(id: string) {
    if (working) return;
    setWorking(id);
    try { await send({ type: "message.delete", id }); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido borrar el mensaje."); }
    finally { setWorking(null); }
  }
  async function adjuntar(file: File | undefined) {
    if (!file || uploading) return;
    if (!adjuntables.includes(file.type)) { notify("Adjunta fotos (JPG, PNG, WebP) o PDF."); return; }
    if (file.size > 50 * 1024 * 1024) { notify("El archivo supera 50 MB."); return; }
    setUploading(true);
    const since = new Date(Date.now() - 1000).toISOString();
    try { await upload(file, projectId, isImage({ mime_type: file.type }) ? "during" : "other"); setPendingAttach({ name: file.name, since }); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido subir el archivo."); }
    finally { setUploading(false); }
  }
  async function reaccionar(id: string, emoji: Emoji) {
    setReactFor(null);
    try { await send({ type: "message.react", id, emoji }); }
    catch (e) { notify(e instanceof Error ? e.message : "No se ha podido reaccionar."); }
  }
  function openRef(ref: Ref) {
    if (ref.type === "v") { setPeek({ kind: "presupuesto", versionId: ref.id }); return; }
    const dest = destinoRef(ref, data, projectId);
    if ("task" in dest) { const t = data.tasks.find(x => x.id === dest.task); if (t) setOpenTask(t); else notify("Esa tarea ya no existe."); return; }
    if ("document" in dest) { const doc = data.documents.find(d => d.id === dest.document); if (!doc) { notify("Ese documento ya no está en el proyecto."); return; } void previsualizar(doc); }
  }

  function mencionar(nombre: string) {
    setMencionAbierta(false);
    setBody(b => { const sin = /(^|\s)@$/.test(b) ? b.slice(0, -1) : b; return `${sin}${sin && !sin.endsWith(" ") ? " " : ""}@${nombre} `; });
    setTimeout(() => textarea.current?.focus(), 0);
  }
  function compartir(tipo: RefType) {
    setAdjuntarAbierto(false);
    setPicker({ open: true, query: "", cat: tipo, active: 0 });
    setBody(b => `${b}${b && !b.endsWith(" ") ? " " : ""}#`);
    setTimeout(() => textarea.current?.focus(), 0);
  }
  function compartirUbicacion() {
    setAdjuntarAbierto(false);
    const lugar = data.projects.find(p => p.id === projectId)?.location;
    if (!lugar) { notify("Este proyecto no tiene dirección."); return; }
    setBody(b => `${b}${b && !b.endsWith(" ") ? " " : ""}${lugar} · https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lugar)} `);
    setTimeout(() => textarea.current?.focus(), 0);
  }
  async function hacerTarea(m: Message) {
    const titulo = parseMessage(m.body).map(part => (part.kind === "text" ? part.text : part.ref.label)).join("").trim().slice(0, 200);
    if (!titulo) return;
    try {
      await send({ type: "task.create", project_id: projectId, title: titulo, trade: "Coordinación", assignee: "", due_date: localDate(), weight: 10 });
      notify(`Tarea creada para hoy: ${titulo}`);
    } catch (e) { notify(e instanceof Error ? e.message : "No se ha podido crear la tarea."); }
  }

  /** Miniatura de una foto adjunta: la URL se resuelve igual que al abrir el documento. */
  const DocThumb = ({ doc, size = "md" }: { doc: Document; size?: "md" | "sm" }) => {
    const [src, setSrc] = useState<string | null>(null);
    useEffect(() => { let activo = true; fileUrl(doc).then(u => { if (activo) setSrc(u); }).catch(() => undefined); return () => { activo = false; }; }, [doc]);
    return (
      <button type="button" className="msg-thumb" data-size={size} onClick={() => void previsualizar(doc)} title={`${doc.name} · ${formatSize(doc.size_bytes)}`}>
        {src ? <img src={src} alt={doc.name} /> : <span className="msg-thumb-loading"><Loader2 size={16} strokeWidth={1.8} aria-hidden="true" /></span>}
        {size === "md" && <small>{doc.name}</small>}
      </button>
    );
  };

  const RefChip = ({ r }: { r: Ref }) => {
    const docImagen = r.type === "d" ? data.documents.find(d => d.id === r.id) : undefined;
    if (docImagen && isImage(docImagen)) return <DocThumb doc={docImagen} />;
    const Icon = iconFor(r.type);
    const dest = destinoRef(r, data, projectId);
    const exists = r.type === "v" ? data.versions.some(v => v.id === r.id) : r.type === "d" ? data.documents.some(d => d.id === r.id) : r.type === "t" ? data.tasks.some(t => t.id === r.id) : r.type === "c" ? data.purchases.some(c => c.id === r.id) : r.type === "p" ? data.projects.some(p => p.id === r.id) : true;
    const content = <><Icon size={12} strokeWidth={1.9} aria-hidden="true" />{r.label}</>;
    if (!exists) return <span className="ref-chip" data-missing="true" title="Ya no existe en el proyecto">{content}</span>;
    if (r.type !== "v" && "href" in dest) return <Link href={dest.href} className="ref-chip">{content}</Link>;
    return <button type="button" className="ref-chip" onClick={() => openRef(r)}>{content}</button>;
  };

  const Texto = ({ s }: { s: string }) => (buscando && consulta.trim() ? <>{trozos(s, consulta).map((t, i) => (t.hit ? <mark key={i}>{t.text}</mark> : <span key={i}>{t.text}</span>))}</> : <>{s}</>);
  const AvatarStack = () => (
    <span className="avatar-stack" aria-hidden="true">
      {gente.slice(0, 4).map(p => <span key={p.name} className="msg-avatar" data-tone={tonoAutor(p.name)}>{iniciales(p.name)}</span>)}
      {gente.length > 4 && <span className="msg-avatar" data-tone="5">+{gente.length - 4}</span>}
    </span>
  );
  const nombres = gente.length === 0 ? "Todavía nadie ha escrito" : gente.length <= 3 ? gente.map(p => p.name.split(" · ")[0]).join(", ") : `${gente.slice(0, 2).map(p => p.name.split(" · ")[0]).join(", ")} y ${gente.length - 2} más`;

  const gruposVisibles = coincidencias ? grupos.map(g => ({ ...g, items: g.items.filter(m => coincidencias.has(m.id)) })).filter(g => g.items.length) : grupos;
  let lastDay = "";

  const Seccion = ({ titulo, icono, children, vacio, vacioTexto }: { titulo: string; icono: ReactNode; children: ReactNode; vacio?: boolean; vacioTexto?: string }) => (
    <section className="info-section"><h3>{icono}{titulo}</h3>{vacio ? <p className="muted text-sm">{vacioTexto ?? "Nada todavía."}</p> : children}</section>
  );

  return (
    <div className="chat chat-window">
      <div className="chat-top">
        {vista === "info" ? (
          <button type="button" className="chat-top-back" onClick={() => setVista("chat")}><ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />Volver al chat</button>
        ) : (<>
          {onClose && <button type="button" className="chat-top-close-phone" aria-label="Volver" onClick={onClose}><ChevronLeft size={22} strokeWidth={1.8} aria-hidden="true" /></button>}
          <button type="button" className="chat-top-people" onClick={() => setVista("info")} title="Participantes y lo compartido">
            {title ? <span className="avatar avatar-ink chat-top-avatar" aria-hidden="true">{inicialesProyecto(title)}</span> : <AvatarStack />}
            <span className="chat-top-names"><strong>{title ?? `${gente.length} participante${gente.length === 1 ? "" : "s"}`}</strong><small className="muted">{nombres}</small>{subtitle && <small className="sr-only">{subtitle}</small>}</span>
          </button>
        </>)}
        <span className="chat-top-tools">
          {/* La lupa siempre a la vista, en la conversación y en la información: abre la búsqueda por palabra. */}
          <button type="button" className="composer-tool" aria-label="Buscar en la conversación" title="Buscar en la conversación" aria-pressed={buscando && vista === "chat"} onClick={() => { if (buscando && vista === "chat") { setBuscando(false); setConsulta(""); return; } setVista("chat"); setBuscando(true); }}><Search size={18} strokeWidth={1.7} aria-hidden="true" /></button>
          <button type="button" className="composer-tool" aria-label="Fotos, archivos y enlaces" title="Fotos, archivos y enlaces" aria-pressed={vista === "info"} onClick={() => setVista(v => (v === "info" ? "chat" : "info"))}><LayoutGrid size={18} strokeWidth={1.7} aria-hidden="true" /></button>
          <Menu label="Más opciones del chat" align="end" items={[
            { id: "mencionar", label: "Mencionar algo del proyecto", hint: "Presupuesto, documento, tarea…", icon: <Hash size={16} strokeWidth={1.7} />, onSelect: () => { setVista("chat"); setPicker({ open: true, query: "", cat: null, active: 0 }); setBody(b => `${b}${b && !b.endsWith(" ") ? " " : ""}#`); setTimeout(() => textarea.current?.focus(), 0); } },
            { id: "consultar", label: "Consultar escribiendo", hint: "Escribe / y elige", icon: <Slash size={16} strokeWidth={1.7} />, onSelect: () => { setVista("chat"); setBody("/"); setTimeout(() => textarea.current?.focus(), 0); } },
            { id: "ayuda", label: "Cómo se usa el chat", icon: <CircleHelp size={16} strokeWidth={1.7} />, onSelect: () => setAyuda(true) }
          ]} />
          {onClose && <button type="button" className="composer-tool" aria-label={buscando ? "Cerrar la búsqueda" : vista === "info" ? "Volver al chat" : "Cerrar el chat"} title={buscando ? "Cerrar la búsqueda" : vista === "info" ? "Volver al chat" : "Cerrar el chat"} onClick={() => { if (buscando) { setBuscando(false); setConsulta(""); } else if (vista === "info") setVista("chat"); else onClose(); }}><X size={18} strokeWidth={1.7} aria-hidden="true" /></button>}
        </span>
      </div>

      {buscando && vista === "chat" && (
        <label className="chat-search">
          <Search size={15} strokeWidth={1.8} aria-hidden="true" />
          <input ref={buscador} type="search" value={consulta} onChange={e => setConsulta(e.target.value)} placeholder="Buscar en la conversación…" aria-label="Buscar en la conversación" onKeyDown={e => { if (e.key === "Escape") { setBuscando(false); setConsulta(""); } }} />
          <span className="muted text-xs pl-mono">{consulta.trim() ? `${coincidencias?.size ?? 0} ${coincidencias?.size === 1 ? "mensaje" : "mensajes"}` : ""}</span>
          <button type="button" className="search-clear" aria-label="Cerrar búsqueda" onClick={() => { setBuscando(false); setConsulta(""); }}><X size={13} strokeWidth={1.8} aria-hidden="true" /></button>
        </label>
      )}

      {vista === "info" ? (
        <div className="chat-info">
          <Seccion titulo="Participantes" icono={<Users size={14} strokeWidth={1.8} aria-hidden="true" />} vacio={!gente.length} vacioTexto="Nadie ha escrito todavía.">
            <ul className="info-people">{gente.map(p => <li key={p.name}><span className="msg-avatar" data-tone={tonoAutor(p.name)} aria-hidden="true">{iniciales(p.name)}</span><span style={{ minWidth: 0, flex: 1 }}><strong>{p.name}</strong><small className="muted">{p.mensajes} mensaje{p.mensajes === 1 ? "" : "s"} · último {dateLabel(p.ultimo)}</small></span></li>)}</ul>
          </Seccion>
          <Seccion titulo={`Fotos${compartidos.fotos.length ? ` · ${compartidos.fotos.length}` : ""}`} icono={<ImageIcon size={14} strokeWidth={1.8} aria-hidden="true" />} vacio={!compartidos.fotos.length}>
            <div className="info-photos">{compartidos.fotos.map(d => <DocThumb key={d.id} doc={d} size="sm" />)}</div>
          </Seccion>
          <Seccion titulo={`Documentos${compartidos.documentos.length ? ` · ${compartidos.documentos.length}` : ""}`} icono={<FileText size={14} strokeWidth={1.8} aria-hidden="true" />} vacio={!compartidos.documentos.length}>
            <ul className="info-list">{compartidos.documentos.map(d => <li key={d.id}><button type="button" className="info-row" onClick={() => void previsualizar(d)}><FileText size={16} strokeWidth={1.7} aria-hidden="true" /><span style={{ minWidth: 0, flex: 1 }}><strong>{d.name}</strong><small className="muted">{formatSize(d.size_bytes)} · {dateLabel(d.created_at)}</small></span><ChevronRight size={14} strokeWidth={1.7} aria-hidden="true" className="muted" /></button></li>)}</ul>
          </Seccion>
          {(["v", "t", "c", "k", "p"] as const).map(tipo => compartidos.referencias[tipo].length > 0 && (
            <Seccion key={tipo} titulo={`${nombreCategoria(tipo)}s mencionados · ${compartidos.referencias[tipo].length}`} icono={(() => { const I = iconFor(tipo); return <I size={14} strokeWidth={1.8} aria-hidden="true" />; })()}>
              <div className="info-chips">{compartidos.referencias[tipo].map(r => <RefChip key={`${r.type}-${r.id}`} r={r} />)}</div>
            </Seccion>
          ))}
          <Seccion titulo={`Enlaces${compartidos.enlaces.length ? ` · ${compartidos.enlaces.length}` : ""}`} icono={<Link2 size={14} strokeWidth={1.8} aria-hidden="true" />} vacio={!compartidos.enlaces.length}>
            <ul className="info-list">{compartidos.enlaces.map(u => <li key={u}><a className="info-row" href={u} target="_blank" rel="noopener"><ExternalLink size={15} strokeWidth={1.7} aria-hidden="true" /><span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u}</span></a></li>)}</ul>
          </Seccion>
        </div>
      ) : (
        <div className="chat-list" role="log" aria-label="Mensajes del proyecto" aria-live="polite">
          {grupos.length === 0 && (
            <div className="chat-empty">
              <strong>Sin mensajes todavía</strong>
              <span className="muted text-sm">Lo que se escriba aquí lo ve todo el equipo del proyecto.</span>
              <span className="muted text-sm">Los botones de abajo consultan el presupuesto, las tareas o las compras sin salir de aquí.</span>
            </div>
          )}
          {buscando && consulta.trim() && gruposVisibles.length === 0 && <div className="chat-empty"><strong>Nada coincide con «{consulta}»</strong></div>}
          {gruposVisibles.map(g => {
            const showDay = g.day !== lastDay; lastDay = g.day;
            return (
              <div key={g.id}>
                {showDay && <div className="chat-day"><span>{etiquetaDia(g.day)}</span></div>}
                <div className="msg-group" data-mine={g.mine}>
                  {!g.mine && <span className="msg-avatar" data-tone={tonoAutor(g.author)} aria-hidden="true">{iniciales(g.author)}</span>}
                  <div className="msg-stack">
                    {!g.mine && <span className="msg-author">{g.author}</span>}
                    {g.items.map((m, i) => {
                      const borrado = Boolean(m.deleted_at);
                      const acciones = borrado ? [] : [
                        ...(can(actor.role, "task.create") ? [{ id: "tarea", label: "Hacer tarea", hint: "La crea para hoy con este texto", icon: <ListPlus size={15} strokeWidth={1.7} />, onSelect: () => void hacerTarea(m) }] : []),
                        ...(g.mine ? [{ id: "editar", label: "Editar", icon: <Pencil size={15} strokeWidth={1.7} />, onSelect: () => setEditing({ id: m.id, body: m.body }) }] : []),
                        ...(g.mine || puedeBorrarAjenos ? [{ id: "borrar", label: "Borrar", hint: "Queda constancia de que hubo un mensaje", icon: <Trash2 size={15} strokeWidth={1.7} />, danger: true, onSelect: () => void borrar(m.id) }] : [])
                      ];
                      return (
                        <article key={m.id} className="msg" data-mine={g.mine} data-first={i === 0} data-last={i === g.items.length - 1} data-deleted={borrado} data-busy={working === m.id}>
                          {editing?.id === m.id ? (
                            <form className="msg-edit" onSubmit={e => { e.preventDefault(); void guardarEdicion(); }}>
                              <textarea value={editing.body} onChange={e => setEditing({ id: m.id, body: e.target.value })} rows={2} autoFocus maxLength={5000} aria-label="Editar mensaje" onKeyDown={e => { if (e.key === "Escape") setEditing(null); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void guardarEdicion(); } }} />
                              <div className="msg-edit-actions"><button type="button" className="btn btn-ghost" style={{ height: 30 }} onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="btn btn-primary" style={{ height: 30 }} disabled={!editing.body.trim() || working === m.id}><Check size={14} strokeWidth={2} aria-hidden="true" />Guardar</button></div>
                            </form>
                          ) : borrado ? (
                            <p className="msg-deleted">Mensaje eliminado</p>
                          ) : (
                            <p>{parseMessage(m.body).map((part, j) => part.kind === "text" ? <Texto key={j} s={part.text} /> : <RefChip key={j} r={part.ref} />)}</p>
                          )}
                          {!borrado && editing?.id !== m.id && <time dateTime={m.created_at}>{m.edited_at ? "editado · " : ""}{time.format(new Date(m.created_at))}</time>}
                          {!borrado && m.reactions && Object.keys(m.reactions).length > 0 && (
                            <span className="msg-reactions">{Object.entries(m.reactions).map(([emoji, quienes]) => <button key={emoji} type="button" className="reaction-pill" data-mine={quienes.includes(actor.name)} title={quienes.join(", ")} onClick={() => void reaccionar(m.id, emoji as Emoji)}>{emoji}<span className="pl-mono">{quienes.length}</span></button>)}</span>
                          )}
                          {!borrado && editing?.id !== m.id && (
                            <span className="msg-menu">
                              {allowed && <span className="msg-react"><button type="button" className="menu-trigger-sm" aria-label="Reaccionar" aria-expanded={reactFor === m.id} onClick={() => setReactFor(reactFor === m.id ? null : m.id)}><SmilePlus size={15} strokeWidth={1.7} aria-hidden="true" /></button>{reactFor === m.id && <span className="react-picker" role="group" aria-label="Reacciones">{EMOJIS.map(e => <button key={e} type="button" onClick={() => void reaccionar(m.id, e)} aria-label={`Reaccionar con ${e}`}>{e}</button>)}</span>}</span>}
                              {acciones.length > 0 && <Menu items={acciones} label="Opciones del mensaje" size="sm" align={g.mine ? "end" : "start"} />}
                            </span>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={end} />
        </div>
      )}

      {vista === "chat" && (
        <div className="chat-quick-wrap">
          <nav ref={chipsRef} className="chat-quick" aria-label="Consultar sin salir del chat">
            {accesosRapidos.map(c => { const Icon = iconoAcceso[c.id] ?? Sparkles; return <button key={c.id} type="button" className="chip" data-acceso={c.id} title={c.descripcion} onClick={() => consultar(c)}><Icon size={14} strokeWidth={1.8} aria-hidden="true" />{c.acceso}</button>; })}
          </nav>
          <button type="button" className="chat-quick-more" aria-label="Ver más" title="Ver más" onClick={() => chipsRef.current?.scrollBy({ left: 160, behavior: "smooth" })}><ChevronRight size={15} strokeWidth={1.9} aria-hidden="true" /></button>
        </div>
      )}

      {allowed && vista === "chat" ? (
        <form className="composer-wrap" onSubmit={submit}>
          {picker.open && (
            <div className="ref-picker" role="listbox" aria-label="Mencionar">
              {!picker.cat && !picker.query ? (
                <>
                  <div className="ref-picker-head"><span>Mencionar…</span><small className="muted">o sigue escribiendo para buscar en todo</small></div>
                  <div className="ref-cats">
                    {categorias.map((c, i) => { const Icon = iconFor(c.type); return <button key={c.type} type="button" role="option" aria-selected={i === picker.active} className="ref-cat" disabled={!conteoCat[c.type]} onMouseEnter={() => setPicker(p => ({ ...p, active: i }))} onMouseDown={e => e.preventDefault()} onClick={() => setPicker(p => ({ ...p, cat: c.type, active: 0 }))}><Icon size={16} strokeWidth={1.7} aria-hidden="true" /><span><strong>{c.label}</strong><small className="muted">{conteoCat[c.type] ? `${conteoCat[c.type]} · ${c.hint}` : "Nada que mencionar"}</small></span></button>; })}
                  </div>
                </>
              ) : (
                <>
                  <div className="ref-picker-head">{picker.cat ? <button type="button" className="ref-picker-back" onMouseDown={e => e.preventDefault()} onClick={() => setPicker(p => ({ ...p, cat: null, active: 0 }))}><ArrowLeft size={13} strokeWidth={2} aria-hidden="true" />{nombreCategoria(picker.cat)}s</button> : <span>Resultados en todo el proyecto</span>}<small className="muted">{matches.length ? `${matches.length} opciones` : ""}</small></div>
                  {matches.length === 0 && <div className="muted text-xs" style={{ padding: "8px 10px" }}>Nada coincide con «{picker.query}».</div>}
                  {matches.map((o, i) => { const Icon = iconFor(o.type); return (
                    <button key={`${o.type}-${o.id}`} type="button" role="option" aria-selected={i === picker.active} className="ref-option" onMouseEnter={() => setPicker(p => ({ ...p, active: i }))} onMouseDown={e => e.preventDefault()} onClick={() => insert(o)}>
                      <Icon size={15} strokeWidth={1.7} aria-hidden="true" />
                      <span style={{ minWidth: 0 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span><small className="muted text-xs">{picker.cat ? o.hint ?? "" : `${o.group}${o.hint ? ` · ${o.hint}` : ""}`}</small></span>
                    </button>
                  ); })}
                </>
              )}
            </div>
          )}
          {!picker.open && sugerencias.length > 0 && (
            <div className="ref-picker cmd-list" role="listbox" aria-label="Consultas">
              <div className="ref-picker-head"><span>Consultar</span><button type="button" className="ref-picker-back" onMouseDown={e => e.preventDefault()} onClick={() => setAyuda(true)}>Ver todas</button></div>
              {sugerencias.map((c, i) => (
                <button key={c.id} type="button" role="option" aria-selected={i === cmdActive} className="ref-option" onMouseEnter={() => setCmdActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => consultar(c)}>
                  <Slash size={14} strokeWidth={2} aria-hidden="true" />
                  <span style={{ minWidth: 0 }}><span className="pl-mono">{c.formas[0]}{c.conArgumento ? " …" : ""}</span><small className="muted text-xs">{c.descripcion}</small></span>
                </button>
              ))}
            </div>
          )}
          {!picker.open && atajoExacto && (
            <div className="cmd-hint"><Sparkles size={13} strokeWidth={2} aria-hidden="true" /><span>Enter abre «{atajoExacto.comando.descripcion.toLowerCase().replace(/\.$/, "")}»</span><button type="button" className="ref-picker-back" onMouseDown={e => e.preventDefault()} onClick={() => { const texto = body; setBody(""); void send({ type: "message.send", project_id: projectId, body: texto.trim() }).catch(e => notify(e instanceof Error ? e.message : "No se ha podido enviar el mensaje.")); }}>Enviar como mensaje</button></div>
          )}
          {adjuntos.length > 0 && (
            <div className="composer-attachments" aria-label="Adjuntos del mensaje">
              {adjuntos.map(d => <span key={d.id} className="ref-chip" data-attachment="true">{isImage(d) ? <ImageIcon size={12} strokeWidth={1.9} aria-hidden="true" /> : <FileText size={12} strokeWidth={1.9} aria-hidden="true" />}{d.name}<button type="button" aria-label={`Quitar ${d.name}`} onClick={() => setAdjuntos(prev => prev.filter(x => x.id !== d.id))}><X size={12} strokeWidth={2} aria-hidden="true" /></button></span>)}
            </div>
          )}
          <div className="composer">
            <Popover open={adjuntarAbierto} onClose={() => setAdjuntarAbierto(false)} side="top" panelClassName="composer-pop" trigger={
              <button type="button" className="composer-tool" aria-label="Adjuntar" title="Adjuntar" aria-expanded={adjuntarAbierto} disabled={uploading} onClick={() => setAdjuntarAbierto(v => !v)}>{uploading ? <Loader2 size={18} strokeWidth={1.8} aria-hidden="true" className="spin" /> : <Paperclip size={18} strokeWidth={1.7} aria-hidden="true" />}</button>
            }>
              <button type="button" className="composer-pop-item" onClick={() => { setAdjuntarAbierto(false); attachInput.current?.click(); }}><ImageIcon size={16} strokeWidth={1.7} aria-hidden="true" />Fotos o documento</button>
              <button type="button" className="composer-pop-item" onClick={() => { setAdjuntarAbierto(false); fotoInput.current?.click(); }}><Camera size={16} strokeWidth={1.7} aria-hidden="true" />Cámara</button>
              <button type="button" className="composer-pop-item" disabled={!conteoCat.v} onClick={() => compartir("v")}><Receipt size={16} strokeWidth={1.7} aria-hidden="true" />Presupuesto</button>
              <button type="button" className="composer-pop-item" disabled={!conteoCat.t} onClick={() => compartir("t")}><ListChecks size={16} strokeWidth={1.7} aria-hidden="true" />Tarea</button>
              <button type="button" className="composer-pop-item" onClick={compartirUbicacion}><MapPin size={16} strokeWidth={1.7} aria-hidden="true" />Ubicación de la obra</button>
            </Popover>
            <input ref={attachInput} type="file" accept={adjuntables.join(",")} onChange={e => { void adjuntar(e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
            <input ref={fotoInput} type="file" accept="image/*" capture="environment" onChange={e => { void adjuntar(e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
            <Popover open={mencionAbierta} onClose={() => setMencionAbierta(false)} side="top" panelClassName="composer-pop" trigger={
              <button type="button" className="composer-tool composer-at" aria-label="Mencionar a alguien" title="Mencionar a alguien" aria-expanded={mencionAbierta} onClick={() => setMencionAbierta(v => !v)}><AtSign size={18} strokeWidth={1.7} aria-hidden="true" /></button>
            }>
              <span className="composer-pop-title">Mencionar a</span>
              {equipo.length === 0 && <p className="muted text-sm" style={{ margin: 0, padding: "6px 12px 10px" }}>Todavía no hay nadie más en esta obra.</p>}
              {equipo.map(n => <button key={n} type="button" className="composer-pop-item" onClick={() => mencionar(n)}><span className="msg-avatar" data-tone={tonoAutor(n)} aria-hidden="true">{iniciales(n)}</span>{n}</button>)}
            </Popover>
            <textarea ref={textarea} value={body} onChange={e => onChange(e.target.value)} onKeyDown={onKey} rows={1} placeholder={uploading ? "Subiendo el archivo…" : "Mensaje · @ para mencionar"} aria-label="Nuevo mensaje" maxLength={5000} />
            <button type="submit" className="composer-send" aria-label={body.trim().startsWith("/") || atajoExacto ? "Consultar" : "Enviar mensaje"} disabled={(!body.trim() && adjuntos.length === 0) || sending || busy}>{body.trim().startsWith("/") || atajoExacto ? <Sparkles size={16} strokeWidth={2} aria-hidden="true" /> : <ArrowUp size={17} strokeWidth={2} aria-hidden="true" />}</button>
          </div>
        </form>
      ) : !allowed ? <p className="muted text-xs">Tu perfil puede leer la conversación pero no escribir.</p> : null}

      <TaskDialog task={openTask ? data.tasks.find(t => t.id === openTask.id) ?? null : null} onClose={() => setOpenTask(null)} />
      <ChatPeek vista={peek} projectId={projectId} onChange={setPeek} onClose={() => setPeek(null)} />

      <Modal open={ayuda} onClose={() => setAyuda(false)} title="Cómo se usa el chat" footer={<button type="button" className="btn btn-primary" onClick={() => setAyuda(false)}>Entendido</button>}>
        <div className="help">
          <section>
            <h3><Receipt size={15} strokeWidth={2} aria-hidden="true" />Consultar sin salir del chat</h3>
            <p className="text-sm">Pulsa uno de los botones bajo la conversación (Presupuesto, Tareas, Compras…) y se abre encima del chat lo mismo que verías en la ficha. Al cerrarlo sigues donde estabas. Si prefieres escribir, vale <kbd>/</kbd> y elegir, o la frase tal cual: «ver último presupuesto», «qué falta».</p>
            <ul className="help-cmds">{comandos.map(c => <li key={c.id}><span className="pl-mono">{c.formas[0]}{c.conArgumento ? " …" : ""}</span><span><strong>{c.descripcion}</strong><small className="muted">{c.ejemplo ? `Ej.: ${c.ejemplo} · ` : ""}También: {c.formas.slice(1, 4).map(f => `«${f}»`).join(", ")}</small></span></li>)}</ul>
          </section>
          <section>
            <h3><Hash size={15} strokeWidth={2} aria-hidden="true" />Mencionar algo del proyecto</h3>
            <p className="text-sm">Escribe <kbd>#</kbd> (o elige «Mencionar algo del proyecto» en el menú <kbd>···</kbd>) para señalar en tu mensaje de qué hablas: «revisad <span className="ref-chip" style={{ cursor: "default" }}><Receipt size={11} strokeWidth={2} aria-hidden="true" />V2 · Presupuesto de reforma</span> antes del viernes». Quien lo lea lo abre con un toque sin buscarlo, y en la información del chat queda reunido todo lo que se ha mencionado. No hace falta para hablar; sirve para ser concreto cuando hay varios presupuestos, documentos o tareas.</p>
            <ul className="help-grid">{categorias.map(c => { const Icon = iconFor(c.type); return <li key={c.type}><Icon size={14} strokeWidth={1.8} aria-hidden="true" /><span><strong>{c.label}</strong><small className="muted">{c.hint}</small></span></li>; })}</ul>
          </section>
          <section>
            <h3><Paperclip size={15} strokeWidth={2} aria-hidden="true" />Y además</h3>
            <ul className="help-plain">
              <li>El clip adjunta fotos o PDF: quedan en Planos y fotos del proyecto y se abren en grande con un toque.</li>
              <li>Pasa por un mensaje para reaccionar, editarlo o borrarlo. <kbd>Enter</kbd> envía, <kbd>Mayús</kbd>+<kbd>Enter</kbd> hace salto de línea.</li>
              <li>La lupa, siempre junto al menú <kbd>···</kbd>, busca en la conversación; «Fotos, documentos y participantes» reúne lo compartido y lo mencionado.</li>
            </ul>
          </section>
        </div>
      </Modal>

      <dialog ref={lightbox} className="lightbox" onClose={e => { if (e.target === e.currentTarget) setPreview(null); }} onClick={e => { if (e.target === e.currentTarget) setPreview(null); }} aria-label={preview ? preview.doc.name : "Previsualización"}>
        {preview && (
          <div className="lightbox-body">
            <header className="lightbox-head">
              <span style={{ minWidth: 0 }}><strong>{preview.doc.name}</strong><small className="muted"> · {formatSize(preview.doc.size_bytes)}</small></span>
              <span className="lightbox-tools">
                {preview.url && <a href={preview.url} target="_blank" rel="noopener" className="btn btn-ghost" style={{ height: 34 }}><ExternalLink size={15} strokeWidth={1.8} aria-hidden="true" />Abrir aparte</a>}
                {preview.url && <a href={preview.url} download={preview.doc.name} className="btn btn-ghost" style={{ height: 34 }}><Download size={15} strokeWidth={1.8} aria-hidden="true" />Descargar</a>}
                <button type="button" className="search-clear" aria-label="Cerrar" onClick={() => setPreview(null)}><X size={15} strokeWidth={1.8} aria-hidden="true" /></button>
              </span>
            </header>
            <div className="lightbox-stage">
              {!preview.url && <span className="muted text-sm"><Loader2 size={18} strokeWidth={1.8} aria-hidden="true" className="spin" /> Cargando…</span>}
              {preview.url && isImage(preview.doc) && <img src={preview.url} alt={preview.doc.name} />}
              {preview.url && !isImage(preview.doc) && <iframe src={preview.url} title={preview.doc.name} />}
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
