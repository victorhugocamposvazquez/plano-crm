"use client";
import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Search, X } from "lucide-react";
import { chipsConsulta, guardarReciente, leerRecientes, quitarTermino } from "@/lib/busqueda";

/**
 * Buscador común de Proyectos, Clientes y Catálogo. Con la caja vacía enseña las últimas búsquedas;
 * al escribir, cómo se ha entendido (un chip por término y la corrección si ha hecho falta).
 */
export function SearchBox({ seccion, value, onChange, placeholder, label, count, vocabulario = [] }: { seccion: string; value: string; onChange: (value: string) => void; placeholder: string; label: string; count?: string; vocabulario?: string[] }) {
  const [recientes, setRecientes] = useState<string[]>([]);
  useEffect(() => { setRecientes(leerRecientes(seccion)); }, [seccion]);
  const chips = useMemo(() => (value.trim() ? chipsConsulta(value, vocabulario) : []), [value, vocabulario]);
  const guardar = () => setRecientes(guardarReciente(seccion, value));
  return (
    <div className="searchbox">
      <label className="searchbox-field">
        <Search size={24} strokeWidth={1.8} aria-hidden="true" />
        <input type="search" value={value} onChange={e => onChange(e.target.value)} onBlur={guardar} onKeyDown={e => { if (e.key === "Enter") guardar(); }} placeholder={placeholder} aria-label={label} autoComplete="off" />
        {count && <span className="searchbox-count" aria-live="polite">{count}</span>}
        {value && <button type="button" className="searchbox-clear" aria-label="Borrar búsqueda" onClick={() => onChange("")}><X size={15} strokeWidth={1.8} aria-hidden="true" /></button>}
        <kbd className="searchbox-kbd" aria-hidden="true">⌘K</kbd>
      </label>
      {value.trim()
        ? chips.length > 0 && <div className="searchbox-hints"><span>Buscando:</span>{chips.map(c => <button key={c.termino} type="button" className="search-chip" data-active aria-label={`Quitar ${c.termino}`} onClick={() => onChange(quitarTermino(value, c.termino))}>{c.correccion ? `«${c.termino}» → ${c.correccion}` : c.termino}<X size={12} strokeWidth={2} aria-hidden="true" /></button>)}</div>
        : recientes.length > 0 && <div className="searchbox-hints"><span>Últimas búsquedas:</span>{recientes.map(r => <button key={r} type="button" className="search-chip" onClick={() => onChange(r)}><RotateCcw size={12} strokeWidth={1.8} aria-hidden="true" />{r}</button>)}</div>}
    </div>
  );
}
