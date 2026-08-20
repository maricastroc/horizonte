type Listener = (e: unknown) => void;

export interface FakeWindow {
  dispatch(kind: string, event?: Record<string, unknown>): void;
  setMotion(matches: boolean): void;
  registered(): number;
  restore(): void;
}

export function fakeWindow({
  innerWidth = 1000,
  innerHeight = 800,
  reduced = false,
  coarse = false,
}: { innerWidth?: number; innerHeight?: number; reduced?: boolean; coarse?: boolean } = {}) {
  const byType = new Map<string, Set<Listener>>();
  const motion = new Set<Listener>();

  const win = {
    innerWidth,
    innerHeight,
    addEventListener(kind: string, fn: Listener) {
      const s = byType.get(kind) ?? new Set();
      s.add(fn);
      byType.set(kind, s);
    },
    removeEventListener(kind: string, fn: Listener) {
      byType.get(kind)?.delete(fn);
    },
    matchMedia(query: string) {
      return {
        matches: query.includes("reduced-motion") ? reduced : coarse,
        addEventListener: (_t: string, fn: Listener) => motion.add(fn),
        removeEventListener: (_t: string, fn: Listener) => motion.delete(fn),
      };
    },
  };

  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = win;

  const handle: FakeWindow = {
    dispatch(kind, event = {}) {
      const e = { preventDefault: () => {}, target: null, ...event };
      for (const fn of byType.get(kind) ?? []) fn(e);
    },
    setMotion(matches) {
      for (const fn of motion) fn({ matches });
    },
    registered() {
      let n = 0;
      for (const s of byType.values()) n += s.size;
      return n + motion.size;
    },
    restore() {
      (globalThis as { window?: unknown }).window = previous;
    },
  };
  return handle;
}

export interface Call {
  label: string;
  args: unknown[];
}

export function recorder() {
  const calls: Call[] = [];
  const names = [
    "markIntent", "resize", "setReducedMotion", "pointTo", "teleportTo",
    "beginPan", "panBy", "endPan", "wheelBy", "primary", "back", "stepFocus",
  ] as const;

  const actions = Object.fromEntries(
    names.map((n) => [n, (...args: unknown[]) => calls.push({ label: n, args })]),
  ) as unknown as Record<(typeof names)[number], (...a: unknown[]) => void>;

  return {
    actions,
    calls,
    calledNames: () => calls.map((c) => c.label),
    last: (label: string) => [...calls].reverse().find((c) => c.label === label),
    count: (label: string) => calls.filter((c) => c.label === label).length,
    clear: () => calls.splice(0, calls.length),
  };
}

export interface FakeAnalyser {
  fftSize: number;
  smoothingTimeConstant: number;
  readonly frequencyBinCount: number;
  getByteFrequencyData(target: Uint8Array): void;
  getByteTimeDomainData(target: Uint8Array): void;
  connect(): void;
  spectrum: Uint8Array;
  wave: Uint8Array;
}

export function fakeContext(sampleRate = 44100) {
  const analyser: FakeAnalyser = {
    fftSize: 2048,
    smoothingTimeConstant: 0,
    get frequencyBinCount() {
      return analyser.fftSize / 2;
    },
    spectrum: new Uint8Array(512),
    wave: new Uint8Array(1024),
    getByteFrequencyData(target) {
      target.set(analyser.spectrum.subarray(0, target.length));
    },
    getByteTimeDomainData(target) {
      target.set(analyser.wave.subarray(0, target.length));
    },
    connect() {},
  };
  const ctx = {
    sampleRate,
    currentTime: 0,
    createAnalyser: () => analyser,
    createGain: () => ({
      gain: { value: 1, setTargetAtTime() {} },
      connect() {},
      disconnect() {},
    }),
    destination: {},
  };
  return { ctx: ctx as unknown as AudioContext, analyser };
}

export function sineTrack(amplitude: number, size = 1024): Uint8Array {
  const wave = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    wave[i] = Math.round(128 + Math.sin((i / size) * Math.PI * 2 * 8) * 127 * amplitude);
  }
  return wave;
}

