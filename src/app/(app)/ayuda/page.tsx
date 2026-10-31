"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { roleNames } from "@/lib/domain";

type Pregunta = { id: string; q: string; a: string[]; href: string; boton: string };

/** Seis preguntas en el idioma de la obra; cada respuesta termina en la pantalla donde se hace. */
const preguntas: Pregunta[] = [
  { id: "presupuesto", q: "¿Cómo hago un presupuesto?", a: ["Entra en el proyecto y abre la pestaña Presupuesto. Con un borrador abierto, «Añadir partidas» te deja traerlas del catálogo, de un plano o de las fotos.", "Añade las partidas por capítulos: cantidad y precio; el importe se calcula solo.", "Cuando esté listo, «Enviar V1 al cliente». Se ve lo que le llega y qué pasa al enviarla."], href: "/proyectos", boton: "Ir a los proyectos" },
  { id: "version", q: "¿Qué es una versión y por qué hay varias?", a: ["Cada vez que el cliente pide cambios sobre un presupuesto ya enviado se hace una versión nueva (V2, V3…). La anterior se conserva tal cual.", "La «Aceptada» es la que vale para la obra; el «Borrador» es la que estás preparando; la «Enviada» la tiene el cliente. La que late en verde es la actual.", "«Ver qué cambia» enseña qué partidas cambian entre dos versiones y cuánto."], href: "/presupuestos", boton: "Ver los presupuestos" },
  { id: "pdf", q: "¿Cómo mando el presupuesto al cliente?", a: ["En el presupuesto, «Enviar V1 al cliente»: eliges WhatsApp, correo o solo el PDF, y ves lo que va a recibir.", "Plano te abre WhatsApp o el correo con el mensaje escrito; el PDF lo adjuntas tú.", "Cuando conteste, «Registrar respuesta del cliente»: si acepta, si pide cambios o si dice que no."], href: "/presupuestos", boton: "Ver los presupuestos" },
  { id: "hoy", q: "¿Cómo apunto lo que hice hoy?", a: ["En Hoy, marca la casilla de la tarea; si te equivocas, «Deshacer» en el aviso.", "Para apuntar algo nuevo, «+» → «Tarea»: con el qué y el cuándo basta.", "Lo que pasa en la obra (fotos, dudas, cambios) va en el chat del proyecto, que ve todo el equipo."], href: "/", boton: "Ir a Hoy" },
  { id: "fotos", q: "¿Cómo subo las fotos de la visita?", a: ["Si el proyecto no existe, «+» → «Visita»: fotos, notas y, si quieres, una cifra orientativa.", "Si ya existe, entra en él y en la pestaña Planos y fotos toca Subir y elige «Fotos de antes».", "También puedes adjuntarlas en el chat del proyecto: quedan guardadas como documentos."], href: "/proyectos/nueva", boton: "Empezar una visita" },
  { id: "perfiles", q: "¿Qué puede hacer cada perfil?", a: ["Equipo de obra: tareas, mensajes, fotos y recepciones de material.", "Jefe de obra: lo anterior más proyectos, presupuestos, catálogo y materiales.", "Oficina y administración: todo, incluidos marcar presupuestos como aceptados, los cobros y la identidad de la empresa."], href: "/mas", boton: "Ver tu cuenta" }
];

const glosario: [string, string][] = [
  ["Versión (V1, V2…)", "Cada propuesta de presupuesto que se entrega al cliente. Se numeran y se conservan todas."],
  ["Enviada", "La versión que tiene el cliente: ya no se edita; los cambios van a una versión nueva."],
  ["Aceptada", "La versión que el cliente ha aceptado; la obra se hace con esta."],
  ["¿Entra en el precio?", "Si una partida suma en el total, se enseña como alternativa sin sumar, o queda fuera."],
  ["Recargo o descuento", "Porcentaje que sube o baja el precio de una partida respecto al catálogo."],
  ["Cobro", "Lo hecho que ya puedes cobrar de lo aceptado. Queda preparado como borrador; todavía no es una factura."]
];

export default function AyudaPage() {
  const { actor } = useWorkspace();
  return (
    <div className="page">
      <div>
        <h1 className="pl-title">¿Cómo se hace?</h1>
        <p className="subtitle">Las seis cosas que más se preguntan, con el botón que lleva a la pantalla. Tu perfil es {roleNames[actor.role].toLowerCase()}.</p>
      </div>

      <section className="help-list" aria-label="Preguntas frecuentes">
        {preguntas.map(p => (
          <details key={p.id} className="help-item">
            <summary>{p.q}</summary>
            <ol className="help-steps">{p.a.map((linea, i) => <li key={i}>{linea}</li>)}</ol>
            <Link href={p.href} className="btn btn-secondary">{p.boton}<ArrowRight size={16} strokeWidth={1.7} aria-hidden="true" /></Link>
          </details>
        ))}
      </section>

      <section aria-labelledby="glosario">
        <h2 id="glosario" className="h3" style={{ marginBottom: 8 }}>Las palabras del presupuesto</h2>
        <dl className="help-glossary">
          {glosario.map(([termino, definicion]) => <div key={termino}><dt>{termino}</dt><dd>{definicion}</dd></div>)}
        </dl>
      </section>

      <p className="muted text-xs">Si algo no está aquí, pregúntalo en el chat del proyecto: lo ve todo el equipo.</p>
    </div>
  );
}
