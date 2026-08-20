import { boundsOf, type AlbumSignature } from "../content/signature";
import { baseRadius, bodyGeomAt, layoutFor, sectorAt } from "../composition/layout";
import { clamp } from "../math";
import { morphologyOf, shellsAt, type AlbumMorphology } from "../morphology";
import { MORPH, RING } from "../tokens";
import type { Variant } from "../types";

export const STAGE = {
  W: 1440,
  H: 900,
  gw: 288,
  gh: 180,
  sub: 2,
} as const;

const TAU = 6.283185307179586;

const INK = {
  crown: 0.82,
  satelliteRim: 0.62,
  dark: -0.45,
} as const;

export interface SilhouetteOptions {
  variant?: Variant;
  W?: number;
  H?: number;
  gw?: number;
  gh?: number;
  morph?: AlbumMorphology;
}

export interface Silhouette {
  data: Float32Array;
  gw: number;
  gh: number;
}

export function silhouetteOf(
  sig: AlbumSignature,
  trackCount: number,
  opts: SilhouetteOptions = {},
): Silhouette {
  const W = opts.W ?? STAGE.W;
  const H = opts.H ?? STAGE.H;
  const gw = opts.gw ?? STAGE.gw;
  const gh = opts.gh ?? STAGE.gh;
  const L = layoutFor(opts.variant ?? "desktop");

  const m = opts.morph ?? morphologyOf(sig, trackCount);
  const bounds = boundsOf(sig, trackCount);
  const base = baseRadius(W, H, 1, 0, L);
  const g = bodyGeomAt(W, H, L.anchorAlbum.x, L.anchorAlbum.y, base, m);

  const sats = m.satellites
    .filter((s) => s.weight > 0.02)
    .map((s) => ({
      x: g.cx + Math.cos(s.angle) * s.dist * g.R,
      y: g.cy + Math.sin(s.angle) * s.dist * g.R * g.flatten,
      r: s.size * g.R * (0.4 + 0.6 * s.weight),
      w: s.weight,
    }));

  const data = new Float32Array(gw * gh);
  const sub = STAGE.sub;
  const inv = 1 / (sub * sub);

  for (let py = 0; py < gh; py++) {
    for (let px = 0; px < gw; px++) {
      let acc = 0;
      for (let sy = 0; sy < sub; sy++) {
        for (let sx = 0; sx < sub; sx++) {
          const x = ((px + (sx + 0.5) / sub) / gw) * W;
          const y = ((py + (sy + 0.5) / sub) / gh) * H;
          acc += inkAt(x, y);
        }
      }
      data[py * gw + px] = acc * inv;
    }
  }

  return { data, gw, gh };

  function inkAt(x: number, y: number): number {
    const dx = x - g.cx;
    const dy = (y - g.cy) / g.flatten;
    const rr = Math.hypot(dx, dy) / g.R;

    let ink = 0;

    if (rr > m.rMin * 0.9 && rr < m.rMax * 1.1) {
      let a = Math.atan2(dy, dx) - RING.anchor;
      a = ((a % TAU) + TAU) % TAU;
      const t = a / TAU;
      const k = sectorAt(bounds, t);
      const b0 = bounds[k];
      const b1 = bounds[k + 1];
      const span = b1 - b0;
      const gap = Math.min(m.fragment, span * 0.42) / 2;
      if (t > b0 + gap && t < b1 - gap) {
        for (const sh of shellsAt(m, t)) {
          if (rr >= sh.inner && rr <= sh.outer) {
            ink = INK.crown;
            break;
          }
        }
      }
    }

    if (rr < m.coreRatio) return INK.dark;

    for (const s of sats) {
      const dxs = x - s.x;
      const dys = (y - s.y) / g.flatten;
      const d = Math.hypot(dxs, dys);
      if (d < s.r) return INK.dark;
      if (d < s.r * (1 + MORPH.satRim)) {
        const a = Math.atan2(dys, dxs);
        if (a > MORPH.satArcSpan[0] - Math.PI && a < MORPH.satArcSpan[1] - Math.PI) {
          ink = Math.max(ink, INK.satelliteRim * s.w);
        }
      }
    }

    return ink;
  }
}

export function blur(src: Float32Array, gw: number, gh: number, sigma: number): Float32Array {
  if (sigma <= 0) return src;
  const k = Math.max(1, Math.ceil(sigma * 3));
  const w: number[] = [];
  let sum = 0;
  for (let i = -k; i <= k; i++) {
    const v = Math.exp((-i * i) / (2 * sigma * sigma));
    w.push(v);
    sum += v;
  }
  for (let i = 0; i < w.length; i++) w[i] /= sum;

  const tmp = new Float32Array(gw * gh);
  const out = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      let a = 0;
      for (let i = -k; i <= k; i++) a += src[y * gw + clamp(x + i, 0, gw - 1)] * w[i + k];
      tmp[y * gw + x] = a;
    }
  }
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      let a = 0;
      for (let i = -k; i <= k; i++) a += tmp[clamp(y + i, 0, gh - 1) * gw + x] * w[i + k];
      out[y * gw + x] = a;
    }
  }
  return out;
}

export function ncc(a: Float32Array, b: Float32Array): number {
  const n = a.length;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    const u = a[i] - ma;
    const v = b[i] - mb;
    sab += u * v;
    saa += u * u;
    sbb += v * v;
  }
  const den = Math.sqrt(saa * sbb);
  return den < 1e-9 ? 1 : sab / den;
}
