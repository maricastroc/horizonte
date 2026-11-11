import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../fieldMaterial", async (importReal) => {
  const real = await importReal<typeof import("../fieldMaterial")>();
  return {
    ...real,
    createFieldGL: () => ({
      uniforms: real.createFieldUniforms(),
      render: () => {},
      resize: (w: number, h: number) => ({ dw: w, dh: h }),
      invalidate: () => {},
      dispose: () => {},
    }),
  };
});

import { AudioAnalysis, NEUTRAL_RESPONSE, type Response } from "../audio/analysis";
import { ALBUMS, type AlbumWithSignature } from "../content";
import { MOTIONS } from "../content/motion.generated";
import { boundsOf } from "../content/signature";
import { FieldEngine } from "../engine/FieldEngine";
import {
  NEUTRAL_MOTION,
  motionQualitiesOf,
  motionResponseOf,
  responseOf,
  routingOf,
  type MotionQualities,
  type MotionResponse,
} from "../motion";
import { MOTION } from "../tokens";
import { engineHarness, fakeContext, sineTrack, type EngineHarness } from "./fakes";

const albumNamed = (id: string) => {
  const album = ALBUMS.find((a) => a.id === id);
  if (!album) throw new Error(id);
  return album;
};

function albumResponse(album: AlbumWithSignature): MotionResponse {
  const bounds = boundsOf(album.signature, album.tracks.length);
  const out = { attack: 0, release: 0, habit: 0, depth: 0, mass: 0, light: 0 };
  album.tracks.forEach((_, k) => {
    const r = motionResponseOf(motionQualitiesOf(album, k));
    const w = bounds[k + 1] - bounds[k];
    for (const key of Object.keys(out) as (keyof typeof out)[]) out[key] += r[key] * w;
  });
  return out;
}

const quality = (q: Partial<MotionQualities>): MotionQualities => ({
  sharpness: 0.5,
  sustain: 0.5,
  weight: 0.5,
  contrast: 0.5,
  beat: 0,
  ...q,
});

