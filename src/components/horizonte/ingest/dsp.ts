import { RealFFT } from "./fft";

export const SR = 22050;
export const FFT = 1024;
export const HOP = 512;
export const ENVELOPE_N = 512;
export const ENV_WIN = 0.2;

export const MIN_DB = -100;
export const MAX_DB = -30;

export const BANDS = {
  bass: [20, 160],
  mid: [160, 2000],
  treb: [2000, 11000],
} as const;

export type BandName = keyof typeof BANDS;
export const BAND_NAMES: BandName[] = ["bass", "mid", "treb"];

export const ANCHOR: Record<string, [number, number]> = {
  loudness: [-32, -12],
  dynamics: [12, 36],
  brightness: [200, 2600],
  duration: [900, 5400],
  rolloff: [400, 4200],
  bassRatio: [0.2, 0.85],
};

export type AnchorKey = "loudness" | "dynamics" | "brightness" | "duration" | "rolloff" | "bassRatio";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function norm(value: number, key: AnchorKey, log = false): number {
  let [lo, hi] = ANCHOR[key];
  let v = value;
  if (log) {
    v = Math.log2(Math.max(v, 1e-6));
    lo = Math.log2(lo);
    hi = Math.log2(hi);
  }
  return round(clamp01((v - lo) / (hi - lo)), 4);
}

