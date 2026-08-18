"use client";

import { FONT_FAMILY } from "@/app/fonts";
import Instruments from "./Instruments";
import { useField } from "./useField";

/**
 * Duas camadas com responsabilidades separadas:
 *   mundo        — deformável, desenhado em canvas, atravessado pelo shader
 *   instrumentos — DOM, mono, nunca deformado, sempre clicável
 *
 * O mundo tem `cursor: none` porque o cursor É a massa; a camada de
 * instrumentos restaura o cursor.
 */
export default function Horizonte() {
  const { canvasRef, engine } = useField(FONT_FAMILY);

  return (
    <main className="fixed inset-0 cursor-none select-none overflow-hidden bg-void text-ink-text">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <Instruments engine={engine} />
    </main>
  );
}
