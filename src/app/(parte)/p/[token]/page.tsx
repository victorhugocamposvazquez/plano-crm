"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarPlus, Camera, Check, Loader2, MapPin, MessageCircle, Package, Phone, Send } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { supabaseConfigured } from "@/lib/supabase/browser";
import { calendarioParte, mapaDe } from "@/lib/parte";
import { enlaceLlamar, enlaceWhatsapp } from "@/lib/operarios";
import { MAX_FOTO_BYTES, parteCheck, parteFoto, parteHecho, parteMensaje, tokenValido, vistaParte, type VistaParte } from "@/lib/parte-vivo";
import { textoProgreso } from "@/lib/lista-tarea";
import type { Workspace } from "@/lib/domain";

type Lista = Extract<VistaParte, { estado: "ok" }>;
type Servicio = { ver(): Promise<VistaParte>; hecho(nota: string): Promise<VistaParte>; mensaje(texto: string): Promise<VistaParte>; foto(f: Blob, nombre: string): Promise<VistaParte>; check(item: string, done: boolean): Promise<VistaParte> };

const fechaLarga = (iso: string) => new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${iso}T12:00:00`)).replace(/^./, c => c.toUpperCase());
const horaCorta = (iso: string) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Con Supabase: las funciones públicas parte_* (solo con el token). La foto se sube a la ruta que reserva la base de datos. */
function servicioSupabase(token: string): Servicio {
  const cliente = async () => (await import("@/lib/supabase/browser")).createClient();
  const rpc = async (fn: string, args: Record<string, unknown>) => { const { data, error } = await (await cliente()).rpc(fn, { p_token: token, ...args }); if (error) throw new Error(error.message || "No se ha podido completar."); return data as VistaParte; };
  return {
    ver: () => rpc("parte_ver", {}),
    hecho: nota => rpc("parte_hecho", { p_nota: nota }),
    mensaje: texto => rpc("parte_mensaje", { p_texto: texto }),
    check: (item, done) => rpc("parte_check", { p_item: item, p_done: done }),
    async foto(f, nombre) {
      const c = await cliente();
      const { data: ruta, error } = await c.rpc("parte_reservar_foto", { p_token: token }); if (error || !ruta) throw new Error(error?.message || "No se ha podido preparar la foto.");
      const { error: e2 } = await c.storage.from("project-files").upload(ruta as string, f, { contentType: f.type, upsert: false }); if (e2) throw new Error("No se ha podido subir la foto. Prueba con menos cobertura de por medio o más tarde.");
      return rpc("parte_foto", { p_path: ruta, p_nombre: nombre });
    }
  };
}
/** En la demostración: las mismas reglas sobre el espacio guardado en este navegador. */
function servicioDemo(token: string): Servicio {
  const clave = "plano.workspace.v1";
  const leer = (): Workspace | null => { try { const r = localStorage.getItem(clave); return r ? JSON.parse(r) : null; } catch { return null; } };
  const guardar = (ws: Workspace) => localStorage.setItem(clave, JSON.stringify(ws));
  const ahora = () => new Date().toISOString(), uuid = () => crypto.randomUUID();
  const con = async (fn: (ws: Workspace) => Workspace) => { const ws = leer(); if (!ws) return { estado: "no_valido" } as VistaParte; const next = fn(ws); guardar(next); return vistaParte(next, token, ahora()); };
  return {
    async ver() { const ws = leer(); if (!ws) return { estado: "no_valido" }; const s = ws.task_shares?.find(x => x.token === token); if (s) { s.seen_at = ahora(); guardar(ws); } return vistaParte(ws, token, ahora()); },
    hecho: nota => con(ws => parteHecho(ws, token, nota, ahora(), uuid)),
    mensaje: texto => con(ws => parteMensaje(ws, token, texto, ahora(), uuid)),
    check: (item, done) => con(ws => parteCheck(ws, token, item, done, ahora())),
    async foto(f, nombre) {
      const ws = leer(); if (!ws) return { estado: "no_valido" };
      const s = ws.task_shares?.find(x => x.token === token), t = s && ws.tasks.find(x => x.id === s.task_id);
      if (!t) throw new Error("Este enlace ya no es válido.");
      const path = `${ws.organization_id}/${t.project_id}/${crypto.randomUUID()}`;
      const { saveLocalFile } = await import("@/lib/local-files");
      await saveLocalFile(path, new File([f], `${nombre || "foto"}.jpg`, { type: f.type }));
      return con(w => parteFoto(w, token, { path, mime: f.type, size: f.size, nombre }, ahora(), uuid));
    }
  };
}

/** La foto del móvil, reducida a 2048 px y en JPEG: sube antes con poca cobertura y nunca pasa del límite. */
async function prepararFoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file), escala = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const lienzo = document.createElement("canvas"); lienzo.width = Math.round(bitmap.width * escala); lienzo.height = Math.round(bitmap.height * escala);
    lienzo.getContext("2d")!.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height); bitmap.close();
    return await new Promise<Blob>((ok, mal) => lienzo.toBlob(b => (b ? ok(b) : mal(new Error("No se ha podido preparar la foto."))), "image/jpeg", 0.85));
  } catch { if (/^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= MAX_FOTO_BYTES) return file; throw new Error("Esa foto no se puede subir. Prueba a hacerla con la cámara."); }
}

/**
 * Parte vivo que abre un operario desde WhatsApp, sin cuenta: la tarea al día, «Cómo llegar», a quién llamar,
 * y tres cosas que puede hacer: marcarla como hecha, escribir al equipo y subir fotos. Todo llega al proyecto.
 */
export default function ParteVivoPage() {
  const { token } = useParams<{ token: string }>();
  const servicio = useRef<Servicio | null>(null);
  const [vista, setVista] = useState<VistaParte | null>(null);
  const [nota, setNota] = useState(""), [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState<"" | "hecho" | "mensaje" | "foto" | "check">(""), [aviso, setAviso] = useState(""), [fallo, setFallo] = useState("");
  const camara = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tokenValido(token)) { setVista({ estado: "no_valido" }); return; }
    servicio.current = supabaseConfigured() ? servicioSupabase(token) : servicioDemo(token);
    servicio.current.ver().then(setVista).catch(() => setVista({ estado: "no_valido" }));
  }, [token]);

  const hacer = useCallback(async (tipo: "hecho" | "mensaje" | "foto" | "check", fn: () => Promise<VistaParte>, ok: string) => {
    if (ocupado) return;
    setOcupado(tipo); setFallo(""); setAviso("");
    try { setVista(await fn()); setAviso(ok); } catch (e) { setFallo(e instanceof Error ? e.message : "No se ha podido completar. Inténtalo otra vez."); }
    finally { setOcupado(""); }
  }, [ocupado]);

  async function subir(files: FileList | null) {
    const lista = [...(files ?? [])].slice(0, 6);
    if (!lista.length || !servicio.current) return;
    await hacer("foto", async () => { let v: VistaParte = vista!; for (const [i, f] of lista.entries()) v = await servicio.current!.foto(await prepararFoto(f), lista.length > 1 ? `Foto ${i + 1}` : "Foto"); return v; }, lista.length > 1 ? `${lista.length} fotos enviadas al equipo.` : "Foto enviada al equipo.");
    if (camara.current) camara.current.value = "";
  }
  function guardarEnCalendario(v: Lista) {
    const ics = calendarioParte({ v: 1, empresa: v.empresa, obra: v.obra, direccion: v.direccion, tarea: v.tarea, oficio: v.oficio, fecha: v.fecha, para: v.para, contacto: v.contacto, telefono: v.telefono, notas: v.notas, material: v.material, enviado: "" });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })), a = document.createElement("a"); a.href = url; a.download = "trabajo.ics"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!vista) return <p className="muted parte-vacio">Abriendo la tarea…</p>;
  if (vista.estado !== "ok") return <div className="parte-vacio"><Brand /><h1>Este enlace ya no es válido</h1><p className="muted">Puede que se haya anulado, caducado o esté incompleto. Pide que te lo vuelvan a enviar.</p></div>;
  const v = vista, llamar = enlaceLlamar(v.telefono), whatsapp = v.telefono ? enlaceWhatsapp(v.telefono) : "";

  return <article className="parte">
    <header className="parte-cabeza"><Brand />{v.empresa && <span className="muted">{v.empresa}</span>}</header>
    <section className="parte-principal">
      <p className="parte-kicker">Tarea{v.oficio ? ` · ${v.oficio}` : ""}</p>
      <h1>{v.tarea}</h1>
      <p className="parte-fecha">{fechaLarga(v.fecha)}</p>
      {v.para && <p className="muted">Para {v.para}</p>}
      {v.hecha
        ? <p className="parte-hecha" role="status"><Check size={18} strokeWidth={2} aria-hidden="true" />Hecha{v.hecha_el ? ` el ${horaCorta(v.hecha_el)}` : ""}. Gracias.</p>
        : <button type="button" className="btn btn-secondary" onClick={() => guardarEnCalendario(v)}><CalendarPlus size={17} strokeWidth={1.6} aria-hidden="true" />Guardar en el calendario</button>}
    </section>

    {(v.obra || v.direccion) && <section className="parte-bloque" aria-labelledby="pv-donde">
      <h2 id="pv-donde">Dónde</h2>
      {v.obra && <p><strong>{v.obra}</strong></p>}
      {v.direccion && <p>{v.direccion}</p>}
      {v.direccion && <a className="btn btn-primary" href={mapaDe(v.direccion)} target="_blank" rel="noopener noreferrer"><MapPin size={17} strokeWidth={1.6} aria-hidden="true" />Cómo llegar</a>}
    </section>}
    {v.descripcion && <section className="parte-bloque" aria-labelledby="pv-descripcion"><h2 id="pv-descripcion">Qué hay que hacer</h2><p className="parte-texto">{v.descripcion}</p></section>}
    {v.lista.length > 0 && <section className="parte-bloque parte-accion" aria-labelledby="pv-lista">
      <h2 id="pv-lista">Lista · {textoProgreso(v.lista)}</h2>
      <ul className="lista-puntos lista-puntos-ver parte-lista">{v.lista.map(p => <li key={p.id}><label>
        <input type="checkbox" checked={p.done} disabled={Boolean(ocupado)} onChange={e => void hacer("check", () => servicio.current!.check(p.id, e.target.checked), "")} />
        <span data-hecho={p.done || undefined}>{p.text}</span>
      </label></li>)}</ul>
    </section>}
    {v.notas && <section className="parte-bloque" aria-labelledby="pv-notas"><h2 id="pv-notas">A tener en cuenta</h2><p className="parte-texto">{v.notas}</p></section>}
    {v.material.length > 0 && <section className="parte-bloque" aria-labelledby="pv-material"><h2 id="pv-material">Material en obra</h2><ul className="parte-material">{v.material.map(m => <li key={m}><Package size={16} strokeWidth={1.6} aria-hidden="true" />{m}</li>)}</ul></section>}

    {!v.hecha && <section className="parte-bloque parte-accion" aria-labelledby="pv-hecho">
      <h2 id="pv-hecho">¿Terminado?</h2>
      <label className="field" style={{ width: "100%" }}><span>Algo que deba saber el equipo (opcional)</span><textarea rows={2} value={nota} onChange={e => setNota(e.target.value)} maxLength={1000} placeholder="Quedan dos sacos en el portal…" /></label>
      <button type="button" className="btn btn-primary parte-grande" disabled={Boolean(ocupado)} onClick={() => void hacer("hecho", () => servicio.current!.hecho(nota), "Avisado: tarea hecha.")}>{ocupado === "hecho" ? <Loader2 size={18} className="spin" aria-hidden="true" /> : <Check size={18} strokeWidth={2} aria-hidden="true" />}Marcar como hecha</button>
    </section>}

    <section className="parte-bloque parte-accion" aria-labelledby="pv-fotos">
      <h2 id="pv-fotos">Fotos del trabajo</h2>
      <p className="muted text-sm">Antes, durante o al terminar. Llegan a la carpeta de fotos del proyecto.{v.fotos ? ` Ya has enviado ${v.fotos}.` : ""}</p>
      <input ref={camara} type="file" accept="image/*" capture="environment" multiple hidden onChange={e => void subir(e.target.files)} aria-label="Elegir fotos" />
      <button type="button" className="btn btn-secondary parte-grande" disabled={Boolean(ocupado)} onClick={() => camara.current?.click()}>{ocupado === "foto" ? <Loader2 size={18} className="spin" aria-hidden="true" /> : <Camera size={18} strokeWidth={1.7} aria-hidden="true" />}{ocupado === "foto" ? "Subiendo…" : "Hacer o subir fotos"}</button>
    </section>

    <section className="parte-bloque parte-accion" aria-labelledby="pv-mensaje">
      <h2 id="pv-mensaje">Escribir al equipo</h2>
      <form className="parte-escribir" onSubmit={e => { e.preventDefault(); const t = mensaje.trim(); if (t) void hacer("mensaje", () => servicio.current!.mensaje(t), "Mensaje enviado al equipo.").then(() => setMensaje("")); }}>
        <label className="sr-only" htmlFor="pv-texto">Mensaje</label>
        <textarea id="pv-texto" rows={2} value={mensaje} onChange={e => setMensaje(e.target.value)} maxLength={1000} placeholder="Una duda, un imprevisto, falta material…" />
        <button type="submit" className="btn btn-secondary" disabled={!mensaje.trim() || Boolean(ocupado)} aria-label="Enviar mensaje">{ocupado === "mensaje" ? <Loader2 size={17} className="spin" aria-hidden="true" /> : <Send size={17} strokeWidth={1.7} aria-hidden="true" />}</button>
      </form>
    </section>

    {(aviso || fallo) && <p className={fallo ? "parte-fallo" : "parte-aviso"} role={fallo ? "alert" : "status"}>{fallo || aviso}</p>}

    {v.contacto && <section className="parte-bloque" aria-labelledby="pv-contacto">
      <h2 id="pv-contacto">Si tienes dudas</h2>
      <p><strong>{v.contacto}</strong>{v.telefono ? ` · ${v.telefono}` : ""}</p>
      <div className="parte-acciones">
        {llamar && <a className="btn btn-secondary" href={llamar}><Phone size={17} strokeWidth={1.6} aria-hidden="true" />Llamar</a>}
        {whatsapp && <a className="btn btn-secondary" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} strokeWidth={1.6} aria-hidden="true" />WhatsApp</a>}
      </div>
    </section>}
    <footer className="parte-pie muted">Este enlace es personal: no lo reenvíes. Caduca el {horaCorta(v.caduca)}.</footer>
  </article>;
}
