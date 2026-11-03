"use client";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { House, Layers2, CalendarDays, Users, Ellipsis, Plus, Search, BookOpen, Wallet, Settings, MessageSquare, ChevronUp, ChevronRight, ChevronLeft, ChevronDown, Package, FileText } from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import { QuickCreateList, QuickCreatePanels, useQuickCreate, opcionesPara } from "@/components/quick-create";
import { AccountMenu, AvatarRing, useAvisos } from "@/components/account-menu";
import { Brand } from "@/components/ui/brand";
import { Modal } from "@/components/ui/modal";
import { Popover } from "@/components/ui/popover";
import { useWorkspace, usePuesto } from "@/components/workspace-provider";
import { menuMovil, puestoNombres, trabajo as trabajoPorPuesto } from "@/lib/puestos";
import { loTuyo } from "@/lib/lo-tuyo";
import type { Workspace } from "@/lib/domain";
import { veSeccion } from "@/lib/navegacion";
import { sinLeerPorProyecto } from "@/lib/chat-visto";
import { facturasDe, vencidas } from "@/lib/facturas";
import { buildAgenda, localDate } from "@/lib/hoy";
import { iniciales } from "@/lib/pasos";

const iconProps = { size: 17, strokeWidth: 1.7, "aria-hidden": true } as const;

