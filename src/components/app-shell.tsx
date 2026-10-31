"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { House, Layers2, CalendarDays, Users, Menu, Plus, Search, BookOpen, Wallet, Settings, MessageSquare, ChevronUp, ChevronRight } from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import { QuickCreateList, QuickCreatePanels, useQuickCreate, opcionesPara } from "@/components/quick-create";
import { AccountMenu } from "@/components/account-menu";
import { Brand } from "@/components/ui/brand";
import { Modal } from "@/components/ui/modal";
import { Popover } from "@/components/ui/popover";
import { useWorkspace } from "@/components/workspace-provider";
import { roleNames, type Workspace } from "@/lib/domain";
import { veSeccion } from "@/lib/navegacion";
import { sinLeerPorProyecto } from "@/lib/chat-visto";
import { buildAgenda, localDate } from "@/lib/hoy";
import { iniciales, quienActua } from "@/lib/pasos";

const iconProps = { size: 17, strokeWidth: 1.7, "aria-hidden": true } as const;

const hoyItem = { href: "/", label: "Hoy", icon: House, primary: true, exact: true };
const trabajo = [
  { href: "/proyectos", label: "Proyectos", icon: Layers2, primary: true },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, primary: true },
  { href: "/clientes", label: "Clientes", icon: Users, primary: true },
  { href: "/finanzas", label: "Finanzas", icon: Wallet }
];
const empresa = [
  { href: "/catalogo", label: "Catálogo", icon: BookOpen },
  { href: "/ajustes", label: "Ajustes", icon: Settings }
];
const masItem = { href: "/mas", label: "Más", icon: Menu, primary: true };
type Item = { href: string; label: string; icon: typeof House; primary?: boolean; exact?: boolean };
const secundarias = ["/presupuestos", "/catalogo", "/compras", "/documentos", "/finanzas", "/ajustes", "/ayuda", "/instalar", "/configuracion", "/sistema", "/laboratorio"];
const seccionesMiga: Record<string, string> = { "/proyectos": "Proyectos", "/agenda": "Agenda", "/clientes": "Clientes", "/finanzas": "Finanzas", "/catalogo": "Catálogo", "/ajustes": "Ajustes", "/presupuestos": "Presupuestos", "/compras": "Compras", "/documentos": "Documentos", "/mas": "Más", "/ayuda": "Ayuda", "/instalar": "Instalar", "/configuracion": "Ajustes", "/sistema": "Supervisión" };

