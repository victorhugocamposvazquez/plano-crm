/**
 * Voz del navegador, en español: dictado (Web Speech API) para dar órdenes y lectura en voz alta de la respuesta.
 * La usan la visita 360 y la propuesta en 3D. Sin dictado (Firefox), queda el campo para escribir.
 *
 * En el móvil el dictado continuo del navegador no es fiable: se corta tras la primera frase o con un silencio, y si se vuelve
 * a abrir antes de que el anterior termine, el nuevo no oye nada. Por eso aquí cada escucha es una sesión corta que se
 * relanza sola mientras el micrófono siga abierto, solo hay una a la vez, y al abrir se calla la voz de Plano
 * (en iPhone, si está hablando, el micrófono no arranca).
 *
 * En el iPhone, `start()` tiene que ir en el mismo toque, sin `await` delante: si antes se pide getUserMedia, el segundo
 * «Hablar» no oye nada. El teléfono ya es el micrófono; getUserMedia solo se usa en el Mac para Continuidad.
 * Además Safari en iPhone se queda mudo si se crea un reconocedor nuevo tras parar otro (start sin eventos): hay uno
 * solo por página, se para con stop() (abort lo deja roto) y se vuelve a arrancar cuando ha soltado.
 *
 * En el Mac, Continuidad expone el micrófono del iPhone. Abrimos esa pista con getUserMedia y, donde el navegador lo
 * permite, la pasamos a `SpeechRecognition.start(audioTrack)`: sin eso el dictado sigue el micrófono por defecto del Mac.
 */
type Resultados = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
export type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: Resultados }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  onaudiostart?: (() => void) | null;
  start(audioTrack?: MediaStreamTrack): void; stop(): void; abort?(): void;
};
/** Lo que devuelve `escuchar`: para cerrar el micrófono. */
export type Escucha = { parar(): void; microfono: string; continuidad: boolean };
export type MicrofonoAbierto = { stream: MediaStream; label: string; continuidad: boolean; track: MediaStreamTrack | null };

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
    u.onerror = () => { hablaHasta = 0; };
    const s = window.speechSynthesis;
    s.cancel(); s.resume?.(); s.speak(u);
  } catch { /* sin voz */ }
}
export function callar() {
  hablaHasta = 0;
  // Sin pause(): en el iPhone la pausa se queda puesta en toda la página y el dictado ya no oye.
  try { if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); window.speechSynthesis.resume?.(); } } catch { /* sin voz */ }
}

/** Diagnóstico en pantalla (`?vozdebug=1`): qué hace el reconocedor en el iPhone. */
export type Traza = (linea: string) => void;

/** En móvil (Android, iPhone, iPad) se usan sesiones cortas que se relanzan; en escritorio, dictado continuo. */
export function esMovil(ua = typeof navigator === "undefined" ? "" : navigator.userAgent, toques = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && toques > 1);
}

/** Preferencia del micrófono (deviceId) en este navegador. */
export const claveMicrofono = "plano.voz.microfono";

/** Puntuación para elegir Continuidad / iPhone frente al micrófono del Mac. */
export function puntuacionMicrofono(label: string, deviceId = ""): number {
  const l = `${label} ${deviceId}`.toLowerCase();
  if (/iphone|ipad/.test(l)) return 100;
  if (/continuidad|continuity/.test(l)) return 95;
  if (/airpods|bluetooth/.test(l)) return 40;
  if (/macbook|built-?in|interno|internal|^default\b|same as system|igual que el sistema/.test(l)) return 0;
  return 10;
}

export function esContinuidad(label: string, deviceId = ""): boolean {
  return puntuacionMicrofono(label, deviceId) >= 95;
}

/** Elige el deviceId a usar: el guardado si sigue existiendo; si no, el de mayor puntuación (iPhone Continuidad). */
export function elegirMicrofono(dispositivos: { deviceId: string; label: string; kind?: string }[], preferidoId = ""): string {
  const entradas = dispositivos.filter(d => !d.kind || d.kind === "audioinput");
  if (!entradas.length) return "";
  if (preferidoId && entradas.some(d => d.deviceId === preferidoId)) return preferidoId;
  return [...entradas].sort((a, b) => puntuacionMicrofono(b.label, b.deviceId) - puntuacionMicrofono(a.label, a.deviceId) || a.label.localeCompare(b.label, "es"))[0]?.deviceId ?? "";
}

