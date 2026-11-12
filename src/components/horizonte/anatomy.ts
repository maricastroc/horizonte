import { ALBUMS, CURATED_COUNT } from "./content";
import type { AlbumSignature } from "./content/signature";
import { fieldConstantsOf } from "./field";
import { ANCHOR } from "./ingest/dsp";
import { morphologyOf, pulseSpreadOf, type AlbumMorphology } from "./morphology";

export type AnatomyPart = "satellites" | "gaps" | "strata" | "contour" | "posture" | "core" | "name";

export type CompareAxis = "duration" | "spread" | "pulse" | "dynamics" | "brightness" | "loudness";

export const PARTS: AnatomyPart[] = [
  "satellites",
  "gaps",
  "strata",
  "contour",
  "posture",
  "core",
  "name",
];

export interface AxisReading {
  axis: CompareAxis;
  value: number;
  median: number;
  rank: number;
  of: number;
  near: boolean;
}

export type Invite = { part: QuestionPart | null };

interface AxisSpec {
  raw: (sig: AlbumSignature) => number;
  norm: (sig: AlbumSignature) => number;
}

const NEAR = 0.03;

const AXES: Record<CompareAxis, AxisSpec> = {
  duration: { raw: (s) => s.measured.durationS, norm: (s) => s.duration },
  spread: { raw: (s) => pulseSpreadOf(s), norm: (s) => pulseSpreadOf(s) },
  pulse: { raw: (s) => s.measured.pulse, norm: (s) => s.pulse },
  dynamics: { raw: (s) => s.measured.dynamicsDb, norm: (s) => s.dynamics },
  brightness: { raw: (s) => s.measured.brightnessHz, norm: (s) => s.brightness },
  loudness: { raw: (s) => s.measured.loudnessDb, norm: (s) => s.loudness },
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const curated = () => ALBUMS.slice(0, CURATED_COUNT);

let medianCache: Record<CompareAxis, number> | null = null;

export function medianOf(axis: CompareAxis): number {
  if (!medianCache) {
    const sigs = curated().map((a) => a.signature);
    medianCache = {
      duration: median(sigs.map(AXES.duration.norm)),
      spread: median(sigs.map(AXES.spread.norm)),
      pulse: median(sigs.map(AXES.pulse.norm)),
      dynamics: median(sigs.map(AXES.dynamics.norm)),
      brightness: median(sigs.map(AXES.brightness.norm)),
      loudness: median(sigs.map(AXES.loudness.norm)),
    };
  }
  return medianCache[axis];
}

const ANCHORED: Record<Exclude<CompareAxis, "spread">, { key: keyof typeof ANCHOR; log: boolean }> = {
  duration: { key: "duration", log: false },
  pulse: { key: "pulse", log: false },
  dynamics: { key: "dynamics", log: false },
  brightness: { key: "brightness", log: true },
  loudness: { key: "loudness", log: false },
};

function rawOfNorm(axis: Exclude<CompareAxis, "spread">, n: number): number {
  const { key, log } = ANCHORED[axis];
  const [lo, hi] = ANCHOR[key];
  if (!log) return lo + n * (hi - lo);
  return Math.pow(2, Math.log2(lo) + n * (Math.log2(hi) - Math.log2(lo)));
}

export function readingOf(alb: number, axis: CompareAxis): AxisReading {
  const spec = AXES[axis];
  const sig = ALBUMS[alb].signature;
  const value = spec.raw(sig);
  const values = ALBUMS.map((a) => spec.raw(a.signature));
  const rank = 1 + values.filter((v) => v > value).length;
  const med = medianOf(axis);
  return {
    axis,
    value,
    median: axis === "spread" ? med : rawOfNorm(axis, med),
    rank,
    of: ALBUMS.length,
    near: Math.abs(spec.norm(sig) - med) < NEAR,
  };
}

export const visibleSatellites = (m: AlbumMorphology) =>
  m.satellites.filter((s) => s.weight > 0.02).length;

export const AXIS_OF: Record<AnatomyPart, CompareAxis | null> = {
  satellites: "duration",
  gaps: "spread",
  strata: "pulse",
  contour: "dynamics",
  posture: "brightness",
  core: "loudness",
  name: null,
};

export type QuestionPart = Exclude<AnatomyPart, "name">;

export interface Standing {
  near: boolean;
  high: boolean;
  strong: boolean;
  top: boolean;
  bottom: boolean;
}

export type Beat = "steady" | "partial" | "none";

export type Finding =
  | ({ part: "satellites"; bodies: number; after: number; minutes: number; usual: number } & Standing)
  | ({ part: "gaps"; open: boolean } & Standing)
  | ({ part: "strata"; beat: Beat } & Standing)
  | ({ part: "contour" } & Standing)
  | ({ part: "posture" } & Standing)
  | ({ part: "core" } & Standing);

export interface Question {
  part: QuestionPart;
  finding: Finding;
  reading: AxisReading;
  experiment: boolean;
  score: number;
}

const WEIGHT: Record<QuestionPart, number> = {
  satellites: 1,
  gaps: 1,
  strata: 0.85,
  contour: 0.7,
  posture: 0.95,
  core: 0.6,
};

const STRONG = 0.5;
const OPEN_GAPS = 0.4;

const edgeOf = (r: AxisReading) => Math.abs(r.rank - (r.of + 1) / 2) / Math.max(1, (r.of - 1) / 2);

function standingOf(r: AxisReading): Standing {
  return {
    near: r.near,
    high: r.value > r.median,
    strong: edgeOf(r) > STRONG,
    top: r.rank === 1,
    bottom: r.rank === r.of,
  };
}

function findingOf(alb: number, part: QuestionPart, r: AxisReading): Finding {
  const album = ALBUMS[alb];
  const st = standingOf(r);
  if (part === "satellites") {
    return {
      part,
      ...st,
      bodies: visibleSatellites(morphologyOf(album.signature, album.tracks.length)),
      after: visibleSatellites(compareMorphology(alb, "duration")),
      minutes: Math.round(album.signature.measured.durationS / 60),
      usual: Math.round(r.median / 60),
    };
  }
  if (part === "gaps") return { part, ...st, open: r.value > OPEN_GAPS };
  if (part === "strata") {
    const p = album.signature.pulse;
    return { part, ...st, beat: p > 0.5 ? "steady" : p < 0.1 ? "none" : "partial" };
  }
  return { part, ...st };
}

function weightOf(f: Finding): number {
  if (f.part === "satellites") return f.near ? 0 : f.bodies > 0 ? WEIGHT.satellites : 0.75;
  if (f.near) return 0;
  if (f.part === "gaps") return f.open ? WEIGHT.gaps : 0.45;
  if (f.part === "strata") return f.beat === "steady" ? WEIGHT.strata : f.beat === "none" ? 0.4 : 0.55;
  return WEIGHT[f.part];
}

const QUESTION_PARTS: QuestionPart[] = ["satellites", "gaps", "strata", "contour", "posture", "core"];

function buildQuestions(alb: number): Question[] {
  return QUESTION_PARTS.map((part, order) => {
    const reading = readingOf(alb, AXIS_OF[part]!);
    const finding = findingOf(alb, part, reading);
    return {
      part,
      finding,
      reading,
      experiment: !reading.near,
      score: edgeOf(reading) * weightOf(finding) - order * 1e-6,
    };
  }).sort((a, b) => b.score - a.score);
}

const questionCache = new Map<AlbumSignature, { of: number; list: Question[] }>();

export function questionsOf(alb: number): Question[] {
  const album = ALBUMS[alb];
  if (!album) return [];
  const hit = questionCache.get(album.signature);
  if (hit && hit.of === ALBUMS.length) return hit.list;
  const list = buildQuestions(alb);
  questionCache.set(album.signature, { of: ALBUMS.length, list });
  return list;
}

export const nameWeightOf = (alb: number) =>
  Math.round(fieldConstantsOf(ALBUMS[alb].signature).artistWeight);

export function inviteOf(alb: number): Invite {
  return { part: questionsOf(alb)[0]?.part ?? null };
}

export function compareSignature(sig: AlbumSignature, axis: CompareAxis): AlbumSignature {
  const med = medianOf(axis);
  if (axis !== "spread") return { ...sig, [axis]: med };
  const tp = sig.trackPulse;
  if (!tp || tp.length < 2) return sig;
  const center = median(tp);
  const flat = pulseSpreadOf(sig) < 1e-6;
  const dev = tp.map((v, i) => (flat ? i / (tp.length - 1) - 0.5 : v - center));
  const at = (k: number) => tp.map((_, i) => Math.max(0, Math.min(1, center + dev[i] * k)));
  let scale = flat ? med : med / pulseSpreadOf(sig);
  let trackPulse = at(scale);
  for (let i = 0; i < 8; i++) {
    const got = pulseSpreadOf({ ...sig, trackPulse });
    if (Math.abs(got - med) < 1e-3 || got < 1e-6) break;
    scale *= med / got;
    trackPulse = at(scale);
  }
  return { ...sig, trackPulse };
}

const compareCache = new Map<AlbumSignature, Map<CompareAxis, AlbumMorphology>>();

export function compareMorphology(alb: number, axis: CompareAxis): AlbumMorphology {
  const album = ALBUMS[alb];
  let byAxis = compareCache.get(album.signature);
  if (!byAxis) {
    byAxis = new Map();
    compareCache.set(album.signature, byAxis);
  }
  let m = byAxis.get(axis);
  if (!m) {
    m = morphologyOf(compareSignature(album.signature, axis), album.tracks.length);
    byAxis.set(axis, m);
  }
  return m;
}
