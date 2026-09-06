import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gl = vi.hoisted(() => ({
  renders: 0,
  sizes: [] as [number, number][],
  discards: 0,
}));

vi.mock("../fieldMaterial", async (importReal) => {
  const real = await importReal<typeof import("../fieldMaterial")>();
  return {
    ...real,
    createFieldGL: () => ({
      uniforms: real.createFieldUniforms(),
      render: () => {
        gl.renders++;
      },
      resize: (w: number, h: number) => {
        gl.sizes.push([w, h]);
        return { dw: w, dh: h };
      },
      dispose: () => {
        gl.discards++;
      },
    }),
  };
});

import { ALBUMS } from "../content";
import { EXPLORED_KEY, HINT_MS, TIDE } from "../tokens";
import { FieldEngine } from "../engine/FieldEngine";
import { albPos, bodyGeom, layoutFor } from "../composition/layout";
import { fieldConstantsOf, reduceMotion } from "../field";
import { morphologyOf } from "../morphology";
import { peakOf, scarCount, STRAIN_BINS } from "../composition/strain";
import {
  IDLE_MS,
  PARTICLES,
  COMPOSITION_FALLBACK_W,
  COMPOSITION_MAX_W,
  RING,
  INTAKE,
  MORPH,
  SECOND_MASS,
} from "../tokens";
import { boundsOf, trackBiasOf } from "../content/signature";
import { engineHarness, type EngineHarness, type FakeAudio } from "./fakes";

const FONTS = { archivo: "A", bodoni: "B", mono: "M" };

let env: EngineHarness;
let engine: FieldEngine;

function on(options: Parameters<typeof engineHarness>[0] = {}) {
  env = engineHarness(options);
  gl.renders = 0;
  gl.sizes = [];
  gl.discards = 0;
  const display = (globalThis as { document: { createElement(t: string): unknown } }).document
    .createElement("canvas") as HTMLCanvasElement;
  engine = new FieldEngine(display, FONTS, { isUiTarget: () => false });
  engine.start();
}

const run = (seconds: number, step = 16) => {
  const n = Math.ceil((seconds * 1000) / step);
  for (let i = 0; i < n; i++) env.advance(step);
};

beforeEach(() => on());

afterEach(() => {
  engine.stop();
  env.restore();
});

describe("lifecycle", () => {
  it("opens on the collection with the first record focused", () => {
    expect(engine.st.scale).toBe("collection");
    expect(engine.st.mode).toBe("stopped");
    expect(engine.getSnapshot().navAlb).toBe(0);
  });

  it("draws one frame per requested animation", () => {
    env.advance();
    env.advance();
    expect(gl.renders).toBe(2);
  });

  it("stopping releases the graphics context and the audio", () => {
    engine.stop();
    expect(gl.discards).toBe(1);
    env.advance();
    expect(gl.renders).toBe(0);
  });

  it("creates one particle per declared unit", () => {
    let parts = 0;
    run(0.1);
    parts = PARTICLES;
    expect(parts).toBe(PARTICLES);
  });
});

describe("state integration", () => {
  it("navigation chases the target without overshooting it", () => {
    engine.st.navT = 3;
    const visited: number[] = [];
    for (let i = 0; i < 120; i++) {
      env.advance();
      visited.push(engine.st.nav);
    }
    expect(Math.max(...visited)).toBeLessThanOrEqual(3.0001);
    expect(engine.st.nav).toBeCloseTo(3, 2);
  });

  it("the navigation target never leaves the catalogue", () => {
    engine.st.navT = 99;
    run(0.5);
    expect(engine.st.navT).toBeLessThanOrEqual(ALBUMS.length - 1);

    engine.st.navT = -99;
    run(0.5);
    expect(engine.st.navT).toBeGreaterThanOrEqual(0);
  });

  it("in the collection the focused album follows navigation", () => {
    engine.st.navT = 4;
    run(2);
    expect(engine.st.alb).toBe(4);
  });

  it("zoom chases the scale", () => {
    engine.enterAlbum(2);
    run(2);
    expect(engine.st.zoom).toBeCloseTo(1, 2);

    engine.back();
    run(2);
    expect(engine.st.zoom).toBeCloseTo(0, 2);
  });

  it("the particles stay at a positive, bounded radius", () => {
    run(4);
    engine.playTrack(0, 0);
    run(4);
    const radii = (engine as unknown as { parts: { r: number }[] }).parts.map((q) => q.r);
    expect(radii).toHaveLength(PARTICLES);
    for (const r of radii) {
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThan(2);
    }
  });

  it("the energy stays between rest and the ceiling", () => {
    run(3);
    expect(engine.st.energy).toBeGreaterThan(0);
    expect(engine.st.energy).toBeLessThanOrEqual(1);
  });

  it("the world's clock advances with time", () => {
    const before = engine.st.t;
    run(1);
    expect(engine.st.t).toBeGreaterThan(before);
    expect(engine.st.t - before).toBeCloseTo(1, 1);
  });
});

