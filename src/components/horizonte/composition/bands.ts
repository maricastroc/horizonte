import { clamp, lerp } from "../math";
import { BAND } from "../tokens";
import type { AlbumMorphology } from "../morphology";

export interface Bands {
  top: number;
  stage: number;
  identity: number;
  list: number;
  gutter: number;
  inset: number;
}

export const FULL_BANDS: Bands = {
  top: 0,
  stage: 1,
  identity: 1,
  list: 1,
  gutter: 0,
  inset: 0,
};

export const sameBands = (a: Bands, b: Bands) =>
  a.top === b.top &&
  a.stage === b.stage &&
  a.identity === b.identity &&
  a.list === b.list &&
  a.gutter === b.gutter;

export const tallness = (W: number, H: number) =>
  clamp((H / W - BAND.tallAnchor[0]) / (BAND.tallAnchor[1] - BAND.tallAnchor[0]), 0, 1);

export function bandsOf(W: number, H: number, zoom: number): Bands {
  const tall = tallness(W, H);
  const top = lerp(BAND.top[0], BAND.top[1], tall);
  const player = lerp(BAND.player[0], BAND.player[1], tall);
  const identity = lerp(BAND.identity[0], BAND.identity[1], tall);
  const free = Math.max(0, 1 - top - player);
  const share = lerp(BAND.shareField, BAND.shareAlbum, clamp(zoom, 0, 1));
  const stage = top + free * share;
  return {
    top,
    stage,
    identity: Math.min(stage + identity, 1 - player),
    list: 1 - player,
    gutter: BAND.gutter,
    inset: BAND.inset,
  };
}

export interface Extent {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export function extentOf(m: AlbumMorphology): Extent {
  let x0 = -m.rMax;
  let x1 = m.rMax;
  let y0 = -m.rMax;
  let y1 = m.rMax;
  for (const sat of m.satellites) {
    if (sat.weight <= 0.02) continue;
    const r = sat.size * (0.4 + 0.6 * sat.weight) * (1 + 0.5 * 0.19);
    const cx = Math.cos(sat.angle) * sat.dist;
    const cy = Math.sin(sat.angle) * sat.dist;
    x0 = Math.min(x0, cx - r);
    x1 = Math.max(x1, cx + r);
    y0 = Math.min(y0, cy - r);
    y1 = Math.max(y1, cy + r);
  }
  return { x0, x1, y0, y1 };
}

export interface StageBox {
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
}

export function stageBox(W: number, H: number, b: Bands): StageBox {
  const top = b.top * H;
  const bottom = b.stage * H;
  const left = b.inset * W;
  const right = (1 - b.inset) * W;
  return {
    cx: (left + right) / 2,
    cy: (top + bottom) / 2,
    halfW: Math.max(1, (right - left) / 2),
    halfH: Math.max(1, (bottom - top) / 2),
  };
}

export function fitRadius(box: StageBox, e: Extent, flatten: number): number {
  const spanX = Math.max(1e-4, e.x1 - e.x0);
  const spanY = Math.max(1e-4, (e.y1 - e.y0) * flatten);
  return BAND.fill * Math.min((2 * box.halfW) / spanX, (2 * box.halfH) / spanY);
}
