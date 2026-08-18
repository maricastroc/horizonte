import { BREAKPOINT, GEO, RING_UNIT } from "../tokens";
import type { FieldState, Variant } from "../types";

export const variantFor = (w: number): Variant =>
  w < BREAKPOINT.mobile ? "mobile" : w < BREAKPOINT.tablet ? "tablet" : "desktop";

export interface WorldLayout {
  variant: Variant;
  anchorCampo: { x: number; y: number };
  anchorAlbum: { x: number; y: number };
  spreadX: number;
  spreadY: number;
  ringScale: number;
  fitCampo: number;
  fitAlbum: number;
  ringLabels: "todos" | "selecionado";
}

const DESKTOP: WorldLayout = {
  variant: "desktop",
  anchorCampo: GEO.anchorCampo,
  anchorAlbum: GEO.anchorAlbum,
  spreadX: GEO.spreadX,
  spreadY: GEO.spreadY,
  ringScale: 1,
  fitCampo: 0.9,
  fitAlbum: 0.52,
  ringLabels: "todos",
};

const TABLET: WorldLayout = {
  ...DESKTOP,
  variant: "tablet",
  anchorCampo: { x: 0.56, y: 0.4 },
  anchorAlbum: { x: 0.5, y: 0.4 },
  ringScale: 0.86,
  fitCampo: 0.92,
  fitAlbum: 0.62,
  ringLabels: "selecionado",
};

const MOBILE: WorldLayout = {
  variant: "mobile",
  anchorCampo: { x: 0.5, y: 0.34 },
  anchorAlbum: { x: 0.5, y: 0.33 },
  spreadX: 1.02,
  spreadY: 0.03,
  ringScale: 0.7,
  fitCampo: 0,
  fitAlbum: 0,
  ringLabels: "selecionado",
};

export const layoutFor = (variant: Variant): WorldLayout =>
  variant === "mobile" ? MOBILE : variant === "tablet" ? TABLET : DESKTOP;

export function albPos(i: number, s: FieldState, L: WorldLayout) {
  const d = i - s.nav;
  const depth = 1 / (1 + Math.abs(d) * 0.8);
  const zx = L.anchorCampo.x + (L.anchorAlbum.x - L.anchorCampo.x) * s.zoom;
  const zy = L.anchorCampo.y + (L.anchorAlbum.y - L.anchorCampo.y) * s.zoom;
  const x = zx + d * L.spreadX * (1 - s.zoom * 0.6);
  const y = zy + Math.sin(d * 1.15) * L.spreadY * (1 - s.zoom);
  return { x, y, depth, d };
}

export const ringR = (W: number, H: number, s: FieldState, L: WorldLayout) =>
  Math.min(W, H) * (0.42 - s.zoom * 0.115 + s.play * 0.055) * L.ringScale;

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
  kind: "corpo" | "faixa" | "vazio";
  i: number;
}

export function hitTest(
  mouseX: number,
  mouseY: number,
  W: number,
  H: number,
  s: FieldState,
  L: WorldLayout,
  trackCount: (alb: number) => number,
  albumCount: number,
): Hit {
  const mx = mouseX * W;
  const my = mouseY * H;

  if (s.scale === "campo") {
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
    return { kind: best >= 0 ? "corpo" : "vazio", i: best };
  }

  const p = albPos(s.alb, s, L);
  const bx = p.x * W;
  const by = p.y * H;
  const R = ringR(W, H, s, L);
  const dx = mx - bx;
  const dy = (my - by) / GEO.flatten;
  const rr = Math.hypot(dx, dy);

  if (rr < R * 0.55) return { kind: "corpo", i: s.alb };
  if (rr > R * 0.62 && rr < R * 1.34) {
    let a = Math.atan2(dy, dx) - s.ringRot;
    a = ((a % 6.2832) + 6.2832) % 6.2832;
    const N = trackCount(s.alb);
    return { kind: "faixa", i: Math.floor((a / 6.2832) * N) % N };
  }
  return { kind: "vazio", i: -1 };
}