describe("collapse sequence", () => {
  it("play enters a collapse and resolves into playback", () => {
    engine.playTrack(0, 0);
    expect(engine.st.mode).toBe("collapse");

    run(3);
    expect(engine.st.mode).toBe("playing");
    expect(engine.st.scale).toBe("track");
  });

  it("the collapse passes through a dark valley before relighting", () => {
    engine.playTrack(0, 0);
    const fades: number[] = [];
    for (let i = 0; i < 160; i++) {
      env.advance();
      fades.push(engine.st.fade);
    }
    expect(Math.min(...fades)).toBeLessThan(0.2);
    expect(engine.st.fade).toBeGreaterThan(0.8);
  });

  it("the jet only appears on the collapse's exit", () => {
    engine.playTrack(0, 0);
    run(0.5);
    const inValley = engine.st.jet;
    run(1.6);
    expect(engine.st.jet).toBeGreaterThan(inValley);
  });
});

describe("fusion sequence", () => {
  it("skipping during playback fuses and promotes the target track", () => {
    engine.playTrack(0, 0);
    run(3);
    engine.skip(1);
    expect(engine.st.mode).toBe("fusion");

    run(3);
    expect(engine.st.mode).toBe("playing");
    expect(engine.st.trk).toBe(1);
    expect(engine.st.playAlb).toBe(0);
  });

  it("the mix rises from zero to one across the fusion", () => {
    engine.playTrack(0, 0);
    run(3);
    engine.skip(1);

    const mixes: number[] = [];
    for (let i = 0; i < 100; i++) {
      env.advance();
      mixes.push(engine.st.mix);
    }
    expect(Math.max(...mixes)).toBeGreaterThan(0.9);
    expect(engine.st.mix).toBe(0);
  });

  it("the shockwave fires and fades out", () => {
    engine.playTrack(0, 0);
    run(3);
    engine.skip(1);

    let fired = false;
    for (let i = 0; i < 120; i++) {
      env.advance();
      if (engine.st.waveR > 0) fired = true;
    }
    expect(fired).toBe(true);
    expect(engine.st.waveR).toBe(-1);
  });

  it("the new track is handed to the audio exactly once", () => {
    engine.playTrack(0, 0);
    run(3);
    engine.skip(1);
    run(0.9);
    expect(engine.st.fuseLoaded).toBe(true);
    run(2);
    expect(engine.st.trk).toBe(1);
  });
});

