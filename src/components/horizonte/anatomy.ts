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

export interface Question {
  part: QuestionPart;
  ask: string;
  answer: string;
  what: string | null;
  label: string;
  result: string;
  drawn: string;
  reading: AxisReading;
  score: number;
}

const COUNT = ["no", "one", "two", "three", "four"];

const DRAWN: Record<QuestionPart, string> = {
  satellites: "small bodies around the ring",
  gaps: "breaks between the sectors",
  strata: "layers in the ring",
  contour: "relief of the outline",
  posture: "how flat the body lies",
  core: "the dark center",
};

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

const NEAR_TEXT: Record<Exclude<QuestionPart, "satellites">, { ask: string; answer: string }> = {
  gaps: {
    ask: "What opens breaks in the ring?",
    answer:
      "Tracks with different pulses. This record's tracks vary about as much as most here, " +
      "so its breaks are of a usual width.",
  },
  strata: {
    ask: "What would split the ring into layers?",
    answer: "A steady beat. This record's beat is about as regular as most here.",
  },
  contour: {
    ask: "What carves its edge?",
    answer:
      "The swing between quiet and loud. This record's swing is close to the usual here, " +
      "so its edge is moderately carved.",
  },
  posture: {
    ask: "What sets how upright it stands?",
    answer:
      "Brightness. This record sounds about as bright as most here, " +
      "so it stands at a usual angle.",
  },
  core: {
    ask: "What sets the size of its dark center?",
    answer:
      "Loudness. This record is about as loud as most here, " +
      "so its center is of a usual size, and so is the weight of its name.",
  },
};

const bodies = (n: number) => `${COUNT[n]} small ${n === 1 ? "body" : "bodies"}`;

function satellitesOf(alb: number, r: AxisReading, high: boolean) {
  const album = ALBUMS[alb];
  const n = visibleSatellites(morphologyOf(album.signature, album.tracks.length));
  const after = visibleSatellites(compareMorphology(alb, "duration"));
  const min = Math.round(album.signature.measured.durationS / 60);
  const usual = Math.round(r.median / 60);
  const lead = `At ${usual} minutes, a usual length here,`;
  const d = Math.abs(after - n);
  const ask =
    n === 0
      ? "Why is it a single body?"
      : n === 1
        ? "Why is there a small body beside it?"
        : `Why are there ${bodies(n)} around it?`;
  const answer = r.near
    ? `Because of its length: ${min} minutes, close to the usual here. ` +
      `Records spread into small bodies as they get longer; at this length, ${COUNT[n]}.`
    : n === 0
      ? `Because it is short: ${min} minutes${r.rank === r.of ? ", the shortest record here" : ""}. ` +
        "Only longer records spread out into small bodies."
      : high
        ? `Because it is long: ${min} minutes${r.rank === 1 ? ", the longest record here" : ""}. ` +
          "A long record becomes territory: it spreads into small bodies instead of growing."
        : `Because of its length: ${min} minutes, shorter than most here. ` +
          `Records spread into small bodies as they get longer; at this length, ${COUNT[n]}.`;
  const result =
    after < n
      ? `${lead} ${COUNT[d]} of its ${bodies(n)} ${d === 1 ? "dissolves" : "dissolve"}.`
      : after > n
        ? `${lead} ${d === 1 ? "one more small body appears" : `${bodies(d)} appear`} around it.`
        : `${lead} its small ${n === 1 ? "body" : "bodies"} ` +
          `${high ? "shrink" : "grow"}${n === 1 ? "s" : ""}.`;
  return {
    weight: r.near ? 0 : n > 0 ? WEIGHT.satellites : 0.75,
    ask,
    answer,
    what: high ? "What if it were shorter?" : "What if it were longer?",
    label: high ? "Shorter" : "Longer",
    result,
  };
}

