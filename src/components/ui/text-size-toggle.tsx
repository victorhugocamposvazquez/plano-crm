"use client";
import { useEffect, useState } from "react";
import { ALargeSmall } from "lucide-react";
import { TEXT_STORAGE_KEY as KEY } from "@/lib/appearance";

type Size = "normal" | "large";

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
