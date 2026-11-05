"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { localDate } from "@/lib/hoy";
import { ajustar, casillasMes, esFecha, fechaCampo, fechaLarga, fueraDeRango, inicioMes, mismoMes, sumarDiasIso, sumarMeses, tituloMes } from "@/lib/calendario-mes";

const diasSemana = ["L", "M", "X", "J", "V", "S", "D"];
const nombresSemana = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/**
 * Campo de fecha con el calendario de Plano en lugar del del navegador. Valor en «AAAA-MM-DD» (vacío si no hay).
 * Se maneja con el ratón, el dedo o el teclado: flechas por días y semanas, RePág/AvPág por meses, Inicio/Fin de la semana,
 * Intro para elegir y Escape para cerrar sin cerrar el diálogo que lo contiene.
 */
export function DateField({ value, onChange, min, max, required = false, label, placeholder = "Elige una fecha", id }: {
  value: string; onChange: (value: string) => void; min?: string; max?: string; required?: boolean; label?: string; placeholder?: string; id?: string;
}) {
  const hoy = localDate();
  const valido = esFecha(value) ? value : "";
  const [open, setOpen] = useState(false);
  const [foco, setFoco] = useState(() => ajustar(valido || hoy, min, max));
  const [arriba, setArriba] = useState(false);
  const root = useRef<HTMLDivElement>(null), boton = useRef<HTMLButtonElement>(null), rejilla = useRef<HTMLDivElement>(null);
  const tituloId = useId();

  function abrir() {
    setFoco(ajustar(valido || hoy, min, max));
    const r = boton.current?.getBoundingClientRect();
    if (r) { const abajo = window.innerHeight - r.bottom; setArriba(abajo < 380 && r.top > abajo); }
    setOpen(true);
  }
  function cerrar(devolverFoco = true) { setOpen(false); if (devolverFoco) boton.current?.focus(); }
  function elegir(iso: string) { if (fueraDeRango(iso, min, max)) return; onChange(iso); cerrar(); }

  // Al abrir o moverse, el foco va al día; se cierra al pulsar fuera.
  useLayoutEffect(() => { if (open) rejilla.current?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`)?.focus({ preventScroll: true }); }, [open, foco]);
  // Abierto en su sitio (en un diálogo o en el móvil), se asegura de que el calendario entero quede a la vista.
  useEffect(() => { if (open) root.current?.querySelector(".date-field-panel")?.scrollIntoView({ block: "nearest" }); }, [open]);
  useEffect(() => {
    if (!open) return;
    const fuera = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [open]);

  function teclas(e: KeyboardEvent) {
    const mover = (iso: string) => { e.preventDefault(); setFoco(ajustar(iso, min, max)); };
    switch (e.key) {
      case "ArrowLeft": return mover(sumarDiasIso(foco, -1));
      case "ArrowRight": return mover(sumarDiasIso(foco, 1));
      case "ArrowUp": return mover(sumarDiasIso(foco, -7));
      case "ArrowDown": return mover(sumarDiasIso(foco, 7));
      case "PageUp": return mover(sumarMeses(foco, e.shiftKey ? -12 : -1));
      case "PageDown": return mover(sumarMeses(foco, e.shiftKey ? 12 : 1));
      case "Home": return mover(sumarDiasIso(foco, -((new Date(`${foco}T12:00:00`).getDay() + 6) % 7)));
      case "End": return mover(sumarDiasIso(foco, 6 - ((new Date(`${foco}T12:00:00`).getDay() + 6) % 7)));
      case "Escape": e.preventDefault(); e.stopPropagation(); return cerrar();
      case "Tab": return; // Tab recorre los controles del panel con normalidad.
    }
  }

  const casillas = casillasMes(foco);
  const siguiente = sumarMeses(inicioMes(foco), 1);
  const sinAnterior = Boolean(min && sumarDiasIso(inicioMes(foco), -1) < min), sinSiguiente = Boolean(max && siguiente > max);

  return <div ref={root} className="date-field" data-open={open || undefined}>
    <button ref={boton} id={id} type="button" className="date-field-button" aria-haspopup="dialog" aria-expanded={open}
      aria-label={label ? `${label}: ${valido ? fechaLarga(valido) : "sin fecha"}` : undefined}
      onClick={() => (open ? cerrar(false) : abrir())}
      onKeyDown={e => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); abrir(); } }}>
      <span data-vacio={!valido || undefined}>{valido ? fechaCampo(valido, hoy) : placeholder}</span>
      <CalendarDays size={18} strokeWidth={1.55} aria-hidden="true" />
    </button>
    {required && <input className="date-field-required" tabIndex={-1} aria-hidden="true" value={valido} onChange={() => {}} required />}
    {open && <div className="date-field-panel" data-side={arriba ? "top" : "bottom"} role="dialog" aria-modal="false" aria-labelledby={tituloId}
      onKeyDown={teclas} onClick={e => e.preventDefault()}>
      <div className="date-field-head">
        <button type="button" className="date-field-nav" aria-label="Mes anterior" disabled={sinAnterior} onClick={() => setFoco(ajustar(sumarMeses(foco, -1), min, max))}><ChevronLeft size={18} strokeWidth={1.7} aria-hidden="true" /></button>
        <strong id={tituloId} aria-live="polite">{tituloMes(foco)}</strong>
        <button type="button" className="date-field-nav" aria-label="Mes siguiente" disabled={sinSiguiente} onClick={() => setFoco(ajustar(sumarMeses(foco, 1), min, max))}><ChevronRight size={18} strokeWidth={1.7} aria-hidden="true" /></button>
      </div>
      <div ref={rejilla} className="date-field-grid" role="grid" aria-labelledby={tituloId}>
        <div role="row" className="date-field-week">{diasSemana.map((d, i) => <span key={d} role="columnheader" aria-label={nombresSemana[i]}>{d}</span>)}</div>
        {[0, 1, 2, 3, 4, 5].map(semana => <div key={semana} role="row" className="date-field-week">
          {casillas.slice(semana * 7, semana * 7 + 7).map(iso => {
            const fuera = fueraDeRango(iso, min, max);
            return <span key={iso} role="gridcell" aria-selected={iso === valido}>
              <button type="button" data-dia={iso} className="date-field-day" tabIndex={iso === foco ? 0 : -1}
                data-otro-mes={!mismoMes(iso, foco) || undefined} data-hoy={iso === hoy || undefined} aria-pressed={iso === valido}
                aria-current={iso === hoy ? "date" : undefined} aria-label={fechaLarga(iso)} disabled={fuera}
                onClick={() => elegir(iso)}>{Number(iso.slice(8))}</button>
            </span>;
          })}
        </div>)}
      </div>
      <div className="date-field-foot">
        {!required && valido ? <button type="button" className="date-field-link" onClick={() => { onChange(""); cerrar(); }}>Borrar</button> : <span />}
        {!fueraDeRango(hoy, min, max) && <button type="button" className="date-field-link" onClick={() => elegir(hoy)}>Hoy</button>}
      </div>
    </div>}
  </div>;
}