function leerPreferido(): string {
  try { return localStorage.getItem(claveMicrofono) ?? ""; } catch { return ""; }
}
function guardarPreferido(id: string) {
  if (!id) return;
  try { localStorage.setItem(claveMicrofono, id); } catch { /* sin storage */ }
}

function etiquetaDe(lista: MediaDeviceInfo[], id: string, fallback = ""): string {
  return lista.find(d => d.deviceId === id)?.label || fallback || id;
}

/**
 * Abre el micrófono preferido (iPhone Continuidad si el sistema lo expone).
 * Suelta enseguida el permiso genérico y vuelve a pedir el deviceId concreto.
 */
export async function abrirMicrofonoPreferido(): Promise<MicrofonoAbierto | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  try {
    const permiso = await navigator.mediaDevices.getUserMedia({ audio: true });
    const lista = await navigator.mediaDevices.enumerateDevices();
    const elegido = elegirMicrofono(lista, leerPreferido());
    permiso.getTracks().forEach(t => t.stop());
    if (!elegido) return null;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: elegido }, echoCancellation: true, noiseSuppression: true }
    });
    guardarPreferido(elegido);
    const label = etiquetaDe(lista, elegido, stream.getAudioTracks()[0]?.label || "");
    return { stream, label, continuidad: esContinuidad(label, elegido), track: stream.getAudioTracks()[0] ?? null };
  } catch {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const label = stream.getAudioTracks()[0]?.label || "Micrófono";
      return { stream, label, continuidad: esContinuidad(label), track: stream.getAudioTracks()[0] ?? null };
    } catch {
      return null;
    }
  }
}

/** Arranca el reconocedor con la pista elegida cuando el navegador lo admite (`start(audioTrack)`). */
export function arrancarReconocimiento(r: Recognition, pista: MediaStreamTrack | null | undefined) {
  if (pista) {
    try { r.start(pista); return; } catch { /* el motor no admite la pista */ }
  }
  r.start();
}

let vigente: Escucha | null = null;
const MAX_RELANZAR = 60;

/** El reconocedor único de la página y quién lo escucha ahora. */
type Oyente = { resultado(e: { resultIndex: number; results: Resultados }): void; error(e: { error: string }): void; fin(): void; audio(): void };
let motor: { r: Recognition; de: new () => Recognition; corriendo: boolean; paradoEn: number; oyente: Oyente | null } | null = null;
function elMotor(Rec: new () => Recognition) {
  if (motor && motor.de === Rec) return motor;
  const m = { r: new Rec(), de: Rec, corriendo: false, paradoEn: 0, oyente: null as Oyente | null };
  m.r.lang = "es-ES"; m.r.interimResults = true;
  m.r.onresult = e => m.oyente?.resultado(e);
  m.r.onerror = e => m.oyente?.error(e);
  m.r.onaudiostart = () => m.oyente?.audio();
  m.r.onend = () => { m.corriendo = false; m.oyente?.fin(); };
  motor = m;
  return m;
}
/** Para los tests: olvida el reconocedor de la página. */
export function soltarMotor() { motor = null; vigente = null; }

/**
 * Abre el micrófono: cada frase final va a `alOir` y lo que aún se está diciendo a `alParcial`.
 * Sigue escuchando (relanzando la sesión si el navegador la corta) hasta `parar()` o un error de permiso.
 * Mientras Plano habla, lo que oye no cuenta (sería su propia voz). Devuelve null si el navegador no tiene dictado.
 */
