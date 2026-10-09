import type { AlbumSignature } from "./content/signature";
import { ENVELOPE_N, envelopeOf, boundsOf } from "./content/signature";
import { clamp, lerp } from "./math";
import { MORPH } from "./tokens";

export interface Satellite {
  angle: number;
  dist: number;
  size: number;
  weight: number;
}

export interface AlbumMorphology {
  bounds: number[];
  plate: number[];
  circuit: number;
  flatten: number;
  coreRatio: number;
  bandRatio: number;
  relief: number;
  strata: number;
  eccX: number;
  eccY: number;
  fragment: number;
  spread: number;
  satellites: Satellite[];
  lobeCos: number[];
  lobeSin: number[];
  phase: number;
  closure: number;
  spiral: number;
  drift: number[];
  rMin: number;
  rMax: number;
}

export type MorphologyShape = Omit<AlbumMorphology, "rMin" | "rMax">;

const HARMONICS = 7;

const normOf = (v: number, lo: number, hi: number) => clamp((v - lo) / (hi - lo), 0, 1);

function rankAt(values: number[], q: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const i = Math.round(q * (sorted.length - 1));
  return sorted[i < 0 ? 0 : i >= sorted.length ? sorted.length - 1 : i];
}

interface Spectrum {
  cos: number[];
  sin: number[];
  first: { x: number; y: number; amp: number };
}

function spectrumOf(env: Float32Array): Spectrum {
  const n = env.length;
  let dc = 0;
  for (let i = 0; i < n; i++) dc += env[i];
  dc /= n;

  const cos: number[] = [];
  const sin: number[] = [];
  let firstX = 0;
  let firstY = 0;

  for (let k = 1; k <= HARMONICS; k++) {
    let a = 0;
    let b = 0;
    for (let i = 0; i < n; i++) {
      const th = (6.283185307179586 * k * i) / n;
      const d = env[i] - dc;
      a += d * Math.cos(th);
      b += d * Math.sin(th);
    }
    a = (2 * a) / n;
    b = (2 * b) / n;
    if (k === 1) {
      firstX = a;
      firstY = b;
    } else {
      cos.push(a);
      sin.push(b);
    }
  }

  return { cos, sin, first: { x: firstX, y: firstY, amp: Math.hypot(firstX, firstY) } };
}

