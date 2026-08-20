import { mediaUrl, needsCors } from "../content/assets";
import type { AudioSource } from "../content/types";
import { clamp } from "../math";

export type PlaybackFault = "source" | "blocked";

export interface Playback {
  readonly kind: AudioSource["kind"];
  load(source: AudioSource): void;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  setVolume(value: number): void;
  readonly position: number;
  readonly duration: number;
  readonly playing: boolean;
  connect(ctx: AudioContext, node: AudioNode): boolean;
  dispose(): void;
  onEnded: (() => void) | null;
  onFault: ((fault: PlaybackFault) => void) | null;
}

interface Resolved {
  key: string;
  url: string;
  cors: boolean;
}

abstract class ElementPlayback implements Playback {
  abstract readonly kind: AudioSource["kind"];
  onEnded: (() => void) | null = null;
  onFault: ((fault: PlaybackFault) => void) | null = null;

  protected el: HTMLAudioElement;
  private node: MediaElementAudioSourceNode | null = null;
  private key = "";
  private wantPlay = false;
  private disposed = false;

  constructor() {
    this.el = new Audio();
    this.el.preload = "auto";
    this.el.addEventListener("ended", () => this.onEnded?.());
    this.el.addEventListener("error", () => this.fail("source"));
  }

  protected abstract resolve(source: AudioSource): Resolved | null;

  private fail(fault: PlaybackFault) {
    if (this.disposed || !this.el.getAttribute("src")) return;
    this.wantPlay = false;
    this.onFault?.(fault);
  }

  load(source: AudioSource) {
    const resolved = this.resolve(source);
    if (!resolved) return;
    if (this.key === resolved.key) return;
    this.key = resolved.key;
    if (resolved.cors) this.el.crossOrigin = "anonymous";
    else this.el.removeAttribute("crossorigin");
    this.el.src = resolved.url;
    this.el.currentTime = 0;
  }

  async play() {
    this.wantPlay = true;
    try {
      await this.el.play();
    } catch (e) {
      this.wantPlay = false;
      const name = (e as Error | undefined)?.name ?? "";
      this.onFault?.(name === "NotAllowedError" ? "blocked" : "source");
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

  setVolume(value: number) {
    this.el.volume = clamp(value, 0, 1);
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
    this.disposed = true;
    this.el.pause();
    this.el.removeAttribute("src");
    this.el.load();
    this.node?.disconnect();
    this.node = null;
  }
}

export class LocalPlayback extends ElementPlayback {
  readonly kind = "local" as const;

  protected resolve(source: AudioSource): Resolved | null {
    if (source.kind !== "local") return null;
    const url = mediaUrl(source.src);
    return { key: source.src, url, cors: needsCors(url) };
  }
}

export class FilePlayback extends ElementPlayback {
  readonly kind = "file" as const;

  protected resolve(source: AudioSource): Resolved | null {
    if (source.kind !== "file") return null;
    return { key: source.url, url: source.url, cors: false };
  }
}
