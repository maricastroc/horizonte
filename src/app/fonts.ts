import { Archivo, Bodoni_Moda, Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";

export const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo-src",
  display: "block",
});

export const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-bodoni-src",
  display: "block",
});

export const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-playfair-src",
  display: "block",
});

export const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter-src",
  display: "block",
});

export const mono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-mono-src",
  display: "block",
});

export const FONT_FAMILY = {
  archivo: `${archivo.style.fontFamily}, ${inter.style.fontFamily}`,
  bodoni: `${bodoni.style.fontFamily}, ${playfair.style.fontFamily}`,
  mono: mono.style.fontFamily,
} as const;
