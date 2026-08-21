import type { AlbumSignature } from "../content/signature";
import type { AlbumMorphology } from "../morphology";
import type { Variant } from "../types";
import { STAGE, blur, ncc, silhouetteOf, type SilhouetteOptions } from "./silhouette";

export const GLANCE_PX = 24;

export const DISTANT = 0.28;

export const GUARDRAIL = {
  mean: 0.72,
  worst: 0.95,
  worstDistant: 0.9,
  invariant: 0.1,
  tracking: 0.25,
} as const;

export const glanceSigma = (
  gw: number = STAGE.gw,
  W: number = STAGE.W,
  worldScale = 1,
) => (GLANCE_PX * gw * worldScale) / W;

export const glanceOf = (ppx: number, worldScale = 1) => GLANCE_PX * ppx * worldScale;

export interface Subject {
  label: string;
  signature: AlbumSignature;
  trackCount: number;
}

export interface PairScore {
  a: string;
  b: string;
  score: number;
  musical: number;
}

const AXES = ["loudness", "dynamics", "brightness", "duration", "pulse"] as const;

export function musicalDistance(a: AlbumSignature, b: AlbumSignature): number {
  let sum = 0;
  for (const k of AXES) sum += (a[k] - b[k]) ** 2;
  return Math.sqrt(sum / AXES.length);
}

export interface PerceptionReport {
  mean: number;
  worst: PairScore;
  best: PairScore;
  pairs: PairScore[];
  sigma: number;
  variant: Variant;
  invariant: number;
  tracking: number;
}

export function measure(
  subjects: Subject[],
  opts: SilhouetteOptions & { sigma?: number; morphOf?: (s: Subject) => AlbumMorphology } = {},
): PerceptionReport {
  const variant = opts.variant ?? "desktop";
  const shots = subjects.map((s) =>
    silhouetteOf(s.signature, s.trackCount, { ...opts, morph: opts.morphOf?.(s) ?? opts.morph }),
  );
  const gw = shots[0]?.gw ?? STAGE.gw;
  const gh = shots[0]?.gh ?? STAGE.gh;
  const ppx = shots[0]?.ppx ?? STAGE.gw / STAGE.W;
  const sigma = opts.sigma ?? glanceOf(ppx);
  const soft = shots.map((s) => blur(s.data, gw, gh, sigma));

  const pairs: PairScore[] = [];
  for (let i = 0; i < subjects.length; i++) {
    for (let j = i + 1; j < subjects.length; j++) {
      pairs.push({
        a: subjects[i].label,
        b: subjects[j].label,
        score: ncc(soft[i], soft[j]),
        musical: musicalDistance(subjects[i].signature, subjects[j].signature),
      });
    }
  }

  const invariant = invariantFraction(shots.map((s) => s.data));

  if (!pairs.length) {
    const empty: PairScore = { a: "", b: "", score: 0, musical: 0 };
    return {
      mean: 0,
      worst: empty,
      best: empty,
      pairs,
      sigma,
      variant,
      invariant,
      tracking: 0,
    };
  }

  let mean = 0;
  let worst = pairs[0];
  let best = pairs[0];
  for (const p of pairs) {
    mean += p.score;
    if (p.score > worst.score) worst = p;
    if (p.score < best.score) best = p;
  }

  return {
    mean: mean / pairs.length,
    worst,
    best,
    pairs,
    sigma,
    variant,
    invariant,
    tracking: correlation(
      pairs.map((p) => p.musical),
      pairs.map((p) => 1 - p.score),
    ),
  };
}

function correlation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const u = xs[i] - mx;
    const v = ys[i] - my;
    sxy += u * v;
    sxx += u * u;
    syy += v * v;
  }
  const den = Math.sqrt(sxx * syy);
  return den < 1e-9 ? 0 : sxy / den;
}

export function worstDistant(r: PerceptionReport): PairScore | null {
  let worst: PairScore | null = null;
  for (const p of r.pairs) {
    if (p.musical < DISTANT) continue;
    if (!worst || p.score > worst.score) worst = p;
  }
  return worst;
}

export function inkFraction(data: Float32Array): number {
  let on = 0;
  for (const v of data) if (v > 0.2) on++;
  return on / data.length;
}

export function invariantFraction(shots: Float32Array[]): number {
  if (!shots.length) return 1;
  let all = 0;
  let any = 0;
  for (let i = 0; i < shots[0].length; i++) {
    let every = true;
    let some = false;
    for (const s of shots) {
      const on = s[i] > 0.2;
      if (on) some = true;
      else every = false;
    }
    if (every) all++;
    if (some) any++;
  }
  return any === 0 ? 1 : all / any;
}