function textOf(alb: number, part: QuestionPart, r: AxisReading) {
  const sig = ALBUMS[alb].signature;
  const high = r.value > r.median;
  const edge = Math.abs(r.rank - (r.of + 1) / 2) / Math.max(1, (r.of - 1) / 2);
  const strong = edge > STRONG;
  const top = r.rank === 1;
  const bottom = r.rank === r.of;
  if (part === "satellites") return satellitesOf(alb, r, high);
  if (r.near) return { ...NEAR_TEXT[part], weight: 0, what: "", label: "", result: "" };
  if (part === "gaps") {
    const open = r.value > OPEN_GAPS;
    return {
      weight: open ? WEIGHT.gaps : 0.45,
      ask: open ? "Why is the ring broken into pieces?" : "Why is the ring almost whole?",
      answer: open
        ? "Because its tracks don't share one beat: some sit on a steady pulse, others much less. " +
          "Each change of pulse opens a break between tracks."
        : "Because its tracks keep the same kind of pulse. " +
          "When tracks differ in beat, the ring breaks between them.",
      what: high ? "What if its tracks shared one beat?" : "What if its tracks drifted apart?",
      label: high ? "One beat" : "Drifting",
      result: high
        ? "With pulses as close as a usual record here, the breaks between tracks narrow."
        : "With pulses as varied as a usual record here, breaks open between its tracks.",
    };
  }
  if (part === "strata") {
    const steady = sig.pulse > 0.5;
    const none = sig.pulse < 0.1;
    return {
      weight: steady ? WEIGHT.strata : none ? 0.4 : 0.55,
      ask: steady
        ? "Why is the ring made of layers?"
        : none
          ? "Why is the ring a single band?"
          : "Why does the ring show faint layers?",
      answer: steady
        ? `Because it sits on a steady beat${top ? ", the steadiest here" : ""}. ` +
          "Repetition in time becomes layers in space."
        : none
          ? `Because it floats free of any beat${bottom ? ", the loosest here" : ""}. ` +
            "Only music on a steady grid splits the ring into layers."
          : "Because its beat is only partly regular. " +
            "The steadier the grid, the more the ring splits into layers.",
      what: high ? "What if its beat were looser?" : "What if it had a steadier beat?",
      label: high ? "Looser" : "Steadier",
      result: high
        ? "With a beat as loose as a usual record here, the layers melt into fewer bands."
        : "With a beat as steady as a usual record here, the band splits into layers.",
    };
  }
  if (part === "contour") {
    return {
      weight: WEIGHT.contour,
      ask: high
        ? strong
          ? "Why is its edge so jagged?"
          : "Why is its edge carved?"
        : strong
          ? "Why is its edge so smooth?"
          : "Why is its edge fairly smooth?",
      answer: high
        ? (strong
            ? "Because it swings between very quiet and very loud" +
              `${top ? ", more than any record here" : ""}. `
            : "Because it moves between quiet and loud more than most here. ") +
          "The wider that swing, the deeper the outline, and the more it breathes when it plays."
        : (strong
            ? `Because it barely changes in volume${bottom ? ", less than any record here" : ""}. `
            : "Because it stays within a narrower range of volume than most here. ") +
          "Even music leaves a smoother outline, and it breathes less when it plays.",
      what: high ? "What if it were more even?" : "What if it swung more between quiet and loud?",
      label: high ? "More even" : "More contrast",
      result: high
        ? "With a usual range of volume, the edge smooths out."
        : "With a usual range of volume, the edge gets carved.",
    };
  }
  if (part === "posture") {
    return {
      weight: WEIGHT.posture,
      ask: high
        ? strong
          ? "Why does it stand so open?"
          : "Why does it stand open?"
        : strong
          ? "Why does it lie so flat?"
          : "Why does it tilt down?",
      answer: high
        ? (strong
            ? `Because it sounds bright${top ? ", the brightest record here" : ""}. `
            : "Because it sounds brighter than most here. ") +
          "Bright records stand open; dark ones lie down."
        : (strong
            ? `Because it sounds dark${bottom ? ", the darkest record here" : ""}: ` +
              "most of its energy sits low. "
            : "Because it sounds a little darker than most here. ") +
          "Dark records lie down; bright ones stand open.",
      what: high ? "What if it sounded darker?" : "What if it sounded brighter?",
      label: high ? "Darker" : "Brighter",
      result: high
        ? "As bright as a usual record here, it settles and tilts down."
        : "As bright as a usual record here, it rises and opens.",
    };
  }
  return {
    weight: WEIGHT.core,
    ask: high
      ? strong
        ? "Why is its dark center so large?"
        : "Why is its dark center fairly large?"
      : strong
        ? "Why is its dark center so small?"
        : "Why is its dark center fairly small?",
    answer: high
      ? (strong
          ? `Because it is loud${top ? ", the loudest record here" : ""}. `
          : "Because it is louder than most here. ") +
        "Loud records grow a heavy center that swallows the ring, and the name is set heavier too."
      : (strong
          ? `Because it is quiet${bottom ? ", the quietest record here" : ""}. `
          : "Because it is a little quieter than most here. ") +
        "Quiet records keep a small center and open space, and the name is set lighter too.",
    what: high ? "What if it were quieter?" : "What if it were louder?",
    label: high ? "Quieter" : "Louder",
    result: high
      ? "As loud as a usual record here, the center shrinks."
      : "As loud as a usual record here, the center swells.",
  };
}

const QUESTION_PARTS: QuestionPart[] = ["satellites", "gaps", "strata", "contour", "posture", "core"];

function buildQuestions(alb: number): Question[] {
  return QUESTION_PARTS.map((part, order) => {
    const reading = readingOf(alb, AXIS_OF[part]!);
    const t = textOf(alb, part, reading);
    const edge =
      Math.abs(reading.rank - (reading.of + 1) / 2) / Math.max(1, (reading.of - 1) / 2);
    return {
      part,
      ask: t.ask,
      answer: t.answer,
      what: reading.near ? null : t.what,
      label: t.label,
      result: t.result,
      drawn: DRAWN[part],
      reading,
      score: edge * t.weight - order * 1e-6,
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

export const COLOUR_NOTE = "Colour comes from the cover, not from the sound.";

export function nameFactOf(alb: number): string {
  const weight = Math.round(fieldConstantsOf(ALBUMS[alb].signature).artistWeight);
  return `The name is set at weight ${weight}: the louder the record, the heavier the type.`;
}

export function inviteOf(alb: number): Invite {
  const lead = questionsOf(alb)[0];
  return lead ? { part: lead.part, line: lead.ask } : { part: null, line: "Why this shape?" };
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
