/**
 * Plantillas de tarea: subtareas habituales de cada trabajo de reforma para no escribirlas cada vez.
 * Se aplican al crear o editar una tarea y después se amplían o corrigen a mano. Se sugieren por el título
 * («pintar el salón» → «Pintar paredes»). Son una base: el orden y el texto se pueden cambiar en cada tarea.
 */
import type { PuntoLista, TaskTemplate } from "./domain";
import { normalizar } from "./busqueda";
import { puntoNuevo } from "./lista-tarea";

/** `propia`: la guardó la empresa (con el id de su fila); si no, es una de las de base de Plano. */
export type PlantillaTarea = { id: string; nombre: string; oficio: string; claves: RegExp; subtareas: string[]; propia?: TaskTemplate; raices?: string[] };

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

// Palabras que no distinguen un trabajo de otro: «Cambiar ventanas» se sugiere por «ventanas», no por «cambiar».
const vacias = new Set(["para", "con", "del", "las", "los", "una", "unos", "unas", "por", "sin", "todo", "toda", "todos", "final", "obra", "cambiar", "poner", "hacer", "colocar", "quitar", "revisar", "arreglar", "nuevo", "nueva", "nuevos", "nuevas", "completo", "completa"]);
const nombreClave = (n: string) => normalizar(n).replace(/ñ/g, "n").trim();

/** Las raíces que distinguen una plantilla propia, sacadas de su nombre: «Pintar fachada» → pint…, fachad… */
export function raicesDeNombre(nombre: string): string[] {
  return [...new Set(nombreClave(nombre).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !vacias.has(w)).map(w => w.length > 5 ? w.slice(0, -2) : w))];
}
export function clavesDeNombre(nombre: string): RegExp {
  const raices = raicesDeNombre(nombre);
  return raices.length ? new RegExp(`\\b(${raices.map(r => `${r}\\w*`).join("|")})\\b`) : /(?!)/;
}

/** Plantilla propia en la forma de las de base. */
export const desdePropia = (t: TaskTemplate): PlantillaTarea => ({ id: t.id, nombre: t.name, oficio: t.trade, claves: clavesDeNombre(t.name), raices: raicesDeNombre(t.name), subtareas: t.subtasks, propia: t });

/**
 * Las plantillas que se ofrecen: primero las de la empresa (por nombre) y después las de base.
 * Una propia con el mismo nombre que una de base la sustituye: así se «corrige» una de base.
 */
export function plantillasDisponibles(propias: TaskTemplate[] | undefined): PlantillaTarea[] {
  // La que sustituye a una de base hereda sus palabras clave: «Pintar paredes» propia se sigue sugiriendo con «techos».
  const lista = [...(propias ?? [])].sort((a, b) => a.name.localeCompare(b.name, "es")).map(t => {
    const base = plantillasTarea.find(p => nombreClave(p.nombre) === nombreClave(t.name));
    return base ? { ...desdePropia(t), claves: base.claves, raices: undefined } : desdePropia(t);
  });
  const usados = new Set(lista.map(p => nombreClave(p.nombre)));
  return [...lista, ...plantillasTarea.filter(p => !usados.has(nombreClave(p.nombre)))];
}

/** La propia que ya usa ese nombre, si hay (sin distinguir mayúsculas ni acentos). */
export const propiaConNombre = (propias: TaskTemplate[] | undefined, nombre: string) => (propias ?? []).find(t => nombreClave(t.name) === nombreClave(nombre)) ?? null;

/** Subtareas de una tarea → textos para guardar como plantilla: sin vacías ni repetidas, hasta 50. */
export function textosDePlantilla(lista: PuntoLista[]): string[] {
  const vistos = new Set<string>();
  return lista.map(p => p.text.trim()).filter(t => { const k = normalizar(t); if (!t || vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, 50);
}

/** La plantilla que encaja con el título, si alguna: la que más palabras clave coinciden (en empate, la primera: las propias van antes). */
export function sugerirPlantilla(titulo: string, lista: PlantillaTarea[] = plantillasTarea): PlantillaTarea | null {
  const t = normalizar(titulo).replace(/ñ/g, "n");
  if (t.trim().length < 3) return null;
  let mejor: { p: PlantillaTarea; n: number } | null = null;
  for (const p of lista) {
    // Una propia cuenta cuántas palabras de su nombre aparecen; si falta alguna, cede el empate a la de base
    // («Pintar el salón» → «Pintar paredes», no «Pintar fachada»; «Pintar la fachada» → la propia).
    const n = p.raices
      ? p.raices.filter(r => new RegExp(`\\b${r}`).test(t)).length - (p.raices.every(r => new RegExp(`\\b${r}`).test(t)) ? 0 : 0.5)
      : (t.match(new RegExp(p.claves.source, "g")) ?? []).length;
    if (n > 0 && (!mejor || n > mejor.n)) mejor = { p, n };
  }
  return mejor?.p ?? null;
}

/** Añade a las subtareas que ya hay las de la plantilla que falten (sin repetir), al final y sin asignar. */
export function aplicarPlantilla(lista: PuntoLista[], p: PlantillaTarea): PuntoLista[] {
  const ya = new Set(lista.map(x => normalizar(x.text).trim()));
  return [...lista, ...p.subtareas.filter(s => !ya.has(normalizar(s).trim())).map(puntoNuevo)].slice(0, 50);
}
