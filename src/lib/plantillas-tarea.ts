/**
 * Plantillas de tarea: subtareas habituales de cada trabajo de reforma para no escribirlas cada vez.
 * Se aplican al crear o editar una tarea y después se amplían o corrigen a mano. Se sugieren por el título
 * («pintar el salón» → «Pintar paredes»). Son una base: el orden y el texto se pueden cambiar en cada tarea.
 */
import type { PuntoLista } from "./domain";
import { normalizar } from "./busqueda";
import { puntoNuevo } from "./lista-tarea";

export type PlantillaTarea = { id: string; nombre: string; oficio: string; claves: RegExp; subtareas: string[] };

export const plantillasTarea: PlantillaTarea[] = [
  { id: "pintar", nombre: "Pintar paredes", oficio: "Pintura", claves: /\b(pint\w*|paredes|techos?|esmalt\w*)\b/,
    subtareas: ["Llevar o comprar la pintura y la imprimación", "Llevar rodillos, brochas y bandejas", "Llevar cinta de carrocero y plástico", "Proteger suelos, enchufes y muebles", "Tapar grietas y agujeros, y lijar", "Dar imprimación donde haga falta", "Primera mano", "Segunda mano", "Retirar protecciones y limpiar"] },
  { id: "demoler", nombre: "Demoler tabique", oficio: "Demoliciones", claves: /\b(demol\w*|derrib\w*|tirar|tabiques?)\b/,
    subtareas: ["Comprobar que no es un muro de carga", "Pedir contenedor o sacos de escombro", "Cortar luz y agua de la zona", "Proteger suelo y zonas comunes", "Demoler", "Retirar escombro", "Limpiar y dejar la zona lista"] },
  { id: "alicatar", nombre: "Alicatar", oficio: "Albañilería", claves: /\b(alicat\w*|azulej\w*|revestir|chapar)\b/,
    subtareas: ["Comprar azulejo (10 % de más) y cemento cola", "Llevar cortadora, llana y crucetas", "Comprobar plomo y nivel de las paredes", "Replantear hiladas", "Alicatar", "Cortes y remates de esquinas", "Rejuntar", "Limpiar"] },
  { id: "tarima", nombre: "Poner tarima", oficio: "Pavimentos", claves: /\b(tarima|parquet|laminad\w*|suelo|vinilic\w*)\b/,
    subtareas: ["Comprobar humedad y nivel del suelo", "Llevar tarima, manta y rodapié", "Dejar la tarima aclimatarse 48 h", "Colocar la manta", "Colocar la tarima", "Rodapiés y remates de puertas", "Limpiar"] },
  { id: "electricidad", nombre: "Electricidad", oficio: "Electricidad", claves: /\b(luz|luces|electric\w*|enchuf\w*|cuadro|interruptor\w*|mecanism\w*)\b/,
    subtareas: ["Cortar la corriente de la zona", "Llevar cable, cajas, tubo y mecanismos", "Rozas y canalización", "Pasar el cableado", "Colocar mecanismos", "Probar y etiquetar el cuadro"] },
  { id: "fontaneria", nombre: "Fontanería de baño", oficio: "Fontanería", claves: /\b(fontaner\w*|bano|baño|grif\w*|sanitari\w*|ducha|plato|inodoro|tuber\w*)\b/,
    subtareas: ["Cortar el agua", "Retirar sanitarios y grifería antiguos", "Hacer las tomas de agua y desagües", "Prueba de presión", "Montar sanitarios y grifería", "Sellar con silicona", "Comprobar que no hay fugas"] },
  { id: "montar", nombre: "Montar mueble o armario", oficio: "Carpintería", claves: /\b(mont\w*|muebles?|armarios?|cocina|encimera)\b/,
    subtareas: ["Revisar medidas en obra", "Llevar herrajes y tornillería", "Montar el cuerpo", "Colocar puertas y ajustarlas", "Fijar a la pared", "Limpiar y revisar"] },
  { id: "limpieza", nombre: "Limpieza final de obra", oficio: "Coordinación", claves: /\b(limpi\w*|entrega|final)\b/,
    subtareas: ["Retirar restos y escombro", "Aspirar y fregar", "Limpiar cristales y marcos", "Revisar remates y repasos", "Hacer fotos finales para el cliente"] }
];

/** La plantilla que encaja con el título, si alguna: la que más palabras clave coinciden. */
export function sugerirPlantilla(titulo: string): PlantillaTarea | null {
  const t = normalizar(titulo).replace(/ñ/g, "n");
  if (t.trim().length < 3) return null;
  let mejor: { p: PlantillaTarea; n: number } | null = null;
  for (const p of plantillasTarea) {
    const n = (t.match(new RegExp(p.claves.source, "g")) ?? []).length;
    if (n > 0 && (!mejor || n > mejor.n)) mejor = { p, n };
  }
  return mejor?.p ?? null;
}

/** Añade a las subtareas que ya hay las de la plantilla que falten (sin repetir), al final y sin asignar. */
export function aplicarPlantilla(lista: PuntoLista[], p: PlantillaTarea): PuntoLista[] {
  const ya = new Set(lista.map(x => normalizar(x.text).trim()));
  return [...lista, ...p.subtareas.filter(s => !ya.has(normalizar(s).trim())).map(puntoNuevo)].slice(0, 50);
}