export function roundHalfEven(v: number): number {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

export function round(v: number, digits: number): number {
  const k = Math.pow(10, digits);
  const scaled = v * k;
  const near = Math.round(scaled);
  const out = Math.abs(scaled - near) < 1e-9 ? near : roundHalfEven(scaled);
  return out / k;
}

export function percentile(sorted: Float64Array | number[], q: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0];
  const pos = (q / 100) * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function sortedCopy(v: Float64Array): Float64Array {
  const c = v.slice();
  c.sort();
  return c;
}

export interface TrackAnalysis {
  durationS: number;
  frames: number;
  rms: Float64Array;
  centroid: Float64Array;
  rolloff: Float64Array;
  bands: Record<BandName, Float64Array>;
  lowEnergy: number;
  totalEnergy: number;
  envelope: Float64Array;
}

interface BinPlan {
  freqs: Float64Array;
  band: Record<BandName, { from: number; to: number }>;
  lowCut: number;
}

let planCache: BinPlan | null = null;

function binPlan(): BinPlan {
  if (planCache) return planCache;
  const bins = FFT / 2 + 1;
  const freqs = new Float64Array(bins);
  for (let k = 0; k < bins; k++) freqs[k] = (k * SR) / FFT;

  const band = {} as BinPlan["band"];
  for (const name of BAND_NAMES) {
    const [lo, hi] = BANDS[name];
    let from = -1;
    let to = -1;
    for (let k = 0; k < bins; k++) {
      if (freqs[k] >= lo && freqs[k] <= hi) {
        if (from < 0) from = k;
        to = k;
      }
    }
    band[name] = { from, to };
  }

  let lowCut = 0;
  while (lowCut < bins && freqs[lowCut] < 300) lowCut++;

  planCache = { freqs, band, lowCut };
  return planCache;
}

let windowCache: Float64Array | null = null;

function hann(): Float64Array {
  if (windowCache) return windowCache;
  const w = new Float64Array(FFT);
  for (let n = 0; n < FFT; n++) w[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (FFT - 1));
  windowCache = w;
  return w;
}

export interface TrackProgress {
  (done: number, total: number): void;
}

export function analyzeTrackPcm(
  pcm: Float32Array,
  onProgress?: TrackProgress,
  shouldAbort?: () => boolean,
): TrackAnalysis {
  const durationS = pcm.length / SR;
  const plan = binPlan();
  const win = hann();
  const fft = new RealFFT(FFT);
  const frame = new Float64Array(FFT);

  const k = Math.floor((pcm.length - FFT) / HOP);
  const usable = k >= 4;
  const count = usable ? k : 0;

  const rms = new Float64Array(count);
  const centroid = new Float64Array(count);
  const rolloff = new Float64Array(count);
  const bands = {
    bass: new Float64Array(count),
    mid: new Float64Array(count),
    treb: new Float64Array(count),
  } as Record<BandName, Float64Array>;

  let lowEnergy = 0;
  let totalEnergy = 0;
  const DB_SPAN = MAX_DB - MIN_DB;
  const SCALE = FFT / 2;

  for (let f = 0; f < count; f++) {
    if ((f & 1023) === 0) {
      if (shouldAbort?.()) throw new AbortAnalysis();
      onProgress?.(f, count);
    }
    const off = f * HOP;
    let sq = 0;
    for (let n = 0; n < FFT; n++) {
      const v = pcm[off + n] * win[n];
      frame[n] = v;
      sq += v * v;
    }
    rms[f] = Math.sqrt(sq / FFT) + 1e-9;

    const mag = fft.magnitudes(frame);

    let num = 0;
    let den = 0;
    for (let b = 0; b < mag.length; b++) {
      const m = mag[b];
      num += m * plan.freqs[b];
      den += m;
    }
    centroid[f] = num / (den + 1e-9);

    const target = 0.85 * den;
    let acc = 0;
    let idx = 0;
    for (let b = 0; b < mag.length; b++) {
      acc += mag[b];
      if (acc >= target) {
        idx = b;
        break;
      }
    }
    rolloff[f] = plan.freqs[idx];

    for (let b = 0; b < plan.lowCut; b++) lowEnergy += mag[b];
    totalEnergy += den;

    for (const name of BAND_NAMES) {
      const { from, to } = plan.band[name];
      let sum = 0;
      for (let b = from; b <= to; b++) {
        const db = 20 * Math.log10(Math.max(mag[b] / SCALE, 1e-10));
        sum += clamp01((db - MIN_DB) / DB_SPAN);
      }
      bands[name][f] = sum / (to - from + 1);
    }
  }
  onProgress?.(count, count);

  let envelope: Float64Array;
  if (!usable) {
    envelope = new Float64Array(1);
  } else {
    const hopEnv = Math.max(1, Math.trunc(SR * ENV_WIN));
    const kk = Math.max(1, Math.floor(pcm.length / hopEnv));
    envelope = new Float64Array(kk);
    for (let i = 0; i < kk; i++) {
      let sq = 0;
      const base = i * hopEnv;
      for (let n = 0; n < hopEnv; n++) {
        const v = pcm[base + n];
        sq += v * v;
      }
      envelope[i] = Math.sqrt(sq / hopEnv);
    }
  }

  return { durationS, frames: count, rms, centroid, rolloff, bands, lowEnergy, totalEnergy, envelope };
}

export class AbortAnalysis extends Error {
  constructor() {
    super("analysis aborted");
    this.name = "AbortAnalysis";
  }
}

function concat(parts: Float64Array[]): Float64Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Float64Array(n);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export interface AlbumMeasurement {
  durationS: number;
  loudnessDb: number;
  dynamicsDb: number;
  brightnessHz: number;
  rolloffHz: number;
  bassRatio: number;
  spans: number[];
  envelopeBytes: Uint8Array;
  envelopeLo: number;
  envelopeHi: number;
  reference: {
    bass: [number, number];
    mid: [number, number];
    treb: [number, number];
    rms: [number, number];
  };
}

export function composeAlbum(tracks: TrackAnalysis[]): AlbumMeasurement {
  if (tracks.length === 0) throw new Error("composeAlbum: no tracks");

  const durations = tracks.map((t) => t.durationS);
  const total = durations.reduce((a, b) => a + b, 0);

  const measured = tracks.filter((t) => t.frames > 0);
  if (measured.length === 0) throw new Error("composeAlbum: no analysable audio");

  const R = concat(measured.map((t) => t.rms));
  const C = concat(measured.map((t) => t.centroid));
  const RO = concat(measured.map((t) => t.rolloff));
  const bands = {
    bass: concat(measured.map((t) => t.bands.bass)),
    mid: concat(measured.map((t) => t.bands.mid)),
    treb: concat(measured.map((t) => t.bands.treb)),
  } as Record<BandName, Float64Array>;

  let lowEnergy = 0;
  let totalEnergy = 0;
  for (const t of measured) {
    lowEnergy += t.lowEnergy;
    totalEnergy += t.totalEnergy;
  }

  let rSum = 0;
  for (let i = 0; i < R.length; i++) rSum += R[i];
  const loudnessDb = 20 * Math.log10(rSum / R.length);

  const rSorted = sortedCopy(R);
  const dynamicsDb =
    20 * Math.log10(percentile(rSorted, 95) / Math.max(percentile(rSorted, 5), 1e-9));

  let cSum = 0;
  for (let i = 0; i < C.length; i++) cSum += C[i];
  const brightnessHz = cSum / C.length;

  let roSum = 0;
  for (let i = 0; i < RO.length; i++) roSum += RO[i];
  const rolloffHz = roSum / RO.length;

  const bassRatio = lowEnergy / Math.max(totalEnergy, 1e-9);

  const env = concat(tracks.map((t) => t.envelope));
  const resampled = new Float64Array(ENVELOPE_N);
  const last = env.length - 1;
  for (let i = 0; i < ENVELOPE_N; i++) {
    const x = last <= 0 ? 0 : (i * last) / (ENVELOPE_N - 1);
    const lo = Math.floor(x);
    const hi = Math.min(last, lo + 1);
    resampled[i] = env[lo] + (env[hi] - env[lo]) * (x - lo);
  }
  const envSorted = sortedCopy(resampled);
  const eLo = percentile(envSorted, 4);
  const eHi = percentile(envSorted, 96);
  const envelopeBytes = new Uint8Array(ENVELOPE_N);
  for (let i = 0; i < ENVELOPE_N; i++) {
    const n = clamp01((resampled[i] - eLo) / Math.max(eHi - eLo, 1e-9));
    envelopeBytes[i] = roundHalfEven(n * 255);
  }

  const ref = (v: Float64Array, digits: number): [number, number] => {
    const s = sortedCopy(v);
    return [round(percentile(s, 10), digits), round(percentile(s, 90), digits)];
  };

  return {
    durationS: round(total, 2),
    loudnessDb: round(loudnessDb, 2),
    dynamicsDb: round(dynamicsDb, 2),
    brightnessHz: round(brightnessHz, 1),
    rolloffHz: round(rolloffHz, 1),
    bassRatio: round(bassRatio, 4),
    spans: durations.map((d) => round(d / total, 6)),
    envelopeBytes,
    envelopeLo: eLo,
    envelopeHi: eHi,
    reference: {
      bass: ref(bands.bass, 4),
      mid: ref(bands.mid, 4),
      treb: ref(bands.treb, 4),
      rms: ref(rSorted, 5),
    },
  };
}

export function encodeEnvelope(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  if (typeof btoa === "function") return btoa(bin);
  return Buffer.from(bytes).toString("base64");
}

export function downmix(channels: Float32Array[]): Float32Array {
  const k = channels.length;
  if (k === 0) return new Float32Array(0);
  const n = channels[0].length;
  const out = new Float32Array(n);
  const gain = 1 / Math.sqrt(k);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let c = 0; c < k; c++) sum += channels[c][i];
    const v = k === 1 ? sum : sum * gain;
    out[i] = v > 1 ? 1 : v < -1 ? -1 : v;
  }
  return out;
}

export interface AlbumProbe {
  durationS: number;
  loudnessDb: number;
  dynamicsDb: number;
  brightnessHz: number;
}

export function probeAlbum(tracks: TrackAnalysis[]): AlbumProbe | null {
  const measured = tracks.filter((t) => t.frames > 0);
  if (measured.length === 0) return null;

  const R = concat(measured.map((t) => t.rms));
  const C = concat(measured.map((t) => t.centroid));

  let rSum = 0;
  for (let i = 0; i < R.length; i++) rSum += R[i];
  let cSum = 0;
  for (let i = 0; i < C.length; i++) cSum += C[i];

  const rSorted = sortedCopy(R);
  return {
    durationS: tracks.reduce((a, t) => a + t.durationS, 0),
    loudnessDb: 20 * Math.log10(rSum / R.length),
    dynamicsDb:
      20 * Math.log10(percentile(rSorted, 95) / Math.max(percentile(rSorted, 5), 1e-9)),
    brightnessHz: cSum / C.length,
  };
}
