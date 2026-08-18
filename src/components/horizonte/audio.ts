import { AUDIO_CURVATURE_CAP } from "./tokens";

/**
 * Áudio real: HTMLAudioElement → AnalyserNode → três bandas.
 *
 * Substitui a simulação por envelope de BPM do protótipo. As bandas alimentam
 * exatamente as mesmas variáveis (`bass` / `mid` / `treb`), e `pos`/`dur` vêm
 * do elemento, não de um contador.
 */

export interface Bands {
  bass: number;
  mid: number;
  treb: number;
}

/** 20–160 Hz · 160–2k · 2k–12k */
const RANGES: [number, number][] = [
  [20, 160],
  [160, 2000],
  [2000, 12000],
];

const FFT_SIZE = 1024;
const SMOOTHING = 0.7;
/** suavização das bandas, ~120 ms */
const BAND_TAU = 0.12;
/** média lenta usada para extrair o acento (desvio) de cada banda */
const SLOW_TAU = 1.2;
/** decaimento do pico adaptativo por segundo */
const PEAK_DECAY = 0.45;
const PEAK_FLOOR = 0.06;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/**
 * Teto rígido de curvatura: o áudio nunca move um valor base mais que ±15%.
 * Tipografia "dançando" mata o resultado.
 */
export const curvature = (base: number, accent: number, cap = AUDIO_CURVATURE_CAP) =>
  base * (1 + clamp(accent, -1, 1) * cap);

export class AudioEngine {
  readonly el: HTMLAudioElement;
  /** nível 0..1 por banda, suavizado */
  readonly level: Bands = { bass: 0, mid: 0, treb: 0 };
  /** desvio -1..1 da média lenta — é o que modula a curvatura */
  readonly accent: Bands = { bass: 0, mid: 0, treb: 0 };

  onEnded: (() => void) | null = null;
  /** avisado quando duração/estado do elemento muda */
  onMeta: (() => void) | null = null;

  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private data: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));
  private slow: Bands = { bass: 0, mid: 0, treb: 0 };
  private peak: Bands = { bass: PEAK_FLOOR, mid: PEAK_FLOOR, treb: PEAK_FLOOR };
  private binRanges: [number, number][] = [];
  private src = "";
  private wantPlay = false;

  constructor() {
    this.el = new Audio();
    this.el.preload = "auto";
    this.el.crossOrigin = "anonymous";
    this.el.addEventListener("ended", () => this.onEnded?.());
    this.el.addEventListener("loadedmetadata", () => this.onMeta?.());
    this.el.addEventListener("durationchange", () => this.onMeta?.());
  }

  /** Criado sob gesto do usuário — política de autoplay dos navegadores. */
  private ensureGraph() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    type W = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as W).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;
    const source = ctx.createMediaElementSource(this.el);
    source.connect(analyser);
    analyser.connect(ctx.destination);

    this.ctx = ctx;
    this.analyser = analyser;
    this.data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

    const nyquist = ctx.sampleRate / 2;
    const bins = analyser.frequencyBinCount;
    this.binRanges = RANGES.map(([lo, hi]) => [
      Math.max(1, Math.floor((lo / nyquist) * bins)),
      Math.max(2, Math.min(bins - 1, Math.ceil((hi / nyquist) * bins))),
    ]);
  }

  load(src: string) {
    if (this.src === src) return;
    this.src = src;
    this.el.src = src;
    this.el.currentTime = 0;
  }

  async play() {
    this.ensureGraph();
    this.wantPlay = true;
    try {
      await this.el.play();
    } catch {
      this.wantPlay = false;
    }
  }

  pause() {
    this.wantPlay = false;
    this.el.pause();
  }

  seek(t: number) {
    if (!Number.isFinite(this.el.duration)) return;
    this.el.currentTime = clamp(t, 0, Math.max(0, this.el.duration - 0.05));
  }

  get playing() {
    return this.wantPlay && !this.el.paused;
  }

  get pos() {
    return Number.isFinite(this.el.currentTime) ? this.el.currentTime : 0;
  }

  get dur() {
    return Number.isFinite(this.el.duration) && this.el.duration > 0 ? this.el.duration : 0;
  }

  /** Lê o analisador e atualiza níveis e acentos. */
  update(dt: number) {
    const kBand = 1 - Math.exp(-dt / BAND_TAU);
    const kSlow = 1 - Math.exp(-dt / SLOW_TAU);
    const decay = Math.exp(-dt * PEAK_DECAY);

    const raw: Bands = { bass: 0, mid: 0, treb: 0 };
    if (this.analyser && !this.el.paused) {
      this.analyser.getByteFrequencyData(this.data);
      const keys: (keyof Bands)[] = ["bass", "mid", "treb"];
      keys.forEach((key, i) => {
        const [b0, b1] = this.binRanges[i];
        let sum = 0;
        for (let b = b0; b <= b1; b++) sum += this.data[b];
        raw[key] = sum / ((b1 - b0 + 1) * 255);
      });
    }

    (["bass", "mid", "treb"] as (keyof Bands)[]).forEach((key) => {
      this.peak[key] = Math.max(PEAK_FLOOR, this.peak[key] * decay, raw[key]);
      const norm = clamp(raw[key] / this.peak[key], 0, 1);
      this.level[key] += (norm - this.level[key]) * kBand;
      this.slow[key] += (this.level[key] - this.slow[key]) * kSlow;
      const spread = Math.max(0.12, this.slow[key]);
      this.accent[key] = clamp((this.level[key] - this.slow[key]) / spread, -1, 1);
    });
  }

  dispose() {
    this.el.pause();
    this.el.removeAttribute("src");
    this.el.load();
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
  }
}