export interface FakeAudio {
  preload: string;
  crossOrigin: string | null;
  volume: number;
  src: string;
  currentTime: number;
  duration: number;
  paused: boolean;
  failOnPlay: boolean;
  loaded: number;
  addEventListener(kind: string, fn: () => void): void;
  removeAttribute(label: string): void;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  getAttribute(name: string): string | null;
  emit(kind: string): void;
}

export function audioEnv() {
  const created: FakeAudio[] = [];
  const connections: { origin: FakeAudio; destino: unknown }[] = [];

  function newAudio(): FakeAudio {
    const listeners = new Map<string, Set<() => void>>();
    const el: FakeAudio = {
      preload: "",
      crossOrigin: null,
      volume: 1,
      src: "",
      currentTime: 0,
      duration: NaN,
      paused: true,
      failOnPlay: false,
      loaded: 0,
      addEventListener(kind, fn) {
        const s = listeners.get(kind) ?? new Set();
        s.add(fn);
        listeners.set(kind, s);
      },
      removeAttribute(label) {
        if (label === "crossorigin") el.crossOrigin = null;
        if (label === "src") el.src = "";
      },
      async play() {
        if (el.failOnPlay) throw new Error("bloqueado");
        el.paused = false;
      },
      pause() {
        el.paused = true;
      },
      load() {
        el.loaded++;
      },
      getAttribute(name) {
        return name === "src" ? el.src || null : null;
      },
      emit(kind) {
        for (const fn of listeners.get(kind) ?? []) fn();
      },
    };
    created.push(el);
    return el;
  }

  const analyserOut: unknown[] = [];
  const analyser = {
    fftSize: 2048,
    smoothingTimeConstant: 0,
    get frequencyBinCount() {
      return analyser.fftSize / 2;
    },
    getByteFrequencyData(a: Uint8Array) {
      a.fill(0);
    },
    getByteTimeDomainData(a: Uint8Array) {
      a.fill(128);
    },
    connect(destino: unknown) {
      analyserOut.push(destino);
    },
  };

  let closedList = 0;
  const gains: { gain: { value: number }; out: unknown[] }[] = [];
  class FakeContext {
    sampleRate = 44100;
    state = "running";
    currentTime = 0;
    destination = { label: "saida" };
    createAnalyser() {
      return analyser;
    }
    createGain() {
      const saidas: unknown[] = [];
      const node = {
        gain: {
          value: 1,
          setTargetAtTime(v: number) {
            node.gain.value = v;
          },
        },
        out: saidas,
        connect: (destino: unknown) => saidas.push(destino),
        disconnect: () => {},
      };
      gains.push(node);
      return node;
    }
    createMediaElementSource(el: FakeAudio) {
      return {
        connect: (destino: unknown) => connections.push({ origin: el, destino }),
        disconnect: () => {},
      };
    }
    resume() {}
    close() {
      closedList++;
    }
  }

  const previousWindow = (globalThis as Record<string, unknown>).window;
  const previousAudio = (globalThis as Record<string, unknown>).Audio;
  (globalThis as Record<string, unknown>).window = { AudioContext: FakeContext };
  (globalThis as Record<string, unknown>).Audio = newAudio;

  return {
    created,
    connections,
    analyser,
    analyserOut,
    gains,
    closedContexts: () => closedList,
    restore() {
      (globalThis as Record<string, unknown>).window = previousWindow;
      (globalThis as Record<string, unknown>).Audio = previousAudio;
    },
  };
}

export interface PaintContext {
  calls: string[];
  props: Record<string, unknown>;
  sources: string[];
  textWidth: number;
  ctx: CanvasRenderingContext2D;
}

