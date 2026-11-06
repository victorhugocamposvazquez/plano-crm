import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { arrancarReconocimiento, callar, decir, escuchar, soltarMotor, elegirMicrofono, esContinuidad, esMovil, puntuacionMicrofono, type Recognition } from "@/lib/voz";

/** Reconocedor de mentira con lo que hacen los móviles: cada sesión acaba tras una frase y tarda en soltar el micrófono. */
class Falso {
  static vivos: Falso[] = []; static fallarAlEmpezar = 0; static ultimaPista: MediaStreamTrack | null | undefined = undefined;
  lang = ""; continuous = true; interimResults = false;
  onresult: ((e: { resultIndex: number; results: unknown }) => void) | null = null;
  onend: (() => void) | null = null; onerror: ((e: { error: string }) => void) | null = null;
  activo = false;
  start(audioTrack?: MediaStreamTrack) {
    Falso.ultimaPista = audioTrack;
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
  vi.useFakeTimers(); Falso.vivos = []; Falso.fallarAlEmpezar = 0; Falso.ultimaPista = undefined; soltarMotor();
  vi.stubGlobal("window", { webkitSpeechRecognition: Falso, speechSynthesis: { speaking: false, cancel: vi.fn() } });
  vi.stubGlobal("navigator", {
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    maxTouchPoints: 5,
    mediaDevices: undefined
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Voz en el móvil", () => {
  it("sigue escuchando después de la primera frase (la sesión se relanza sola)", async () => {
    const oido: string[] = [];
    const e = (await escuchar({ alOir: t => oido.push(t), alParcial: () => {}, alTerminar: () => {}, alError: () => {} }))!;
    expect(vivo().continuous).toBe(false);
    vivo().oye("pon tarima en la cocina");
    await vi.advanceTimersByTimeAsync(300);
    vivo().oye("pinta las paredes");
    expect(oido).toEqual(["pon tarima en la cocina", "pinta las paredes"]);
    e.parar();
  });
  it("cerrar y volver a abrir enseguida no deja el segundo sordo", async () => {
    const oido: string[] = []; let terminados = 0;
    const opciones = { alOir: (t: string) => oido.push(t), alParcial: () => {}, alTerminar: () => { terminados++; }, alError: () => {} };
    (await escuchar(opciones))!.parar();
    const segundo = (await escuchar(opciones))!;        // el primero aún no ha soltado el micrófono
    await vi.advanceTimersByTimeAsync(1000);               // su fin llega tarde y no debe apagar al segundo
    vivo().oye("mide 4 por 3");
    expect(oido).toEqual(["mide 4 por 3"]);
    expect(terminados).toBe(1);
    segundo.parar();
    expect(terminados).toBe(2);
  });
  it("si el navegador aún no suelta el micrófono, lo vuelve a intentar", async () => {
    Falso.fallarAlEmpezar = 2;
    const oido: string[] = [];
    await escuchar({ alOir: t => oido.push(t), alParcial: () => {}, alTerminar: () => {}, alError: () => {} });
    await vi.advanceTimersByTimeAsync(1000);
    vivo().oye("cuánto va");
    expect(oido).toEqual(["cuánto va"]);
  });
  it("no se oye a sí mismo mientras Plano habla, y avisa si no hay permiso", async () => {
    const oido: string[] = [], errores: string[] = []; let fin = false;
    const w = window as unknown as { speechSynthesis: { speaking: boolean } };
    await escuchar({ alOir: t => oido.push(t), alParcial: () => {}, alTerminar: () => { fin = true; }, alError: m => errores.push(m) });
    vi.stubGlobal("SpeechSynthesisUtterance", class { lang = ""; rate = 1; onend: (() => void) | null = null; constructor(public text: string) {} });
    (window as unknown as { speechSynthesis: { speak: () => void } }).speechSynthesis.speak = () => {};
    decir("Suelo: tarima laminada."); w.speechSynthesis.speaking = true; vivo().oye("suelo: tarima laminada");
    w.speechSynthesis.speaking = false; await vi.advanceTimersByTimeAsync(300);
    expect(oido).toEqual([]);
    // Si el móvil deja la voz «colgada», pasado el tiempo de la frase vuelve a oír.
    w.speechSynthesis.speaking = true; await vi.advanceTimersByTimeAsync(16000);
    vivo().oye("cuánto va");
    expect(oido).toEqual(["cuánto va"]);
    await vi.advanceTimersByTimeAsync(300);
    expect(errores).toEqual([]);
    vivo().onerror?.({ error: "not-allowed" });
    expect(errores[0]).toMatch(/Permite el micrófono/);
    expect(fin).toBe(true);
  });
  it("si Safari cierra la sesión sin frase final, cuenta lo último que oyó", async () => {
    const oido: string[] = [];
    await escuchar({ alOir: t => oido.push(t), alParcial: () => {}, alTerminar: () => {}, alError: () => {} });
    const r = vivo();
    r.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "pon tarima" }], { isFinal: false })] });
    r.soltar();
    await vi.advanceTimersByTimeAsync(100);
    expect(oido).toEqual(["pon tarima"]);
  });
  it("callar no deja la voz en pausa", () => {
    const s = { speaking: false, cancel: vi.fn(), pause: vi.fn(), resume: vi.fn() };
    vi.stubGlobal("window", { webkitSpeechRecognition: Falso, speechSynthesis: s });
    callar();
    expect(s.pause).not.toHaveBeenCalled();
    expect(s.cancel).toHaveBeenCalled();
  });
  it("distingue móvil de escritorio", () => {
    expect(esMovil("Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile", 5)).toBe(true);
    expect(esMovil("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(esMovil("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
  });
});

