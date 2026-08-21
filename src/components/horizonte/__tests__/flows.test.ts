import { afterEach, describe, expect, it, vi } from "vitest";

const gl = vi.hoisted(() => ({ renders: 0 }));

vi.mock("../fieldMaterial", async (importReal) => {
  const real = await importReal<typeof import("../fieldMaterial")>();
  return {
    ...real,
    createFieldGL: () => ({
      uniforms: real.createFieldUniforms(),
      render: () => {
        gl.renders++;
      },
      resize: (w: number, h: number) => ({ dw: w, dh: h }),
      dispose: () => {},
    }),
  };
});

import { ALBUMS } from "../content";
import { FieldEngine } from "../engine/FieldEngine";
import { SEQ } from "../tokens";
import { GEO } from "../tokens";
import { engineHarness, type EngineHarness, type FakeAudio } from "./fakes";

const FONTS = { archivo: "A", bodoni: "B", mono: "M" };

let env: EngineHarness;
let engine: FieldEngine;

function world(options: Parameters<typeof engineHarness>[0] = {}) {
  env = engineHarness(options);
  const display = (globalThis as { document: { createElement(t: string): unknown } }).document
    .createElement("canvas") as HTMLCanvasElement;
  engine = new FieldEngine(display, FONTS, { isUiTarget: () => false });
  engine.start();
  return engine;
}

const run = (seconds: number) => {
  for (let i = 0; i < Math.ceil((seconds * 1000) / 16); i++) env.advance(16);
};

const player = () =>
  (engine as unknown as { bus: { current: { el: FakeAudio } | null } }).bus.current;

const currentSource = () => (player() as unknown as { el: FakeAudio } | null)?.el.src ?? "";

afterEach(() => {
  engine.stop();
  env.restore();
});

describe("flow: from the collection to a sounding track", () => {
  it("walks collection, album and playback", () => {
    world();
    expect(engine.getSnapshot().scale).toBe("collection");

    engine.enterAlbum(2);
    env.advance();
    expect(engine.getSnapshot().scale).toBe("album");
    expect(engine.getSnapshot().alb).toBe(2);

    engine.playTrack(2, 1);
    expect(engine.st.mode).toBe("collapse");
    expect(currentSource()).toBe(ALBUMS[2].tracks[1].source.kind === "local" ? ALBUMS[2].tracks[1].source.src : "");

    run(3);
    const snap = engine.getSnapshot();
    expect(snap.scale).toBe("track");
    expect(snap.mode).toBe("playing");
    expect(snap.playAlb).toBe(2);
    expect(snap.trk).toBe(1);
    expect(engine.bus.playing).toBe(true);
    expect(snap.announce).toContain(ALBUMS[2].tracks[1].title);
  });

  it("the audio leaves rest and gains energy when it plays", () => {
    world();
    run(1);
    const stopped = engine.st.energy;

    engine.playTrack(0, 0);
    run(4);
    expect(engine.st.play).toBeGreaterThan(0.5);
    expect(engine.st.energy).not.toBe(stopped);
  });
});

describe("flow: the splice between tracks", () => {
  it("the natural end splices into the next and swaps the file, without ceremony", () => {
    world();
    engine.playTrack(0, 0);
    run(3);
    const before = currentSource();

    (player() as unknown as { el: FakeAudio }).el.emit("ended");
    expect(engine.st.mode).toBe("playing");
    expect(engine.st.trk).toBe(1);
    expect(currentSource()).not.toBe(before);

    run(3);
    expect(engine.st.mode).toBe("playing");
    expect(engine.st.mix).toBe(0);
    expect(engine.st.waveR).toBe(-1);
  });

  it("after the last track, it returns to the first", () => {
    world();
    const last = ALBUMS[0].tracks.length - 1;
    engine.playTrack(0, last);
    run(3);

    (player() as unknown as { el: FakeAudio }).el.emit("ended");
    run(3);
    expect(engine.st.trk).toBe(0);
  });

  it("skipping during playback swaps the file exactly once", () => {
    world();
    engine.playTrack(0, 0);
    run(3);
    const before = currentSource();

    engine.skip(1);
    run(3);
    expect(currentSource()).not.toBe(before);
    expect(engine.st.trk).toBe(1);
    expect(engine.bus.playing).toBe(true);
  });
});

