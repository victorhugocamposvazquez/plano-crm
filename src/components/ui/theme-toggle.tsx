"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export type Theme = "light" | "dark";
const KEY = "plano.theme";
const labels: Record<Theme, string> = { light: "Tema claro", dark: "Tema oscuro" };

/** Aplica el tema al <html>: con data-theme fuerza Workspace o Grafito. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/** Tema efectivo: el guardado o, si no hay, el que prefiera el sistema. */
export function currentTheme(): Theme {
  try { const saved = localStorage.getItem(KEY); if (saved === "light" || saved === "dark") return saved; } catch {}
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Script en línea para el <head>: lee la preferencia guardada antes de pintar y evita el parpadeo. */
export const themeBootScript = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}`;

export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    setTheme(currentTheme());
    const sync = (e: StorageEvent) => { if (e.key === KEY) setTheme(currentTheme()); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function set(next: Theme) {
    setTheme(next); applyTheme(next);
    try { localStorage.setItem(KEY, next); } catch {}
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: next }));
  }
  return [theme, set];
}

/** Interruptor directo claro ↔ oscuro. Vive en el armazón, en el acceso y en el panel de cuenta. */
export function ThemeToggle({ className = "", withLabel = false }: { className?: string; withLabel?: boolean }) {
  const [theme, setTheme] = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Moon : Sun;
  return (
    <button type="button" className={`theme-toggle ${withLabel ? "theme-toggle-label" : ""} ${className}`.trim()} onClick={() => setTheme(next)} aria-label={`${labels[theme]} · cambiar a ${labels[next].toLowerCase()}`} title={`Cambiar a ${labels[next].toLowerCase()}`} aria-pressed={theme === "dark"}>
      <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
      {withLabel && <span>{labels[theme]}</span>}
    </button>
  );
}