describe("measured motion of the curated catalogue", () => {
  it("every curated track has a measured motion in the normalized range", () => {
    for (const album of ALBUMS) {
      const rows = MOTIONS[album.id];
      expect(rows, album.id).toHaveLength(album.tracks.length);
      for (const row of rows) {
        expect(row).not.toBeNull();
        for (const key of ["sharpness", "sustain", "weight", "contrast"] as const) {
          expect(row![key]).toBeGreaterThanOrEqual(0);
          expect(row![key]).toBeLessThanOrEqual(1);
        }
        expect(row!.beat).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("a track departs from its album by at most the per-track ceiling", () => {
    for (const album of ALBUMS) {
      const bounds = boundsOf(album.signature, album.tracks.length);
      for (const key of ["sharpness", "sustain", "weight", "contrast"] as const) {
        let anchor = 0;
        MOTIONS[album.id].forEach((row, k) => (anchor += row![key] * (bounds[k + 1] - bounds[k])));
        album.tracks.forEach((_, k) => {
          const q = motionQualitiesOf(album, k)!;
          expect(Math.abs(q[key] - anchor)).toBeLessThanOrEqual(MOTION.track.cap + 1e-9);
        });
      }
    }
  });

  it("an album without measured motion keeps today's response", () => {
    const local = { ...ALBUMS[0], id: "local-record" } as AlbumWithSignature;
    expect(motionQualitiesOf(local, 0)).toBeNull();
    expect(motionResponseOf(null)).toBe(NEUTRAL_MOTION);
  });
});

describe("from qualities to response", () => {
  it("sharper attacks rise faster", () => {
    expect(responseOf(quality({ sharpness: 0.9 })).attack).toBeLessThan(
      responseOf(quality({ sharpness: 0.1 })).attack,
    );
  });

  it("more sustained sound lets the response linger longer", () => {
    expect(responseOf(quality({ sustain: 0.9 })).release).toBeGreaterThan(
      responseOf(quality({ sustain: 0.1 })).release * 3,
    );
  });

  it("a reliable grid keeps every beat a separate event", () => {
    const beat = 0.5;
    const r = responseOf(quality({ sustain: 1, beat }));
    expect(r.release).toBeLessThanOrEqual(beat * MOTION.beatRelease + 1e-12);
  });

  it("the habit follows the release, inside its bounds", () => {
    for (const sustain of [0, 0.25, 0.5, 0.75, 1]) {
      const r = responseOf(quality({ sustain }));
      expect(r.habit).toBeGreaterThanOrEqual(MOTION.habit[0]);
      expect(r.habit).toBeLessThanOrEqual(MOTION.habit[1]);
      expect(r.habit).toBeGreaterThanOrEqual(r.release);
    }
  });

  it("the response never releases faster than it attacks", () => {
    for (const sharpness of [0, 0.5, 1]) {
      for (const sustain of [0, 0.5, 1]) {
        const r = responseOf(quality({ sharpness, sustain, beat: 0.2 }));
        expect(r.release).toBeGreaterThanOrEqual(r.attack);
      }
    }
  });

  it("more micro-contrast lets typical events reach further into the ceiling", () => {
    const flat = responseOf(quality({ contrast: 0 }));
    const sharp = responseOf(quality({ contrast: 1 }));
    expect(sharp.depth).toBeGreaterThan(flat.depth);
    expect(flat.depth).toBeGreaterThan(0);
    expect(sharp.depth).toBeLessThanOrEqual(1);
  });

  it("a balanced spectrum keeps today's routing", () => {
    expect(routingOf(quality({ weight: 0.5 }))).toEqual({ mass: 1, light: 1 });
  });

  it("weight moves reaction between mass and light without exceeding the ceiling", () => {
    const heavy = routingOf(quality({ weight: 1 }));
    const light = routingOf(quality({ weight: 0 }));
    expect(heavy.mass).toBe(1);
    expect(heavy.light).toBe(MOTION.route.floor);
    expect(light.mass).toBe(MOTION.route.floor);
    expect(light.light).toBe(1);
    for (let w = 0; w <= 1; w += 0.05) {
      const r = routingOf(quality({ weight: w }));
      expect(r.mass).toBeLessThanOrEqual(1);
      expect(r.light).toBeLessThanOrEqual(1);
    }
  });
});

describe("motion personalities do not converge", () => {
  const all = ALBUMS.map(albumResponse);

  it("the catalogue spans a wide range of attack and release", () => {
    const attack = all.map((r) => r.attack);
    const release = all.map((r) => r.release);
    expect(Math.max(...attack) / Math.min(...attack)).toBeGreaterThan(2.4);
    expect(Math.max(...release) / Math.min(...release)).toBeGreaterThan(3.5);
  });

  it("soft, sustained records answer slower than sharp, percussive ones", () => {
    const soft = albumResponse(albumNamed("grove-of-whispers-the-sheltering-sky"));
    const sparse = albumResponse(albumNamed("jono-terbakar-lebar"));
    const sharp = albumResponse(albumNamed("smert-v-letnjuju-polnoch-chajka"));
    expect(soft.attack).toBeGreaterThan(sharp.attack * 2.5);
    expect(sparse.release).toBeGreaterThan(sharp.release * 3.5);
  });

  it("the heaviest record moves mass, the lightest moves light", () => {
    const heavy = albumResponse(albumNamed("meho-mkultra"));
    const airy = albumResponse(albumNamed("grove-of-whispers-the-sheltering-sky"));
    expect(heavy.mass).toBeGreaterThan(0.95);
    expect(heavy.light).toBeLessThan(0.6);
    expect(airy.light).toBeGreaterThan(0.95);
    expect(airy.mass).toBeLessThan(0.75);
  });
});

describe("live analysis with a measured response", () => {
  const SR = 44100;
  const BINS = 512;
  const bass = (value: number) => {
    const s = new Uint8Array(BINS);
    for (let b = 1; b <= Math.round((160 / (SR / 2)) * BINS); b++) s[b] = value;
    return s;
  };

  function stepResponse(response: Response) {
    const { ctx, analyser } = fakeContext(SR);
    const analysis = new AudioAnalysis(ctx);
    analysis.setResponse(response);
    analyser.wave = sineTrack(0.5);
    analyser.spectrum = bass(20);
    for (let i = 0; i < 400; i++) analysis.update(1 / 60, true);
    const low = analysis.frame.bass;
    analyser.spectrum = bass(240);
    for (let i = 0; i < 400; i++) analysis.update(1 / 60, true);
    const high = analysis.frame.bass;
    const span = high - low;

    const measure = (from: Uint8Array, to: Uint8Array, done: () => boolean) => {
      analyser.spectrum = from;
      for (let i = 0; i < 400; i++) analysis.update(1 / 60, true);
      analyser.spectrum = to;
      let n = 0;
      while (!done() && n < 600) {
        analysis.update(1 / 60, true);
        n++;
      }
      return n;
    };
    const rise = measure(bass(20), bass(240), () => analysis.frame.bass >= low + 0.75 * span);
    const fall = measure(bass(240), bass(20), () => analysis.frame.bass <= high - 0.75 * span);
    return { rise, fall };
  }

  it("the neutral response keeps the symmetric smoothing of before", () => {
    const r = stepResponse(NEUTRAL_RESPONSE);
    expect(Math.abs(r.rise - r.fall)).toBeLessThanOrEqual(1);
  });

  it("a sharp, sustained response rises faster and falls slower than neutral", () => {
    const neutral = stepResponse(NEUTRAL_RESPONSE);
    const measured = stepResponse({ attack: 0.05, release: 0.9, habit: 4.5, depth: 0 });
    expect(measured.rise).toBeLessThan(neutral.rise);
    expect(measured.fall).toBeGreaterThan(neutral.fall * 4);
  });

  it("with depth, a typical fluctuation uses more of the ceiling than before", () => {
    const wobble = (response: Response) => {
      const { ctx, analyser } = fakeContext(SR);
      const analysis = new AudioAnalysis(ctx);
      analysis.setResponse(response);
      analyser.wave = sineTrack(0.5);
      let peak = 0;
      for (let i = 0; i < 1200; i++) {
        analyser.spectrum = bass(i % 30 < 4 ? 170 : 140);
        analysis.update(1 / 60, true);
        if (i > 600) peak = Math.max(peak, analysis.frame.accent.bass);
      }
      return peak;
    };
    const legacy = wobble(NEUTRAL_RESPONSE);
    const measured = wobble({ ...NEUTRAL_RESPONSE, depth: 0.8 });
    expect(measured).toBeGreaterThan(legacy * 3);
    expect(measured).toBeLessThanOrEqual(1);
  });

  it("silence does not turn into accents", () => {
    const { ctx, analyser } = fakeContext(SR);
    const analysis = new AudioAnalysis(ctx);
    analysis.setResponse({ ...NEUTRAL_RESPONSE, depth: 1 });
    analyser.wave = sineTrack(0);
    analyser.spectrum = new Uint8Array(BINS);
    for (let i = 0; i < 600; i++) analysis.update(1 / 60, true);
    expect(Math.abs(analysis.frame.accent.bass)).toBeLessThan(0.01);
  });

  it("a longer habit keeps the accent of a slow swell alive", () => {
    const swell = (response: Response) => {
      const { ctx, analyser } = fakeContext(SR);
      const analysis = new AudioAnalysis(ctx);
      analysis.setResponse(response);
      analyser.wave = sineTrack(0.5);
      analyser.spectrum = bass(40);
      for (let i = 0; i < 600; i++) analysis.update(1 / 60, true);
      analyser.spectrum = bass(200);
      for (let i = 0; i < 120; i++) analysis.update(1 / 60, true);
      return analysis.frame.accent.bass;
    };
    expect(swell({ attack: 0.2, release: 1, habit: 5, depth: 0 })).toBeGreaterThan(
      swell(NEUTRAL_RESPONSE) + 0.2,
    );
  });
});

describe("engine wiring", () => {
  let env: EngineHarness;
  let engine: FieldEngine;

  const start = () => {
    env = engineHarness();
    const display = (globalThis as { document: { createElement(t: string): unknown } }).document
      .createElement("canvas") as HTMLCanvasElement;
    engine = new FieldEngine(display, { archivo: "A", bodoni: "B", mono: "M" }, { isUiTarget: () => false });
    engine.start();
  };
  const run = (seconds: number) => {
    for (let i = 0; i < Math.ceil((seconds * 1000) / 16); i++) env.advance(16);
  };
  const internals = () =>
    engine as unknown as { motion: MotionResponse; bus: { response: Response } };

  afterEach(() => {
    engine.stop();
    env.restore();
  });

  it("without the experiment the bus keeps the neutral response", () => {
    start();
    const alb = ALBUMS.findIndex((a) => a.id === "jono-terbakar-lebar");
    engine.playTrack(alb, 1);
    run(6);
    expect(internals().bus.response).toBe(NEUTRAL_RESPONSE);
    expect(internals().motion).toEqual(NEUTRAL_MOTION);
  });

  it("with the experiment the playing track's response reaches the bus", () => {
    start();
    engine.experiments.motion = true;
    const alb = ALBUMS.findIndex((a) => a.id === "jono-terbakar-lebar");
    engine.playTrack(alb, 1);
    run(8);
    const target = motionResponseOf(motionQualitiesOf(ALBUMS[alb], 1));
    const motion = internals().motion;
    expect(motion.release).toBeCloseTo(target.release, 2);
    expect(motion.mass).toBeCloseTo(target.mass, 2);
    expect(internals().bus.response).toBe(motion);
  });

  it("turning the experiment off restores the neutral response at once", () => {
    start();
    engine.experiments.motion = true;
    engine.playTrack(0, 0);
    run(4);
    engine.experiments.motion = false;
    run(0.1);
    expect(internals().bus.response).toBe(NEUTRAL_RESPONSE);
    expect(internals().motion).toEqual(NEUTRAL_MOTION);
  });
});