export async function escuchar({ alOir, alParcial, alTerminar, alError, traza }: { alOir: (frase: string) => void; alParcial: (texto: string) => void; alTerminar: () => void; alError: (mensaje: string) => void; traza?: Traza }): Promise<Escucha | null> {
  const Disponible = reconocimiento();
  const t0 = Date.now();
  const log = (m: string) => { try { traza?.(`${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`); } catch { /* sin traza */ } };
  if (!Disponible) { log("sin SpeechRecognition"); return null; }
  const Rec: new () => Recognition = Disponible;
  vigente?.parar();
  callar();
  alParcial("");
  const movil = esMovil();
  log(`abrir · ${movil ? "móvil" : "escritorio"}`);
  let micro: MicrofonoAbierto | null = null;
  let pista: MediaStreamTrack | null = null;
  let abierto = true, relanzadas = 0, terminado = false, espera: ReturnType<typeof setTimeout> | null = null;
  // Safari en iPhone a veces cierra la sesión sin marcar la frase como final: lo último oído cuenta.
  let pendiente = "";
  const m = elMotor(Rec);
  const soltarFlujo = () => { try { micro?.stream.getTracks().forEach(t => t.stop()); } catch { /* ya cerrado */ } };
  const terminar = () => { if (terminado) return; terminado = true; abierto = false; if (espera) clearTimeout(espera); soltarFlujo(); if (m.oyente === oyente) m.oyente = null; if (vigente === control) vigente = null; alTerminar(); };
  const relanzar = (ms: number) => { if (espera) clearTimeout(espera); espera = setTimeout(() => { espera = null; if (abierto) arrancar(); }, ms); };

  const oyente: Oyente = {
    audio() { log("micrófono abierto"); },
    resultado(e) {
      if (hablando()) { log("resultado ignorado: Plano habla"); return; }
      relanzadas = 0;
      let parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]; const t = res[0]?.transcript ?? "";
        if (res.isFinal) { pendiente = ""; if (t.trim()) { log(`final «${t.trim()}»`); alOir(t.trim()); } }
        else parcial += t;
      }
      if (parcial) { pendiente = parcial.trim(); alParcial(pendiente); }
    },
    error(e) {
      log(`error ${e.error}`);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { alError("Permite el micrófono para dar órdenes por voz (en los ajustes del navegador)."); terminar(); }
      else if (e.error === "audio-capture") { alError("No llega sonido del micrófono. En el Mac: iPhone cerca y desbloqueado, y en Ajustes › Sonido › Entrada elige el micrófono del iPhone."); terminar(); }
      // «no-speech», «aborted» o «network»: se relanza al terminar la sesión.
    },
    fin() {
      log("fin de sesión");
      if (pendiente && abierto && !hablando()) { const f = pendiente; pendiente = ""; log(`final por cierre «${f}»`); alOir(f); }
      pendiente = "";
      if (!abierto) return;
      // Mientras Plano lee la respuesta, en el iPhone el micrófono no vuelve. Se espera a que calle.
      const pausa = hablando() ? Math.min(8000, Math.max(300, hablaHasta - Date.now() + 150)) : (movil ? 150 : 300);
      if (!hablando() && relanzadas++ >= MAX_RELANZAR) { terminar(); return; }
      relanzar(pausa);
    }
  };

  function arrancar() {
    if (!abierto) return;
    alParcial("");
    // Si el anterior aún no ha soltado, se arranca al llegar su fin (oyente.fin → relanzar).
    if (m.corriendo) {
      // Si tras pedir stop() el iPhone no avisa del fin, no esperamos para siempre.
      if (m.paradoEn && Date.now() - m.paradoEn > 1500) { log("el anterior no soltó: fuerzo"); m.corriendo = false; try { m.r.abort?.(); } catch { /* ya parado */ } }
      else { log("esperando a que suelte el anterior"); relanzar(300); return; }
    }
    m.r.continuous = !movil;
    try { arrancarReconocimiento(m.r, pista); m.corriendo = true; m.paradoEn = 0; log(`start${pista ? " con pista" : ""}`); }
    catch (err) { log(`start falló: ${err instanceof Error ? err.message : String(err)}`); if (abierto && relanzadas++ < MAX_RELANZAR) relanzar(400); else terminar(); }
  }

  const control: Escucha = {
    microfono: "",
    continuidad: false,
    parar() {
      if (!abierto && terminado) return;
      log("parar");
      abierto = false;
      callar();
      // stop() y no abort(): en el iPhone, tras abort el reconocedor arranca sin oír.
      if (m.corriendo) { m.paradoEn = Date.now(); try { m.r.stop(); } catch { m.corriendo = false; } }
      terminar();
    }
  };
  m.oyente = oyente;
  vigente = control;
  // En el móvil, start() va en este mismo turno (el toque). Un await delante y el iPhone ignora el segundo Hablar.
  if (movil) { arrancar(); return control; }
  micro = await abrirMicrofonoPreferido();
  if (!abierto) { soltarFlujo(); return control; }
  pista = micro?.track ?? null;
  control.microfono = micro?.label || "";
  control.continuidad = Boolean(micro?.continuidad);
  if (micro && !micro.continuidad) {
    alError("No aparece el micrófono del iPhone. Déjalo cerca, desbloqueado y con Continuidad; o elígelo en Ajustes del Mac › Sonido › Entrada. Mientras, uso el del Mac.");
  }
  arrancar();
  return control;
}
