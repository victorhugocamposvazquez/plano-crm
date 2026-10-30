/** Preferencias compartidas por el servidor y los controles del navegador. */
export const THEME_STORAGE_KEY = "plano.theme";
export const TEXT_STORAGE_KEY = "plano.text";

/** Texto literal del script previo al pintado; no importarlo desde un módulo «use client». */
export const appearanceBootScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){};try{if(localStorage.getItem("${TEXT_STORAGE_KEY}")==="large")document.documentElement.dataset.text="large";}catch(e){}`;