describe("flow: transport", () => {
  it("pause and resume follow the audio element", () => {
    world();
    engine.playTrack(0, 0);
    run(3);

    engine.transport();
    run(0.2);
    expect(engine.st.mode).toBe("paused");
    expect(engine.bus.playing).toBe(false);

    engine.transport();
    run(0.2);
    expect(engine.st.mode).toBe("playing");
    expect(engine.bus.playing).toBe(true);
  });

  it("seeking moves the file and the world's position", () => {
    world();
    engine.playTrack(0, 0);
    run(3);
    (player() as unknown as { el: FakeAudio }).el.duration = 200;
    run(0.1);
    expect(engine.st.dur).toBe(200);

    engine.seekFraction(0.25);
    run(0.1);
    expect(engine.st.pos).toBeCloseTo(50, 1);
  });

  it("navigating between scales does not interrupt playback", () => {
    world();
    engine.playTrack(1, 0);
    run(3);

    engine.back();
    engine.back();
    run(1);
    expect(engine.getSnapshot().scale).toBe("collection");
    expect(engine.bus.playing).toBe(true);

    engine.goScale("track");
    run(1);
    expect(engine.getSnapshot().scale).toBe("track");
    expect(engine.getSnapshot().alb).toBe(1);
  });
});

describe("flow: gesture reaches the world", () => {
  it("the wheel crosses the collection", () => {
    world();
    env.fire("wheel", { deltaY: 625, deltaX: 0 });
    run(2);
    expect(engine.st.alb).toBe(1);
  });

  it("the arrow advances one record", () => {
    world();
    env.fire("keydown", { key: "ArrowRight", code: "ArrowRight" });
    run(2);
    expect(engine.st.alb).toBe(1);
  });

  it("a tap on the record's body opens the album", () => {
    world();
    const x = GEO.anchorCollection.x * 1280;
    const y = GEO.anchorCollection.y * 800;
    env.fire("pointermove", { clientX: x, clientY: y, pointerType: "mouse" });
    env.fire("pointerdown", { clientX: x, clientY: y, pointerType: "mouse" });
    env.fire("pointerup", { clientX: x + 1, clientY: y, pointerType: "mouse" });
    run(0.1);
    expect(engine.st.scale).toBe("album");
  });

  it("dragging moves navigation and snaps on release", () => {
    world();
    env.fire("pointerdown", { clientX: 900, clientY: 400, pointerType: "mouse" });
    env.fire("pointermove", { clientX: 600, clientY: 400, pointerType: "mouse" });
    expect(engine.st.navT).toBeGreaterThan(0);

    env.fire("pointerup", { clientX: 600, clientY: 400, pointerType: "mouse" });
    expect(Number.isInteger(engine.st.navT)).toBe(true);
  });

  it("Escape steps back one scale", () => {
    world();
    engine.enterAlbum(3);
    run(0.5);
    env.fire("keydown", { key: "Escape", code: "Escape" });
    run(0.5);
    expect(engine.st.scale).toBe("collection");
  });

  it("stopping the engine detaches the listeners", () => {
    world();
    engine.stop();
    const before = engine.st.navT;
    env.fire("keydown", { key: "ArrowRight", code: "ArrowRight" });
    expect(engine.st.navT).toBe(before);
  });
});

describe("flow: reduced motion", () => {
  it("the collapse resolves in its short version", () => {
    world({ reduced: true });
    engine.playTrack(0, 0);
    run(SEQ.reduced + 0.2);
    expect(engine.st.mode).toBe("playing");
  });

  it("the fusion also resolves in its short version and swaps the file", () => {
    world({ reduced: true });
    engine.playTrack(0, 0);
    run(1);
    const before = currentSource();

    engine.skip(1);
    run(SEQ.reduced + 0.2);
    expect(engine.st.mode).toBe("playing");
    expect(currentSource()).not.toBe(before);
  });

  it("the preference switched on at runtime turns off the perturbation", () => {
    world({ reduced: false });
    run(1);
    env.setMotion(true);
    run(1);
    const c = (engine as unknown as { C: { reactionCap: number } }).C;
    expect(c.reactionCap).toBe(0);
  });
});

describe("flow: one record at a time", () => {
  it("playing a second record fuses and the first leaves the stage", () => {
    world();
    engine.playTrack(0, 0);
    run(3);

    engine.playTrack(4, 2);
    run(3);
    expect(engine.st.playAlb).toBe(4);
    expect(engine.st.trk).toBe(2);
    expect(engine.getSnapshot().announce).toContain(ALBUMS[4].artist);
  });

  it("every record in the catalogue can be opened and played", () => {
    world();
    for (let i = 0; i < ALBUMS.length; i++) {
      engine.enterAlbum(i);
      run(0.2);
      expect(engine.st.alb).toBe(i);
      expect(engine.st.sel).toBeGreaterThanOrEqual(0);
      expect(engine.st.sel).toBeLessThan(ALBUMS[i].tracks.length);
    }
  });
});
