"use client";

import { useEffect } from "react";
import { FONT_FAMILY } from "@/app/fonts";
import { useCopy, useDocumentLocale } from "./i18n";
import Instruments, { isInstrumentsTarget } from "./Instruments";
import { useField } from "./useField";

export default function Horizonte() {
  const { canvasRef, engine } = useField(FONT_FAMILY, isInstrumentsTarget);
  useDocumentLocale();
  const t = useCopy();

  useEffect(() => engine?.setLabels(t.canvas), [engine, t]);

  return (
    <main className="fixed inset-0 cursor-none select-none overflow-hidden bg-void text-ink-text">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <Instruments engine={engine} />
    </main>
  );
}
