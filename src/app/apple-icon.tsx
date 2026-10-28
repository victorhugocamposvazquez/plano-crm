import { ImageResponse } from "next/og";
import { BrandIconMark, brandIconFonts } from "@/lib/brand-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Icono para «Añadir a pantalla de inicio» en iOS. */
export default async function AppleIcon() {
  return new ImageResponse(<BrandIconMark size={size.width} />, { ...size, fonts: await brandIconFonts() });
}