describe("Preferencia de micrófono (Mac → iPhone Continuidad)", () => {
  it("prioriza el iPhone frente al micrófono interno del Mac", () => {
    expect(puntuacionMicrofono("iPhone de Hugo")).toBeGreaterThan(puntuacionMicrofono("MacBook Pro Microphone"));
    expect(esContinuidad("iPhone de Hugo")).toBe(true);
    expect(esContinuidad("MacBook Pro Microphone")).toBe(false);
    expect(elegirMicrofono([
      { deviceId: "mac", label: "MacBook Pro Microphone", kind: "audioinput" },
      { deviceId: "phone", label: "iPhone de Hugo", kind: "audioinput" }
    ])).toBe("phone");
  });
  it("respeta el deviceId guardado si sigue existiendo", () => {
    expect(elegirMicrofono([
      { deviceId: "mac", label: "MacBook Pro Microphone" },
      { deviceId: "phone", label: "iPhone de Hugo" },
      { deviceId: "otro", label: "iPhone de Marta" }
    ], "otro")).toBe("otro");
  });
  it("en el móvil el segundo Hablar vuelve a oír y no pide getUserMedia", async () => {
    const getUserMedia = vi.fn();
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      maxTouchPoints: 5,
      mediaDevices: { getUserMedia, enumerateDevices: vi.fn() }
    });
    const oido: string[] = [];
    const parcial: string[] = [];
    const primero = (await escuchar({ alOir: t => oido.push(t), alParcial: t => parcial.push(t), alTerminar: () => {}, alError: () => {} }))!;
    expect(parcial[0]).toBe("");
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(Falso.ultimaPista).toBeUndefined();
    vivo().oye("primera");
    primero.parar();
    await vi.advanceTimersByTimeAsync(500);
    await escuchar({ alOir: t => oido.push(t), alParcial: () => {}, alTerminar: () => {}, alError: () => {} });
    vivo().oye("segunda");
    expect(oido).toEqual(["primera", "segunda"]);
    expect(getUserMedia).not.toHaveBeenCalled();
    // El iPhone se queda mudo con un reconocedor nuevo: siempre es el mismo.
    expect(new Set(Falso.vivos).size).toBe(1);
  });
  it("parar usa stop() y no abort()", async () => {
    const e = (await escuchar({ alOir: () => {}, alParcial: () => {}, alTerminar: () => {}, alError: () => {} }))!;
    const r = vivo();
    const stop = vi.spyOn(r, "stop"), abort = vi.spyOn(r, "abort");
    e.parar();
    expect(stop).toHaveBeenCalled();
    expect(abort).not.toHaveBeenCalled();
  });
  it("en el Mac pasa la pista del iPhone a start", async () => {
    const track = { kind: "audio", label: "iPhone de Hugo", stop: vi.fn() } as unknown as MediaStreamTrack;
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      maxTouchPoints: 0,
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
        enumerateDevices: vi.fn().mockResolvedValue([
          { deviceId: "mac", label: "MacBook Pro Microphone", kind: "audioinput" },
          { deviceId: "phone", label: "iPhone de Hugo", kind: "audioinput" }
        ])
      }
    });
    vi.stubGlobal("localStorage", { getItem: () => "", setItem: vi.fn(), removeItem: vi.fn() });
    await escuchar({ alOir: () => {}, alParcial: () => {}, alTerminar: () => {}, alError: () => {} });
    expect(Falso.ultimaPista).toBe(track);
  });
  it("pasa la pista de audio a start(audioTrack) y cae a start() si falla", () => {
    const pista = { kind: "audio", label: "iPhone de Hugo" } as MediaStreamTrack;
    const conPista = { start: vi.fn(), stop: vi.fn() } as unknown as Recognition;
    arrancarReconocimiento(conPista, pista);
    expect(conPista.start).toHaveBeenCalledWith(pista);

    const sinSoporte = {
      start: vi.fn((track?: MediaStreamTrack) => { if (track) throw new Error("no admite pista"); }),
      stop: vi.fn()
    } as unknown as Recognition;
    arrancarReconocimiento(sinSoporte, pista);
    expect(sinSoporte.start).toHaveBeenNthCalledWith(1, pista);
    expect(sinSoporte.start).toHaveBeenNthCalledWith(2);
  });
});
