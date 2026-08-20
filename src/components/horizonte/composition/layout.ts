import { BREAKPOINT, GEO, REACH, RING, RING_UNIT } from "../tokens";
import { albumProgressOf } from "../state";
import { neighborScale, type AlbumMorphology } from "../morphology";
import type { FieldState, Variant } from "../types";

export const variantFor = (w: number, h = Number.POSITIVE_INFINITY): Variant =>
  w < BREAKPOINT.mobile || h < BREAKPOINT.short
    ? "mobile"
    : w < BREAKPOINT.tablet
      ? "tablet"
      : "desktop";

export interface WorldLayout {
  variant: Variant;
  anchorCollection: { x: number; y: number };
  anchorAlbum: { x: number; y: number };
  spreadX: number;
  spreadY: number;
  ringScale: number;
  fitCollection: number;
  fitAlbum: number;
  ringLabels: "todos" | "selecionado";
}

const DESKTOP: WorldLayout = {
  variant: "desktop",
  anchorCollection: GEO.anchorCollection,
  anchorAlbum: GEO.anchorAlbum,
  spreadX: GEO.spreadX,
  spreadY: GEO.spreadY,
  ringScale: 1,
  fitCollection: 0.52,
  fitAlbum: 0.52,
  ringLabels: "todos",
};

const TABLET: WorldLayout = {
  ...DESKTOP,
  variant: "tablet",
  anchorCollection: { x: 0.44, y: 0.4 },
  anchorAlbum: { x: 0.5, y: 0.4 },
  ringScale: 0.86,
  fitCollection: 0.92,
  fitAlbum: 0.62,
  ringLabels: "selecionado",
};

const MOBILE: WorldLayout = {
  variant: "mobile",
  anchorCollection: { x: 0.5, y: 0.34 },
  anchorAlbum: { x: 0.5, y: 0.33 },
  spreadX: 1.02,
  spreadY: 0.03,
  ringScale: 0.7,
  fitCollection: 0.86,
  fitAlbum: 0.86,
  ringLabels: "selecionado",
};

export const layoutFor = (variant: Variant): WorldLayout =>
  variant === "mobile" ? MOBILE : variant === "tablet" ? TABLET : DESKTOP;

export function albPos(i: number, s: FieldState, L: WorldLayout) {
  const d = i - s.nav;
  const depth = 1 / (1 + Math.abs(d) * 0.8);
  const zx = L.anchorCollection.x + (L.anchorAlbum.x - L.anchorCollection.x) * s.zoom;
  const zy = L.anchorCollection.y + (L.anchorAlbum.y - L.anchorCollection.y) * s.zoom;
  const x = zx + d * L.spreadX * (1 - s.zoom * 0.6);
  const y = zy + Math.sin(d * 1.15) * L.spreadY * (1 - s.zoom);
  return { x, y, depth, d };
}

export const baseRadius = (W: number, H: number, zoom: number, play: number, L: WorldLayout) =>
  Math.min(W, H) * (0.42 - zoom * 0.115 + play * 0.055) * L.ringScale;

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

export function bodyGeom(
  W: number,
  H: number,
  s: FieldState,
  L: WorldLayout,
  m: AlbumMorphology,
): BodyGeom {
  const p = albPos(s.alb, s, L);
  return bodyGeomAt(W, H, p.x, p.y, ringR(W, H, s, L), m, s.zoom);
}

export function sectorAt(bounds: number[], t: number): number {
  const n = bounds.length - 1;
  for (let k = 0; k < n; k++) {
    if (t < bounds[k + 1]) return k;
  }
  return n - 1;
}

export function lockup(W: number, H: number, s: FieldState) {
  const p = s.play;
  const z = s.zoom;
  const size = W * (GEO.lockup - p * 0.045 - z * GEO.lockupZoom);
  const ay = H * (0.555 + p * 0.03);
  return {
    size,
    ay,
    ty: ay + size * 0.5,
    tsize: size * 0.53,
    msize: W * 0.011,
    my: ay + size * 0.5 + size * 0.24,
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