export function paintContext(textWidth = 10): PaintContext {
  const record: PaintContext = {
    calls: [],
    props: {},
    sources: [],
    textWidth,
    ctx: null as unknown as CanvasRenderingContext2D,
  };

  const gradient = { addColorStop: () => {} };

  const target: Record<string, unknown> = {
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    measureText: () => ({ width: record.textWidth }),
    getImageData: () => ({ data: new Uint8ClampedArray(48 * 48 * 4) }),
  };

  record.ctx = new Proxy(target, {
    get(base, key: string) {
      if (key in base) {
        const v = base[key];
        if (typeof v === "function") {
          return (...args: unknown[]) => {
            record.calls.push(key);
            return (v as (...a: unknown[]) => unknown)(...args);
          };
        }
        return v;
      }
      if (key in record.props) return record.props[key];
      return (...args: unknown[]) => {
        record.calls.push(key);
        void args;
      };
    },
    set(_base, key: string, value) {
      record.props[key] = value;
      if (key === "font") record.sources.push(String(value));
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return record;
}

function fakeScreen() {
  const painting = paintContext();
  return {
    width: 0,
    height: 0,
    getContext: () => painting.ctx,
  };
}

export interface EngineHarness {
  fire(kind: string, event?: Record<string, unknown>): void;
  setMotion(matches: boolean): void;
  advance(ms?: number): void;
  frames(): number;
  now(): number;
  resize(w: number, h: number): void;
  images: { src: string; onload: (() => void) | null; onerror: (() => void) | null }[];
  audios: FakeAudio[];
  restore(): void;
}

export function engineHarness({
  innerWidth = 1280,
  innerHeight = 800,
  reduced = false,
  coarse = false,
}: {
  innerWidth?: number;
  innerHeight?: number;
  reduced?: boolean;
  coarse?: boolean;
} = {}): EngineHarness {
  const previous: Record<string, unknown> = {};
  const g = globalThis as Record<string, unknown>;
  for (const k of ["document", "window", "Image", "Audio", "requestAnimationFrame", "cancelAnimationFrame"]) {
    previous[k] = g[k];
  }

  const images: EngineHarness["images"] = [];
  const audios: FakeAudio[] = [];
  const audio = audioEnv();
  const audioWindow = (globalThis as { window?: { AudioContext?: unknown } }).window;

  let pending: ((t: number) => void) | null = null;
  let nextId = 1;
  let t = 10_000;
  let counted = 0;

  const listeners = new Map<string, Set<(e: unknown) => void>>();
  const motion = new Set<(e: unknown) => void>();

  const win = {
    innerWidth,
    innerHeight,
    devicePixelRatio: 1,
    AudioContext: audioWindow?.AudioContext,
    matchMedia: (query: string) => ({
      matches: query.includes("reduced-motion")
        ? reduced
        : query.includes("pointer: coarse")
          ? coarse
          : false,
      media: query,
      addEventListener: (_t: string, fn: (e: unknown) => void) => motion.add(fn),
      removeEventListener: (_t: string, fn: (e: unknown) => void) => motion.delete(fn),
    }),
    addEventListener(kind: string, fn: (e: unknown) => void) {
      const s = listeners.get(kind) ?? new Set();
      s.add(fn);
      listeners.set(kind, s);
    },
    removeEventListener(kind: string, fn: (e: unknown) => void) {
      listeners.get(kind)?.delete(fn);
    },
  };

  g.document = {
    visibilityState: "visible",
    createElement: (tag: string) => (tag === "canvas" ? fakeScreen() : {}),
  };
  g.window = win;
  g.Image = function FakeImage(this: Record<string, unknown>) {
    const img = { src: "", decoding: "", crossOrigin: "", onload: null, onerror: null };
    images.push(img as EngineHarness["images"][number]);
    return img;
  };
  g.requestAnimationFrame = (cb: (t: number) => void) => {
    pending = cb;
    return nextId++;
  };
  g.cancelAnimationFrame = () => {
    pending = null;
  };

  return {
    fire(kind, event = {}) {
      const e = { preventDefault: () => {}, target: null, ...event };
      for (const fn of listeners.get(kind) ?? []) fn(e);
    },
    setMotion(matches) {
      for (const fn of motion) fn({ matches });
    },
    advance(ms = 16) {
      t += ms;
      counted++;
      const cb = pending;
      pending = null;
      cb?.(t);
    },
    frames: () => counted,
    now: () => t,
    resize(w, h) {
      win.innerWidth = w;
      win.innerHeight = h;
    },
    images,
    audios,
    restore() {
      audio.restore();
      for (const [k, v] of Object.entries(previous)) {
        if (v === undefined) delete g[k];
        else g[k] = v;
      }
    },
  };
}
