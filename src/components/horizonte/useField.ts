"use client";

import { useEffect, useRef, useState } from "react";
import { FieldEngine } from "./engine/FieldEngine";
import type { FontFamilies } from "./types";

export function useField(fonts: FontFamilies) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [engine, setEngine] = useState<FieldEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const inst = new FieldEngine(canvas, fonts);
    inst.start();
    setEngine(inst);
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __horizonte?: FieldEngine }).__horizonte = inst;
    }
    return () => {
      inst.stop();
      setEngine(null);
    };
  }, [fonts]);

  return { canvasRef, engine };
}
