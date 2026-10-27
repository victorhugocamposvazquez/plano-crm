"use client";
import { useEffect } from "react";

/** Los documentos se ven y se imprimen siempre en claro, sin tocar la preferencia guardada del usuario. */
export function PrintTheme() {
  useEffect(() => {
    const previous = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = "light";
    return () => { if (previous) document.documentElement.dataset.theme = previous; else delete document.documentElement.dataset.theme; };
  }, []);
  return null;
}
