import type { ReactElement } from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Colores de la marca en el icono: azul de Plano de fondo, texto blanco y el cuadrado naranja de «PLANO■». */
export const brandIconColors = {
  bg: "#2c5a85",
  ink: "#ffffff",
  orange: "#e25a12"
} as const;

/**
 * Marca para favicon y PWA: «PLA» y debajo «NO■» sobre azul, en Archivo 800 como la marca en interfaz.
 * JSX compatible con `ImageResponse` de `next/og` (sin CSS externo ni ::after); la fuente se pasa en `brandIconFonts()`.
 */
export function BrandIconMark({ size }: { size: number }): ReactElement {
  const fontSize = Math.round(size * 0.4);
  const dot = Math.max(3, Math.round(size * 0.1));
  const letterSpacing = -fontSize * 0.07;
  const row = { display: "flex", alignItems: "flex-end", fontSize, fontWeight: 800, lineHeight: 0.84, letterSpacing, fontFamily: "Archivo", color: brandIconColors.ink } as const;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: Math.round(size * 0.035), background: brandIconColors.bg }}>
      <div style={row}>PLA</div>
      <div style={row}>
        NO
        <div style={{ width: dot, height: dot, background: brandIconColors.orange, marginLeft: Math.max(1, Math.round(size * 0.03)), marginBottom: Math.round(fontSize * 0.04) }} />
      </div>
    </div>
  );
}

/** Archivo 800 (latín) para que el icono se pinte con la tipografía de la marca; licencia OFL en `fonts/LICENSE-archivo.txt`. */
export async function brandIconFonts() {
  const data = await readFile(join(process.cwd(), "src/lib/fonts/archivo-latin-800-normal.woff"));
  return [{ name: "Archivo", data, weight: 800 as const, style: "normal" as const }];
}
