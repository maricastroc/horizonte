"use client";

import { useEffect, useState } from "react";
import { FONT_FAMILY } from "@/app/fonts";
import type { AlbumView } from "./AnatomyRail";
import { useCopy, useDocumentLocale } from "./i18n";
import Instruments, { isInstrumentsTarget } from "./Instruments";
import { useField } from "./useField";
import WorldOverlay from "./WorldOverlay";

export default function Horizonte({ classic = false }: { classic?: boolean }) {
  const { canvasRef, engine, world } = useField(FONT_FAMILY, isInstrumentsTarget, classic);
  const [view, setView] = useState<AlbumView>("tracks");
  useDocumentLocale();
  const t = useCopy();

  useEffect(() => engine?.setLabels(t.canvas), [engine, t]);

  return (
    <main className="world-main fixed inset-0 cursor-none select-none overflow-hidden bg-void text-ink-text">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      {engine && world && <WorldOverlay engine={engine} world={world} inquiry={view === "shape"} />}
      <Instruments engine={engine} world={!classic} onAlbumView={setView} />
    </main>
  );
}
