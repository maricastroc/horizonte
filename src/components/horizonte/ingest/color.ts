import type { Ink } from "../content/types";

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

const linearToSrgb = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

export function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;
  const cb = (v: number) => (v > 0 ? Math.cbrt(v) : 0);
  const l_ = cb(l);
  const m_ = cb(m);
  const s_ = cb(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

export function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function oklch(r: number, g: number, b: number): [number, number, number] {
  const [L, a, bb] = rgbToOklab(r, g, b);
  return [L, Math.hypot(a, bb), Math.atan2(bb, a)];
}

function maxChroma(hue: number, L: number): number {
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    const rgb = oklabToRgb(L, mid * Math.cos(hue), mid * Math.sin(hue));
    if (rgb.every((v) => v >= -0.001 && v <= 1.001)) lo = mid;
    else hi = mid;
  }
  return lo;
}

const L_LO = 0.5;
const L_HI = 0.62;
const C_LO = 0.13;
const C_HI = 0.18;

const DH = [0, 0.12, -0.12, 0.25, -0.25, 0.4, -0.4, 0.6, -0.6, 0.9, -0.9, 1.3, -1.3, 1.8, -1.8];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const round3 = (v: number) => Math.round(clamp01(v) * 1000) / 1000;

export function forceRange(hue: number, L = 0.56, C = 0.155): Ink {
  const targetC = Math.min(Math.max(C, C_LO), C_HI);
  const L0 = Math.min(Math.max(L, L_LO), L_HI);
  const steps: number[] = [];
  for (let i = 0; i <= 24; i++) steps.push(L_LO + (i * (L_HI - L_LO)) / 24);

  for (const dh of DH) {
    const h = hue + dh;
    let best: [number, number, number] | null = null;
    for (const Lc of steps) {
      const cm = maxChroma(h, Lc);
      if (cm < C_LO) continue;
      const c = Math.min(targetC, cm, C_HI);
      const score = Math.abs(Lc - L0);
      if (!best || score < best[0]) best = [score, Lc, c];
    }
    if (best) {
      const [, Lc, c] = best;
      const rgb = oklabToRgb(Lc, c * Math.cos(h), c * Math.sin(h));
      return [round3(rgb[0]), round3(rgb[1]), round3(rgb[2])];
    }
  }
  const rgb = oklabToRgb(0.56, C_LO * Math.cos(hue), C_LO * Math.sin(hue));
  return [round3(rgb[0]), round3(rgb[1]), round3(rgb[2])];
}

const HUE_WARM = 0.6;
const HUE_COOL = -2.25;

export function inkFromAudio(brightness: number, rolloff: number, bassRatio01: number): [Ink, Ink] {
  const axis = clamp01(0.34 * brightness + 0.22 * rolloff + 0.44 * (1 - bassRatio01));
  const hue = HUE_WARM + (HUE_COOL - HUE_WARM) * axis;
  return [forceRange(hue, 0.56, 0.155), forceRange(hue + 2.35, 0.56, 0.145)];
}

interface Swatch {
  count: number;
  L: number;
  C: number;
  h: number;
  score: number;
}

const CHROMA_GATE = 0.035;

export function inksFromPixels(data: Uint8ClampedArray, fallbackHue: number): [Ink, Ink] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const hit = buckets.get(key);
    if (hit) {
      hit.n++;
      hit.r += r;
      hit.g += g;
      hit.b += b;
    } else {
      buckets.set(key, { n: 1, r, g, b });
    }
  }

  const entries: Swatch[] = [];
  const top = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 24);
  for (const e of top) {
    const [L, C, h] = oklch(e.r / e.n / 255, e.g / e.n / 255, e.b / e.n / 255);
    if (L < 0.18 || L > 0.93) continue;
    entries.push({ count: e.n, L, C, h, score: e.n * (0.06 + C) });
  }

  if (entries.length === 0 || Math.max(...entries.map((e) => e.C)) < CHROMA_GATE) {
    return [forceRange(fallbackHue, 0.56, 0.155), forceRange(fallbackHue + 2.2, 0.56, 0.145)];
  }

  entries.sort((x, y) => y.score - x.score);
  const a = entries[0];
  const gap = (e: Swatch) => {
    const d = Math.abs(e.h - a.h) % (2 * Math.PI);
    return Math.min(d, 2 * Math.PI - d);
  };
  let b = a;
  if (entries.length > 1) {
    b = entries.slice(1).reduce((best, e) => (gap(e) * e.score > gap(best) * best.score ? e : best));
  }
  const bh = gap(b) < 0.6 ? a.h + 2.2 : b.h;
  return [forceRange(a.h, a.L, a.C), forceRange(bh, b.L, b.C)];
}

export function stableHue(seed: string): number {
  let h = 2166136261;
  const bytes = new TextEncoder().encode(seed);
  for (const ch of bytes) h = Math.imul(h ^ ch, 16777619) >>> 0;
  return (h / 0xffffffff) * 2 * Math.PI;
}