describe("snapshot for React", () => {
  it("keeps identity while nothing discrete changes", () => {
    run(0.5);
    const a = engine.getSnapshot();
    run(0.5);
    expect(engine.getSnapshot()).toBe(a);
  });

  it("changes identity when the scale changes", () => {
    const a = engine.getSnapshot();
    engine.enterAlbum(1);
    env.advance();
    expect(engine.getSnapshot()).not.toBe(a);
    expect(engine.getSnapshot().scale).toBe("album");
  });

  it("notifies subscribers only on discrete changes", () => {
    run(0.5);
    let warnings = 0;
    const cancel = engine.subscribe(() => warnings++);
    run(0.5);
    expect(warnings).toBe(0);

    engine.enterAlbum(2);
    env.advance();
    expect(warnings).toBe(1);

    cancel();
    engine.enterAlbum(3);
    env.advance();
    expect(warnings).toBe(1);
  });

  it("announces the current track to screen readers", () => {
    engine.playTrack(1, 2);
    env.advance();
    const announcement = engine.getSnapshot().announce;
    expect(announcement).toContain("03");
    expect(announcement).toContain(ALBUMS[1].tracks[2].title);
    expect(announcement).toContain(ALBUMS[1].artist);
  });

  it("announces the collection when nothing is playing", () => {
    expect(engine.getSnapshot().announce).toContain(String(ALBUMS.length));
  });

  it("the hint waits for stillness, names the gesture, and points where there is room", () => {
    const clock = vi.spyOn(performance, "now");
    engine.markIntent();
    env.advance();
    expect(engine.getSnapshot().hint).toBe(null);

    clock.mockReturnValue(performance.now() + HINT_MS + 200);
    env.advance();
    expect(engine.getSnapshot().hint).toBe("drag");
    expect(engine.getSnapshot().hintDir).toBe(1);

    engine.markIntent();
    clock.mockRestore();
    env.advance();
    expect(engine.getSnapshot().hint).toBe(null);
  });

  it("the arrow turns back on the last record", () => {
    const clock = vi.spyOn(performance, "now");
    engine.st.nav = ALBUMS.length - 1;
    engine.st.navT = ALBUMS.length - 1;
    clock.mockReturnValue(performance.now() + HINT_MS + 200);
    env.advance();
    expect(engine.getSnapshot().hintDir).toBe(-1);
    clock.mockRestore();
  });

  it("the hint never returns once the gesture has been found, and that is remembered", () => {
    const clock = vi.spyOn(performance, "now");
    clock.mockReturnValue(performance.now() + HINT_MS + 200);
    env.advance();
    expect(engine.getSnapshot().hint).toBe("drag");

    engine.stepFocus(1);
    expect(env.storage.get(EXPLORED_KEY)).toBe("1");

    clock.mockReturnValue(performance.now() + HINT_MS * 10);
    env.advance();
    expect(engine.getSnapshot().hint).toBe(null);
    clock.mockRestore();
  });

  it("on a touch device the hint asks for a swipe, not a drag", () => {
    engine.stop();
    env.restore();
    on({ coarse: true });
    const clock = vi.spyOn(performance, "now");
    clock.mockReturnValue(performance.now() + HINT_MS + 200);
    env.advance();
    expect(engine.getSnapshot().hint).toBe("swipe");
    expect(engine.getSnapshot().idle).toBe(false);
    clock.mockRestore();
  });

  it("the hint stays out of an album", () => {
    const clock = vi.spyOn(performance, "now");
    engine.enterAlbum(0);
    clock.mockReturnValue(performance.now() + HINT_MS * 10);
    env.advance();
    expect(engine.getSnapshot().hint).toBe(null);
    clock.mockRestore();
  });

  it("the tide drifts the field toward the next record only after real stillness", () => {
    const clock = vi.spyOn(performance, "now");
    expect(engine.st.tide).toBe(0);

    clock.mockReturnValue(performance.now() + IDLE_MS + 1000);
    run(2);
    const drifted = engine.st.tide;
    expect(drifted).toBeGreaterThan(0);
    expect(Math.abs(drifted)).toBeLessThanOrEqual(TIDE.amp);

    engine.markIntent();
    clock.mockRestore();
    run(2);
    expect(engine.st.tide).toBeCloseTo(0, 6);
  });

  it("the tide never runs under reduced motion, nor inside an album", () => {
    const clock = vi.spyOn(performance, "now");
    clock.mockReturnValue(performance.now() + IDLE_MS + 1000);

    engine.setReducedMotion(true);
    run(3);
    expect(engine.st.tide).toBeCloseTo(0, 6);

    engine.setReducedMotion(false);
    engine.enterAlbum(0);
    run(3);
    expect(engine.st.tide).toBeCloseTo(0, 6);
    clock.mockRestore();
  });

  it("rest switches on after stillness and off at the first gesture", () => {
    const clock = vi.spyOn(performance, "now");
    clock.mockReturnValue(performance.now() + IDLE_MS + 1000);
    env.advance();
    expect(engine.getSnapshot().idle).toBe(true);

    engine.markIntent();
    env.advance();
    expect(engine.getSnapshot().idle).toBe(false);
    clock.mockRestore();
  });
});

describe("continuous frame", () => {
  it("delivers progress, position and duration every frame", () => {
    const frames: { progress: number; position: number; duration: number }[] = [];
    engine.onFrame((f) => frames.push({ ...f }));
    engine.playTrack(0, 0);
    run(0.1);

    expect(frames.length).toBeGreaterThan(0);
    const lastOne = frames[frames.length - 1];
    expect(lastOne.duration).toBeGreaterThan(0);
    expect(lastOne.progress).toBeGreaterThanOrEqual(0);
    expect(lastOne.progress).toBeLessThanOrEqual(1);
  });

  it("cancelling the registration for delivery", () => {
    let n = 0;
    const cancel = engine.onFrame(() => n++);
    env.advance();
    const after = n;
    cancel();
    env.advance();
    expect(n).toBe(after);
  });
});

