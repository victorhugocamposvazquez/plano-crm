"use client";
import { useEffect, useState } from "react";
import { CalendarPlus, MapPin, MessageCircle, Package, Phone } from "lucide-react";
import { calendarioParte, leerParte, mapaDe, type Parte } from "@/lib/parte";
import { enlaceLlamar, enlaceWhatsapp } from "@/lib/operarios";
import { Brand } from "@/components/ui/brand";

const fechaLarga = (iso: string) => new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${iso}T12:00:00`)).replace(/^./, c => c.toUpperCase());

/**
 * Parte de trabajo que recibe un operario por WhatsApp: qué hacer, cuándo, dónde (con «Cómo llegar»), a quién llamar y qué material hay.
 * Todo viene en el enlace, tras «#»; la página no pide cuenta ni consulta el servidor.
 */
export default function PartePage() {
  const [parte, setParte] = useState<Parte | null | undefined>(undefined);
  useEffect(() => { const leer = () => setParte(leerParte(window.location.hash)); leer(); window.addEventListener("hashchange", leer); return () => window.removeEventListener("hashchange", leer); }, []);

  function guardarEnCalendario() {
    if (!parte) return;
    const url = URL.createObjectURL(new Blob([calendarioParte(parte)], { type: "text/calendar" })), a = document.createElement("a");
    a.href = url; a.download = "trabajo.ics"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (parte === undefined) return <p className="muted parte-vacio">Abriendo el parte…</p>;
  if (parte === null) return <div className="parte-vacio"><Brand /><h1>Este enlace no se puede abrir</h1><p className="muted">Puede que esté incompleto. Pide que te lo vuelvan a enviar.</p></div>;

  const llamar = enlaceLlamar(parte.telefono), whatsapp = parte.telefono ? enlaceWhatsapp(parte.telefono) : "";
  return <article className="parte">
    <header className="parte-cabeza">
      <Brand />
      {parte.empresa && <span className="muted">{parte.empresa}</span>}
    </header>
    <section className="parte-principal">
      <p className="parte-kicker">Parte de trabajo{parte.oficio ? ` · ${parte.oficio}` : ""}</p>
      <h1>{parte.tarea}</h1>
      <p className="parte-fecha">{fechaLarga(parte.fecha)}</p>
      {parte.para && <p className="muted">Para {parte.para}</p>}
      <button type="button" className="btn btn-secondary" onClick={guardarEnCalendario}><CalendarPlus size={17} strokeWidth={1.6} aria-hidden="true" />Guardar en el calendario</button>
    </section>
    {(parte.obra || parte.direccion) && <section className="parte-bloque" aria-labelledby="parte-donde">
      <h2 id="parte-donde">Dónde</h2>
      {parte.obra && <p><strong>{parte.obra}</strong></p>}
      {parte.direccion && <p>{parte.direccion}</p>}
      {parte.direccion && <a className="btn btn-primary" href={mapaDe(parte.direccion)} target="_blank" rel="noopener noreferrer"><MapPin size={17} strokeWidth={1.6} aria-hidden="true" />Cómo llegar</a>}
    </section>}
    {parte.notas && <section className="parte-bloque" aria-labelledby="parte-notas"><h2 id="parte-notas">A tener en cuenta</h2><p className="parte-texto">{parte.notas}</p></section>}
    {parte.material.length > 0 && <section className="parte-bloque" aria-labelledby="parte-material">
      <h2 id="parte-material">Material en obra</h2>
      <ul className="parte-material">{parte.material.map(m => <li key={m}><Package size={16} strokeWidth={1.6} aria-hidden="true" />{m}</li>)}</ul>
    </section>}
    {parte.contacto && <section className="parte-bloque" aria-labelledby="parte-contacto">
      <h2 id="parte-contacto">Si tienes dudas</h2>
      <p><strong>{parte.contacto}</strong>{parte.telefono ? ` · ${parte.telefono}` : ""}</p>
      <div className="parte-acciones">
        {llamar && <a className="btn btn-secondary" href={llamar}><Phone size={17} strokeWidth={1.6} aria-hidden="true" />Llamar</a>}
        {whatsapp && <a className="btn btn-secondary" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} strokeWidth={1.6} aria-hidden="true" />WhatsApp</a>}
      </div>
    </section>}
    <footer className="parte-pie muted">Enviado {parte.enviado}. Si algo cambia, te llegará un enlace nuevo.</footer>
  </article>;
}
