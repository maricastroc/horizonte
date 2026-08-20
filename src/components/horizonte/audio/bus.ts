import type { AlbumSignature } from "../content/signature";
import type { AudioSource, Track } from "../content/types";
import { clamp } from "../math";
import { AudioAnalysis, type AudioFrame } from "./analysis";
import { FilePlayback, LocalPlayback, type Playback, type PlaybackFault } from "./playback";

export interface VisualAudioState extends AudioFrame {
  position: number;
  duration: number;
  playing: boolean;
}

function playbackFor(source: AudioSource): Playback | null {
  if (source.kind === "local") return new LocalPlayback();
  if (source.kind === "file") return new FilePlayback();
  return null;
}

const VOLUME_RAMP = 0.015;

export class AudioBus {
  onEnded: (() => void) | null = null;
  onFault: ((fault: PlaybackFault) => void) | null = null;

  private ctx: AudioContext | null = null;
  private analysis: AudioAnalysis | null = null;
  private gain: GainNode | null = null;
  private players = new Map<AudioSource["kind"], Playback>();
  private current: Playback | null = null;
  private level = 1;
  private silent = false;

  readonly state: VisualAudioState = {
    energy: 0,
    bass: 0,
    mid: 0,
    treb: 0,
    accent: { bass: 0, mid: 0, treb: 0 },
    flux: 0,
    centroid: 0.5,
    position: 0,
    duration: 0,
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
    if (this.reference) this.analysis.setReference(this.reference);
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.effectiveLevel();
    this.analysis.analyser.connect(this.gain);
    this.gain.connect(this.ctx.destination);
    return this.ctx;
  }

  private reference: AlbumSignature["reference"] | null = null;

  setSignature(sig: AlbumSignature) {
    this.reference = sig.reference;
    this.analysis?.setReference(sig.reference);
  }

  private effectiveLevel() {
    return this.silent ? 0 : this.level;
  }

  private applyLevel() {
    const value = this.effectiveLevel();
    if (this.gain && this.ctx) {
      this.gain.gain.setTargetAtTime(value, this.ctx.currentTime, VOLUME_RAMP);
      return;
    }
    this.current?.setVolume(value);
  }

  get volume() {
    return this.level;
  }

  get muted() {
    return this.silent;
  }

  setVolume(value: number) {
    this.level = clamp(value, 0, 1);
    this.silent = false;
    this.applyLevel();
  }

  setMuted(muted: boolean) {
    this.silent = muted;
    this.applyLevel();
  }

  load(track: Track) {
    const source = track.source;
    let player = this.players.get(source.kind);
    if (!player) {
      const made = playbackFor(source);
      if (!made) return;
      made.onEnded = () => this.onEnded?.();
      made.onFault = (fault) => this.onFault?.(fault);
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
    player.setVolume(ctx ? 1 : this.effectiveLevel());
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
      s.centroid = frame.centroid;
    }
    s.position = this.position;
    s.duration = this.duration;
    s.playing = playing;
    return s;
  }

  dispose() {
    this.players.forEach((p) => p.dispose());
    this.players.clear();
    this.current = null;
    this.gain?.disconnect();
    this.gain = null;
    void this.ctx?.close();
    this.ctx = null;
    this.analysis = null;
  }
}
