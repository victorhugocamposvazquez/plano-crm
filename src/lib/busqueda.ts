/**
 * Búsqueda tolerante de Proyectos, Clientes y Catálogo: entiende acentos, palabras vacías, singular y plural,
 * prefijos y errores de una o dos letras («mosiaco» encuentra «mosaico»). Los números solo coinciden por
 * el principio de la palabra, para que «05» no arrastre «PL-005».
 */
export const normalizar = (texto: string) => String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/×/g, "x");
const vacias = new Set(["de", "del", "la", "el", "los", "las", "en", "con", "y", "para", "un", "una", "que", "a", "por", "al", "o"]);
const raiz = (palabra: string) => (palabra.length > 4 ? palabra.replace(/(es|s)$/, "") : palabra);

/** Distancia de edición con transposición: dos letras cambiadas de sitio cuentan como un error. */
export function distancia(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}

/** ¿El término `t` encuentra la palabra `w`? Ambos ya normalizados. */
export function coincidePalabra(t: string, w: string) {
  if (w.startsWith(t)) return true;
  if (/\d/.test(t)) return false;
  if (t.length >= 4 && w.length >= 4 && t.startsWith(w)) return true;
  const rt = raiz(t), rw = raiz(w);
  if (rt.length >= 3 && rw.startsWith(rt)) return true;
  if (rt.length >= 4 && rw.length >= 4 && rt.startsWith(rw)) return true;
  const limite = t.length >= 7 ? 2 : t.length >= 4 ? 1 : 0;
  if (!limite || w.length < 3 || /\d/.test(w)) return false;
  return distancia(t, w) <= limite || (w.length > t.length && distancia(t, w.slice(0, t.length)) <= limite) || (rt.length >= 4 && distancia(rt, rw) <= limite);
}

const palabras = (texto: string) => normalizar(texto).split(/[^a-z0-9ñ]+/).filter(Boolean);
export type Consulta = { terminos: string[]; soloStock: boolean };
export function leerConsulta(texto: string): Consulta {
  const crudo = normalizar(texto);
  const soloStock = /\b(en stock|stock|disponibles?|hay en almacen)\b/.test(crudo);
  return { soloStock, terminos: palabras(crudo.replace(/\b(en stock|stock|disponibles?|hay en almacen)\b/g, " ")).filter(t => !vacias.has(t)) };
}

/** ¿Todos los términos encuentran alguna palabra del texto? Cada término puede coincidir en un sitio distinto. */
export function coincide(terminos: string[], texto: string) {
  const ws = palabras(texto);
  return terminos.every(t => ws.some(w => coincidePalabra(t, w)));
}

export function buscarTolerante<T>(lista: T[], consulta: string, texto: (item: T) => string) {
  const { terminos } = leerConsulta(consulta);
  return terminos.length ? lista.filter(item => coincide(terminos, texto(item))) : lista;
}

export type ChipBusqueda = { termino: string; correccion: string | null };
/** Cómo se ha entendido la búsqueda: un chip por término y, si no estaba tal cual, la palabra que se ha entendido. */
export function chipsConsulta(consulta: string, vocabulario: string[]): ChipBusqueda[] {
  const conocidas = new Set(vocabulario.flatMap(palabras));
  return leerConsulta(consulta).terminos.map(termino => {
    if (conocidas.has(termino) || /\d/.test(termino)) return { termino, correccion: null };
    const parecida = [...conocidas].find(w => !w.startsWith(raiz(termino)) && !termino.startsWith(w) && coincidePalabra(termino, w));
    return { termino, correccion: parecida ?? null };
  });
}

export function quitarTermino(consulta: string, termino: string) {
  return normalizar(consulta).split(/\s+/).filter(p => p && p !== termino).join(" ");
}

const clave = (seccion: string) => `plano.busquedas.${seccion}`;
export function leerRecientes(seccion: string): string[] {
  try { const raw = JSON.parse(localStorage.getItem(clave(seccion)) ?? "[]"); return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string").slice(0, 5) : []; } catch { return []; }
}
export function guardarReciente(seccion: string, consulta: string) {
  const limpia = consulta.trim();
  if (limpia.length < 2) return leerRecientes(seccion);
  const siguiente = [limpia, ...leerRecientes(seccion).filter(x => normalizar(x) !== normalizar(limpia))].slice(0, 5);
  try { localStorage.setItem(clave(seccion), JSON.stringify(siguiente)); } catch {}
  return siguiente;
}
