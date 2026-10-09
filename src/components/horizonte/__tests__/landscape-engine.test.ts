import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../fieldMaterial", async (importReal) => {
  const real = await importReal<typeof import("../fieldMaterial")>();
  return {
    ...real,
    createFieldGL: () => ({
      uniforms: real.createFieldUniforms(),
      render: () => {},
      resize: (w: number, h: number) => ({ dw: w, dh: h }),
      dispose: () => {},
    }),
  };
});

import { ALBUMS } from "../content";
import { FieldEngine } from "../engine/FieldEngine";
import { bodyGeom, layoutFor } from "../composition/layout";
import { landscapeOf, sectionIndexAt, stateDistance, type FormState } from "../landscape";
import { crownAt, morphologyOf, pathTurn, type AlbumMorphology } from "../morphology";
import { SEQ } from "../tokens";
import { engineHarness, type EngineHarness, type FakeAudio } from "./fakes";

const FONTS = { archivo: "A", bodoni: "B", mono: "M" };

interface Inside {
  M: AlbumMorphology;
  formMix: number;
  formState: FormState | null;
  suspend: number;
  moment: { section: number } | null;
  click(): void;
}

let env: EngineHarness;
let engine: FieldEngine;
const inside = () => engine as unknown as Inside;

const run = (seconds: number, step = 16) => {
  const n = Math.ceil((seconds * 1000) / step);
  for (let i = 0; i < n; i++) env.advance(step);
};

const SOLAR = ALBUMS.findIndex((a) => a.id === "darin-wilson-impromptu");

function start(form: boolean) {
  env = engineHarness();
  const display = (globalThis as { document: { createElement(t: string): unknown } }).document
    .createElement("canvas") as HTMLCanvasElement;
  engine = new FieldEngine(display, FONTS, { isUiTarget: () => false });
  engine.experiments.form = form;
  engine.start();
  engine.teleportTo(0.99, 0.99);
}

function play(alb: number, trk: number): FakeAudio {
  engine.playTrack(alb, trk);
  const el = env.audios[env.audios.length - 1];
  el.duration = ALBUMS[alb].tracks[trk].dur;
  return el;
}

afterEach(() => {
  engine.stop();
  env.restore();
});

describe("with the experiment off", () => {
  beforeEach(() => start(false));

  it("the track scale keeps drawing the album map", () => {
    play(SOLAR, 3);
    run(4);
    expect(inside().formMix).toBe(0);
    expect(inside().M).toBe(morphologyOf(ALBUMS[SOLAR].signature, ALBUMS[SOLAR].tracks.length));
  });
});

describe("with the experiment on", () => {
  beforeEach(() => start(true));

  it("the collapse swaps the map for the landscape inside its valley, not before", () => {
    play(SOLAR, 3);
    run(SEQ.collapse.ramp * 0.6);
    expect(inside().formMix).toBe(0);
    run(SEQ.collapse.valleyEnd - SEQ.collapse.ramp * 0.6 + 0.05);
    expect(inside().formMix).toBe(1);
    expect(inside().M.bounds).toEqual(landscapeOf(SOLAR, 3).bounds);
  });

  it("the form travels through the sections and comes back when the material comes back", () => {
    const el = play(SOLAR, 3);
    const L = landscapeOf(SOLAR, 3);
    const dur = ALBUMS[SOLAR].tracks[3].dur;
    run(3);
    const back = L.sections.findIndex((s) => s.recall >= 0);
    expect(back).toBeGreaterThan(0);
    const first = L.sections[L.sections[back].recall];
    el.currentTime = ((first.at + first.end) / 2) * dur;
    run(8);
    const original = { ...inside().formState!, thickness: 0 };
    el.currentTime = ((L.sections[back].at + L.sections[back].end) / 2) * dur;
    run(10);
    expect(inside().moment!.section).toBe(back);
    const returned = { ...inside().formState!, thickness: 0 };
    expect(stateDistance(original, returned)).toBeLessThan(0.05);
  });

  it("pointing at the landscape chooses a moment of the track, not another track", () => {
    const el = play(SOLAR, 3);
    run(4);
    const s = engine.st;
    const m = inside().M;
    const target = 4;
    const sec = landscapeOf(SOLAR, 3).sections[target];
    const t = (sec.at + sec.end) / 2;
    const L = layoutFor("desktop");
    const W = 1280;
    const H = 800;
    for (let i = 0; i < 6; i++) {
      const g = bodyGeom(W, H, s, L, m);
      const c = crownAt(m, t);
      const r = ((c.inner + c.outer) / 2) * g.R;
      const a = pathTurn(m, t) * 6.2832 + s.ringRot;
      engine.teleportTo((g.cx + Math.cos(a) * r) / W, (g.cy + Math.sin(a) * r * g.flatten) / H);
      run(0.3);
    }
    inside().click();
    run(0.2);
    expect(s.mode).toBe("playing");
    expect(s.trk).toBe(3);
    expect(sectionIndexAt(landscapeOf(SOLAR, 3), el.currentTime / ALBUMS[SOLAR].tracks[3].dur)).toBe(target);
  });

  it("stepping back to the album returns to the map", () => {
    play(SOLAR, 3);
    run(4);
    engine.back();
    run(2);
    expect(inside().formMix).toBe(0);
    expect(inside().M).toBe(morphologyOf(ALBUMS[SOLAR].signature, ALBUMS[SOLAR].tracks.length));
  });

  it("a long session never produces an invalid form", () => {
    const el = play(SOLAR, 3);
    const dur = ALBUMS[SOLAR].tracks[3].dur;
    for (let t = 0; t < dur; t += 7) {
      el.currentTime = t;
      run(0.5);
      const st = inside().formState!;
      for (const v of Object.values(st)) expect(Number.isFinite(v)).toBe(true);
      expect(Number.isFinite(inside().M.rMax)).toBe(true);
    }
  });

  it("a pause in the music suspends the form", () => {
    const hit = ALBUMS.flatMap((a, ai) =>
      a.tracks.map((_, k) => ({ ai, k, L: landscapeOf(ai, k) })),
    ).find((x) => x.L.pauses.some((p) => (p.end - p.at) * x.L.duration > 6));
    expect(hit).toBeTruthy();
    const { ai, k, L } = hit!;
    const pause = L.pauses.find((p) => (p.end - p.at) * L.duration > 6)!;
    const el = play(ai, k);
    run(3);
    el.currentTime = ((pause.at + pause.end) / 2) * L.duration;
    run(3);
    expect(inside().suspend).toBeGreaterThan(0.5);
  });
});
