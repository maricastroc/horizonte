import { ALBUMS, type AlbumWithSignature } from "./content";
import { curatedMotionOf } from "./content/motion";
import { boundsOf } from "./content/signature";
import { clamp, lerp } from "./math";
import { routingOf } from "./motion";
import { BREATH } from "./tokens";

export interface Temperament {
  period: number;
  rise: number;
  fall: number;
  depth: number;
  mass: number;
  light: number;
  peak: number;
  rest: number;
}

const cache = new WeakMap<AlbumWithSignature, Temperament | null>();

function anchorOf(album: AlbumWithSignature) {
  const rows = curatedMotionOf(album.id);
  const n = album.tracks.length;
  if (!rows || rows.length !== n) return null;
  const bounds = boundsOf(album.signature, n);
  const keys = ["sharpness", "sustain", "weight", "contrast"] as const;
  const sum = { sharpness: 0, sustain: 0, weight: 0, contrast: 0 };
  let total = 0;
  const beats: { beat: number; w: number }[] = [];
  rows.forEach((r, k) => {
    if (!r) return;
    const w = bounds[k + 1] - bounds[k];
    for (const key of keys) sum[key] += r[key] * w;
    total += w;
    if (r.beat > 0) beats.push({ beat: r.beat, w });
  });
  if (total <= 0) return null;
  for (const key of keys) sum[key] /= total;
  const gridded = beats.reduce((a, b) => a + b.w, 0);
  let beat = 0;
  if (gridded / total >= BREATH.grid) {
    beats.sort((a, b) => a.beat - b.beat);
    let acc = 0;
    for (const b of beats) {
      acc += b.w;
      if (acc >= gridded / 2) {
        beat = b.beat;
        break;
      }
    }
  }
  return { ...sum, beat };
}

function pulse(t: number, rise: number, fall: number) {
  if (t <= 0) return 0;
  return (1 - Math.exp(-t / rise)) * Math.exp(-Math.max(0, t - rise) / fall);
}

function raw(T: Omit<Temperament, "peak" | "rest">, u: number) {
  let v = 0;
  for (let k = 0; k < 4; k++) v += pulse(u + k * T.period, T.rise, T.fall);
  return v;
}

export function periodOf(sustain: number, beat: number): number {
  if (beat > 0) {
    for (const bars of BREATH.bars) if (beat * bars >= BREATH.minPeriod) return beat * bars;
    return beat * BREATH.bars[BREATH.bars.length - 1];
  }
  return lerp(BREATH.period[0], BREATH.period[1], sustain);
}

type Spread = Record<"sharpness" | "sustain" | "contrast", [number, number]>;
let spread: Spread | null = null;

function spreadOf(): Spread {
  if (spread) return spread;
  const out: Spread = { sharpness: [1, 0], sustain: [1, 0], contrast: [1, 0] };
  for (const album of ALBUMS) {
    const a = anchorOf(album);
    if (!a) continue;
    for (const key of ["sharpness", "sustain", "contrast"] as const) {
      out[key][0] = Math.min(out[key][0], a[key]);
      out[key][1] = Math.max(out[key][1], a[key]);
    }
  }
  spread = out;
  return out;
}

function placed(key: keyof Spread, v: number) {
  const [lo, hi] = spreadOf()[key];
  return hi - lo > 1e-6 ? clamp((v - lo) / (hi - lo), 0, 1) : 0.5;
}

export function temperamentOf(album: AlbumWithSignature): Temperament | null {
  if (cache.has(album)) return cache.get(album)!;
  const a = anchorOf(album);
  let out: Temperament | null = null;
  if (a) {
    const sharp = placed("sharpness", a.sharpness);
    const held = placed("sustain", a.sustain);
    const period = periodOf(held, a.beat);
    const route = routingOf(a);
    const base = {
      period,
      rise: period * lerp(BREATH.rise[0], BREATH.rise[1], 1 - sharp),
      fall: period * lerp(BREATH.fall[0], BREATH.fall[1], held),
      depth: lerp(BREATH.depth[0], BREATH.depth[1], placed("contrast", a.contrast)),
      mass: route.mass,
      light: route.light,
    };
    let lo = Number.POSITIVE_INFINITY;
    let hi = 0;
    for (let i = 0; i < BREATH.samples; i++) {
      const v = raw(base, (i / BREATH.samples) * period);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    out = { ...base, peak: hi, rest: lo };
  }
  cache.set(album, out);
  return out;
}

export function breathAt(T: Temperament, t: number, phase = 0): number {
  const P = T.period;
  const u = (((t + phase * P) % P) + P) % P;
  return clamp((raw(T, u) - T.rest) / Math.max(1e-6, T.peak - T.rest), 0, 1) * T.depth;
}
