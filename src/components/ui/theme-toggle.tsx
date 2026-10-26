"use client";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

export type Theme = "system" | "light" | "dark";
const KEY = "plano.theme";
const order: Theme[] = ["system", "light", "dark"];
const labels: Record<Theme, string> = { system: "Tema del sistema", light: "Tema claro", dark: "Tema oscuro" };

/** Aplica el tema al <html>: sin atributo sigue al sistema; con data-theme fuerza Workspace o Grafito. */
export function applyTheme(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme;
}

/** Script en línea para el <head>: lee la preferencia guardada antes de pintar y evita el parpadeo. */
export const themeBootScript = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}`;

/** Botón que recorre sistema → claro → oscuro. Vive en el armazón y en el acceso. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => { try { const saved = localStorage.getItem(KEY) as Theme | null; if (saved && order.includes(saved)) setTheme(saved); } catch {} }, []);

  function next() {
    const value = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(value); applyTheme(value);
    try { if (value === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, value); } catch {}
  }

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <button type="button" className={`theme-toggle ${className}`.trim()} onClick={next} aria-label={`${labels[theme]} · cambiar`} title={labels[theme]}>
      <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
    </button>
  );
}