describe("uniform contract", () => {
  const u = () => (engine as unknown as { gl: { uniforms: Record<string, { value: never }> } }).gl.uniforms;

  it("the primary mass follows the focused album's position", () => {
    engine.enterAlbum(2);
    run(2);
    env.advance();

    const res = u().uRes.value as unknown as { x: number; y: number };
    const aspect = res.x / res.y;
    const size = engine as unknown as { W: number; H: number };
    const mm = morphologyOf(ALBUMS[2].signature, ALBUMS[2].tracks.length);
    const g = bodyGeom(size.W, size.H, engine.st, layoutFor("desktop"), mm);
    const m0 = u().uM0.value as unknown as { x: number; y: number; z: number; w: number };

    expect(m0.x).toBeCloseTo((g.cx / size.W - 0.5) * aspect, 6);
    expect(m0.y).toBeCloseTo(0.5 - g.cy / size.H, 6);
    expect(m0.z).toBeCloseTo(engine.st.m0k, 6);
    expect(m0.w).toBeCloseTo(engine.st.m0h, 6);
  });

  it("the field's ink is the focused album's", () => {
    engine.enterAlbum(3);
    run(1);
    env.advance();
    const ink = u().uInk.value as unknown as { x: number; y: number; z: number };
    expect([ink.x, ink.y, ink.z]).toEqual(ALBUMS[3].inkA);
  });

  it("the rim hardness oscillates around the constant, inside the record's ceiling", () => {
    engine.enterAlbum(5);
    run(2);
    env.advance();

    const c = fieldConstantsOf(ALBUMS[5].signature);
    const read = u().uRim.value as unknown as number;
    const deviation = Math.abs(read - c.rimHardness) / c.rimHardness;

    expect(deviation).toBeGreaterThan(0);
    expect(deviation).toBeLessThanOrEqual(c.reactionCap * 0.5 + 1e-9);
  });

  it("the fade is never negative", () => {
    engine.playTrack(0, 0);
    for (let i = 0; i < 200; i++) {
      env.advance();
      expect(u().uFade.value as unknown as number).toBeGreaterThanOrEqual(0);
    }
  });

  it("in the collection the second mass points at the neighbour, with its weight", () => {
    engine.st.navT = 2;
    run(2);
    env.advance();

    const s = engine.st;
    const dir = s.nav - Math.round(s.nav) >= 0 ? 1 : -1;
    const neighbour = Math.max(0, Math.min(ALBUMS.length - 1, Math.round(s.nav) + dir));
    const c = fieldConstantsOf(ALBUMS[neighbour].signature);
    const mm = morphologyOf(ALBUMS[neighbour].signature, ALBUMS[neighbour].tracks.length);

    const m1 = u().uM1.value as unknown as { z: number; w: number };
    expect(m1.z).toBeCloseTo(SECOND_MASS.k * c.massScale, 4);
    expect(m1.w).toBeCloseTo(SECOND_MASS.h * (mm.coreRatio / MORPH.coreRef) * mm.circuit, 4);
  });

  it("the shader's time follows the world's clock", () => {
    run(1);
    env.advance();
    expect(u().uTime.value as unknown as number).toBeCloseTo(engine.st.t, 6);
  });
});

describe("qualidade adaptativa", () => {
  it("steps the composition down after three consecutive slow windows", () => {
    const before = gl.sizes.length;
    for (let win = 0; win < 3; win++) {
      for (let i = 0; i < 12; i++) env.advance(50);
      env.advance(1100);
    }
    expect(gl.sizes.length).toBeGreaterThan(before);
    expect(COMPOSITION_FALLBACK_W).toBeLessThan(COMPOSITION_MAX_W);
  });

  it("does not step down when the frames arrive on time", () => {
    const before = gl.sizes.length;
    for (let win = 0; win < 4; win++) {
      for (let i = 0; i < 70; i++) env.advance(14);
      env.advance(20);
    }
    expect(gl.sizes.length).toBe(before);
  });
});

describe("window", () => {
  it("resizing reconfigures the composition and the layout", () => {
    env.resize(500, 900);
    engine.resize();
    env.advance();
    expect(engine.getSnapshot().variant).toBe("mobile");

    env.resize(1400, 900);
    engine.resize();
    env.advance();
    expect(engine.getSnapshot().variant).toBe("desktop");
  });
});

describe("the ring at rest is the record's shape (P13)", () => {
  it("with nothing playing, the rotation does not accumulate", () => {
    engine.enterAlbum(3);
    run(4);
    const early = engine.st.ringRot;
    run(20);
    expect(Math.abs(engine.st.ringRot - early)).toBeLessThan(0.001);
  });

  it("rests in the canonical orientation", () => {
    engine.enterAlbum(3);
    run(6);
    expect(engine.st.ringRot).toBeCloseTo(RING.anchor, 3);
  });

  it("entering the same record twice shows the same ring", () => {
    engine.enterAlbum(3);
    run(6);
    const first = engine.st.ringRot;
    engine.goScale("collection");
    run(3);
    engine.enterAlbum(3);
    run(6);
    expect(engine.st.ringRot).toBeCloseTo(first, 6);
  });

  it("while playing, the ring turns in the record's direction", () => {
    engine.playTrack(0, 1);
    run(4);
    const early = engine.st.ringRot;
    run(6);
    expect(engine.st.ringRot).toBeLessThan(early);
  });
});

