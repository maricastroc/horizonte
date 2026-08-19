import type { FieldState, Mode } from "./types";

export function initialState(): FieldState {
  return {
    scale: "campo",
    zoom: 0,
    zoomT: 0,
    nav: 0,
    navT: 0,
    alb: 0,
    playAlb: -1,
    trk: 0,
    sel: 0,
    hover: -1,
    hoverBody: -1,
    mode: "parado",
    play: 0,
    pos: 0,
    dur: 0,
    spin: 0.06,
    blur: 0,
    fade: 0,
    jet: 0,
    m0k: 0.088,
    m0h: 0.112,
    m1k: 0.02,
    m1h: 0.05,
    m1x: 0.6,
    m1y: 0.1,
    mix: 0,
    fuseB: 0,
    fuseAlb: 0,
    fuseLoaded: false,
    waveR: -1,
    waveA: 0,
    energy: 0.3,
    curK: 0,
    t: 0,
    seqT: 0,
    ringRot: 0,
    fadeSel: 0,
    treb: 0,
  };
}

export const progressOf = (s: Pick<FieldState, "pos" | "dur">) =>
  s.dur ? Math.min(1, s.pos / s.dur) : 0;

export const isEngaged = (mode: Mode) => mode === "toca" || mode === "pausa";
