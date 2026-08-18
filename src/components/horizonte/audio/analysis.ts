import { AUDIO_CURVATURE_CAP } from "../tokens";

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
  spectrum: Float32Array;
  active: boolean;
}

const RANGES: [number, number][] = [
  [20, 160],
  [160, 2000],
  [2000, 12000],
];

export const FFT_SIZE = 1024;
export const SMOOTHING = 0.7;
const BAND_TAU = 0.12;
const SLOW_TAU = 1.2;
const PEAK_DECAY = 0.45;
const PEAK_FLOOR = 0.06;
export const SPECTRUM_BINS = 32;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export const curvature = (base: number, accent: number, cap = AUDIO_CURVATURE_CAP) =>
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
    spectrum: new Float32Array(SPECTRUM_BINS),
    active: false,
  };

  private freq: Uint8Array<ArrayBuffer>;
  private time: Uint8Array<ArrayBuffer>;
  private prevSpectrum = new Float32Array(SPECTRUM_BINS);
  private slow: Bands = { bass: 0, mid: 0, treb: 0 };
  private peak: Bands = { bass: PEAK_FLOOR, mid: PEAK_FLOOR, treb: PEAK_FLOOR };
  private binRanges: [number, number][];

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
    f.active = false;
  }

  update(dt: number, live: boolean) {
    if (!live) {
      this.decay(dt);
      return this.frame;
    }

    const f = this.frame;
    const kBand = 1 - Math.exp(-dt / BAND_TAU);
    const kSlow = 1 - Math.exp(-dt / SLOW_TAU);
    const decay = Math.exp(-dt * PEAK_DECAY);

    this.analyser.getByteFrequencyData(this.freq);
    this.analyser.getByteTimeDomainData(this.time);

    let sq = 0;
    for (let i = 0; i < this.time.length; i++) {
      const v = (this.time[i] - 128) / 128;
      sq += v * v;
    }
    const rms = Math.sqrt(sq / this.time.length);
    f.energy += (clamp(rms * 2.6, 0, 1) - f.energy) * kBand;

    KEYS.forEach((key, i) => {
      const [b0, b1] = this.binRanges[i];
      let sum = 0;
      for (let b = b0; b <= b1; b++) sum += this.freq[b];
      const raw = sum / ((b1 - b0 + 1) * 255);
      this.peak[key] = Math.max(PEAK_FLOOR, this.peak[key] * decay, raw);
      const norm = clamp(raw / this.peak[key], 0, 1);
      f[key] += (norm - f[key]) * kBand;
      this.slow[key] += (f[key] - this.slow[key]) * kSlow;
      const spread = Math.max(0.12, this.slow[key]);
      f.accent[key] = clamp((f[key] - this.slow[key]) / spread, -1, 1);
    });

    const per = Math.floor(this.freq.length / SPECTRUM_BINS);
    let flux = 0;
    for (let i = 0; i < SPECTRUM_BINS; i++) {
      let sum = 0;
      for (let j = 0; j < per; j++) sum += this.freq[i * per + j];
      const v = sum / (per * 255);
      flux += Math.max(0, v - this.prevSpectrum[i]);
      this.prevSpectrum[i] = v;
      f.spectrum[i] = v;
    }
    f.flux += (clamp(flux / SPECTRUM_BINS / 0.06, 0, 1) - f.flux) * kBand;
    f.active = true;
    return f;
  }
}