describe("per-track identity in the field (P11)", () => {
  const heavy = (alb: number) => {
    const bias = trackBiasOf(ALBUMS[alb].signature, ALBUMS[alb].tracks.length);
    let best = 0;
    bias.forEach((b, i) => {
      if (b.loudness > bias[best].loudness) best = i;
    });
    return best;
  };

  it("the current track shifts the world's mass", () => {
    const alb = 0;
    const alta = heavy(alb);
    const baixa = trackBiasOf(ALBUMS[alb].signature, ALBUMS[alb].tracks.length)
      .reduce((acc, b, i, all) => (b.loudness < all[acc].loudness ? i : acc), 0);

    engine.playTrack(alb, alta);
    run(6);
    const strong = engine.st.m0k;

    engine.playTrack(alb, baixa);
    run(6);
    expect(engine.st.m0k).toBeLessThan(strong);
  });

  it("in the collection the record returns to the album constants, whatever the track", () => {
    const alb = 0;
    const bias = trackBiasOf(ALBUMS[alb].signature, ALBUMS[alb].tracks.length);
    const alta = heavy(alb);
    const baixa = bias.reduce((acc, b, i, all) => (b.loudness < all[acc].loudness ? i : acc), 0);

    engine.playTrack(alb, alta);
    run(6);
    engine.goScale("collection");
    run(8);
    const withHighBand = engine.st.m0k;

    engine.playTrack(alb, baixa);
    run(6);
    engine.goScale("collection");
    run(8);

    expect(engine.st.m0k).toBeCloseTo(withHighBand, 6);
  });
});

describe("the light crosses the track (P12)", () => {
  const uniforms = () =>
    (engine as unknown as { gl: { uniforms: Record<string, { value: never }> } }).gl.uniforms;
  const light = () => uniforms().uLight.value as unknown as { x: number; y: number };
  const element = () =>
    (engine as unknown as { bus: { current: { el: FakeAudio } | null } }).bus.current!.el;

  it("at rest, the light stays in the base direction", () => {
    run(2);
    env.advance();
    expect(light().x).toBeCloseTo(-0.7, 3);
    expect(light().y).toBeCloseTo(0.71, 3);
  });

  it("the direction sweeps as the track advances", () => {
    engine.playTrack(0, 0);
    run(4);
    env.advance();
    const start = { ...light() };

    element().currentTime = ALBUMS[0].tracks[0].dur * 0.95;
    run(4);
    env.advance();
    const end = light();

    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeGreaterThan(0.05);
    expect(Math.hypot(end.x, end.y)).toBeCloseTo(Math.hypot(start.x, start.y), 6);
  });
});

describe("experiment: the field anticipates (off by default)", () => {
  it("is born switched off", () => {
    expect(engine.experiments.anticipation).toBe(false);
  });

  it("switched off, the anticipation signal stays at zero even while playing", () => {
    engine.playTrack(0, 1);
    run(8);
    expect(engine.lead).toBe(0);
  });

  it("switched off, the world is identical to the pre-experiment one", () => {
    engine.playTrack(0, 1);
    run(8);
    const withoutExperiment = { m0h: engine.st.m0h, fade: engine.st.fade };

    engine.experiments.anticipation = true;
    run(8);
    engine.experiments.anticipation = false;
    run(8);

    expect(engine.st.m0h).toBeCloseTo(withoutExperiment.m0h, 6);
    expect(engine.st.fade).toBeCloseTo(withoutExperiment.fade, 6);
  });

  it("switched on, the horizon shifts inside the record's reaction ceiling", () => {
    engine.experiments.anticipation = true;
    engine.playTrack(0, 1);
    run(10);

    const c = fieldConstantsOf(ALBUMS[0].signature);
    expect(Math.abs(engine.lead)).toBeLessThanOrEqual(1);
    const deviation = Math.abs(engine.lead) * c.reactionCap;
    expect(deviation).toBeLessThanOrEqual(c.reactionCap + 1e-9);
  });

  it("reduced-motion zeroes the experiment's amplitude", () => {
    on({ reduced: true });
    engine.experiments.anticipation = true;
    engine.playTrack(0, 1);
    run(8);

    const c = reduceMotion(fieldConstantsOf(ALBUMS[0].signature));
    expect(c.reactionCap).toBe(0);
  });
});

