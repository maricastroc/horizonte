import { ALBUMS, CURATED_COUNT, type AlbumWithSignature } from "./content";
import type { AlbumSignature } from "./content/signature";
import { fieldConstantsOf } from "./field";
import { ANCHOR } from "./ingest/dsp";
import { morphologyOf, pulseSpreadOf, type AlbumMorphology } from "./morphology";
import { ANATOMY, MORPH } from "./tokens";

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
  label: string;
  value: number;
  shown: string;
  median: number;
  medianShown: string;
  rank: number;
  of: number;
  standing: string;
  near: boolean;
}

export interface AnatomyRow {
  part: AnatomyPart;
  label: string;
  word: string;
  sentence: string;
  reading: AxisReading | null;
  detail: string;
}

export type Invite = { part: AnatomyPart; line: string } | { part: null; line: string };

interface AxisSpec {
  label: string;
  high: string;
  low: string;
  raw: (sig: AlbumSignature) => number;
  norm: (sig: AlbumSignature) => number;
  shown: (v: number) => string;
}

const NEAR = 0.03;

const minutes = (s: number) => `${Math.round(s / 60)} min`;
const db = (v: number) => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} dB`;
const two = (v: number) => v.toFixed(2);

const AXES: Record<CompareAxis, AxisSpec> = {
  duration: {
    label: "Length",
    high: "longest",
    low: "shortest",
    raw: (s) => s.measured.durationS,
    norm: (s) => s.duration,
    shown: minutes,
  },
  spread: {
    label: "Pulse spread",
    high: "most uneven",
    low: "most even",
    raw: (s) => pulseSpreadOf(s),
    norm: (s) => pulseSpreadOf(s),
    shown: two,
  },
  pulse: {
    label: "Pulse",
    high: "steadiest",
    low: "loosest",
    raw: (s) => s.measured.pulse,
    norm: (s) => s.pulse,
    shown: two,
  },
  dynamics: {
    label: "Dynamics",
    high: "most dynamic",
    low: "most compressed",
    raw: (s) => s.measured.dynamicsDb,
    norm: (s) => s.dynamics,
    shown: (v) => `${v.toFixed(1)} dB range`,
  },
  brightness: {
    label: "Brightness",
    high: "brightest",
    low: "darkest",
    raw: (s) => s.measured.brightnessHz,
    norm: (s) => s.brightness,
    shown: (v) => `${Math.round(v)} Hz`,
  },
  loudness: {
    label: "Loudness",
    high: "loudest",
    low: "quietest",
    raw: (s) => s.measured.loudnessDb,
    norm: (s) => s.loudness,
    shown: db,
  },
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

const ORD = (n: number) => {
  const tens = n % 100;
  const unit = n % 10;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${unit === 1 ? "st" : unit === 2 ? "nd" : unit === 3 ? "rd" : "th"}`;
};

function standingOf(spec: AxisSpec, rank: number, of: number): string {
  if (rank === 1) return `${spec.high} of ${of}`;
  if (rank === of) return `${spec.low} of ${of}`;
  return `${ORD(rank)} ${spec.high} of ${of}`;
}

export function readingOf(alb: number, axis: CompareAxis): AxisReading {
  const spec = AXES[axis];
  const sig = ALBUMS[alb].signature;
  const value = spec.raw(sig);
  const values = ALBUMS.map((a) => spec.raw(a.signature));
  const rank = 1 + values.filter((v) => v > value).length;
  const med = medianOf(axis);
  const medRaw = axis === "spread" ? med : rawOfNorm(axis, med);
  const near = Math.abs(spec.norm(sig) - med) < NEAR;
  return {
    axis,
    label: spec.label,
    value,
    shown: spec.shown(value),
    median: medRaw,
    medianShown: spec.shown(medRaw),
    rank,
    of: ALBUMS.length,
    standing: standingOf(spec, rank, ALBUMS.length),
    near,
  };
}

const word = (table: readonly (readonly [number, string])[], v: number) =>
  table.find(([edge]) => v < edge)?.[1] ?? table[table.length - 1][1];

const fragmentOf = (spread: number) => {
  const [lo, hi] = MORPH.fragAnchor;
  return Math.max(0, Math.min(1, (spread - lo) / (hi - lo)));
};

const SAY = {
  satellites:
    "A long record becomes territory: it spreads into satellite bodies instead of growing. " +
    "Their sizes differ as much as its tracks' levels do.",
  single:
    "Length becomes territory. A record this short stays a single body; " +
    "longer ones spread into satellites.",
  whole:
    "Its tracks share a pulse, so the crown stays almost whole. " +
    "Tracks that keep different pulses pull apart.",
  gaps:
    "Tracks that keep different pulses pull apart: " +
    "the breaks between sectors widen when they don't share a beat.",
  strata:
    "Repetition in time becomes layers in space: " +
    "the steadier the beat grid, the more the crown splits into shells.",
  contour:
    "Dynamics carve the outline: the wider the distance between quiet and loud, " +
    "the deeper the contour. It swells, in broad strokes, where the record gets louder.",
  posture:
    "Brightness sets the posture: dark records lie down, bright ones stand open. " +
    "It also hardens the rim of light.",
  core:
    "Loudness sets the mass: a loud record grows a core that swallows its own circuit; " +
    "a quiet one leaves open space.",
  name: "The name weighs what the record weighs: loudness sets the weight of the type.",
};

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

