import { clamp, lerp } from "../math";
import { WATERMARK } from "../tokens";
import { STRAIN_BINS } from "./strain";

export interface Mark {
  turn: number;
  tier: number;
  depth: number;
  width: number;
}

export interface Watermark {
  album: number;
  track: number;
  peak: number;
  version: number;
  marks: Mark[];
}

export function emptyWatermark(): Watermark {
  return { album: -1, track: -1, peak: -2, version: 0, marks: [] };
}

export function clearWatermark(w: Watermark) {
  if (!w.marks.length && w.album < 0) return;
  w.album = -1;
  w.track = -1;
  w.peak = -2;
  w.marks.length = 0;
  w.version++;
}

const TAU_TURNS = 1;

export function turnGap(a: number, b: number): number {
  const d = Math.abs(a - b) % TAU_TURNS;
  return Math.min(d, TAU_TURNS - d);
}

export function tierOf(charge: number): number {
  const over = (charge - WATERMARK.floor) / (1 - WATERMARK.floor);
  return clamp(Math.ceil(over * WATERMARK.tiers), 1, WATERMARK.tiers);
}

export function depthOf(tier: number): number {
  const t = WATERMARK.tiers > 1 ? (tier - 1) / (WATERMARK.tiers - 1) : 1;
  return lerp(WATERMARK.depth[0], WATERMARK.depth[1], t);
}

export function widthOf(span: number): number {
  return clamp(span * WATERMARK.widthOfSpan, WATERMARK.width[0], WATERMARK.width[1]);
}

export function observe(
  w: Watermark,
  album: number,
  track: number,
  turn: number,
  charge: number,
  span: number,
): boolean {
  if (album < 0) return false;
  if (w.album !== album) {
    w.album = album;
    w.track = -1;
    w.marks.length = 0;
    w.version++;
  }
  if (w.track !== track) {
    w.track = track;
    w.peak = Math.max(charge, WATERMARK.floor - WATERMARK.step);
  }
  if (charge < WATERMARK.floor) return false;
  if (charge < w.peak + WATERMARK.step) return false;

  w.peak = charge;
  const tier = tierOf(charge);
  const depth = depthOf(tier);
  const at = ((turn % TAU_TURNS) + TAU_TURNS) % TAU_TURNS;

  for (const mark of w.marks) {
    if (turnGap(mark.turn, at) >= WATERMARK.merge) continue;
    if (depth <= mark.depth) return false;
    mark.tier = tier;
    mark.depth = depth;
    mark.width = Math.max(mark.width, widthOf(span));
    w.version++;
    return true;
  }

  if (w.marks.length >= WATERMARK.max) return false;
  w.marks.push({ turn: at, tier, depth, width: widthOf(span) });
  w.version++;
  return true;
}

export function watermarkField(w: Watermark, out: Float32Array): Float32Array {
  out.fill(0);
  for (const mark of w.marks) {
    const half = (mark.width / 2) * STRAIN_BINS;
    const at = mark.turn * STRAIN_BINS;
    const from = Math.ceil(at - half);
    const to = Math.floor(at + half);
    for (let i = from; i <= to; i++) {
      const bin = ((i % STRAIN_BINS) + STRAIN_BINS) % STRAIN_BINS;
      const f = half > 0 ? (i - at) / half : 0;
      const rise = mark.depth * Math.pow(Math.cos((f * Math.PI) / 2), 1.6);
      if (rise > out[bin]) out[bin] = rise;
    }
  }
  return out;
}
