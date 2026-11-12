import type { Metadata, Viewport } from "next";
import { BOOT_SCRIPT } from "@/components/horizonte/i18n/locale";
import { archivo, bodoni, inter, mono, playfair } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Horizonte",
  description:
    "Music has mass; mass bends space. A spatial music experience.",
};

export const viewport: Viewport = {
  themeColor: "#07070A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${bodoni.variable} ${mono.variable} ${playfair.variable} ${inter.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
