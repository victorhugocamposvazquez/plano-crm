"use client";
import Link from "next/link";
import { CircleHelp, ArrowRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { roleNames } from "@/lib/domain";

type Pregunta = { id: string; q: string; a: string[]; href: string; boton: string };

/** Seis preguntas en el idioma de la obra; cada respuesta termina en la pantalla donde se hace. */
const preguntas: Pregunta[] = [
  { id: "presupuesto", q: "¿Cómo hago un presupuesto?", a: ["Entra en el proyecto y toca «···» → «Nuevo presupuesto» (a mano con el catálogo, desde un plano o desde fotos).", "Añade las partidas por capítulos: cantidad y precio; el importe se calcula solo.", "Cuando esté listo, «Terminar la V1 para enviarla» y después el PDF para el cliente."], href: "/proyectos", boton: "Ir a los proyectos" },
  { id: "version", q: "¿Qué es una versión y por qué hay varias?", a: ["Cada vez que el cliente pide cambios sobre un presupuesto ya terminado se hace una versión nueva (V2, V3…). La anterior se conserva tal cual.", "La que está «aprobada» es la que vale para la obra; la que está «en borrador» es la que estás preparando.", "«Ver cambios» enseña qué partidas cambian entre dos versiones y cuánto."], href: "/presupuestos", boton: "Ver los presupuestos" },
  { id: "pdf", q: "¿Cómo mando el presupuesto al cliente?", a: ["En el presupuesto, «···» → «Imprimir borrador» o «PDF de la V1». Se abre el documento con la identidad de la empresa.", "Desde ahí se guarda en PDF o se imprime, y se envía por correo o WhatsApp como cualquier archivo.", "Cuando el cliente acepte, «Aprobar V1 para obra» y anota cómo aceptó (correo, firma, señal)."], href: "/presupuestos", boton: "Ver los presupuestos" },
  { id: "hoy", q: "¿Cómo apunto lo que hice hoy?", a: ["En Hoy, marca la casilla de la tarea; si te equivocas, «Deshacer» en el aviso.", "Para apuntar algo nuevo, «+» → «Tarea»: con el qué y el cuándo basta.", "Lo que pasa en la obra (fotos, dudas, cambios) va en el chat del proyecto, que ve todo el equipo."], href: "/", boton: "Ir a Hoy" },
  { id: "fotos", q: "¿Cómo subo las fotos de la visita?", a: ["Si el proyecto no existe, «+» → «Visita a pie de obra»: fotos, notas y, si quieres, una cifra orientativa.", "Si ya existe, entra en él y en la pestaña Documentos elige «Fotos de antes» y toca Adjuntar.", "También puedes adjuntarlas en el chat del proyecto: quedan guardadas como documentos."], href: "/proyectos/nueva", boton: "Empezar una visita" },
  { id: "perfiles", q: "¿Qué puede hacer cada perfil?", a: ["Equipo de obra: tareas, mensajes, fotos y recepciones de material.", "Jefe de obra: lo anterior más proyectos, presupuestos, catálogo y compras.", "Oficina y administración: todo, incluidas la aprobación de presupuestos, las certificaciones y la identidad de la empresa."], href: "/mas", boton: "Ver tu cuenta" }
];

const glosario: [string, string][] = [
  ["Versión (V1, V2…)", "Cada propuesta de presupuesto que se entrega al cliente. Se numeran y se conservan todas."],
  ["Terminar una versión", "Dejarla cerrada para enviarla: ya no se edita; los cambios van a una versión nueva."],
  ["Aprobada para obra", "La versión que el cliente ha aceptado; es la referencia de la obra."],
  ["¿Entra en el precio?", "Si una partida suma en el total, se enseña como alternativa sin sumar, o queda fuera."],
  ["Recargo o descuento", "Porcentaje que sube o baja el precio de una partida respecto al catálogo."],
  ["Certificación", "Lo ejecutado que ya puedes facturar de lo aprobado."]
];

export default function AyudaPage() {
  const { actor } = useWorkspace();
  return (
    <div className="page">
      <div>
        <div className="eyebrow"><CircleHelp size={13} strokeWidth={1.8} aria-hidden="true" /><span>Ayuda</span></div>
        <h1 className="h1">¿Cómo se hace?</h1>
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