type Item = { href: string; label: string; icon: typeof House; exact?: boolean };
const hoyItem: Item = { href: "/", label: "Hoy", icon: House, exact: true };
/* Todas las secciones; el puesto decide cuáles van en «Tu trabajo», cuáles en la barra del móvil y cuáles se pliegan. */
const catalogo: Item[] = [
  { href: "/proyectos", label: "Proyectos", icon: Layers2 },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/finanzas", label: "Finanzas", icon: Wallet },
  { href: "/compras", label: "Materiales", icon: Package },
  { href: "/presupuestos", label: "Presupuestos", icon: FileText },
  { href: "/catalogo", label: "Catálogo", icon: BookOpen },
  { href: "/ajustes", label: "Ajustes", icon: Settings }
];
const masItem: Item = { href: "/mas", label: "Más", icon: Ellipsis };
const menuEmpresaKey = "plano.menu.empresa";
const secundarias = ["/clientes", "/presupuestos", "/catalogo", "/compras", "/documentos", "/finanzas", "/ajustes", "/ayuda", "/instalar", "/configuracion", "/sistema", "/laboratorio"];
const seccionesMiga: Record<string, string> = { "/proyectos": "Proyectos", "/agenda": "Agenda", "/clientes": "Clientes", "/finanzas": "Finanzas", "/catalogo": "Catálogo", "/ajustes": "Ajustes", "/presupuestos": "Presupuestos", "/compras": "Materiales", "/documentos": "Documentos", "/mas": "Más", "/ayuda": "Ayuda", "/instalar": "Instalar", "/configuracion": "Ajustes", "/sistema": "Supervisión" };

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
  const puesto = usePuesto();
  const movil = menuMovil[puesto];
  const tuTrabajo = useMemo(() => trabajoPorPuesto[puesto].slice(1).map(h => catalogo.find(i => i.href === h)).filter((i): i is Item => Boolean(i) && veSeccion(actor.role, i!.href)), [puesto, actor.role]);
  const empresaItems = useMemo(() => catalogo.filter(i => !tuTrabajo.includes(i) && veSeccion(actor.role, i.href)), [tuTrabajo, actor.role]);
  const [empresaAbierta, setEmpresaAbierta] = useState(false);
  useEffect(() => { try { setEmpresaAbierta(localStorage.getItem(menuEmpresaKey) === "abierto"); } catch { /* sin almacenamiento */ } }, []);
  const plegarEmpresa = () => setEmpresaAbierta(v => { try { localStorage.setItem(menuEmpresaKey, v ? "plegado" : "abierto"); } catch { /* sin almacenamiento */ } return !v; });
  const raices = useMemo(() => ["/", "/mas", ...movil], [movil]);
  const esMovil = (href: string) => href === "/" || href === "/mas" || movil.includes(href);
  const [search, setSearch] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [cuenta, setCuenta] = useState(false);
  const [cuentaMovil, setCuentaMovil] = useState(false);
  const [crearMovil, setCrearMovil] = useState(false);
  const [chats, setChats] = useState<"movil" | "escritorio" | null>(null);
  const crear = useQuickCreate();
  const { sinLeer: avisosSinLeer } = useAvisos();
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
  const avisos = useMemo(() => loTuyo(data, actor, puesto, hoy).tuyas.length, [data, actor, puesto, hoy]);
  const atrasadas = useMemo(() => buildAgenda(data, hoy).overdue.length, [data, hoy]);
  const facturasVencidas = useMemo(() => vencidas(facturasDe(data), hoy).length, [data, hoy]);
  const abiertos = data.projects.filter(p => p.status !== "completed").length;
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const proyectoActual = pathname.match(/^\/proyectos\/([0-9a-f-]{36})/)?.[1];
  const conversaciones = useMemo(() => {
    const ultimo = new Map<string, string>();
    for (const m of data.messages) if (!m.deleted_at && m.created_at > (ultimo.get(m.project_id) ?? "")) ultimo.set(m.project_id, m.created_at);
    return data.projects.filter(p => p.status !== "completed" || ultimo.has(p.id)).sort((a, b) => (ultimo.get(b.id) ?? "").localeCompare(ultimo.get(a.id) ?? "")).slice(0, 8);
  }, [data.messages, data.projects]);

  function abrirChat(lugar: "movil" | "escritorio") {
    if (proyectoActual) { const q = new URLSearchParams(window.location.search); q.set("chat", "1"); window.history.replaceState(null, "", `${pathname}?${q.toString()}`); }
    else setChats(v => (v === lugar ? null : lugar));
  }

  const enlace = (item: Item, badge?: ReactNode, plegado = false) => {
    const Icon = item.icon;
    const active = isActive(item.href, item.exact) || (item.href === "/mas" && !raices.some(h => h !== "/mas" && isActive(h, h === "/")) && secundarias.some(h => isActive(h)));
    return (
      <Link key={item.href} prefetch={false} href={item.href} className="nav-item" data-primary={esMovil(item.href) || undefined} data-solo-movil={item.href === "/mas" || undefined} data-solo-grande={!esMovil(item.href) || undefined} data-plegado={plegado || undefined} aria-current={active ? "page" : undefined} aria-label={item.label} title={item.label}>
        <span className="nav-icon"><Icon {...iconProps} size={19} /></span>
        <span className="nav-label">{item.label}</span>
        {badge}
      </Link>
    );
  };
  // Una instancia por sitio y estado propio: si no, la copia oculta cierra el desplegable antes de que llegue el toque.
  const chatBoton = (lugar: "movil" | "escritorio") => (
    <Popover open={chats === lugar} onClose={() => setChats(null)} align="end" panelClassName="chats-panel" trigger={
      <button type="button" className="chat-button" onClick={() => abrirChat(lugar)} aria-label={totalSinLeer ? `Chat, ${totalSinLeer} sin leer` : "Chat"} aria-haspopup="dialog" title="Chat de las obras">
        <MessageSquare className="chat-button-icon" size={17} strokeWidth={1.7} aria-hidden="true" /><span className="chat-button-text">Chat</span>{totalSinLeer > 0 && <span className="count-badge" data-tone="info">{totalSinLeer}</span>}
      </button>
    }>
      <strong className="chats-title">Chats de las obras</strong>
      {conversaciones.length === 0 && <p className="muted text-sm" style={{ padding: "8px 14px" }}>Todavía no hay proyectos.</p>}
      {conversaciones.map(p => <Link key={p.id} prefetch={false} href={`/proyectos/${p.id}?chat=1`} className="chats-row" onClick={() => setChats(null)}>
        <span className="avatar avatar-sm" aria-hidden="true">{iniciales(p.name)}</span>
        <span className="chats-name"><strong>{p.name}</strong><small>{p.location || p.client_name}</small></span>
        {sinLeer.get(p.id) ? <span className="count-badge" data-tone="info">{sinLeer.get(p.id)}</span> : <ChevronRight size={15} strokeWidth={1.7} aria-hidden="true" className="muted" />}
      </Link>)}
    </Popover>
  );

  const badgeDe = (item: Item) => item.href === "/proyectos" ? <span className="nav-count" aria-hidden="true">{abiertos}</span> : item.href === "/agenda" && atrasadas > 0 ? <span className="nav-alert" title={`${atrasadas} atrasadas`}><span className="sr-only">{atrasadas} tareas atrasadas</span></span> : item.href === "/finanzas" && facturasVencidas > 0 ? <span className="count-badge" data-tone="danger" aria-label={`${facturasVencidas} facturas vencidas`}>{facturasVencidas}</span> : undefined;
  const botonCrear = <button type="button" className="nav-plus" aria-label="Crear" aria-haspopup="dialog" aria-expanded={crearMovil} onClick={() => setCrearMovil(true)}><Plus size={22} strokeWidth={2} aria-hidden="true" /></button>;
  const migas = miga(pathname, data);
  // En móvil, las secciones que viven en Más vuelven a Más; una ficha de cliente, a Clientes.
  const volver = pathname.startsWith("/clientes/") ? { href: "/clientes", label: "Clientes" } : pathname.startsWith("/configuracion/") ? { href: "/ajustes", label: "Ajustes" } : !raices.includes(pathname) && !pathname.startsWith("/proyectos/") ? { href: "/mas", label: "Más" } : null;
  return (
    <div className="shell">
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      <nav className="nav" aria-label="Principal">
        <Link prefetch={false} href="/" className="nav-brand" aria-label="Inicio"><Brand /><small className="nav-org">{data.organization_name || "Plano"}</small></Link>
        {puedeCrear && <Popover open={nuevo} onClose={() => setNuevo(false)} className="nav-new" align="stretch" trigger={
          <button type="button" className="nav-new-button" onClick={() => setNuevo(v => !v)} aria-expanded={nuevo} aria-haspopup="menu" aria-label="Nuevo" title="Nuevo"><Plus size={16} strokeWidth={1.8} aria-hidden="true" /><span>Nuevo</span></button>
        }><QuickCreateList onElegir={o => { setNuevo(false); crear.elegir(o); }} /></Popover>}
        {enlace(hoyItem, avisos > 0 ? <span className="count-badge" data-tone="warning" aria-label={`${avisos} cosas te tocan`}>{avisos}</span> : undefined)}
        {tuTrabajo.length > 0 && <span className="nav-group">Tu trabajo</span>}
        {tuTrabajo.map(item => <Fragment key={item.href}>{enlace(item, badgeDe(item))}{item.href === movil[0] && puedeCrear && botonCrear}</Fragment>)}
        {empresaItems.length > 0 && <button type="button" className="nav-group nav-group-toggle" aria-expanded={empresaAbierta} onClick={plegarEmpresa}>Toda la empresa{empresaAbierta ? <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" /> : <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />}</button>}
        {empresaItems.map(item => <Fragment key={item.href}>{enlace(item, badgeDe(item), !empresaAbierta)}{item.href === movil[0] && puedeCrear && botonCrear}</Fragment>)}
        {enlace(masItem)}
        <div className="nav-foot">
          <Popover open={cuenta} onClose={() => setCuenta(false)} side="top" panelClassName="account-panel" trigger={
            <button type="button" className="nav-account" onClick={() => setCuenta(v => !v)} aria-haspopup="dialog" aria-expanded={cuenta} aria-label={`Tu cuenta · ${actor.name}${avisosSinLeer ? ` · ${avisosSinLeer} avisos sin leer` : ""}`} title="Tu cuenta">
              <AvatarRing name={actor.name} count={avisosSinLeer} />
              <span className="nav-user"><strong>{actor.name}</strong><small>{puestoNombres[puesto]}</small></span>
              <ChevronUp size={15} strokeWidth={1.7} aria-hidden="true" className="nav-account-chevron" />
            </button>
          }><AccountMenu onClose={() => setCuenta(false)} /></Popover>
        </div>
      </nav>

      <div className="shell-column">
        <div className="phone-bar">
          <Link prefetch={false} href="/" className="phone-bar-brand" aria-label="Inicio"><Brand /></Link>
          {raices.includes(pathname) && <div className="phone-tools">
          <button type="button" className="phone-tool" onClick={() => setSearch(true)} aria-label="Buscar en Plano"><Search size={19} strokeWidth={1.6} aria-hidden="true" /></button>
          {chatBoton("movil")}
          <button type="button" className="phone-avatar" onClick={() => setCuentaMovil(true)} aria-label={`Tu cuenta · ${actor.name}${avisosSinLeer ? ` · ${avisosSinLeer} avisos sin leer` : ""}`} aria-haspopup="dialog" aria-expanded={cuentaMovil}><AvatarRing name={actor.name} count={avisosSinLeer} /></button>
          </div>}
        </div>
        {volver && <div className="phone-subnav">
          <Link prefetch={false} href={volver.href} className="phone-back"><ChevronLeft size={18} strokeWidth={1.8} aria-hidden="true" />{volver.label}</Link>
          {puedeCrear && <button type="button" className="phone-plus" aria-label="Crear" aria-haspopup="dialog" onClick={() => setCrearMovil(true)}><Plus size={18} strokeWidth={2} aria-hidden="true" /></button>}
        </div>}
        <header className="deskbar">
          <nav className="crumbs" aria-label="Estás en">
            {migas.map((m, i) => <span key={`${m.label}-${i}`}>{i > 0 && <span aria-hidden="true"> › </span>}{m.href ? <Link prefetch={false} href={m.href}>{m.label}</Link> : <span aria-current="page">{m.label}</span>}</span>)}
          </nav>
          <div className="deskbar-tools">
            <button type="button" className="deskbar-search" onClick={() => setSearch(true)} aria-label="Buscar en Plano" title="Buscar (⌘K)"><Search size={15} strokeWidth={1.8} aria-hidden="true" /><span>Buscar proyecto, cliente, calle…</span><kbd>⌘K</kbd></button>
            {chatBoton("escritorio")}
          </div>
        </header>
        <main id="contenido" tabIndex={-1} className="shell-main">{children}</main>
      </div>

      <Modal open={cuentaMovil} onClose={() => setCuentaMovil(false)} title={actor.name}>{cuentaMovil && <AccountMenu hoja onClose={() => setCuentaMovil(false)} />}</Modal>
      <Modal open={crearMovil} onClose={() => setCrearMovil(false)} title="Crear"><QuickCreateList onElegir={o => { setCrearMovil(false); crear.elegir(o); }} /></Modal>
      <QuickCreatePanels panel={crear.panel} onClose={crear.cerrar} />
      <CommandPalette open={search} onClose={() => setSearch(false)} />
      {notice && <div className="notice" role="status"><span>{notice}</span>{noticeAction && <button type="button" className="notice-action" onClick={() => { const run = noticeAction.run; dismissNotice(); void run(); }}>{noticeAction.label}</button>}</div>}
    </div>
  );
}
