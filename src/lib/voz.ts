/**
 * Voz del navegador, en español: dictado (Web Speech API) para dar órdenes y lectura en voz alta de la respuesta.
 * La usan la visita 360 y la propuesta en 3D. Sin dictado (Firefox), queda el campo para escribir.
 */
export type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null; start(): void; stop(): void;
};

export function reconocimiento(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function decir(texto: string) {
  try { if (!("speechSynthesis" in window)) return; const u = new SpeechSynthesisUtterance(texto); u.lang = "es-ES"; u.rate = 1.05; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch { /* sin voz */ }
}

/**
 * Empieza a escuchar: cada frase final va a `alOir`, lo que aún se está diciendo a `alParcial`.
 * Devuelve el reconocedor (para pararlo) o null si el navegador no tiene dictado.
 */
export function escuchar({ alOir, alParcial, alTerminar, alError }: { alOir: (frase: string) => void; alParcial: (texto: string) => void; alTerminar: () => void; alError: (mensaje: string) => void }): Recognition | null {
  const Rec = reconocimiento();
  if (!Rec) return null;
  const r = new Rec(); r.lang = "es-ES"; r.continuous = true; r.interimResults = true;
  r.onresult = e => {
    let parcial = "";
    for (let i = e.resultIndex; i < e.results.length; i++) { const res = e.results[i]; const t = res[0]?.transcript ?? ""; if (res.isFinal) alOir(t.trim()); else parcial += t; }
    if (parcial) alParcial(parcial.trim());
  };
  r.onerror = e => { if (e.error === "not-allowed") alError("Permite el micrófono para dar órdenes por voz."); };
  r.onend = alTerminar;
  r.start();
  return r;
}
