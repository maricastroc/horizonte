import { Archivo, Bodoni_Moda, JetBrains_Mono } from "next/font/google";

/**
 * As três famílias do handoff, self-hospedadas via next/font.
 * `style.fontFamily` é reaproveitado nos canvases de composição — a tipografia
 * monumental é desenhada no canvas, não em DOM.
 *
 * As variáveis terminam em `-src` porque o `@theme` do Tailwind as reexporta
 * como `--font-archivo` / `--font-bodoni` / `--font-mono` em `:root`.
 */
export const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700"],
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

export const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-src",
  display: "block",
});

export const FONT_FAMILY = {
  archivo: archivo.style.fontFamily,
  bodoni: bodoni.style.fontFamily,
  mono: mono.style.fontFamily,
} as const;