function miga(pathname: string, data: Workspace): { href?: string; label: string }[] {
  if (pathname === "/") return [{ label: new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).replace(/^/, "Hoy · ") }];
  const seccion = Object.keys(seccionesMiga).find(h => pathname === h || pathname.startsWith(`${h}/`));
  if (!seccion) return [];
  const raiz = { href: seccion === "/configuracion" ? "/ajustes" : seccion, label: seccionesMiga[seccion] };
  const resto = pathname.slice(seccion.length + 1);
  if (!resto) return [{ label: raiz.label }];
  if (seccion === "/proyectos") return [raiz, { label: resto === "nueva" ? "Visita" : data.projects.find(p => p.id === resto.split("/")[0])?.name ?? "Proyecto" }];
  if (seccion === "/clientes") return [raiz, { label: "Ficha" }];
  return [raiz];
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { actor, data, notice, noticeAction, dismissNotice } = useWorkspace();
  const visibles = useCallback((lista: Item[]) => lista.filter(item => veSeccion(actor.role, item.href)), [actor.role]);
  const [search, setSearch] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [cuenta, setCuenta] = useState(false);
  const [cuentaMovil, setCuentaMovil] = useState(false);
  const [crearMovil, setCrearMovil] = useState(false);
  const [chats, setChats] = useState(false);
  const crear = useQuickCreate();
  const puedeCrear = opcionesPara(actor.role).length > 0;
  // ⌘K / Ctrl+K abre el buscador desde cualquier pantalla.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(v => !v); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [sinLeer, setSinLeer] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    const contar = () => setSinLeer(sinLeerPorProyecto(data.messages, actor.name));
    contar();
    window.addEventListener("plano:chat-visto", contar);
    return () => window.removeEventListener("plano:chat-visto", contar);
  }, [data.messages, actor.name]);
  const totalSinLeer = [...sinLeer.values()].reduce((s, n) => s + n, 0);
  const hoy = localDate();
  const avisos = useMemo(() => data.projects.filter(p => quienActua(data, p, hoy) === "te-espera").length, [data, hoy]);
  const atrasadas = useMemo(() => buildAgenda(data, hoy).overdue.length, [data, hoy]);
  const abiertos = data.projects.filter(p => p.status !== "completed").length;
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const initials = iniciales(actor.name);
  const proyectoActual = pathname.match(/^\/proyectos\/([0-9a-f-]{36})/)?.[1];
  const conversaciones = useMemo(() => {
    const ultimo = new Map<string, string>();
    for (const m of data.messages) if (!m.deleted_at && m.created_at > (ultimo.get(m.project_id) ?? "")) ultimo.set(m.project_id, m.created_at);
    return data.projects.filter(p => p.status !== "completed" || ultimo.has(p.id)).sort((a, b) => (ultimo.get(b.id) ?? "").localeCompare(ultimo.get(a.id) ?? "")).slice(0, 8);
  }, [data.messages, data.projects]);

  function abrirChat() {
    if (proyectoActual) { const q = new URLSearchParams(window.location.search); q.set("chat", "1"); router.push(`${pathname}?${q.toString()}`); }
    else setChats(v => !v);
  }

  const enlace = (item: Item, badge?: ReactNode) => {
    const Icon = item.icon;
    const active = isActive(item.href, item.exact) || (item.href === "/mas" && secundarias.some(h => isActive(h)));
    return (
      <Link key={item.href} prefetch={false} href={item.href} className="nav-item" data-primary={item.primary || undefined} data-solo-movil={item.href === "/mas" || undefined} data-solo-grande={item.href === "/finanzas" || item.href === "/catalogo" || item.href === "/ajustes" || undefined} aria-current={active ? "page" : undefined} aria-label={item.label} title={item.label}>
        <span className="nav-icon"><Icon {...iconProps} size={19} /></span>
        <span className="nav-label">{item.label}</span>
        {badge}
      </Link>
    );
  };
  const chatBoton = (
    <Popover open={chats} onClose={() => setChats(false)} align="end" panelClassName="chats-panel" trigger={
      <button type="button" className="chat-button" onClick={abrirChat} aria-label={totalSinLeer ? `Chat, ${totalSinLeer} sin leer` : "Chat"} aria-haspopup="dialog" title="Chat de las obras">
        <MessageSquare size={17} strokeWidth={1.7} aria-hidden="true" /><span className="chat-button-text">Chat</span>{totalSinLeer > 0 && <span className="count-badge" data-tone="info">{totalSinLeer}</span>}
      </button>
    }>
      <strong className="chats-title">Chats de las obras</strong>
      {conversaciones.length === 0 && <p className="muted text-sm" style={{ padding: "8px 14px" }}>Todavía no hay proyectos.</p>}
      {conversaciones.map(p => <Link key={p.id} prefetch={false} href={`/proyectos/${p.id}?chat=1`} className="chats-row" onClick={() => setChats(false)}>
        <span className="avatar avatar-sm" aria-hidden="true">{iniciales(p.name)}</span>
        <span className="chats-name"><strong>{p.name}</strong><small>{p.location || p.client_name}</small></span>
        {sinLeer.get(p.id) ? <span className="count-badge" data-tone="info">{sinLeer.get(p.id)}</span> : <ChevronRight size={15} strokeWidth={1.7} aria-hidden="true" className="muted" />}
      </Link>)}
    </Popover>
  );

  const migas = miga(pathname, data);
  return (
    <div className="shell">
      <nav className="nav" aria-label="Principal">
        <Link prefetch={false} href="/" className="nav-brand" aria-label="Inicio"><Brand /><small className="nav-org">{data.organization_name || "Plano"}</small></Link>
        {puedeCrear && <Popover open={nuevo} onClose={() => setNuevo(false)} className="nav-new" align="stretch" trigger={
          <button type="button" className="nav-new-button" onClick={() => setNuevo(v => !v)} aria-expanded={nuevo} aria-haspopup="menu" aria-label="Nuevo" title="Nuevo"><Plus size={16} strokeWidth={1.8} aria-hidden="true" /><span>Nuevo</span></button>
        }><QuickCreateList onElegir={o => { setNuevo(false); crear.elegir(o); }} /></Popover>}
        {enlace(hoyItem, avisos > 0 ? <span className="count-badge" data-tone="warning" aria-label={`${avisos} proyectos te esperan`}>{avisos}</span> : undefined)}
        {visibles(trabajo).length > 0 && <span className="nav-group">Trabajo</span>}
        {visibles(trabajo).map(item => enlace(item, item.href === "/proyectos" ? <span className="nav-count" aria-hidden="true">{abiertos}</span> : item.href === "/agenda" && atrasadas > 0 ? <span className="nav-alert" title={`${atrasadas} atrasadas`}><span className="sr-only">{atrasadas} tareas atrasadas</span></span> : undefined))}
        {visibles(empresa).length > 0 && <span className="nav-group">Empresa</span>}
        {visibles(empresa).map(item => enlace(item))}
        {enlace(masItem)}
        <div className="nav-foot">
          <Popover open={cuenta} onClose={() => setCuenta(false)} side="top" panelClassName="account-panel" trigger={
            <button type="button" className="nav-account" onClick={() => setCuenta(v => !v)} aria-haspopup="dialog" aria-expanded={cuenta} aria-label={`Tu cuenta · ${actor.name}`} title="Tu cuenta">
              <span className="avatar avatar-ink" aria-hidden="true">{initials}</span>
              <span className="nav-user"><strong>{actor.name}</strong><small>{roleNames[actor.role]}</small></span>
              <ChevronUp size={15} strokeWidth={1.7} aria-hidden="true" className="nav-account-chevron" />
            </button>
          }><AccountMenu onClose={() => setCuenta(false)} /></Popover>
        </div>
      </nav>

      <div className="shell-column">
        <header className="topbar">
          <Link prefetch={false} href="/" aria-label="Inicio" style={{ color: "inherit", textDecoration: "none" }}><Brand /></Link>
          <div className="topbar-tools">
            <button type="button" className="topbar-search" onClick={() => setSearch(true)} aria-label="Buscar en Plano"><Search size={19} strokeWidth={1.6} aria-hidden="true" /></button>
            {chatBoton}
            {puedeCrear && <button type="button" className="topbar-new" aria-label="Crear" title="Crear" aria-haspopup="dialog" aria-expanded={crearMovil} onClick={() => setCrearMovil(true)}><Plus size={18} strokeWidth={1.9} aria-hidden="true" /></button>}
            <button type="button" className="avatar avatar-ink avatar-button" onClick={() => setCuentaMovil(true)} aria-label={`Tu cuenta · ${actor.name}`} aria-haspopup="dialog" aria-expanded={cuentaMovil}>{initials}</button>
          </div>
        </header>
        <header className="deskbar">
          <nav className="crumbs" aria-label="Estás en">
            {migas.map((m, i) => <span key={`${m.label}-${i}`}>{i > 0 && <span aria-hidden="true"> › </span>}{m.href ? <Link prefetch={false} href={m.href}>{m.label}</Link> : <span aria-current="page">{m.label}</span>}</span>)}
          </nav>
          <div className="deskbar-tools">
            <button type="button" className="deskbar-search" onClick={() => setSearch(true)} aria-label="Buscar en Plano" title="Buscar (⌘K)"><Search size={15} strokeWidth={1.8} aria-hidden="true" /><span>Buscar proyecto, cliente, calle…</span><kbd>⌘K</kbd></button>
            {chatBoton}
          </div>
        </header>
        <main className="shell-main">{children}</main>
      </div>

      <Modal open={cuentaMovil} onClose={() => setCuentaMovil(false)} title="Tu cuenta"><AccountMenu onClose={() => setCuentaMovil(false)} /></Modal>
      <Modal open={crearMovil} onClose={() => setCrearMovil(false)} title="¿Qué quieres crear?"><QuickCreateList onElegir={o => { setCrearMovil(false); crear.elegir(o); }} /></Modal>
      <QuickCreatePanels panel={crear.panel} onClose={crear.cerrar} />
      <CommandPalette open={search} onClose={() => setSearch(false)} />
      {notice && <div className="notice" role="status"><span>{notice}</span>{noticeAction && <button type="button" className="notice-action" onClick={() => { const run = noticeAction.run; dismissNotice(); void run(); }}>{noticeAction.label}</button>}</div>}
    </div>
  );
}