function rowsOf(album: AlbumWithSignature, alb: number): AnatomyRow[] {
  const sig = album.signature;
  const m = morphologyOf(sig, album.tracks.length);
  const sats = visibleSatellites(m);
  const W = ANATOMY.words;
  const r = (axis: CompareAxis) => readingOf(alb, axis);
  const satellites = r("duration");
  const gaps = r("spread");
  const strata = r("pulse");
  const contour = r("dynamics");
  const posture = r("brightness");
  const core = r("loudness");
  const gapWord = word(W.gaps, fragmentOf(gaps.value));
  const weight = Math.round(fieldConstantsOf(sig).artistWeight);
  return [
    {
      part: "satellites",
      label: "Satellites",
      word: W.satellites[Math.min(sats, W.satellites.length - 1)],
      sentence: sats > 0 ? SAY.satellites : SAY.single,
      reading: satellites,
      detail: `${satellites.shown} · ${satellites.standing}`,
    },
    {
      part: "gaps",
      label: "Gaps",
      word: gapWord,
      sentence: gapWord === "closed" ? SAY.whole : SAY.gaps,
      reading: gaps,
      detail: `spread ${gaps.shown} · ${gaps.standing}`,
    },
    {
      part: "strata",
      label: "Strata",
      word: word(W.strata, sig.pulse),
      sentence: SAY.strata,
      reading: strata,
      detail: `pulse ${strata.shown} · ${strata.standing}`,
    },
    {
      part: "contour",
      label: "Contour",
      word: word(W.contour, sig.dynamics),
      sentence: SAY.contour,
      reading: contour,
      detail: `${contour.shown} · ${contour.standing}`,
    },
    {
      part: "posture",
      label: "Posture",
      word: word(W.posture, sig.brightness),
      sentence: SAY.posture,
      reading: posture,
      detail: `${posture.shown} · ${posture.standing}`,
    },
    {
      part: "core",
      label: "Core",
      word: word(W.core, sig.loudness),
      sentence: SAY.core,
      reading: core,
      detail: `${core.shown} · ${core.standing}`,
    },
    {
      part: "name",
      label: "Name",
      word: String(weight),
      sentence: SAY.name,
      reading: null,
      detail: `type weight ${weight} · ${core.shown}`,
    },
  ];
}

const rowCache = new Map<AlbumSignature, AnatomyRow[]>();

export function anatomyOf(alb: number): AnatomyRow[] {
  const album = ALBUMS[alb];
  if (!album) return [];
  let rows = rowCache.get(album.signature);
  if (!rows || rows[0]?.reading?.of !== ALBUMS.length) {
    rows = rowsOf(album, alb);
    rowCache.set(album.signature, rows);
  }
  return rows;
}

export const COLOUR_NOTE = "Colour comes from the cover, not from the sound.";

const INVITE: Record<Exclude<AnatomyPart, "name">, [string, string]> = {
  satellites: ["The music put them there.", "The music decided that too."],
  gaps: [
    "Those breaks in the crown were measured, not drawn.",
    "An unbroken crown. That was measured too.",
  ],
  strata: ["Those layers come from the beat.", "No layers here. That comes from the beat too."],
  contour: [
    "That ragged outline is the music's dynamics.",
    "That smooth outline is the music's dynamics.",
  ],
  posture: ["It stands open because of how it sounds.", "It lies down because of how it sounds."],
  core: ["That core is the record's loudness.", "That small core is the record's loudness."],
};

const COUNT = [
  "No satellites.",
  "One satellite.",
  "Two satellites.",
  "Three satellites.",
  "Four satellites.",
];

export function inviteOf(alb: number): Invite {
  const rows = anatomyOf(alb);
  let best: { row: AnatomyRow; high: boolean; edge: number } | null = null;
  for (const row of rows) {
    if (!row.reading || row.part === "name") continue;
    const { rank, of } = row.reading;
    const edge = Math.min(rank - 1, of - rank);
    if (edge > 0) continue;
    if (!best) best = { row, high: rank === 1, edge };
  }
  if (!best) return { part: null, line: "Every part of this shape was measured from the music." };
  const part = best.row.part as Exclude<AnatomyPart, "name">;
  const [hi, lo] = INVITE[part];
  if (part === "satellites") {
    const m = morphologyOf(ALBUMS[alb].signature, ALBUMS[alb].tracks.length);
    const n = visibleSatellites(m);
    return { part, line: `${COUNT[Math.min(n, COUNT.length - 1)]} ${n > 0 ? hi : lo}` };
  }
  return { part, line: best.high ? hi : lo };
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
