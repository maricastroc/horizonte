import type { Metadata, Viewport } from "next";
import { archivo, bodoni, mono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Horizonte",
  description:
    "A música tem massa; massa deforma o espaço. Uma experiência musical espacial.",
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
      lang="pt-BR"
      className={`${archivo.variable} ${bodoni.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
