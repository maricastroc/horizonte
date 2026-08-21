import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AudioBus } from "../audio/bus";
import { LocalPlayback } from "../audio/playback";
import { NEUTRAL_SIGNATURE } from "../content/signature";
import type { AudioSource, Track } from "../content/types";
import { audioEnv } from "./fakes";

const unknown = { kind: "stream", uri: "x" } as unknown as AudioSource;

let env: ReturnType<typeof audioEnv>;

const track = (id: string, src: string, dur = 100): Track => ({
  id,
  title: id,
  dur,
  source: { kind: "local", src, mime: "audio/mp4" },
});

beforeEach(() => {
  env = audioEnv();
});

afterEach(() => {
  env.restore();
});

describe("LocalPlayback", () => {
  it("prepares the element to play without waiting", () => {
    new LocalPlayback();
    expect(env.created[0].preload).toBe("auto");
  });

  it("loads the track and rewinds to the start", () => {
    const p = new LocalPlayback();
    const el = env.created[0];
    el.currentTime = 42;
    p.load({ kind: "local", src: "/music/a/01.m4a" });

    expect(el.src).toBe("/music/a/01.m4a");
    expect(el.currentTime).toBe(0);
  });

  it("reloading the same track does not rewind it", () => {
    const p = new LocalPlayback();
    const el = env.created[0];
    p.load({ kind: "local", src: "/music/a/01.m4a" });
    el.currentTime = 42;
    p.load({ kind: "local", src: "/music/a/01.m4a" });

    expect(el.currentTime).toBe(42);
  });

  it("ignores sources that are not local", () => {
    const p = new LocalPlayback();
    p.load(unknown);
    expect(env.created[0].src).toBe("");
  });

  it("only requests CORS when the media is remote", () => {
    const p = new LocalPlayback();
    const el = env.created[0];
    p.load({ kind: "local", src: "/music/a/01.m4a" });
    expect(el.crossOrigin).toBe(null);

    p.load({ kind: "local", src: "https://cdn.exemplo/a/02.m4a" });
    expect(el.crossOrigin).toBe("anonymous");
  });

  it("play and pause follow the element", async () => {
    const p = new LocalPlayback();
    const el = env.created[0];
    await p.play();
    expect(p.playing).toBe(true);
    expect(el.paused).toBe(false);

    p.pause();
    expect(p.playing).toBe(false);
    expect(el.paused).toBe(true);
  });

  it("playback blocked by the browser does not get stuck in playing", async () => {
    const p = new LocalPlayback();
    env.created[0].failOnPlay = true;
    await p.play();
    expect(p.playing).toBe(false);
  });

  it("position and duration ignore non-finite values", () => {
    const p = new LocalPlayback();
    const el = env.created[0];
    expect(p.duration).toBe(0);

    el.currentTime = NaN;
    expect(p.position).toBe(0);

    el.duration = Infinity;
    expect(p.duration).toBe(0);

    el.duration = 180;
    el.currentTime = 12;
    expect(p.duration).toBe(180);
    expect(p.position).toBe(12);
  });

  it("seeking with no known duration does not touch the element", () => {
    const p = new LocalPlayback();
    const el = env.created[0];
    el.currentTime = 5;
    p.seek(90);
    expect(el.currentTime).toBe(5);
  });

  it("seeking respects the track's bounds", () => {
    const p = new LocalPlayback();
    const el = env.created[0];
    el.duration = 180;

    p.seek(-10);
    expect(el.currentTime).toBe(0);

    p.seek(90);
    expect(el.currentTime).toBe(90);

    p.seek(9999);
    expect(el.currentTime).toBeCloseTo(179.95, 5);
  });

  it("reports when the track ends", () => {
    const p = new LocalPlayback();
    let end = 0;
    p.onEnded = () => end++;
    env.created[0].emit("ended");
    expect(end).toBe(1);
  });

  it("disposing releases the element", () => {
    const p = new LocalPlayback();
    const el = env.created[0];
    p.load({ kind: "local", src: "/music/a/01.m4a" });
    p.dispose();

    expect(el.paused).toBe(true);
    expect(el.src).toBe("");
    expect(el.loaded).toBe(1);
  });
});

