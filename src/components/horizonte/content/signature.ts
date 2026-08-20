import type { Ink } from "./types";

export interface AlbumSignature {
  loudness: number;
  dynamics: number;
  brightness: number;
  duration: number;
  pulse: number;

  measured: {
    loudnessDb: number;
    dynamicsDb: number;
    brightnessHz: number;
    rolloffHz: number;
    bassRatio: number;
    pulse: number;
    durationS: number;
  };

  spans: number[];

  trackBrightness?: number[];

  trackPulse?: number[];

  envelope: string;

  reference: {
    bass: [number, number];
    mid: [number, number];
    treb: [number, number];
    rms: [number, number];
  };

  inkA?: Ink;
  inkB?: Ink;
}

export const ENVELOPE_N = 512;

export const NEUTRAL_SIGNATURE: AlbumSignature = {
  loudness: 0.5,
  dynamics: 0.5,
  brightness: 0.5,
  duration: 0.5,
  pulse: 0.5,
  measured: {
    loudnessDb: -22,
    dynamicsDb: 24,
    brightnessHz: 720,
    rolloffHz: 1600,
    bassRatio: 0.5,
    pulse: 0.4,
    durationS: 2400,
  },
  spans: [],
  envelope: "",
  reference: {
    bass: [0.2, 0.85],
    mid: [0.15, 0.7],
    treb: [0.02, 0.45],
    rms: [0.01, 0.09],
  },
};

export interface TrackBias {
  loudness: number;
  dynamics: number;
  brightness: number;
  pulse: number;
}

export const NEUTRAL_BIAS: TrackBias = {
  loudness: 0,
  dynamics: 0,
  brightness: 0,
  pulse: 0,
};

const envelopeCache = new WeakMap<AlbumSignature, Float32Array>();
const boundsCache = new WeakMap<AlbumSignature, Map<number, number[]>>();
const biasCache = new WeakMap<AlbumSignature, Map<number, TrackBias[]>>();

export function envelopeOf(sig: AlbumSignature): Float32Array {
  const hit = envelopeCache.get(sig);
  if (hit) return hit;

  const out = new Float32Array(ENVELOPE_N);
  if (!sig.envelope) {
    out.fill(0.5);
  } else {
    const bin = atob(sig.envelope);
    const n = Math.min(ENVELOPE_N, bin.length);
    for (let i = 0; i < n; i++) out[i] = bin.charCodeAt(i) / 255;
    for (let i = n; i < ENVELOPE_N; i++) out[i] = out[n - 1] ?? 0.5;
  }
  envelopeCache.set(sig, out);
  return out;
}

export function sampleEnvelope(env: Float32Array, t: number): number {
  const x = (t <= 0 ? 0 : t >= 1 ? 1 : t) * (ENVELOPE_N - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = env[i];
  const b = env[Math.min(ENVELOPE_N - 1, i + 1)];
  return a + (b - a) * f;
}

export function boundsOf(sig: AlbumSignature, trackCount: number): number[] {
  let porContagem = boundsCache.get(sig);
  if (!porContagem) {
    porContagem = new Map();
    boundsCache.set(sig, porContagem);
  }
  const hit = porContagem.get(trackCount);
  if (hit) return hit;

  const bounds = new Array<number>(trackCount + 1);
  const spans = sig.spans;
  if (spans.length !== trackCount) {
    for (let k = 0; k <= trackCount; k++) bounds[k] = k / trackCount;
    porContagem.set(trackCount, bounds);
    return bounds;
  }
  let acc = 0;
  bounds[0] = 0;
  for (let k = 0; k < trackCount; k++) {
    acc += spans[k];
    bounds[k + 1] = acc;
  }
  const total = bounds[trackCount] || 1;
  for (let k = 1; k <= trackCount; k++) bounds[k] /= total;
  porContagem.set(trackCount, bounds);
  return bounds;
}

const BIAS_BLEND = 0.55;
const BIAS_CAP = 0.25;

const PER_TRACK_CAP = 0.12;
const PER_TRACK_KNEE = 0.5;

const GATE = {
  brightness: { floor: 0.071, knee: 0.12 },
  pulse: { floor: 0.118, knee: 0.28 },
} as const;

const clampBias = (v: number) => (v < -BIAS_CAP ? -BIAS_CAP : v > BIAS_CAP ? BIAS_CAP : v);

function rankAt(sorted: number[], q: number): number {
  const i = Math.round(q * (sorted.length - 1));
  return sorted[i < 0 ? 0 : i >= sorted.length ? sorted.length - 1 : i];
}

function perTrackBias(
  values: number[] | undefined,
  gate: { floor: number; knee: number },
  bounds: number[],
  trackCount: number,
): number[] {
  const out = new Array<number>(trackCount).fill(0);
  if (!values || values.length !== trackCount) return out;

  let ref = 0;
  for (let k = 0; k < trackCount; k++) ref += values[k] * (bounds[k + 1] - bounds[k]);

  const sorted = values.slice().sort((a, b) => a - b);
  const spread = rankAt(sorted, 0.9) - rankAt(sorted, 0.1);
  const open = Math.min(1, Math.max(0, (spread - gate.floor) / gate.knee));

  const linear = PER_TRACK_CAP * PER_TRACK_KNEE;
  const above = PER_TRACK_CAP - linear;
  for (let k = 0; k < trackCount; k++) {
    const d = (values[k] - ref) * open;
    const a = Math.abs(d);
    out[k] =
      a <= linear ? d : Math.sign(d) * (linear + above * Math.tanh((a - linear) / above));
  }
  return out;
}

export function trackBiasOf(sig: AlbumSignature, trackCount: number): TrackBias[] {
  if (trackCount <= 0) return [];

  let byCount = biasCache.get(sig);
  if (!byCount) {
    byCount = new Map();
    biasCache.set(sig, byCount);
  }
  const hit = byCount.get(trackCount);
  if (hit) return hit;

  const env = envelopeOf(sig);
  const bounds = boundsOf(sig, trackCount);
  const levels = new Array<number>(trackCount);
  const spreads = new Array<number>(trackCount);
  let refLevel = 0;
  let refSpread = 0;

  for (let k = 0; k < trackCount; k++) {
    const i0 = Math.min(ENVELOPE_N - 1, Math.floor(bounds[k] * (ENVELOPE_N - 1)));
    const i1 = Math.max(i0, Math.floor(bounds[k + 1] * (ENVELOPE_N - 1)));
    const slice: number[] = [];
    for (let i = i0; i <= i1; i++) slice.push(env[i]);

    let sum = 0;
    for (const v of slice) sum += v;
    const level = sum / slice.length;
    slice.sort((a, b) => a - b);
    const spread = rankAt(slice, 0.95) - rankAt(slice, 0.05);

    levels[k] = level;
    spreads[k] = spread;
    const weight = bounds[k + 1] - bounds[k];
    refLevel += level * weight;
    refSpread += spread * weight;
  }

  const bright = perTrackBias(sig.trackBrightness, GATE.brightness, bounds, trackCount);
  const pulse = perTrackBias(sig.trackPulse, GATE.pulse, bounds, trackCount);

  const bias = new Array<TrackBias>(trackCount);
  for (let k = 0; k < trackCount; k++) {
    bias[k] = {
      loudness: clampBias((levels[k] - refLevel) * BIAS_BLEND),
      dynamics: clampBias((spreads[k] - refSpread) * BIAS_BLEND),
      brightness: bright[k],
      pulse: pulse[k],
    };
  }

  byCount.set(trackCount, bias);
  return bias;
}