function normalizeLobes(cos: number[], sin: number[]) {
  let peak = 0;
  for (let i = 0; i < 720; i++) {
    const th = (6.283185307179586 * i) / 720;
    let v = 0;
    for (let j = 0; j < cos.length; j++) {
      const k = j + 2;
      v += cos[j] * Math.cos(k * th) + sin[j] * Math.sin(k * th);
    }
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  if (peak < 1e-6) return { cos: cos.map(() => 0), sin: sin.map(() => 0) };
  return { cos: cos.map((v) => v / peak), sin: sin.map((v) => v / peak) };
}

function lobeSum(cos: number[], sin: number[], turn: number): number {
  const th = 6.283185307179586 * turn;
  let v = 0;
  for (let j = 0; j < cos.length; j++) {
    const k = j + 2;
    v += cos[j] * Math.cos(k * th) + sin[j] * Math.sin(k * th);
  }
  return v;
}

export function lobesOf(env: Float32Array): { cos: number[]; sin: number[] } {
  const spec = spectrumOf(env);
  return normalizeLobes(spec.cos, spec.sin);
}

export const coreFlattenOf = (flatten: number) =>
  flatten >= MORPH.flatten[0]
    ? flatten
    : MORPH.flatten[0] - (MORPH.flatten[0] - flatten) * MORPH.coreTilt;

const satGain = (weight: number) => 0.4 + 0.6 * weight;

export const satRadiusOf = (m: AlbumMorphology, s: Satellite) =>
  Math.min(s.size * satGain(s.weight), m.coreRatio * MORPH.satCap);

export function lobeAt(m: AlbumMorphology, turn: number): number {
  return lobeSum(m.lobeCos, m.lobeSin, turn);
}

export const pathTurn = (m: Pick<AlbumMorphology, "closure">, t: number) =>
  m.closure >= 1 ? t : t * m.closure;

export function pathAt(m: Pick<AlbumMorphology, "closure">, turn: number): number {
  const u = ((turn % 1) + 1) % 1;
  if (m.closure >= 1) return u;
  return u <= m.closure ? u / m.closure : -1;
}

export const isPathed = (m: Pick<AlbumMorphology, "closure" | "spiral" | "drift">) =>
  m.closure < 1 || m.spiral !== 0 || m.drift.length > 0;

export function segmentAt(bounds: number[], t: number): number {
  const n = bounds.length - 1;
  for (let k = 0; k < n; k++) if (t < bounds[k + 1]) return k;
  return n - 1;
}

const shiftOf = (m: Pick<AlbumMorphology, "spiral" | "drift">, t: number, k: number) =>
  m.spiral * (t - 0.5) + (m.drift[k] ?? 0);

export function outerAt(m: AlbumMorphology, t: number): number {
  return (
    1 +
    m.relief * lobeAt(m, pathTurn(m, t)) +
    shiftOf(m, t, segmentAt(m.bounds, t))
  );
}

export interface Crown {
  inner: number;
  outer: number;
}

function crownFrom(m: MorphologyShape, t: number): Crown {
  const k = segmentAt(m.bounds, t);
  const floor = m.coreRatio * 1.06;
  const band = m.bandRatio * m.plate[k];
  const raw = 1 + m.relief * lobeSum(m.lobeCos, m.lobeSin, pathTurn(m, t)) + shiftOf(m, t, k);
  const outer = Math.max(raw, floor + band * MORPH.bandFloor);
  const inner = Math.max(floor, outer - band);
  return { inner, outer };
}

export interface Shell {
  inner: number;
  outer: number;
}

function shellsFrom(c: Crown, strata: number): Shell[] {
  const base = c.outer - c.inner;
  if (strata <= 0.02 || base <= 0) return [c];
  const total = base * (1 + MORPH.strataReach * strata);
  const n = MORPH.shells;
  const gap = (total * MORPH.strataGap * strata) / (n - 1);
  const slot = (total - gap * (n - 1)) / n;
  const out: Shell[] = [];
  for (let i = 0; i < n; i++) {
    const inner = c.inner + i * (slot + gap);
    out.push({ inner, outer: inner + slot });
  }
  return out;
}

export function shellsAt(m: AlbumMorphology, t: number): Shell[] {
  return shellsFrom(crownFrom(m, t), m.strata);
}

export function crownAt(m: AlbumMorphology, t: number): Crown {
  return crownFrom(m, t);
}

export function withExtent(shape: MorphologyShape): AlbumMorphology {
  let rMin = Number.POSITIVE_INFINITY;
  let rMax = 0;
  for (let i = 0; i < 360; i++) {
    const c = crownFrom(shape, i / 360);
    const sh = shellsFrom(c, shape.strata);
    const top = sh[sh.length - 1].outer;
    if (top > rMax) rMax = top;
    if (c.inner < rMin) rMin = c.inner;
  }
  return { ...shape, rMin, rMax };
}

export const arcSpanOf = (m: Pick<AlbumMorphology, "spread">) =>
  lerp(MORPH.arcSpan[0], MORPH.arcSpan[1], m.spread);

function trackLevels(sig: AlbumSignature, trackCount: number): number[] {
  const env = envelopeOf(sig);
  const bounds = boundsOf(sig, trackCount);
  const out: number[] = [];
  for (let k = 0; k < trackCount; k++) {
    const i0 = Math.min(ENVELOPE_N - 1, Math.floor(bounds[k] * (ENVELOPE_N - 1)));
    const i1 = Math.max(i0, Math.floor(bounds[k + 1] * (ENVELOPE_N - 1)));
    let sum = 0;
    for (let i = i0; i <= i1; i++) sum += env[i];
    out.push(sum / (i1 - i0 + 1));
  }
  return out;
}

export function pulseSpreadOf(sig: AlbumSignature): number {
  const raw = sig.trackPulse;
  if (!raw || raw.length < 2) return 0;
  return rankAt(raw, 0.9) - rankAt(raw, 0.1);
}

export function levelSpreadOf(sig: AlbumSignature, trackCount: number): number {
  if (trackCount < 2) return 0;
  const levels = trackLevels(sig, trackCount);
  return rankAt(levels, 0.9) - rankAt(levels, 0.1);
}

const cache = new WeakMap<AlbumSignature, Map<number, AlbumMorphology>>();

export function morphologyOf(sig: AlbumSignature, trackCount: number): AlbumMorphology {
  let byCount = cache.get(sig);
  if (!byCount) {
    byCount = new Map();
    cache.set(sig, byCount);
  }
  const hit = byCount.get(trackCount);
  if (hit) return hit;

  const env = envelopeOf(sig);
  const spec = spectrumOf(env);
  const lobes = normalizeLobes(spec.cos, spec.sin);

  const massN = normOf(sig.loudness, MORPH.massAnchor[0], MORPH.massAnchor[1]);
  const spread = normOf(sig.duration, MORPH.spreadAnchor[0], MORPH.spreadAnchor[1]);
  const fragN = normOf(pulseSpreadOf(sig), MORPH.fragAnchor[0], MORPH.fragAnchor[1]);
  const hierN = normOf(levelSpreadOf(sig, trackCount), MORPH.hierAnchor[0], MORPH.hierAnchor[1]);
  const eccN = normOf(spec.first.amp, MORPH.eccAnchor[0], MORPH.eccAnchor[1]);
  const bounds = boundsOf(sig, trackCount);
  const levels = trackLevels(sig, trackCount);
  const plate = levels.map((v) =>
    lerp(MORPH.plate[0], MORPH.plate[1], clamp((v - 0.18) / 0.64, 0, 1)),
  );

  const circuit = lerp(MORPH.circuit[0], MORPH.circuit[1], massN) * (1 - MORPH.spreadShrink * spread);
  const flatten = lerp(MORPH.flatten[0], MORPH.flatten[1], sig.brightness);
  const coreRatio = lerp(MORPH.core[0], MORPH.core[1], sig.loudness);
  const bandRatio = (1 - coreRatio) * MORPH.bandFill;
  const relief = lerp(MORPH.relief[0], MORPH.relief[1], sig.dynamics);
  const fragment = lerp(MORPH.fragment[0], MORPH.fragment[1], fragN);
  const strata = sig.pulse;


  const eccLen = eccN * MORPH.eccReach;
  const eccAngle = Math.atan2(spec.first.y, spec.first.x);
  const eccX = Math.cos(eccAngle) * eccLen;
  const eccY = Math.sin(eccAngle) * eccLen;

  const satellites: Satellite[] = [];
  const eccTurn = (eccAngle / 6.283185307179586 + 1) % 1;
  for (let i = 0; i < MORPH.satellites; i++) {
    const weight = clamp((spread - MORPH.satOnset - i * MORPH.satStep) / MORPH.satKnee, 0, 1);
    const phase = (eccTurn + i * MORPH.satPhase) % 1;
    satellites.push({
      angle: MORPH.satArc[0] + phase * MORPH.satArc[1],
      dist: MORPH.satDist[0] + i * MORPH.satDist[1],
      size:
        MORPH.satSize *
        (1 - MORPH.satGrow + MORPH.satGrow * 2 * spread) *
        Math.pow(1 - hierN * MORPH.satFalloff, i),
      weight,
    });
  }

  let satPeak = 0;
  for (const s of satellites) {
    if (s.weight <= 0.02) continue;
    satPeak = Math.max(satPeak, s.size * satGain(s.weight));
  }
  const satCeiling = coreRatio * MORPH.satCap;
  if (satPeak > satCeiling) {
    const k = satCeiling / satPeak;
    for (const s of satellites) s.size *= k;
  }

  const m = withExtent({
    bounds,
    plate,
    circuit,
    flatten,
    coreRatio,
    bandRatio,
    relief,
    strata,
    eccX,
    eccY,
    fragment,
    spread,
    satellites,
    lobeCos: lobes.cos,
    lobeSin: lobes.sin,
    phase: eccAngle,
    closure: 1,
    spiral: 0,
    drift: [],
  });

  byCount.set(trackCount, m);
  return m;
}

export const neighborScale = (m: AlbumMorphology) =>
  1 + (m.circuit - 1) * MORPH.neighborDamp;

export const NEUTRAL_MORPHOLOGY: AlbumMorphology = {
  bounds: [0, 1],
  plate: [1],
  circuit: 1,
  flatten: 0.62,
  coreRatio: 0.34,
  bandRatio: (1 - 0.34) * MORPH.bandFill,
  relief: 0,
  strata: 0,
  eccX: 0,
  eccY: 0,
  fragment: MORPH.fragment[0],
  spread: 0,
  satellites: [],
  lobeCos: [],
  lobeSin: [],
  phase: 0,
  closure: 1,
  spiral: 0,
  drift: [],
  rMin: 1 - (1 - 0.34) * MORPH.bandFill,
  rMax: 1,
};

export function mixMorphology(
  a: AlbumMorphology,
  b: AlbumMorphology,
  t: number,
): AlbumMorphology {
  const k = clamp(t, 0, 1);
  const n = Math.max(a.lobeCos.length, b.lobeCos.length);
  const lobeCos: number[] = [];
  const lobeSin: number[] = [];
  for (let i = 0; i < n; i++) {
    lobeCos.push(lerp(a.lobeCos[i] ?? 0, b.lobeCos[i] ?? 0, k));
    lobeSin.push(lerp(a.lobeSin[i] ?? 0, b.lobeSin[i] ?? 0, k));
  }
  const sats: Satellite[] = [];
  const sn = Math.max(a.satellites.length, b.satellites.length);
  for (let i = 0; i < sn; i++) {
    const sa = a.satellites[i];
    const sb = b.satellites[i];
    if (!sa || !sb) {
      const only = sa ?? sb!;
      sats.push({ ...only, weight: only.weight * (sa ? 1 - k : k) });
      continue;
    }
    sats.push({
      angle: lerp(sa.angle, sb.angle, k),
      dist: lerp(sa.dist, sb.dist, k),
      size: lerp(sa.size, sb.size, k),
      weight: lerp(sa.weight, sb.weight, k),
    });
  }
  const drift: number[] = [];
  const dn = Math.max(a.drift.length, b.drift.length);
  if (a.bounds.length === b.bounds.length) {
    for (let i = 0; i < dn; i++) drift.push(lerp(a.drift[i] ?? 0, b.drift[i] ?? 0, k));
  } else {
    drift.push(...(k < 0.5 ? a.drift : b.drift));
  }
  return {
    bounds: k < 0.5 ? a.bounds : b.bounds,
    plate: k < 0.5 ? a.plate : b.plate,
    circuit: lerp(a.circuit, b.circuit, k),
    flatten: lerp(a.flatten, b.flatten, k),
    coreRatio: lerp(a.coreRatio, b.coreRatio, k),
    bandRatio: lerp(a.bandRatio, b.bandRatio, k),
    relief: lerp(a.relief, b.relief, k),
    strata: lerp(a.strata, b.strata, k),
    eccX: lerp(a.eccX, b.eccX, k),
    eccY: lerp(a.eccY, b.eccY, k),
    fragment: lerp(a.fragment, b.fragment, k),
    spread: lerp(a.spread, b.spread, k),
    satellites: sats,
    lobeCos,
    lobeSin,
    phase: lerp(a.phase, b.phase, k),
    closure: lerp(a.closure, b.closure, k),
    spiral: lerp(a.spiral, b.spiral, k),
    drift,
    rMin: lerp(a.rMin, b.rMin, k),
    rMax: lerp(a.rMax, b.rMax, k),
  };
}
