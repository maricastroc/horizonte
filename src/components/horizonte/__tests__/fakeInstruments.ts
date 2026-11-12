import { FULL_BANDS } from "../composition/bands";
import type { FrameOut } from "../engine/frame";
import type { FieldEngine } from "../engine/FieldEngine";
import type { Snapshot } from "../types";

export const BASE: Snapshot = {
  scale: "collection",
  bands: FULL_BANDS,
  mode: "stopped",
  alb: 0,
  navAlb: 0,
  sel: 0,
  trk: 0,
  playAlb: -1,
  hoverTrk: -1,
  hoverAlb: -1,
  idle: false,
  hint: null,
  hintDir: 1,
  variant: "desktop",
  fault: null,
  focus: null,
  compare: false,
  peek: false,
  invite: null,
};

export function fakeEngine(initial: Partial<Snapshot> = {}) {
  let snap: Snapshot = { ...BASE, ...initial };
  const subscribers = new Set<() => void>();
  let sink: ((f: FrameOut) => void) | null = null;
  const frame: FrameOut = { progress: 0, position: 0, duration: 0 };
  const calls: { label: string; args: unknown[] }[] = [];

  const register =
    (label: string) =>
    (...args: unknown[]) => {
      calls.push({ label, args });
    };

  const engine = {
    subscribe: (fn: () => void) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    getSnapshot: () => snap,
    onFrame: (fn: (f: FrameOut) => void) => {
      sink = fn;
      return () => {
        sink = null;
      };
    },
    markIntent: register("markIntent"),
    goScale: register("goScale"),
    enterAlbum: register("enterAlbum"),
    playTrack: register("playTrack"),
    setRailAlb: register("setRailAlb"),
    setIntake: register("setIntake"),
    setRailTrk: register("setRailTrk"),
    skip: register("skip"),
    transport: register("transport"),
    back: register("back"),
    seekFraction: register("seekFraction"),
    setVolume: register("setVolume"),
    setMuted: register("setMuted"),
    openAnatomy: register("openAnatomy"),
    closeAnatomy: register("closeAnatomy"),
    setAnatomyFocus: register("setAnatomyFocus"),
    previewAnatomy: register("previewAnatomy"),
    setCompare: register("setCompare"),
    volume: 1,
    muted: false,
    frameOut: frame,
  };

  return {
    engine: engine as unknown as FieldEngine,
    calls,
    last: (label: string) => [...calls].reverse().find((c) => c.label === label),
    update(partial: Partial<Snapshot>) {
      snap = { ...snap, ...partial };
      for (const fn of subscribers) fn();
    },
    frame(f: FrameOut) {
      Object.assign(frame, f);
      sink?.(f);
    },
    hasFrame: () => sink !== null,
  };
}
