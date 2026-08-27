import { BAND, BREAKPOINT, GEO, LOCKUP, REACH, RING, RING_UNIT, SHARD } from "../tokens";
import { albumProgressOf } from "../state";
import { clamp, lerp } from "../math";
import { neighborScale, type AlbumMorphology } from "../morphology";
import type { FieldState, Variant } from "../types";
import {
  bandsOf,
  extentOf,
  fitRadius,
  stageBox,
  FULL_BANDS,
  type Bands,
  type StageBox,
} from "./bands";

export const variantFor = (w: number, h = Number.POSITIVE_INFINITY): Variant =>
  w < BREAKPOINT.mobile || h < BREAKPOINT.short
    ? "mobile"
    : w < BREAKPOINT.tablet
      ? "tablet"
      : "desktop";

export type LockupSpec = (typeof LOCKUP)["desktop"] | (typeof LOCKUP)["mobile"];
export type ShardSpec = (typeof SHARD)["desktop"] | (typeof SHARD)["mobile"];

export interface WorldLayout {
  variant: Variant;
  anchorCollection: { x: number; y: number };
  anchorAlbum: { x: number; y: number };
  spreadX: number;
  spreadY: number;
  ringScale: number;
  fitCollection: number;
  fitAlbum: number;
  ringLabels: "all" | "selected" | "none";
  staged: boolean;
  type: LockupSpec;
  shard: ShardSpec;
}

const DESKTOP: WorldLayout = {
  variant: "desktop",
  anchorCollection: GEO.anchorCollection,
  anchorAlbum: GEO.anchorAlbum,
  spreadX: GEO.spreadX,
  spreadY: GEO.spreadY,
  ringScale: 1,
  fitCollection: 0.5,
  fitAlbum: 0.5,
  ringLabels: "all",
  staged: false,
  type: LOCKUP.desktop,
  shard: SHARD.desktop,
};

const TABLET: WorldLayout = {
  ...DESKTOP,
  variant: "tablet",
  anchorCollection: { x: 0.44, y: 0.4 },
  anchorAlbum: { x: 0.5, y: 0.4 },
  ringScale: 0.86,
  fitCollection: 0.92,
  fitAlbum: 0.62,
  ringLabels: "selected",
};

const MOBILE: WorldLayout = {
  variant: "mobile",
  anchorCollection: { x: 0.5, y: 0.34 },
  anchorAlbum: { x: 0.5, y: 0.33 },
  spreadX: 1.02,
  spreadY: 0.03,
  ringScale: 1.15,
  fitCollection: 0.9,
  fitAlbum: 0.9,
  ringLabels: "none",
  staged: true,
  type: LOCKUP.mobile,
  shard: SHARD.mobile,
};

export const layoutFor = (variant: Variant): WorldLayout =>
  variant === "mobile" ? MOBILE : variant === "tablet" ? TABLET : DESKTOP;

export function albPos(i: number, s: FieldState, L: WorldLayout) {
  const d = i - s.nav;
  const depth = 1 / (1 + Math.abs(d) * 0.8);
  const zx = L.anchorCollection.x + (L.anchorAlbum.x - L.anchorCollection.x) * s.zoom;
  const zy = L.anchorCollection.y + (L.anchorAlbum.y - L.anchorCollection.y) * s.zoom;
  const x = zx + d * L.spreadX * (1 - s.zoom * 0.6) - s.tide;
  const y = zy + Math.sin(d * 1.15) * L.spreadY * (1 - s.zoom);
  return { x, y, depth, d };
}

export const baseRadius = (W: number, H: number, zoom: number, play: number, L: WorldLayout) =>
  Math.min(W, H) * (0.385 - zoom * 0.105 + play * 0.055) * L.ringScale;

export const ringR = (W: number, H: number, s: FieldState, L: WorldLayout) =>
  baseRadius(W, H, s.zoom, s.play, L);

export interface BodyGeom {
  cx: number;
  cy: number;
  R: number;
  flatten: number;
}

export function bodyGeomAt(
  W: number,
  H: number,
  anchorX: number,
  anchorY: number,
  base: number,
  m: AlbumMorphology,
  ecc = 1,
): BodyGeom {
  const R = base * m.circuit;
  return {
    cx: anchorX * W + m.eccX * R * ecc,
    cy: anchorY * H + m.eccY * R * m.flatten * ecc,
    R,
    flatten: m.flatten,
  };
}

export const bandsFor = (W: number, H: number, s: FieldState, L: WorldLayout): Bands =>
  L.staged ? bandsOf(W, H, s.zoom) : FULL_BANDS;

export function placeInStage(
  box: StageBox,
  m: AlbumMorphology,
  natural: number,
  freeX: number,
  zoom: number,
): BodyGeom {
  const e = extentOf(m);
  const R = Math.min(natural, fitRadius(box, e, m.flatten));

  const midX = ((e.x0 + e.x1) / 2) * R;
  const midY = ((e.y0 + e.y1) / 2) * m.flatten * R;
  const slackX = Math.max(0, box.halfW - ((e.x1 - e.x0) / 2) * R);
  const slackY = Math.max(0, box.halfH - ((e.y1 - e.y0) / 2) * m.flatten * R);

  const offX = clamp(m.eccX * R * BAND.slack, -slackX, slackX);
  const offY = clamp(m.eccY * R * m.flatten * BAND.slack, -slackY, slackY);

  return {
    cx: lerp(freeX + m.eccX * R, box.cx - midX + offX, clamp(zoom, 0, 1)),
    cy: box.cy - midY + offY,
    R,
    flatten: m.flatten,
  };
}