describe("AudioBus", () => {
  it("does not build the audio graph before the first play", () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    expect(env.connections).toHaveLength(0);
  });

  it("connects the element to the analyser on play", async () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();

    expect(env.connections).toHaveLength(1);
    expect(bus.playing).toBe(true);
  });

  it("reuses the same player across tracks of the same type", async () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    bus.load(track("b", "/music/a/02.m4a"));

    expect(env.created).toHaveLength(1);
    expect(env.created[0].src).toBe("/music/a/02.m4a");
  });

  it("ignores a source with no available player", () => {
    const bus = new AudioBus();
    bus.load({ id: "s", title: "s", dur: 10, source: unknown });
    expect(env.created).toHaveLength(0);
    expect(bus.playing).toBe(false);
  });

  it("forwards the track's end", async () => {
    const bus = new AudioBus();
    let end = 0;
    bus.onEnded = () => end++;
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();
    env.created[0].emit("ended");

    expect(end).toBe(1);
  });

  it("the signature chosen before the graph is applied when it is born", async () => {
    const bus = new AudioBus();
    bus.setSignature(NEUTRAL_SIGNATURE);
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();

    expect(() => bus.update(0.05)).not.toThrow();
  });

  it("the visual state follows the element's position and duration", async () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();
    env.created[0].duration = 200;
    env.created[0].currentTime = 50;

    const s = bus.update(0.05);
    expect(s.position).toBe(50);
    expect(s.duration).toBe(200);
    expect(s.playing).toBe(true);
  });

  it("always returns the same state object", () => {
    const bus = new AudioBus();
    expect(bus.update(0.05)).toBe(bus.update(0.05));
  });

  it("with no graph, the state is still readable and zeroed", () => {
    const bus = new AudioBus();
    const s = bus.update(0.05);
    expect(s.position).toBe(0);
    expect(s.duration).toBe(0);
    expect(s.playing).toBe(false);
    expect(s.energy).toBe(0);
  });

  it("disposing closes the context and releases the players", async () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();
    bus.dispose();

    expect(env.closedContexts()).toBe(1);
    expect(env.created[0].paused).toBe(true);
    expect(bus.playing).toBe(false);
  });

  it("seeking with no loaded track does not break", () => {
    const bus = new AudioBus();
    expect(() => bus.seek(30)).not.toThrow();
    expect(bus.position).toBe(0);
  });
});

describe("volume — the gain sits after the analyser", () => {
  it("the graph is element → analyser → gain → output", async () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();

    const gain = env.gains[0];
    expect(gain).toBeDefined();
    expect(env.connections.map((c) => c.destino)).toContain(env.analyser);
    expect(env.analyserOut).toContain(gain);
    expect(gain.out).toHaveLength(1);
  });

  it("lowering the volume does not change what the analyser sees", async () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();
    const before = env.analyser.fftSize;

    bus.setVolume(0.2);
    expect(env.gains[0].gain.value).toBeCloseTo(0.2, 5);
    expect(env.created[0].volume).toBe(1);
    expect(env.analyser.fftSize).toBe(before);
  });

  it("muting zeroes the gain without forgetting the chosen level", async () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();

    bus.setVolume(0.6);
    bus.setMuted(true);
    expect(env.gains[0].gain.value).toBe(0);
    expect(bus.volume).toBeCloseTo(0.6, 5);
    expect(bus.muted).toBe(true);

    bus.setMuted(false);
    expect(env.gains[0].gain.value).toBeCloseTo(0.6, 5);
  });

  it("the level chosen before the graph is applied when it is born", async () => {
    const bus = new AudioBus();
    bus.setVolume(0.35);
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();
    expect(env.gains[0].gain.value).toBeCloseTo(0.35, 5);
  });
});

describe("playback fault", () => {
  it("a file error is announced, not swallowed", async () => {
    const bus = new AudioBus();
    const faults: string[] = [];
    bus.onFault = (f) => faults.push(f);
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();

    env.created[0].emit("error");
    expect(faults).toEqual(["source"]);
    expect(bus.playing).toBe(false);
  });

  it("the browser's refusal is distinguished from a broken file", async () => {
    const bus = new AudioBus();
    const faults: string[] = [];
    bus.onFault = (f) => faults.push(f);
    bus.load(track("a", "/music/a/01.m4a"));

    const el = env.created[0];
    el.play = async () => {
      const e = new Error("no");
      e.name = "NotAllowedError";
      throw e;
    };
    await bus.play();
    expect(faults).toEqual(["blocked"]);
  });

  it("disposing the player does not invent a fault", async () => {
    const bus = new AudioBus();
    const faults: string[] = [];
    bus.onFault = (f) => faults.push(f);
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();

    bus.dispose();
    env.created[0].emit("error");
    expect(faults).toEqual([]);
  });
});
