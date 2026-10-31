"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtSign, CalendarClock, CircleAlert, CircleHelp, LogOut, MessageCircleQuestion, Palette, Settings } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { ThemePicker } from "@/components/ui/theme-toggle";
import { TextSizeSwitch } from "@/components/ui/text-size-toggle";
import { construirAvisos, leerLeidos, marcarLeidos, type Aviso, type TipoAviso } from "@/lib/avisos";
import { dateLabel, roleNames } from "@/lib/domain";
import { iniciales } from "@/lib/pasos";
import { veSeccion } from "@/lib/navegacion";

const perfilDetalle = { admin: "aprueba presupuestos y cobros", office: "aprueba presupuestos y cobros", manager: "lleva las obras", site: "tareas, mensajes y documentos", viewer: "solo consulta" } as const;
const iconoAviso: Record<TipoAviso, { icon: typeof AtSign; tone: string }> = { mencion: { icon: AtSign, tone: "info" }, atrasada: { icon: CircleAlert, tone: "danger" }, agenda: { icon: CalendarClock, tone: "success" }, cliente: { icon: MessageCircleQuestion, tone: "warning" } };

/** Avisos y cuáles están sin leer, calculados con lo que hay en el espacio. */
export function useAvisos() {
  const { data, actor } = useWorkspace();
  const [leidos, setLeidos] = useState<Set<string>>(new Set());
  useEffect(() => { const sync = () => setLeidos(leerLeidos()); sync(); window.addEventListener("plano:avisos", sync); return () => window.removeEventListener("plano:avisos", sync); }, []);
  const avisos = construirAvisos(data, actor);
  return { avisos, leidos, sinLeer: avisos.filter(a => !leidos.has(a.id)).length, marcarTodos: () => marcarLeidos(avisos.map(a => a.id)) };
}

/** Avatar con aro: naranja y contador si hay avisos sin leer, gris si no. */
export function AvatarRing({ name, count }: { name: string; count: number }) {
  return <span className="avatar-ring" data-on={count > 0 || undefined} aria-hidden="true"><span className="avatar avatar-ink">{iniciales(name)}</span>{count > 0 && <span className="avatar-count">{count > 9 ? "9+" : count}</span>}</span>;
}

function ListaAvisos({ avisos, leidos, limite, onIr }: { avisos: Aviso[]; leidos: Set<string>; limite?: number; onIr: () => void }) {
  const router = useRouter();
  if (!avisos.length) return <p className="account-menu-note">No tienes avisos. Cuando alguien te mencione o una tarea tuya se acerque o se atrase, aparecerá aquí.</p>;
  return <div className="aviso-list">{avisos.slice(0, limite ?? 30).map(a => { const { icon: Icon, tone } = iconoAviso[a.tipo]; return (
    <button key={a.id} type="button" className="aviso" data-new={!leidos.has(a.id) || undefined} onClick={() => { marcarLeidos([a.id]); onIr(); router.push(a.href); }}>
      <span className="aviso-icon" data-tone={tone}><Icon size={15} strokeWidth={1.8} aria-hidden="true" /></span>
      <span><span><strong>{a.quien}</strong> {a.texto}</span><small>{dateLabel(a.cuando)}</small></span>
    </button>
  ); })}</div>;
}

function Salir() {
  const { mode, notify } = useWorkspace();
  const [saliendo, setSaliendo] = useState(false);
  async function salir() {
    if (saliendo) return;
    setSaliendo(true);
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { notify(result.error || "No se ha podido cerrar la sesión."); return; }
      window.location.assign(typeof result.redirect === "string" ? result.redirect : "/login");
    } catch { notify("Sin conexión: no se ha podido cerrar la sesión."); }
    finally { setSaliendo(false); }
  }
  return mode === "supabase"
    ? <button type="button" className="account-menu-exit" onClick={salir} disabled={saliendo}><LogOut size={16} strokeWidth={1.7} aria-hidden="true" />{saliendo ? "Cerrando…" : "Cerrar sesión"}</button>
    : <p className="account-menu-note">Modo demostración: los datos viven solo en este navegador.</p>;
}

/** Popover de escritorio y hoja de móvil. En la hoja, Avisos y Tu cuenta son dos pestañas. */
export function AccountMenu({ onClose, hoja = false }: { onClose: () => void; hoja?: boolean }) {
  const { actor, data } = useWorkspace();
  const { avisos, leidos, sinLeer, marcarTodos } = useAvisos();
  const [pestana, setPestana] = useState<"avisos" | "cuenta">(sinLeer > 0 ? "avisos" : "cuenta");
  const cabecera = <div className="account-menu-id"><span className="avatar avatar-ink" aria-hidden="true">{iniciales(actor.name)}</span><span className="account-menu-name"><strong>{actor.name}</strong><small>{roleNames[actor.role]}</small></span></div>;
  const cuenta = <>
    <dl className="account-menu-facts">
      <div><dt>Empresa</dt><dd>{data.organization_name || "—"}</dd></div>
      <div><dt>Perfil</dt><dd>{roleNames[actor.role]} · {perfilDetalle[actor.role]}</dd></div>
    </dl>
    <div className="account-menu-row"><span>Tema</span><ThemePicker /></div>
    <div className="account-menu-row"><span>Letra grande</span><TextSizeSwitch /></div>
    <nav className="account-menu-links" aria-label="Accesos de la cuenta">
      {veSeccion(actor.role, "/ajustes") && <Link href="/ajustes" onClick={onClose}><Settings size={16} strokeWidth={1.7} aria-hidden="true" />Ajustes</Link>}
      {veSeccion(actor.role, "/configuracion/identidad") && <Link href="/configuracion/identidad" onClick={onClose}><Palette size={16} strokeWidth={1.7} aria-hidden="true" />Logo y colores de la empresa</Link>}
      <Link href="/ayuda" onClick={onClose}><CircleHelp size={16} strokeWidth={1.7} aria-hidden="true" />Ayuda</Link>
    </nav>
    <Salir />
  </>;
  const cabeceraAvisos = <div className="aviso-head"><span>Avisos{sinLeer ? ` · ${sinLeer}` : ""}</span>{sinLeer > 0 && <button type="button" className="link-inline" onClick={marcarTodos}>Marcar todo como leído</button>}</div>;
  if (hoja) return (
    <div className="account-menu">
      <div className="account-menu-tabs"><div className="pl-seg" role="group" aria-label="Avisos o cuenta">
        <button type="button" aria-pressed={pestana === "avisos"} onClick={() => setPestana("avisos")}>{sinLeer ? `Avisos · ${sinLeer}` : "Avisos"}</button>
        <button type="button" aria-pressed={pestana === "cuenta"} onClick={() => setPestana("cuenta")}>Tu cuenta</button>
      </div></div>
      {pestana === "avisos" ? <div>{sinLeer > 0 && cabeceraAvisos}<ListaAvisos avisos={avisos} leidos={leidos} onIr={onClose} /></div> : <>{cabecera}{cuenta}</>}
    </div>
  );
  return (
    <div className="account-menu">
      {cabecera}
      {avisos.length > 0 && <div>{cabeceraAvisos}<ListaAvisos avisos={avisos} leidos={leidos} limite={3} onIr={onClose} /></div>}
      {cuenta}
    </div>
  );
}
