import { BREAKPOINT, GEO, RING_UNIT } from "../tokens";
import type { FieldState, Variant } from "../types";

export const variantFor = (w: number): Variant =>
  w < BREAKPOINT.mobile ? "mobile" : w < BREAKPOINT.tablet ? "tablet" : "desktop";

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
  fitCollection: 0.9,
  fitAlbum: 0.52,
  ringLabels: "todos",
};

const TABLET: WorldLayout = {
  ...DESKTOP,
  variant: "tablet",
  anchorCollection: { x: 0.56, y: 0.4 },
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
  fitCollection: 0,
  fitAlbum: 0,
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

export const ringR = (W: number, H: number, s: FieldState, L: WorldLayout) =>
  Math.min(W, H) * (0.42 - s.zoom * 0.115 + s.play * 0.055) * L.ringScale;

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
  const size = W * (0.185 - p * 0.045 - z * 0.088);
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
  flatten: number,
): Hit {
  const mx = mouseX * W;
  const my = mouseY * H;

  if (s.scale === "collection") {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < albumCount; i++) {
      const p = albPos(i, s, L);
      const r = Math.min(W, H) * 0.12 * p.depth + 26;
      const dd = Math.hypot(mx - p.x * W, my - p.y * H);
      if (dd < r && dd < bd) {
        bd = dd;
        best = i;
      }
    }
    return { kind: best >= 0 ? "body" : "empty", i: best };
  }

  const p = albPos(s.alb, s, L);
  const bx = p.x * W;
  const by = p.y * H;
  const R = ringR(W, H, s, L);
  const dx = mx - bx;
  const dy = (my - by) / flatten;
  const rr = Math.hypot(dx, dy);

  if (rr < R * 0.55) return { kind: "body", i: s.alb };
  if (rr > R * 0.62 && rr < R * 1.34) {
    let a = Math.atan2(dy, dx) - s.ringRot;
    a = ((a % 6.2832) + 6.2832) % 6.2832;
    return { kind: "track", i: sectorAt(bounds(s.alb), a / 6.2832) };
  }
  return { kind: "empty", i: -1 };
}
