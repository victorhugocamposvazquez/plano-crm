import type { ReactElement } from "react";

/** Colores de la marca en Workspace (favicon y PWA siempre en claro). */
export const brandIconColors = {
  bg: "#ffffff",
  ink: "#20272d",
  orange: "#e25a12"
} as const;

/**
 * Marca «P■» para favicon y iconos de la PWA.
 * JSX compatible con `ImageResponse` de `next/og` (sin CSS externo ni ::after).
 */
export function BrandIconMark({ size }: { size: number }): ReactElement {
  const fontSize = Math.round(size * 0.62);
  const dot = Math.max(3, Math.round(size * 0.14));
  const gap = Math.max(2, Math.round(size * 0.04));
  const pad = Math.round(size * 0.14);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: pad,
        background: brandIconColors.bg,
        color: brandIconColors.ink
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap }}>
        <span
          style={{
            fontSize,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.06em",
            fontFamily: 'Archivo, "Arial Black", Arial, sans-serif'
          }}
        >
          P
        </span>
        <div
          style={{
            width: dot,
            height: dot,
            background: brandIconColors.orange,
            marginBottom: Math.round(fontSize * 0.06)
          }}
        />
      </div>
    </div>
  );
}