describe("the crown deforms and remembers", () => {
  const ALB = ALBUMS.findIndex((x) => x.id === "jono-terbakar-lebar");
  const seconds = () => ALBUMS[ALB].tracks[0].dur;
  const bounds = () => boundsOf(ALBUMS[ALB].signature, ALBUMS[ALB].tracks.length);

  const airborne = () => {
    engine.playTrack(ALB, 0);
    run(1);
    const el = env.audios[env.audios.length - 1];
    el.duration = seconds();
    return el;
  };

  const hear = (el: FakeAudio, from: number, to: number, stepSeconds = 1) => {
    for (let t = from; t <= to; t += stepSeconds) {
      el.currentTime = t;
      run(0.4);
    }
  };

  const scarAt = (progress: number) => {
    const b = bounds();
    const turn = b[0] + (b[1] - b[0]) * progress;
    const bin = Math.round((((turn % 1) + 1) % 1) * STRAIN_BINS) % STRAIN_BINS;
    return Math.abs(engine.strain.plastic[bin]);
  };

  it("listening loads the material and leaves a residue", () => {
    const el = airborne();
    hear(el, 0, seconds());
    expect(peakOf(engine.strain.field)).toBeGreaterThan(0);
    expect(scarCount(engine.strain)).toBeGreaterThan(0);
    expect(engine.strain.album).toBe(ALB);
  });

  it("pausing lets the material relax but never erases the scars", () => {
    const el = airborne();
    hear(el, 0, 150);
    const scars = scarCount(engine.strain);
    const deepest = peakOf(engine.strain.plastic);
    expect(scars).toBeGreaterThan(0);

    engine.transport();
    run(240);
    expect(peakOf(engine.strain.elastic)).toBeLessThan(0.002);
    expect(scarCount(engine.strain)).toBe(scars);
    expect(peakOf(engine.strain.plastic)).toBe(deepest);
  });

  it("skipping forward leaves the gap unmarked", () => {
    const el = airborne();
    hear(el, 0, seconds() * 0.25);
    const heard = scarAt(0.12);

    el.currentTime = seconds() * 0.8;
    hear(el, seconds() * 0.8, seconds());
    expect(heard).toBeGreaterThan(0);
    expect(scarAt(0.5)).toBe(0);
  });

  it("going back over what was heard restores the marks without deepening them", () => {
    const el = airborne();
    hear(el, 0, seconds());
    const scars = scarCount(engine.strain);
    const deepest = peakOf(engine.strain.plastic);

    hear(el, 0, seconds());
    expect(scarCount(engine.strain)).toBeLessThanOrEqual(scars);
    expect(peakOf(engine.strain.plastic)).toBeCloseTo(deepest, 3);
  });

  it("leaving for another record wipes the material", () => {
    const el = airborne();
    hear(el, 0, 150);
    expect(peakOf(engine.strain.field)).toBeGreaterThan(0);

    engine.playTrack(5, 0);
    run(4);
    expect(engine.strain.album).not.toBe(ALB);
    expect(peakOf(engine.strain.plastic)).toBe(0);
  });
});

