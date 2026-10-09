import { ALBUMS } from "./content";
import { BINARY_WEIGHT } from "./content/binary.generated";
import { clamp } from "./math";
import { climaxAt, isSilent, sectionAt, type Score } from "./score";
import type { Satellite } from "./morphology";
import { BINARY } from "./tokens";

export interface BinaryPlan {
  weight: number;
  first: number;
  second: number;
  arrival: number;
  tilt: number;
}

export interface BinaryShape {
  split: number;
  lead: number;
}

export const SINGLE: BinaryShape = { split: 0, lead: 0.5 };

export function binaryWeightOf(albumIndex: number, track: number): number {
  const album = ALBUMS[albumIndex];
  return album ? (BINARY_WEIGHT[album.id]?.[track] ?? 0) : 0;
}

const arcGap = (a: number, b: number) =>
  Math.abs(((((a - b + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);

export function axisOf(jitter: number, satellites: Satellite[]): number {
  const [a0, a1] = BINARY.axis;
  let best = (a0 + a1) / 2;
  let score = Number.NEGATIVE_INFINITY;
  for (let a = a0; a <= a1 + 1e-9; a += 0.02) {
    let clear: number = BINARY.clearance;
    for (const s of satellites) {
      if (s.weight > 0.02) clear = Math.min(clear, arcGap(a, s.angle));
    }
    const v = clear - BINARY.leftward * Math.cos(a);
    if (v > score) {
      score = v;
      best = a;
    }
  }
  return best + (jitter - 0.5) * BINARY.jitter;
}

export function binaryPlanOf(score: Score, satellites: Satellite[] = []): BinaryPlan | null {
  const weight = binaryWeightOf(score.album, score.track);
  if (!score.curated || weight < BINARY.floor || score.materials.length < 2) return null;
  const pair = [...score.materials].sort((a, b) => b.share - a.share).slice(0, 2);
  pair.sort((a, b) => a.first - b.first);
  const u = (score.track * 0.618034 + score.album * 0.381966) % 1;
  return {
    weight,
    first: pair[0].cluster,
    second: pair[1].cluster,
    arrival: pair[1].first,
    tilt: axisOf(u, satellites),
  };
}

export function binaryAt(score: Score, plan: BinaryPlan, t: number): BinaryShape {
  if (t < plan.arrival) return SINGLE;
  const k = sectionAt(score, t);
  let switches = 0;
  let prev = -1;
  for (let j = 0; j <= k; j++) {
    const s = score.sections[j];
    if (isSilent(s) || (s.cluster !== plan.first && s.cluster !== plan.second)) continue;
    if (prev >= 0 && s.cluster !== prev) switches++;
    prev = s.cluster;
  }
  const formed = Math.min(1, BINARY.arrival + BINARY.alternation * Math.max(0, switches - 1));
  const split = clamp(
    plan.weight * formed * (1 + BINARY.climax * climaxAt(score, t)),
    0,
    BINARY.maxSplit,
  );
  const sec = score.sections[k];
  const sounding = isSilent(sec) ? -1 : sec.cluster;
  const lead =
    sounding === plan.first ? BINARY.lead : sounding === plan.second ? 1 - BINARY.lead : 0.5;
  return { split, lead };
}

export interface CurvePoint {
  x: number;
  y: number;
  nx: number;
  ny: number;
  k: number;
}

export interface BinaryGeometry {
  shape: BinaryShape;
  r0: number;
  masses: [number, number];
  radii: [number, number];
  first: [number, number];
  second: [number, number];
  length: number;
  table: Float64Array;
  lengths: Float64Array;
  loop: number;
  share: number;
}

const SAMPLES = 1440;
const STRIDE = 5;

export function massesOf(shape: BinaryShape): [number, number] {
  const beta = Math.pow(Math.max(0, shape.split * 2 * (1 - shape.lead)), BINARY.emergence);
  const second = beta / (1 + beta);
  return [1 - second, second];
}

const ease = (u: number) => u * u * (3 - 2 * u);

export function binaryGeometry(shape: BinaryShape, r0: number): BinaryGeometry {
  const [qa, qb] = massesOf(shape);
  const ra = r0 * Math.sqrt(qa);
  const rb = r0 * Math.sqrt(qb);
  const d = ra + rb * (1 + BINARY.gap);
  const ca = -qb * d;
  const cb = qa * d;
  const phi = Math.acos(Math.min(1, (ra + rb) / Math.max(d, 1e-9)));
  const ka = Math.pow(ra / r0, BINARY.band);
  const kb = Math.pow(Math.max(rb, 1e-6) / r0, BINARY.band);
  const pa = (th: number): [number, number] => [ca + ra * Math.cos(th), ra * Math.sin(th)];
  const pb = (th: number): [number, number] => [cb + rb * Math.cos(th), rb * Math.sin(th)];
  const a1 = pa(phi);
  const b1 = pb(Math.PI + phi);
  const b2 = pb(Math.PI - phi);
  const a2 = pa(-phi);
  const seg = Math.hypot(b1[0] - a1[0], b1[1] - a1[1]);
  const arcB = rb * (2 * Math.PI - 2 * phi);
  const arcA = ra * (2 * Math.PI - 2 * phi);
  const total = arcA + arcB + 2 * seg;
  const cross = ra / Math.max(ra + rb, 1e-9);

  const pts = new Float64Array(SAMPLES * 3);
  for (let i = 0; i < SAMPLES; i++) {
    let l = (i / SAMPLES) * total;
    let x: number;
    let y: number;
    let k: number;
    if (l < seg) {
      const u = seg > 0 ? l / seg : 0;
      x = a1[0] + (b1[0] - a1[0]) * u;
      y = a1[1] + (b1[1] - a1[1]) * u;
      k =
        u < cross ? ka * ease(1 - u / cross) : -kb * ease((u - cross) / Math.max(1e-9, 1 - cross));
    } else if ((l -= seg) < arcB) {
      const th = Math.PI + phi + (rb > 0 ? l / rb : 0);
      [x, y] = pb(th);
      k = -kb;
    } else if ((l -= arcB) < seg) {
      const u = seg > 0 ? l / seg : 0;
      x = b2[0] + (a2[0] - b2[0]) * u;
      y = b2[1] + (a2[1] - b2[1]) * u;
      const back = 1 - cross;
      k = u < back ? -kb * ease(1 - u / back) : ka * ease((u - back) / Math.max(1e-9, 1 - back));
    } else {
      l -= seg;
      const th = -phi - (ra > 0 ? l / ra : 0);
      [x, y] = pa(th);
      k = ka;
    }
    pts[i * 3] = x;
    pts[i * 3 + 1] = -y;
    pts[i * 3 + 2] = k;
  }

  const table = new Float64Array(SAMPLES * STRIDE);
  const lengths = new Float64Array(SAMPLES + 1);
  let acc = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const p = ((i + SAMPLES - 1) % SAMPLES) * 3;
    const n = ((i + 1) % SAMPLES) * 3;
    let tx = pts[n] - pts[p];
    let ty = pts[n + 1] - pts[p + 1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const k = pts[i * 3 + 2];
    const side = k < 0 ? -1 : 1;
    table[i * STRIDE] = pts[i * 3];
    table[i * STRIDE + 1] = pts[i * 3 + 1];
    table[i * STRIDE + 2] = ty * side;
    table[i * STRIDE + 3] = -tx * side;
    table[i * STRIDE + 4] = Math.abs(k);
    lengths[i] = acc;
    acc += Math.hypot(pts[n] - pts[i * 3], pts[n + 1] - pts[i * 3 + 1]);
  }
  lengths[SAMPLES] = acc;
  return {
    shape,
    r0,
    masses: [qa, qb],
    radii: [ra, rb],
    first: [ca, 0],
    second: [cb, 0],
    length: acc,
    table,
    lengths,
    loop: (2 * seg + arcB) * (acc / total),
    share: ((2 * seg + arcB) / total) * ease(Math.min(1, qb / BINARY.claim)),
  };
}

export function curveAt(g: BinaryGeometry, u: number): CurvePoint {
  const v = ((u % 1) + 1) % 1;
  const target =
    v < g.share
      ? (v / g.share) * g.loop
      : g.loop + ((v - g.share) / (1 - g.share)) * (g.length - g.loop);
  let lo = 0;
  let hi = SAMPLES;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (g.lengths[mid] <= target) lo = mid;
    else hi = mid;
  }
  const span = g.lengths[lo + 1] - g.lengths[lo] || 1;
  const f = (target - g.lengths[lo]) / span;
  const a = lo * STRIDE;
  const b = ((lo + 1) % SAMPLES) * STRIDE;
  const flip = g.table[a + 2] * g.table[b + 2] + g.table[a + 3] * g.table[b + 3] < 0;
  const w = flip ? (f < 0.5 ? 0 : 1) : f;
  const nx = g.table[a + 2] + (g.table[b + 2] - g.table[a + 2]) * w;
  const ny = g.table[a + 3] + (g.table[b + 3] - g.table[a + 3]) * w;
  const nl = Math.hypot(nx, ny) || 1;
  return {
    x: g.table[a] + (g.table[b] - g.table[a]) * f,
    y: g.table[a + 1] + (g.table[b + 1] - g.table[a + 1]) * f,
    nx: nx / nl,
    ny: ny / nl,
    k: g.table[a + 4] + (g.table[b + 4] - g.table[a + 4]) * f,
  };
}

export function extentAt(g: BinaryGeometry, angle: number): number {
  let best = 0;
  const cx = Math.cos(angle);
  const cy = Math.sin(angle);
  for (let i = 0; i < SAMPLES; i += 2) {
    const x = g.table[i * STRIDE];
    const y = g.table[i * STRIDE + 1];
    const d = Math.hypot(x, y);
    if (d < 1e-6) continue;
    if ((x * cx + y * cy) / d > 0.97 && d > best) best = d;
  }
  return best;
}
