"use client";
import { useEffect, useState } from "react";
import { ALargeSmall } from "lucide-react";

const KEY = "plano.text";
type Size = "normal" | "large";

/** Letra grande: sube la base de la tipografía un 15 % (los tamaños van en rem). Se guarda por navegador. */
export const textBootScript = `try{if(localStorage.getItem("${KEY}")==="large")document.documentElement.dataset.text="large";}catch(e){}`;

function current(): Size {
  try { return localStorage.getItem(KEY) === "large" ? "large" : "normal"; } catch { return "normal"; }
}

export function TextSizeToggle() {
  const [size, setSize] = useState<Size>("normal");
  useEffect(() => { setSize(current()); }, []);
  function toggle() {
    const next: Size = size === "large" ? "normal" : "large";
    setSize(next);
    if (next === "large") document.documentElement.dataset.text = "large"; else delete document.documentElement.dataset.text;
    try { localStorage.setItem(KEY, next); } catch {}
  }
  return (
    <button type="button" className="theme-toggle theme-toggle-label" onClick={toggle} aria-pressed={size === "large"} title={size === "large" ? "Volver a la letra normal" : "Subir el tamaño de la letra"}>
      <ALargeSmall size={17} strokeWidth={1.6} aria-hidden="true" />
      <span>{size === "large" ? "Letra grande" : "Letra normal"}</span>
    </button>
  );
}
