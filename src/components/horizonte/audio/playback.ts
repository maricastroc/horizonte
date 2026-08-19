import { mediaUrl, needsCors } from "../content/assets";
import type { AudioSource } from "../content/types";
import { clamp } from "../math";

export interface Playback {
  readonly kind: AudioSource["kind"];
  load(source: AudioSource): void;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  readonly position: number;
  readonly duration: number;
  readonly playing: boolean;
  connect(ctx: AudioContext, node: AudioNode): boolean;
  dispose(): void;
  onEnded: (() => void) | null;
}

export class LocalPlayback implements Playback {
  readonly kind = "local" as const;
  onEnded: (() => void) | null = null;

  private el: HTMLAudioElement;
  private node: MediaElementAudioSourceNode | null = null;
  private src = "";
  private wantPlay = false;

  constructor() {
    this.el = new Audio();
    this.el.preload = "auto";
    this.el.addEventListener("ended", () => this.onEnded?.());
  }

  load(source: AudioSource) {
    if (source.kind !== "local") return;
    if (this.src === source.src) return;
    this.src = source.src;
    const url = mediaUrl(source.src);
    if (needsCors(url)) this.el.crossOrigin = "anonymous";
    else this.el.removeAttribute("crossorigin");
    this.el.src = url;
    this.el.currentTime = 0;
  }

  async play() {
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

  seek(seconds: number) {
    if (!Number.isFinite(this.el.duration)) return;
    this.el.currentTime = clamp(seconds, 0, Math.max(0, this.el.duration - 0.05));
  }

  get position() {
    return Number.isFinite(this.el.currentTime) ? this.el.currentTime : 0;
  }

  get duration() {
    return Number.isFinite(this.el.duration) && this.el.duration > 0 ? this.el.duration : 0;
  }

  get playing() {
    return this.wantPlay && !this.el.paused;
  }

  connect(ctx: AudioContext, node: AudioNode) {
    this.node ??= ctx.createMediaElementSource(this.el);
    this.node.connect(node);
    return true;
  }

  dispose() {
    this.el.pause();
    this.el.removeAttribute("src");
    this.el.load();
    this.node?.disconnect();
    this.node = null;
  }
}