export function bodyGeom(
  W: number,
  H: number,
  s: FieldState,
  L: WorldLayout,
  m: AlbumMorphology,
): BodyGeom {
  const p = albPos(s.alb, s, L);
  if (!L.staged) return bodyGeomAt(W, H, p.x, p.y, ringR(W, H, s, L), m, s.zoom);
  return placeInStage(
    stageBox(W, H, bandsFor(W, H, s, L)),
    m,
    ringR(W, H, s, L) * m.circuit,
    p.x * W,
    s.zoom,
  );
}

export function sectorAt(bounds: number[], t: number): number {
  const n = bounds.length - 1;
  for (let k = 0; k < n; k++) {
    if (t < bounds[k + 1]) return k;
  }
  return n - 1;
}

export interface Lockup {
  size: number;
  ay: number;
  ty: number;
  tsize: number;
  msize: number;
  my: number;
  margin: number;
  marginTitle: number;
  marginMeta: number;
  widthTitle: number;
  widthMeta: number;
  floor: number;
  metaAlpha: number;
}

const RISE = 0.72;

export function lockup(W: number, H: number, s: FieldState, L: WorldLayout): Lockup {
  const t = L.type;
  const p = s.play;
  const z = s.zoom;
  const nominal = W * (t.size - p * t.play - z * t.zoom);
  const meta = (v: number) => Math.max(v * t.meta, W * t.metaFloor);

  let size = t.sizeCap < 1 ? Math.min(nominal, H * t.sizeCap) : nominal;
  let ay = H * (t.baseline + p * t.baselinePlay);

  if (L.staged) {
    const b = bandsFor(W, H, s, L);
    const room = Math.max(1, (b.identity - b.stage) * H);
    const stack = RISE + t.titleGap + t.metaGap;
    if (size * stack + meta(size) * 0.35 > room) {
      size = Math.min(
        (room - W * t.metaFloor * 0.35) / stack,
        room / (stack + t.meta * 0.35),
      );
    }
    ay = b.stage * H + size * RISE;
  }

  const ty = ay + size * t.titleGap;
  return {
    size,
    ay,
    ty,
    tsize: size * t.title,
    msize: L.staged ? meta(size) : W * t.meta,
    my: ty + size * t.metaGap,
    margin: W * t.margin,
    marginTitle: W * t.marginTitle,
    marginMeta: W * t.marginMeta,
    widthTitle: t.fitTitle ? t.fitTitle * W - 2 * W * t.marginTitle : 0,
    widthMeta: t.fitMeta ? t.fitMeta * W - 2 * W * t.marginMeta : 0,
    floor: t.floor,
    metaAlpha: t.metaAlpha,
  };
}

export const ringBufferScale = (R: number) => R / RING_UNIT;

export function ringRotationTarget(
  bounds: number[],
  trk: number,
  trackProgress: number,
  onAir: boolean,
) {
  return RING.anchor - 6.2832 * (onAir ? albumProgressOf(bounds, trk, trackProgress) : 0);
}

export interface Hit {
  kind: "body" | "track" | "empty";
  i: number;
}

export function hitTest(
  mouseX: number,
  mouseY: number,
  W: number,
  H: number,
  s: FieldState,
  L: WorldLayout,
  bounds: (alb: number) => number[],
  albumCount: number,
  morphOf: (alb: number) => AlbumMorphology,
): Hit {
  const mx = mouseX * W;
  const my = mouseY * H;

  if (s.scale === "collection") {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < albumCount; i++) {
      const p = albPos(i, s, L);
      const r = Math.min(W, H) * 0.12 * p.depth * neighborScale(morphOf(i)) + 26;
      const dd = Math.hypot(mx - p.x * W, my - p.y * H);
      if (dd < r && dd < bd) {
        bd = dd;
        best = i;
      }
    }
    return { kind: best >= 0 ? "body" : "empty", i: best };
  }

  const m = morphOf(s.alb);
  const g = bodyGeom(W, H, s, L, m);
  const dx = mx - g.cx;
  const dy = (my - g.cy) / g.flatten;
  const rr = Math.hypot(dx, dy) / g.R;

  const bodyR = Math.min(m.coreRatio * REACH.core, m.rMin * REACH.inner * 0.98);
  if (rr < bodyR) return { kind: "body", i: s.alb };
  if (rr > m.rMin * REACH.inner && rr < m.rMax * REACH.outer) {
    let a = Math.atan2(dy, dx) - s.ringRot;
    a = ((a % 6.2832) + 6.2832) % 6.2832;
    return { kind: "track", i: sectorAt(bounds(s.alb), a / 6.2832) };
  }
  return { kind: "empty", i: -1 };
}
