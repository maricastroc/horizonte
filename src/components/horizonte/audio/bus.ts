import type { AudioSource, Track } from "../content/types";
import { AudioAnalysis, type AudioFrame } from "./analysis";
import { LocalPlayback, type Playback } from "./playback";

export interface VisualAudioState extends AudioFrame {
  position: number;
  duration: number;
  progress: number;
  playing: boolean;
}

function playbackFor(source: AudioSource): Playback | null {
  if (source.kind === "local") return new LocalPlayback();
  return null;
}

export class AudioBus {
  onEnded: (() => void) | null = null;
  onMeta: (() => void) | null = null;

  private ctx: AudioContext | null = null;
  private analysis: AudioAnalysis | null = null;
  private players = new Map<AudioSource["kind"], Playback>();
  private current: Playback | null = null;

  readonly state: VisualAudioState = {
    energy: 0,
    bass: 0,
    mid: 0,
    treb: 0,
    accent: { bass: 0, mid: 0, treb: 0 },
    flux: 0,
    spectrum: new Float32Array(32),
    active: false,
    position: 0,
    duration: 0,
    progress: 0,
    playing: false,
  };

  private ensureGraph() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }
    type W = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as W).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.analysis = new AudioAnalysis(this.ctx);
    this.analysis.analyser.connect(this.ctx.destination);
    return this.ctx;
  }

  load(track: Track) {
    const source = track.source;
    let player = this.players.get(source.kind);
    if (!player) {
      const made = playbackFor(source);
      if (!made) return;
      made.onEnded = () => this.onEnded?.();
      made.onMeta = () => this.onMeta?.();
      this.players.set(source.kind, made);
      player = made;
    }
    if (this.current && this.current !== player) this.current.pause();
    this.current = player;
    player.load(source);
  }

  async play() {
    const ctx = this.ensureGraph();
    const player = this.current;
    if (!player) return;
    if (ctx && this.analysis) player.connect(ctx, this.analysis.analyser);
    await player.play();
  }

  pause() {
    this.current?.pause();
  }

  seek(seconds: number) {
    this.current?.seek(seconds);
  }

  get position() {
    return this.current?.position ?? 0;
  }

  get duration() {
    return this.current?.duration ?? 0;
  }

  get playing() {
    return this.current?.playing ?? false;
  }

  update(dt: number): VisualAudioState {
    const s = this.state;
    const playing = this.playing;
    const frame = this.analysis?.update(dt, playing) ?? null;

    if (frame) {
      s.energy = frame.energy;
      s.bass = frame.bass;
      s.mid = frame.mid;
      s.treb = frame.treb;
      s.accent = frame.accent;
      s.flux = frame.flux;
      s.spectrum = frame.spectrum;
      s.active = frame.active;
    }
    s.position = this.position;
    s.duration = this.duration;
    s.progress = s.duration ? Math.min(1, s.position / s.duration) : 0;
    s.playing = playing;
    return s;
  }

  dispose() {
    this.players.forEach((p) => p.dispose());
    this.players.clear();
    this.current = null;
    void this.ctx?.close();
    this.ctx = null;
    this.analysis = null;
  }
}
