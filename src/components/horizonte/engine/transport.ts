import { clamp } from "../math";
import { isEngaged } from "../state";
import type { FieldState, Scale } from "../types";

export type AudioEffect =
  | { kind: "load"; alb: number; trk: number }
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "seek"; seconds: number };

export interface Catalog {
  size: number;
  trackCount(alb: number): number;
  trackDuration(alb: number, trk: number): number;
  hasTrack(alb: number, trk: number): boolean;
}

export function enterAlbum(s: FieldState, cat: Catalog, i: number): AudioEffect[] {
  s.alb = clamp(Math.round(i), 0, cat.size - 1);
  s.navT = s.alb;
  s.scale = "album";
  s.zoomT = 1;
  s.sel = s.playAlb === s.alb ? s.trk : 0;
  return [];
}

export function playTrack(s: FieldState, cat: Catalog, alb: number, trk: number): AudioEffect[] {
  if (s.scale === "faixa" && s.playAlb === alb && s.trk === trk) return transport(s, cat);
  if (s.playAlb >= 0 && isEngaged(s.mode) && s.scale === "faixa") return fuseTo(s, alb, trk);

  s.playAlb = alb;
  s.alb = alb;
  s.trk = trk;
  s.sel = trk;
  s.dur = cat.trackDuration(alb, trk);
  s.pos = 0;
  s.scale = "faixa";
  s.zoomT = 1;
  s.mode = "colapso";
  s.seqT = 0;
  return [{ kind: "load", alb, trk }];
}

export function fuseTo(s: FieldState, alb: number, trk: number): AudioEffect[] {
  if (s.mode === "fusao") return [];
  s.fuseB = trk;
  s.fuseAlb = alb;
  s.mode = "fusao";
  s.seqT = 0;
  s.mix = 0;
  s.fuseLoaded = false;
  s.m1x = Math.cos(-0.7) * 1.5;
  s.m1y = Math.sin(-0.7) * 1.5;
  s.m1k = 0.03;
  s.m1h = 0.055;
  return [];
}

export function commitFusion(s: FieldState, cat: Catalog): AudioEffect[] {
  if (s.fuseLoaded) return [];
  s.fuseLoaded = true;
  if (!cat.hasTrack(s.fuseAlb, s.fuseB)) return [];
  return [{ kind: "load", alb: s.fuseAlb, trk: s.fuseB }];
}

export function endFusion(s: FieldState, cat: Catalog, loadedDuration: number): AudioEffect[] {
  s.playAlb = s.fuseAlb;
  s.trk = s.fuseB;
  s.sel = s.fuseB;
  s.alb = s.fuseAlb;
  s.dur = loadedDuration || cat.trackDuration(s.alb, s.trk);
  s.pos = 0;
  s.mix = 0;
  s.m1k = 0;
  s.m1h = 0;
  s.waveR = -1;
  s.mode = "toca";
  if (s.scale !== "album") {
    s.scale = "faixa";
    s.zoomT = 1;
  }
  return [];
}

export function transport(s: FieldState, cat: Catalog): AudioEffect[] {
  if (s.mode === "fusao") return [];
  if (s.playAlb < 0 || s.scale !== "faixa") return playTrack(s, cat, s.alb, s.sel);
  if (s.mode === "toca" || s.mode === "colapso") {
    s.mode = "pausa";
    return [{ kind: "pause" }];
  }
  s.mode = "toca";
  return [{ kind: "play" }];
}

export function back(s: FieldState): AudioEffect[] {
  if (s.scale === "faixa") {
    s.scale = "album";
    s.zoomT = 1;
  } else if (s.scale === "album") {
    s.scale = "campo";
    s.zoomT = 0;
    s.hover = -1;
  }
  return [];
}

export function goScale(s: FieldState, cat: Catalog, level: Scale): AudioEffect[] {
  if (level === "campo") {
    s.scale = "campo";
    s.zoomT = 0;
    s.hover = -1;
    return [];
  }
  if (level === "album") {
    if (s.scale === "campo") return enterAlbum(s, cat, Math.round(s.nav));
    s.scale = "album";
    s.zoomT = 1;
    return [];
  }
  if (s.playAlb >= 0) {
    s.alb = s.playAlb;
    s.scale = "faixa";
    s.zoomT = 1;
    return [];
  }
  return playTrack(s, cat, s.alb, s.sel);
}

export function primary(s: FieldState, cat: Catalog): AudioEffect[] {
  if (s.scale === "campo") return enterAlbum(s, cat, Math.round(s.nav));
  if (s.scale === "album") return playTrack(s, cat, s.alb, s.sel);
  return transport(s, cat);
}

export function stepSel(s: FieldState, cat: Catalog, dir: number): AudioEffect[] {
  if (s.scale === "campo") return [];
  const n = cat.trackCount(s.alb);
  s.sel = (s.sel + dir + n) % n;
  if (s.scale === "faixa" && isEngaged(s.mode)) return fuseTo(s, s.alb, s.sel);
  return [];
}

export function skip(s: FieldState, cat: Catalog, dir: number): AudioEffect[] {
  if (s.scale === "campo" && s.playAlb < 0) {
    s.navT = clamp(Math.round(s.nav) + dir, 0, cat.size - 1);
    return [];
  }
  const alb = s.playAlb >= 0 && s.scale !== "album" ? s.playAlb : s.alb;
  const n = cat.trackCount(alb);
  const from = s.playAlb === alb && s.scale === "faixa" ? s.trk : s.sel;
  const next = (from + dir + n) % n;

  if (s.playAlb === alb && (isEngaged(s.mode) || s.mode === "colapso")) {
    return fuseTo(s, alb, next);
  }
  s.sel = next;
  if (s.scale === "faixa") return playTrack(s, cat, alb, next);
  return [];
}

export function seekFraction(s: FieldState, f: number): AudioEffect[] {
  if (!s.dur) return [];
  return [{ kind: "seek", seconds: clamp(f, 0, 1) * s.dur }];
}

export function trackEnded(s: FieldState, cat: Catalog): AudioEffect[] {
  if (s.playAlb < 0) return [];
  const n = cat.trackCount(s.playAlb);
  return fuseTo(s, s.playAlb, (s.trk + 1) % n);
}