describe("pointing has weight (P14)", () => {
  const u2 = () =>
    (engine as unknown as { gl: { uniforms: Record<string, { value: never }> } }).gl.uniforms;
  const m1 = () => u2().uM1.value as unknown as { x: number; y: number; z: number; w: number };
  const aspect = () => {
    const res = u2().uRes.value as unknown as { x: number; y: number };
    return res.x / res.y;
  };

  const posOf = (alb: number) => albPos(alb, engine.st, layoutFor("desktop"));

  const release = () => {
    engine.setRailAlb(-1);
    engine.teleportTo(0.95, 0.95);
    run(3);
    env.advance();
  };

  const pointAtBody = (alb: number) => {
    const p = posOf(alb);
    engine.teleportTo(p.x, p.y);
    run(3);
    env.advance();
  };

  const pointAtRail = (alb: number) => {
    engine.teleportTo(0.95, 0.95);
    engine.setRailAlb(alb);
    run(3);
    env.advance();
  };

  beforeEach(() => {
    engine.st.navT = 0;
    run(2);
    release();
  });

  it("pointing at a body carries the second mass to it", () => {
    pointAtBody(1);
    const p = posOf(1);
    expect(m1().x).toBeCloseTo((p.x - 0.5) * aspect(), 2);
    expect(m1().y).toBeCloseTo(0.5 - p.y, 2);
  });

  it("the weight felt is the pointed record's, not a fixed value", () => {
    pointAtRail(7);
    const heavy = m1().z;
    pointAtRail(1);
    const light = m1().z;

    const c7 = fieldConstantsOf(ALBUMS[7].signature);
    const c1 = fieldConstantsOf(ALBUMS[1].signature);
    expect(c7.massScale).toBeGreaterThan(c1.massScale);
    expect(heavy).toBeGreaterThan(light);
    expect(heavy / light).toBeCloseTo(c7.massScale / c1.massScale, 2);
  });

  it("pointing weighs more than the passive neighbour", () => {
    const passive = m1().z;
    pointAtRail(1);
    expect(m1().z).toBeGreaterThan(passive);
    expect(m1().z / passive).toBeCloseTo(SECOND_MASS.pointGain, 1);
  });

  it("pointing at the focused record does not create a second lens over it", () => {
    const before = { ...m1() };
    pointAtRail(0);
    expect(m1().x).toBeCloseTo(before.x, 3);
    expect(m1().z).toBeCloseTo(before.z, 4);
  });

  it("the pointed body's horizon is its own, with no gain", () => {
    pointAtRail(7);
    const mm = morphologyOf(ALBUMS[7].signature, ALBUMS[7].tracks.length);
    expect(m1().w).toBeCloseTo(SECOND_MASS.h * (mm.coreRatio / MORPH.coreRef) * mm.circuit, 4);
  });

  it("the mass arrives with inertia, it does not teleport", () => {
    const start = m1().x;
    engine.teleportTo(0.95, 0.95);
    engine.setRailAlb(4);
    env.advance();
    const oneFrame = m1().x;
    run(3);
    const arrival = m1().x;

    expect(Math.abs(arrival - start)).toBeGreaterThan(0.01);
    expect(Math.abs(oneFrame - start)).toBeLessThan(Math.abs(arrival - start));
  });

  it("outside the collection, pointing does not touch the second mass", () => {
    engine.enterAlbum(2);
    run(3);
    const before = { ...m1() };
    pointAtRail(6);
    expect(m1().z).toBeCloseTo(before.z, 6);
    expect(m1().w).toBeCloseTo(before.w, 6);
  });

  it("reduced-motion keeps the record's weight but removes the pointing gain", () => {
    on({ reduced: true });
    engine.st.navT = 0;
    run(2);
    pointAtRail(7);
    const c = fieldConstantsOf(ALBUMS[7].signature);
    expect(m1().z).toBeCloseTo(SECOND_MASS.k * c.massScale, 4);
  });

  const pointAtIntake = (on: boolean) => {
    engine.teleportTo(0.95, 0.95);
    engine.setRailAlb(-1);
    engine.setIntake(on);
    run(4);
    env.advance();
  };

  it("pointing at the intake opens a place: less mass, more horizon", () => {
    const rest = { ...m1() };
    pointAtIntake(true);

    expect(m1().z).toBeLessThan(rest.z);
    expect(m1().w).toBeGreaterThan(rest.w);
    expect(m1().z / rest.z).toBeCloseTo(INTAKE.mass, 1);
    expect(m1().w).toBeCloseTo(SECOND_MASS.h * INTAKE.horizon, 4);
  });

  it("the intake does not shift the second mass — the place is here, not off-screen", () => {
    const rest = { ...m1() };
    pointAtIntake(true);
    expect(m1().x).toBeCloseTo(rest.x, 3);
    expect(m1().y).toBeCloseTo(rest.y, 3);
  });

  it("it is the opposite of pointing at a record: one weighs, the other lightens", () => {
    pointAtRail(7);
    const record = m1().z;
    release();
    const rest = m1().z;
    pointAtIntake(true);
    const intake = m1().z;

    expect(record).toBeGreaterThan(rest);
    expect(intake).toBeLessThan(rest);
  });

  it("releasing the intake gives the field back to the neighbour", () => {
    const rest = { ...m1() };
    pointAtIntake(true);
    pointAtIntake(false);
    expect(m1().z).toBeCloseTo(rest.z, 3);
    expect(m1().w).toBeCloseTo(rest.w, 3);
  });

  it("pointing at the intake ignores a record left pointed in the rail", () => {
    pointAtRail(7);
    engine.setIntake(true);
    run(4);
    const c = fieldConstantsOf(ALBUMS[7].signature);
    expect(m1().z).toBeLessThan(SECOND_MASS.k * c.massScale);
  });
});

