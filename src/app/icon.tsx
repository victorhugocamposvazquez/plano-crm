import { ImageResponse } from "next/og";
import { BrandIconMark, brandIconFonts } from "@/lib/brand-icon";

export function generateImageMetadata() {
  return [
    { contentType: "image/png", size: { width: 32, height: 32 }, id: "32" },
    { contentType: "image/png", size: { width: 192, height: 192 }, id: "192" },
    { contentType: "image/png", size: { width: 512, height: 512 }, id: "512" }
  ];
}

/** Favicon y iconos PWA: «PLA / NO■» sobre azul. */
export default async function Icon({ id }: { id: Promise<string> }) {
  const key = await id;
  const size = key === "512" ? 512 : key === "192" ? 192 : 32;
  return new ImageResponse(<BrandIconMark size={size} />, { width: size, height: size, fonts: await brandIconFonts() });
}
