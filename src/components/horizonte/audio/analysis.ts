import type { AlbumSignature } from "../content/signature";
import { clamp } from "../math";

export interface Bands {
  bass: number;
  mid: number;
  treb: number;
}

export interface AudioFrame {
  energy: number;
  bass: number;
  mid: number;
  treb: number;
  accent: Bands;
  flux: number;
  centroid: number;
}
const RANGES: [number, number][] = [
  [20, 160],
  [160, 2000],
  [2000, 11000],
];

export const FFT_SIZE = 1024;
export const SMOOTHING = 0.7;
const BAND_TAU = 0.12;
const SLOW_TAU = 1.2;

const BRIGHT_LO = Math.log2(200);
const BRIGHT_HI = Math.log2(2600);

const BYTE_TO_LINEAR = (() => {
  const t = new Float32Array(256);
  for (let b = 0; b < 256; b++) {
    const db = (b / 255) * 70 - 100;
    t[b] = b === 0 ? 0 : Math.pow(10, db / 20);
  }
  return t;
})();

export const curvature = (base: number, accent: number, cap: number) =>
  base * (1 + clamp(accent, -1, 1) * cap);

const KEYS: (keyof Bands)[] = ["bass", "mid", "treb"];

export class AudioAnalysis {
  readonly analyser: AnalyserNode;
  readonly frame: AudioFrame = {
    energy: 0,
    bass: 0,
    mid: 0,
    treb: 0,
    accent: { bass: 0, mid: 0, treb: 0 },
    flux: 0,
    centroid: 0.5,
  };

  private freq: Uint8Array<ArrayBuffer>;
  private time: Uint8Array<ArrayBuffer>;
  private slow: Bands = { bass: 0, mid: 0, treb: 0 };
  private prev: Bands = { bass: 0, mid: 0, treb: 0 };
  private binRanges: [number, number][];
  private binHz: Float32Array;

  private ref: AlbumSignature["reference"] | null = null;

  constructor(ctx: AudioContext) {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;
    this.analyser = analyser;
    this.freq = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    this.time = new Uint8Array(new ArrayBuffer(analyser.fftSize));

    const nyquist = ctx.sampleRate / 2;
    const bins = analyser.frequencyBinCount;
    this.binRanges = RANGES.map(([lo, hi]) => [
      Math.max(1, Math.floor((lo / nyquist) * bins)),
      Math.max(2, Math.min(bins - 1, Math.ceil((hi / nyquist) * bins))),
    ]);
    this.binHz = new Float32Array(bins);
    for (let b = 0; b < bins; b++) this.binHz[b] = (b / bins) * nyquist;
  }

  setReference(ref: AlbumSignature["reference"]) {
    this.ref = ref;
  }

  private norm(key: keyof Bands, raw: number) {
    const r = this.ref?.[key];
    if (!r) return clamp(raw, 0, 1);
    const [lo, hi] = r;
    return clamp((raw - lo) / Math.max(1e-4, hi - lo), 0, 1);
  }

  private decay(dt: number) {
    const k = 1 - Math.exp(-dt / BAND_TAU);
    const f = this.frame;
    f.energy += (0 - f.energy) * k;
    KEYS.forEach((key) => {
      f[key] += (0 - f[key]) * k;
      f.accent[key] += (0 - f.accent[key]) * k;
    });
    f.flux += (0 - f.flux) * k;
  }

  update(dt: number, live: boolean) {
    if (!live) {
      this.decay(dt);
      return this.frame;
    }

    const f = this.frame;
    const kBand = 1 - Math.exp(-dt / BAND_TAU);
    const kSlow = 1 - Math.exp(-dt / SLOW_TAU);

    this.analyser.getByteFrequencyData(this.freq);
    this.analyser.getByteTimeDomainData(this.time);

    let sq = 0;
    for (let i = 0; i < this.time.length; i++) {
      const v = (this.time[i] - 128) / 128;
      sq += v * v;
    }
    const rms = Math.sqrt(sq / this.time.length);
    const rmsRef = this.ref?.rms;
    const energy = rmsRef
      ? clamp((rms - rmsRef[0]) / Math.max(1e-5, rmsRef[1] - rmsRef[0]), 0, 1)
      : clamp(rms * 2.6, 0, 1);
    f.energy += (energy - f.energy) * kBand;

    let flux = 0;
    KEYS.forEach((key, i) => {
      const [b0, b1] = this.binRanges[i];
      let sum = 0;
      for (let b = b0; b <= b1; b++) sum += this.freq[b];
      const raw = sum / ((b1 - b0 + 1) * 255);
      const level = this.norm(key, raw);

      flux += Math.max(0, level - this.prev[key]);
      this.prev[key] = level;

      f[key] += (level - f[key]) * kBand;
      this.slow[key] += (f[key] - this.slow[key]) * kSlow;
      const spread = Math.max(0.12, this.slow[key]);
      f.accent[key] = clamp((f[key] - this.slow[key]) / spread, -1, 1);
    });
    f.flux += (clamp(flux / 0.18, 0, 1) - f.flux) * kBand;

    let num = 0;
    let den = 0;
    for (let b = 1; b < this.freq.length; b++) {
      const m = BYTE_TO_LINEAR[this.freq[b]];
      num += m * this.binHz[b];
      den += m;
    }
    const hz = den > 0 ? num / den : 0;
    const centroid = hz > 0 ? clamp((Math.log2(hz) - BRIGHT_LO) / (BRIGHT_HI - BRIGHT_LO), 0, 1) : 0.5;
    f.centroid += (centroid - f.centroid) * kBand;

    return f;
  }
}