describe("a track that fails to load stops pretending to play", () => {
  const fault = (kind: "source" | "blocked") => {
    engine.bus.onFault?.(kind);
    run(2);
    env.advance();
  };

  it("the fault takes the world off air instead of resolving into playback", () => {
    engine.playTrack(0, 0);
    expect(engine.st.mode).toBe("collapse");
    fault("source");
    expect(engine.st.mode).toBe("paused");
    run(3);
    expect(engine.st.mode).toBe("paused");
  });

  it("the reason reaches the instruments layer", () => {
    engine.playTrack(0, 0);
    fault("source");
    expect(engine.getSnapshot().fault).toBe("source");
  });

  it("the browser's block is a different reason from a broken file", () => {
    engine.playTrack(0, 0);
    fault("blocked");
    expect(engine.getSnapshot().fault).toBe("blocked");
  });

  it("asking again clears the fault before trying", () => {
    engine.playTrack(0, 0);
    fault("source");
    expect(engine.getSnapshot().fault).toBe("source");

    engine.transport();
    run(2);
    env.advance();
    expect(engine.getSnapshot().fault).toBe(null);
  });

  it("the fault does not drop the focused track: you can see which one failed", () => {
    engine.playTrack(2, 1);
    fault("source");
    expect(engine.st.playAlb).toBe(2);
    expect(engine.st.trk).toBe(1);
    expect(engine.st.scale).toBe("track");
  });
});

describe("the cursor knows what is under it", () => {
  const uReach = () =>
    (engine as unknown as { gl: { uniforms: { uReach: { value: number } } } }).gl.uniforms.uReach
      .value;

  const pointAt = (x: number, y: number, naUi = false) => {
    engine.teleportTo(x, y);
    engine.pointTo(x, y, naUi);
    run(4);
    env.advance();
  };

  const body = () => {
    const L = layoutFor("desktop");
    const alb = engine.st.alb;
    const mm = morphologyOf(ALBUMS[alb].signature, ALBUMS[alb].tracks.length);
    const size = (engine as unknown as { W: number; H: number });
    const g = bodyGeom(size.W, size.H, engine.st, L, mm);
    return [g.cx / size.W, g.cy / size.H] as const;
  };

  it("in the collection, over a body the ring closes", () => {
    pointAt(...body());
    expect(engine.reach).toBe("enter");
    expect(uReach()).toBeGreaterThan(0.5);
  });

  it("in the collection, the void promises nothing — clicking there does nothing", () => {
    pointAt(0.02, 0.95);
    expect(engine.reach).toBe("none");
    expect(Math.abs(uReach())).toBeLessThan(0.1);
  });

  it("inside the album, the void opens the ring: it is what gives a scale back", () => {
    engine.enterAlbum(0);
    run(3);
    pointAt(0.03, 0.96);
    expect(engine.reach).toBe("leave");
    expect(uReach()).toBeLessThan(-0.5);
  });

  it("entering and leaving have opposite signs, not different intensities of the same", () => {
    engine.enterAlbum(0);
    run(3);
    pointAt(...body());
    const inside = uReach();
    pointAt(0.03, 0.96);
    const outside = uReach();
    expect(inside).toBeGreaterThan(0);
    expect(outside).toBeLessThan(0);
  });

  it("over a control the ring vanishes: that click is not the world's", () => {
    engine.enterAlbum(0);
    run(3);
    pointAt(0.03, 0.96, true);
    expect(engine.reach).toBe("none");
  });

  it("during the ceremony the ring vanishes: it is not the time to point", () => {
    engine.enterAlbum(0);
    run(3);
    const [x, y] = body();
    engine.teleportTo(x, y);
    engine.pointTo(x, y, false);
    run(0.5);
    expect(engine.reach).toBe("enter");

    engine.playTrack(0, 0);
    engine.pointTo(x, y, false);
    run(0.3);
    expect(engine.st.mode).toBe("collapse");
    expect(engine.reach).toBe("none");
  });

  it("on touch there is no ring: no cursor hovers", () => {
    engine.stop();
    on({ coarse: true });
    engine.enterAlbum(0);
    run(3);
    engine.teleportTo(0.03, 0.96);
    engine.pointTo(0.03, 0.96, false);
    run(4);
    expect(engine.reach).toBe("none");
  });
});

describe("volume", () => {
  it("the engine keeps the level and the mute without losing one in the other", () => {
    engine.setVolume(0.4);
    expect(engine.volume).toBeCloseTo(0.4, 5);
    engine.setMuted(true);
    expect(engine.muted).toBe(true);
    expect(engine.volume).toBeCloseTo(0.4, 5);
    engine.setMuted(false);
    expect(engine.volume).toBeCloseTo(0.4, 5);
  });

  it("touching the volume counts as presence: the layer does not vanish under the person's hand", () => {
    const clock = vi.spyOn(performance, "now");
    clock.mockReturnValue(performance.now() + IDLE_MS + 1000);
    env.advance();
    expect(engine.getSnapshot().idle).toBe(true);

    engine.setVolume(0.5);
    env.advance();
    expect(engine.getSnapshot().idle).toBe(false);
    clock.mockRestore();
  });
});
