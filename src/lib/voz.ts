/**
 * Voz del navegador, en español: dictado (Web Speech API) para dar órdenes y lectura en voz alta de la respuesta.
 * La usan la visita 360 y la propuesta en 3D. Sin dictado (Firefox), queda el campo para escribir.
 *
 * En el móvil el dictado continuo del navegador no es fiable: se corta tras la primera frase o con un silencio, y si se vuelve
 * a abrir antes de que el anterior termine, el nuevo no oye nada. Por eso aquí cada escucha es una sesión corta que se
 * relanza sola mientras el micrófono siga abierto, solo hay una a la vez, y al abrir se calla la voz de Plano
 * (en iPhone, si está hablando, el micrófono no arranca).
 */
type Resultados = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
export type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: Resultados }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null; start(): void; stop(): void; abort?(): void;
};
/** Lo que devuelve `escuchar`: para cerrar el micrófono. */
export type Escucha = { parar(): void };

export function reconocimiento(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Hasta cuándo puede estar hablando Plano: el tiempo de leer la frase. Si el móvil deja la voz «colgada», el micrófono no se queda sordo. */
let hablaHasta = 0;
const hablando = () => { try { return Date.now() < hablaHasta && typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.speaking; } catch { return false; } };
export function decir(texto: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(texto); u.lang = "es-ES"; u.rate = 1.05;
    hablaHasta = Date.now() + Math.min(15000, 800 + texto.length * 70);
    u.onend = () => { hablaHasta = 0; };
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  } catch { /* sin voz */ }
}
export function callar() { hablaHasta = 0; try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch { /* sin voz */ } }

/** En móvil (Android, iPhone, iPad) se usan sesiones cortas que se relanzan; en escritorio, dictado continuo. */
export function esMovil(ua = typeof navigator === "undefined" ? "" : navigator.userAgent, toques = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && toques > 1);
}

let vigente: Escucha | null = null;
const MAX_RELANZAR = 60;

/**
 * Abre el micrófono: cada frase final va a `alOir` y lo que aún se está diciendo a `alParcial`.
 * Sigue escuchando (relanzando la sesión si el navegador la corta) hasta `parar()` o un error de permiso.
 * Mientras Plano habla, lo que oye no cuenta (sería su propia voz). Devuelve null si el navegador no tiene dictado.
 */
export function escuchar({ alOir, alParcial, alTerminar, alError }: { alOir: (frase: string) => void; alParcial: (texto: string) => void; alTerminar: () => void; alError: (mensaje: string) => void }): Escucha | null {
  const Disponible = reconocimiento();
  if (!Disponible) return null;
  const Rec: new () => Recognition = Disponible;
  vigente?.parar();
  callar();
  const movil = esMovil();
  let abierto = true, actual: Recognition | null = null, relanzadas = 0, terminado = false;
  const terminar = () => { if (terminado) return; terminado = true; abierto = false; if (vigente === control) vigente = null; alTerminar(); };
  const relanzar = (espera: number) => setTimeout(() => { if (abierto) arrancar(); }, espera);

  function arrancar() {
    const r = new Rec(); actual = r;
    r.lang = "es-ES"; r.continuous = !movil; r.interimResults = true;
    r.onresult = e => {
      if (actual !== r || hablando()) return;
      relanzadas = 0;
      let parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) { const res = e.results[i]; const t = res[0]?.transcript ?? ""; if (res.isFinal) { if (t.trim()) alOir(t.trim()); } else parcial += t; }
      if (parcial) alParcial(parcial.trim());
    };
    r.onerror = e => {
      if (actual !== r) return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { alError("Permite el micrófono para dar órdenes por voz (en los ajustes del navegador)."); terminar(); }
      else if (e.error === "audio-capture") { alError("No llega sonido del micrófono. Cierra otras apps que lo usen y vuelve a intentarlo."); terminar(); }
      // «no-speech», «aborted» o «network»: se relanza al terminar la sesión.
    };
    r.onend = () => {
      if (actual !== r) return;
      actual = null;
      if (abierto && relanzadas++ < MAX_RELANZAR) relanzar(movil ? 150 : 300); else terminar();
    };
    try { r.start(); }
    catch { actual = null; if (abierto && relanzadas++ < MAX_RELANZAR) relanzar(400); else terminar(); } // el anterior aún no había soltado el micrófono
  }

  const control: Escucha = {
    parar() {
      if (!abierto && terminado) return;
      abierto = false;
      const r = actual; actual = null;
      try { (r?.abort ?? r?.stop)?.call(r); } catch { /* ya parado */ }
      terminar();
    }
  };
  vigente = control;
  arrancar();
  return control;
}
