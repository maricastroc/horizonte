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

export function segueToAlbum(s: FieldState, cat: Catalog, alb: number): AudioEffect[] {
  s.playAlb = alb;
  s.alb = alb;
  s.navT = alb;
  s.trk = 0;
  s.sel = 0;
  s.dur = cat.trackDuration(alb, 0);
  s.pos = 0;
  s.scale = "track";
  s.zoomT = 1;
  s.mode = "playing";
  s.segueT = 0;
  return [{ kind: "load", alb, trk: 0 }];
}

export function enterAlbum(s: FieldState, cat: Catalog, i: number): AudioEffect[] {
  const alb = clamp(Math.round(i), 0, cat.size - 1);
  if (s.mode === "playing" && s.playAlb >= 0 && s.playAlb !== alb) {
    return segueToAlbum(s, cat, alb);
  }
  s.alb = alb;
  s.navT = alb;
  s.scale = "album";
  s.zoomT = 1;
  s.sel = s.playAlb === s.alb ? s.trk : 0;
  return [];
}

export function playTrack(s: FieldState, cat: Catalog, alb: number, trk: number): AudioEffect[] {
  if (s.scale === "track" && s.playAlb === alb && s.trk === trk) return transport(s, cat);
  if (s.playAlb >= 0 && isEngaged(s.mode) && s.scale === "track") return fuseTo(s, alb, trk);

  s.playAlb = alb;
  s.alb = alb;
  s.navT = alb;
  s.trk = trk;
  s.sel = trk;
  s.dur = cat.trackDuration(alb, trk);
  s.pos = 0;
  s.scale = "track";
  s.zoomT = 1;
  s.mode = "collapse";
  s.seqT = 0;
  return [{ kind: "load", alb, trk }];
}

export function fuseTo(s: FieldState, alb: number, trk: number): AudioEffect[] {
  if (s.mode === "fusion") return [];
  s.fuseB = trk;
  s.fuseAlb = alb;
  s.fuseFrom = s.alb;
  s.mode = "fusion";
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
  const held = s.alb === s.fuseFrom;
  s.playAlb = s.fuseAlb;
  s.trk = s.fuseB;
  s.dur = loadedDuration || cat.trackDuration(s.fuseAlb, s.fuseB);
  s.pos = 0;
  s.mix = 0;
  s.m1k = 0;
  s.m1h = 0;
  s.waveR = -1;
  s.mode = "playing";
  if (held) {
    s.alb = s.fuseAlb;
    s.navT = s.alb;
    s.sel = s.fuseB;
    if (s.scale !== "album") {
      s.scale = "track";
      s.zoomT = 1;
    }
  }
  return [];
}

export function transport(s: FieldState, cat: Catalog): AudioEffect[] {
  if (s.mode === "fusion") return [];
  if (s.playAlb < 0 || s.scale !== "track") return playTrack(s, cat, s.alb, s.sel);
  if (s.mode === "playing" || s.mode === "collapse") {
    s.mode = "paused";
    return [{ kind: "pause" }];
  }
  s.mode = "playing";
  return [{ kind: "play" }];
}

export function back(s: FieldState): AudioEffect[] {
  if (s.scale === "track") {
    s.scale = "album";
    s.zoomT = 1;
  } else if (s.scale === "album") {
    s.scale = "collection";
    s.zoomT = 0;
    s.hover = -1;
  }
  return [];
}

export function goScale(s: FieldState, cat: Catalog, level: Scale): AudioEffect[] {
  if (level === "collection") {
    s.scale = "collection";
    s.zoomT = 0;
    s.hover = -1;
    return [];
  }
  if (level === "album") {
    if (s.scale === "collection") return enterAlbum(s, cat, Math.round(s.nav));
    s.scale = "album";
    s.zoomT = 1;
    return [];
  }
  if (s.playAlb >= 0) {
    s.alb = s.playAlb;
    s.scale = "track";
    s.zoomT = 1;
    return [];
  }
  return playTrack(s, cat, s.alb, s.sel);
}

export function primary(s: FieldState, cat: Catalog): AudioEffect[] {
  if (s.scale === "collection") return enterAlbum(s, cat, Math.round(s.nav));
  if (s.scale === "album") return playTrack(s, cat, s.alb, s.sel);
  return transport(s, cat);
}

export function stepSel(s: FieldState, cat: Catalog, dir: number): AudioEffect[] {
  if (s.scale === "collection") return [];
  const n = cat.trackCount(s.alb);
  s.sel = (s.sel + dir + n) % n;
  if (s.scale === "track" && isEngaged(s.mode)) return fuseTo(s, s.alb, s.sel);
  return [];
}

export function skip(s: FieldState, cat: Catalog, dir: number): AudioEffect[] {
  if (s.scale === "collection" && s.playAlb < 0) {
    s.navT = clamp(Math.round(s.nav) + dir, 0, cat.size - 1);
    return [];
  }
  const alb = s.playAlb >= 0 && s.scale !== "album" ? s.playAlb : s.alb;
  const n = cat.trackCount(alb);
  const from = s.playAlb === alb && s.scale === "track" ? s.trk : s.sel;
  const next = (from + dir + n) % n;

  if (s.playAlb === alb && (isEngaged(s.mode) || s.mode === "collapse")) {
    return fuseTo(s, alb, next);
  }
  s.sel = next;
  if (s.scale === "track") return playTrack(s, cat, alb, next);
  return [];
}

export function seekFraction(s: FieldState, f: number): AudioEffect[] {
  if (!s.dur) return [];
  return [{ kind: "seek", seconds: clamp(f, 0, 1) * s.dur }];
}

export function trackEnded(s: FieldState, cat: Catalog): AudioEffect[] {
  if (s.playAlb < 0) return [];
  if (s.mode === "fusion") return [];
  const alb = s.playAlb;
  const next = (s.trk + 1) % cat.trackCount(alb);
  s.trk = next;
  s.dur = cat.trackDuration(alb, next);
  s.pos = 0;
  s.segueT = 0;
  s.mode = "playing";
  if (s.alb === alb) s.sel = next;
  return [{ kind: "load", alb, trk: next }];
}
