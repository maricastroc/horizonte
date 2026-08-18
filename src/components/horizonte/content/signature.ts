import type { Ink } from "./types";

export interface AlbumSignature {
  loudness: number;
  dynamics: number;
  brightness: number;
  duration: number;

  measured: {
    loudnessDb: number;
    dynamicsDb: number;
    brightnessHz: number;
    rolloffHz: number;
    bassRatio: number;
    durationS: number;
  };

  spans: number[];

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
  measured: {
    loudnessDb: -22,
    dynamicsDb: 24,
    brightnessHz: 720,
    rolloffHz: 1600,
    bassRatio: 0.5,
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

const cache = new WeakMap<AlbumSignature, Float32Array>();

export function envelopeOf(sig: AlbumSignature): Float32Array {
  const hit = cache.get(sig);
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
  cache.set(sig, out);
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
  const bounds = new Array<number>(trackCount + 1);
  const spans = sig.spans;
  if (spans.length !== trackCount) {
    for (let k = 0; k <= trackCount; k++) bounds[k] = k / trackCount;
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
  return bounds;
}
