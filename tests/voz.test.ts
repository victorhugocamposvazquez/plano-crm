import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { decir, escuchar, esMovil } from "@/lib/voz";

/** Reconocedor de mentira con lo que hacen los móviles: cada sesión acaba tras una frase y tarda en soltar el micrófono. */
class Falso {
  static vivos: Falso[] = []; static fallarAlEmpezar = 0;
  lang = ""; continuous = true; interimResults = false;
  onresult: ((e: { resultIndex: number; results: unknown }) => void) | null = null;
  onend: (() => void) | null = null; onerror: ((e: { error: string }) => void) | null = null;
  activo = false;
  start() {
    if (Falso.fallarAlEmpezar > 0) { Falso.fallarAlEmpezar--; throw new Error("InvalidStateError"); }
    if (Falso.vivos.some(r => r.activo)) throw new Error("InvalidStateError: otro reconocedor tiene el micrófono");
    this.activo = true; Falso.vivos.push(this);
  }
  stop() { this.soltar(); }
  abort() { this.soltar(); }
  soltar() { if (!this.activo) return; this.activo = false; setTimeout(() => this.onend?.(), 50); }
  oye(texto: string) { this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: texto }], { isFinal: true })] }); this.soltar(); }
}
const vivo = () => Falso.vivos.filter(r => r.activo).at(-1)!;

beforeEach(() => {
  vi.useFakeTimers(); Falso.vivos = []; Falso.fallarAlEmpezar = 0;
  vi.stubGlobal("window", { webkitSpeechRecognition: Falso, speechSynthesis: { speaking: false, cancel: vi.fn() } });
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", maxTouchPoints: 5 });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Voz en el móvil", () => {
  it("sigue escuchando después de la primera frase (la sesión se relanza sola)", () => {
    const oido: string[] = [];
    const e = escuchar({ alOir: t => oido.push(t), alParcial: () => {}, alTerminar: () => {}, alError: () => {} })!;
    expect(vivo().continuous).toBe(false);
    vivo().oye("pon tarima en la cocina");
    vi.advanceTimersByTime(300);
    vivo().oye("pinta las paredes");
    expect(oido).toEqual(["pon tarima en la cocina", "pinta las paredes"]);
    e.parar();
  });
  it("cerrar y volver a abrir enseguida no deja el segundo sordo", () => {
    const oido: string[] = []; let terminados = 0;
    const opciones = { alOir: (t: string) => oido.push(t), alParcial: () => {}, alTerminar: () => { terminados++; }, alError: () => {} };
    escuchar(opciones)!.parar();
    const segundo = escuchar(opciones)!;        // el primero aún no ha soltado el micrófono
    vi.advanceTimersByTime(1000);               // su fin llega tarde y no debe apagar al segundo
    vivo().oye("mide 4 por 3");
    expect(oido).toEqual(["mide 4 por 3"]);
    expect(terminados).toBe(1);
    segundo.parar();
    expect(terminados).toBe(2);
  });
  it("si el navegador aún no suelta el micrófono, lo vuelve a intentar", () => {
    Falso.fallarAlEmpezar = 2;
    const oido: string[] = [];
    escuchar({ alOir: t => oido.push(t), alParcial: () => {}, alTerminar: () => {}, alError: () => {} });
    vi.advanceTimersByTime(1000);
    vivo().oye("cuánto va");
    expect(oido).toEqual(["cuánto va"]);
  });
  it("no se oye a sí mismo mientras Plano habla, y avisa si no hay permiso", () => {
    const oido: string[] = [], errores: string[] = []; let fin = false;
    const w = window as unknown as { speechSynthesis: { speaking: boolean } };
    escuchar({ alOir: t => oido.push(t), alParcial: () => {}, alTerminar: () => { fin = true; }, alError: m => errores.push(m) });
    vi.stubGlobal("SpeechSynthesisUtterance", class { lang = ""; rate = 1; onend: (() => void) | null = null; constructor(public text: string) {} });
    (window as unknown as { speechSynthesis: { speak: () => void } }).speechSynthesis.speak = () => {};
    decir("Suelo: tarima laminada."); w.speechSynthesis.speaking = true; vivo().oye("suelo: tarima laminada");
    w.speechSynthesis.speaking = false; vi.advanceTimersByTime(300);
    expect(oido).toEqual([]);
    // Si el móvil deja la voz «colgada», pasado el tiempo de la frase vuelve a oír.
    w.speechSynthesis.speaking = true; vi.advanceTimersByTime(16000);
    vivo().oye("cuánto va");
    expect(oido).toEqual(["cuánto va"]);
    vi.advanceTimersByTime(300);
    expect(errores).toEqual([]);
    vivo().onerror?.({ error: "not-allowed" });
    expect(errores[0]).toMatch(/Permite el micrófono/);
    expect(fin).toBe(true);
  });
  it("distingue móvil de escritorio", () => {
    expect(esMovil("Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile", 5)).toBe(true);
    expect(esMovil("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(esMovil("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
  });
});
