"use client";

import { useEffect, useRef, useState } from "react";
import { FieldEngine } from "./engine/FieldEngine";
import type { FontFamilies } from "./types";
import { World } from "./world/World";

export function useField(fonts: FontFamilies, isUiTarget: (e: Event) => boolean, classic = false) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [engine, setEngine] = useState<FieldEngine | null>(null);
  const [world, setWorld] = useState<World | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let made: World | null = null;
    const inst = classic
      ? new FieldEngine(canvas, fonts, { isUiTarget })
      : new FieldEngine(canvas, fonts, { isUiTarget }, (cv) => {
          made = new World(cv, fonts.archivo);
          return made;
        });
    inst.start();
    setEngine(inst);
    setWorld(made);
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as { __horizonte?: FieldEngine; __world?: World | null };
      w.__horizonte = inst;
      w.__world = made;
    }
    return () => {
      inst.stop();
      setEngine(null);
      setWorld(null);
    };
  }, [fonts, isUiTarget, classic]);

  return { canvasRef, engine, world };
}
