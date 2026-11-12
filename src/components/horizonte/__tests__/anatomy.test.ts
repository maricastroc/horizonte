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

import {
  AXIS_OF,
  compareMorphology,
  compareSignature,
  inviteOf,
  medianOf,
  nameFactOf,
  questionsOf,
  readingOf,
  visibleSatellites,
  type CompareAxis,
} from "../anatomy";
import { ALBUMS, CURATED_COUNT } from "../content";
import { FieldEngine } from "../engine/FieldEngine";
import type { FieldUniforms } from "../fieldMaterial";
import { morphologyOf, pulseSpreadOf, type AlbumMorphology } from "../morphology";
import { drawFocus, drawGhost, emptyFrame } from "../composition/focus";
import { ANATOMY, IDLE_MS } from "../tokens";
import { engineHarness, paintContext, type EngineHarness } from "./fakes";

const at = (id: string) => {
  const i = ALBUMS.findIndex((a) => a.id === id);
  if (i < 0) throw new Error(id);
  return i;
};

const EWORLD = at("zero-project-e-world");
const ASG = at("madison-kenny-all-systems-go");
const LEBAR = at("jono-terbakar-lebar");
const DARK = at("mark-wilson-x-dark-thoughts");
const MKULTRA = at("meho-mkultra");
const DUST = at("dust-time-gravity");

const MORPH_FIELDS = [
  "circuit",
  "flatten",
  "coreRatio",
  "bandRatio",
  "relief",
  "strata",
  "fragment",
  "spread",
] as const;

const OWNS: Record<CompareAxis, readonly (typeof MORPH_FIELDS)[number][]> = {
  duration: ["circuit", "spread"],
  spread: ["fragment"],
  pulse: ["strata"],
  dynamics: ["relief"],
  brightness: ["flatten"],
  loudness: ["circuit", "coreRatio", "bandRatio"],
};

const changed = (a: AlbumMorphology, b: AlbumMorphology) =>
  MORPH_FIELDS.filter((k) => Math.abs(a[k] - b[k]) > 1e-9);

describe("the questions a record asks", () => {
  it("every curated record asks six questions, its most striking first", () => {
    for (let i = 0; i < CURATED_COUNT; i++) {
      const qs = questionsOf(i);
      expect(qs).toHaveLength(6);
      expect(new Set(qs.map((q) => q.part)).size).toBe(6);
      for (let k = 1; k < qs.length; k++) expect(qs[k - 1].score).toBeGreaterThanOrEqual(qs[k].score);
      for (const q of qs) {
        expect(q.ask.endsWith("?")).toBe(true);
        expect(q.answer.length).toBeGreaterThan(20);
        expect(q.reading.axis).toBe(AXIS_OF[q.part]);
      }
    }
  });

  it("each record leads with what stands out in it", () => {
    expect(questionsOf(EWORLD)[0].ask).toBe("Why are there four small bodies around it?");
    expect(questionsOf(DARK)[0].ask).toBe("Why is the ring broken into pieces?");
    expect(questionsOf(MKULTRA)[0].ask).toBe("Why does it lie so flat?");
    expect(questionsOf(ASG)[0].ask).toBe("Why does it stand so open?");
    expect(questionsOf(LEBAR)[0].ask).toBe("Why is its edge so jagged?");
  });

  it("the experiment says which way the record would change", () => {
    const sat = (i: number) => questionsOf(i).find((q) => q.part === "satellites")!;
    const pos = (i: number) => questionsOf(i).find((q) => q.part === "posture")!;
    expect([sat(EWORLD).what, sat(EWORLD).label]).toEqual(["What if it were shorter?", "Shorter"]);
    expect([sat(ASG).what, sat(ASG).label]).toEqual(["What if it were longer?", "Longer"]);
    expect([pos(MKULTRA).what, pos(MKULTRA).label]).toEqual([
      "What if it sounded brighter?",
      "Brighter",
    ]);
    expect([pos(ASG).what, pos(ASG).label]).toEqual(["What if it sounded darker?", "Darker"]);
  });

  it("the result names what the eye will see, counted by the real morphology", () => {
    const sat = (i: number) => questionsOf(i).find((q) => q.part === "satellites")!;
    expect(sat(EWORLD).result).toContain("two of its four small bodies dissolve");
    expect(sat(ASG).result).toContain("two small bodies appear");
    expect(visibleSatellites(compareMorphology(EWORLD, "duration"))).toBe(2);
  });

  it("speaks without technical numbers, except minutes", () => {
    for (let i = 0; i < CURATED_COUNT; i++) {
      for (const q of questionsOf(i)) {
        for (const text of [q.ask, q.answer, q.what ?? "", q.result]) {
          expect(text.replace(/\d+ minutes/g, "")).not.toMatch(/\d|dB|Hz|median/);
        }
      }
    }
  });

  it("a record close to the usual gets a neutral question and no experiment", () => {
    const core = questionsOf(MKULTRA).find((q) => q.part === "core")!;
    expect(core.what).toBeNull();
    expect(core.ask).toBe("What sets the size of its dark center?");
    expect(core.score).toBeCloseTo(0, 4);
  });

  it("gaps are explained by the pulse between tracks, never by dynamics", () => {
    const gaps = questionsOf(DARK).find((q) => q.part === "gaps")!;
    expect(gaps.reading.axis).toBe("spread");
    expect(gaps.answer).toMatch(/pulse/);
    expect(gaps.answer).not.toMatch(/dynamic|volume|loud/i);
  });

  it("the invitation is the record's leading question", () => {
    for (let i = 0; i < CURATED_COUNT; i++) {
      expect(inviteOf(i)).toEqual({ part: questionsOf(i)[0].part, line: questionsOf(i)[0].ask });
    }
  });

  it("the deeper layer keeps the measurements and their standing", () => {
    expect(readingOf(EWORLD, "duration").standing).toBe("longest of 14");
    expect(readingOf(EWORLD, "pulse").standing).toBe("steadiest of 14");
    expect(readingOf(ASG, "duration").standing).toBe("shortest of 14");
    expect(readingOf(ASG, "brightness").standing).toBe("brightest of 14");
    expect(readingOf(ASG, "dynamics").standing).toBe("most compressed of 14");
    expect(readingOf(LEBAR, "dynamics").standing).toBe("most dynamic of 14");
    expect(readingOf(DARK, "spread").standing).toBe("most uneven of 14");
    expect(readingOf(MKULTRA, "brightness").standing).toBe("darkest of 14");
    expect(readingOf(DUST, "pulse").standing).toBe("loosest of 14");
    expect(readingOf(LEBAR, "brightness").standing).toBe("12th brightest of 14");
    expect(nameFactOf(EWORLD)).toBe(
      "The name is set at weight 704: the louder the record, the heavier the type.",
    );
  });

  it("medians come from the fourteen curated records only", () => {
    for (const axis of ["duration", "pulse", "dynamics", "brightness", "loudness"] as const) {
      const xs = ALBUMS.slice(0, CURATED_COUNT)
        .map((a) => a.signature[axis])
        .sort((a, b) => a - b);
      expect(medianOf(axis)).toBeCloseTo((xs[6] + xs[7]) / 2, 9);
    }
    expect(readingOf(EWORLD, "duration").medianShown).toBe("34 min");
  });
});

describe("the contraprova", () => {
  it("changes only the selected descriptor and never the record itself", () => {
    const sig = ALBUMS[EWORLD].signature;
    const before = JSON.stringify(sig);
    for (const axis of ["duration", "pulse", "dynamics", "brightness", "loudness"] as const) {
      const cf = compareSignature(sig, axis);
      const diff = Object.keys(sig).filter(
        (k) => JSON.stringify(sig[k as keyof typeof sig]) !== JSON.stringify(cf[k as keyof typeof cf]),
      );
      expect(diff).toEqual([axis]);
      expect(cf[axis]).toBeCloseTo(medianOf(axis), 9);
    }
    expect(JSON.stringify(sig)).toBe(before);
  });

  it("the pulse spread reaches the median, even from a record with none", () => {
    for (const i of [DARK, DUST, EWORLD]) {
      const cf = compareSignature(ALBUMS[i].signature, "spread");
      expect(pulseSpreadOf(cf)).toBeCloseTo(medianOf("spread"), 2);
    }
  });

  it("each axis moves only the parts of the form that it builds", () => {
    for (const i of [EWORLD, ASG, DARK]) {
      const base = morphologyOf(ALBUMS[i].signature, ALBUMS[i].tracks.length);
      for (const axis of Object.keys(OWNS) as CompareAxis[]) {
        const moved = changed(base, compareMorphology(i, axis));
        for (const k of moved) expect(OWNS[axis]).toContain(k);
      }
    }
  });

  it("is visible where it matters: satellites come and go with length", () => {
    expect(visibleSatellites(compareMorphology(EWORLD, "duration"))).toBe(2);
    expect(visibleSatellites(compareMorphology(ASG, "duration"))).toBe(2);
    const dark = morphologyOf(ALBUMS[DARK].signature, ALBUMS[DARK].tracks.length);
    expect(compareMorphology(DARK, "spread").fragment).toBeLessThan(dark.fragment * 0.5);
  });
});

describe("the isolation mask", () => {
  const frameOf = (alb: number) => {
    const f = emptyFrame();
    Object.assign(f, { bx: 640, by: 400, R: 260, flatten: 0.7, rot: 0.3 });
    f.m = morphologyOf(ALBUMS[alb].signature, ALBUMS[alb].tracks.length);
    return f;
  };
  const core = { x: 640, y: 400, rx: 80, ry: 56 };
  const fills = (calls: string[]) => calls.filter((c) => c === "fill").length;

  it("draws the crown from the morphology, one closed sector per track", () => {
    const paint = paintContext();
    expect(drawFocus(paint.ctx, 1280, frameOf(DARK), "gaps", core)).toBe(true);
    expect(paint.calls.filter((c) => c === "closePath")).toHaveLength(ALBUMS[DARK].tracks.length);
    expect(fills(paint.calls)).toBe(1);
    expect(paint.calls).not.toContain("drawImage");
  });

  it("the ghost of the original is the same geometry, stroked", () => {
    const paint = paintContext();
    const m = morphologyOf(ALBUMS[EWORLD].signature, ALBUMS[EWORLD].tracks.length);
    drawGhost(paint.ctx, m, 640, 400, 260, 0.3, "rgba(239,235,227,0.4)", 1.1);
    expect(paint.calls.filter((c) => c === "closePath")).toHaveLength(ALBUMS[EWORLD].tracks.length);
    expect(paint.calls.filter((c) => c === "ellipse")).toHaveLength(visibleSatellites(m));
    expect(paint.calls).not.toContain("fill");
  });

  it("satellites are kept only where they exist, with a backlight behind them", () => {
    const empty = paintContext();
    expect(drawFocus(empty.ctx, 1280, frameOf(ASG), "satellites", core)).toBe(false);
    const f = frameOf(EWORLD);
    f.satellites.push({ x: 500, y: 200, r: 30, ry: 21, w: 1 });
    const paint = paintContext();
    expect(drawFocus(paint.ctx, 1280, f, "satellites", core)).toBe(true);
    expect(paint.calls).toContain("createRadialGradient");
  });

  it("the name is kept by drawing the same text", () => {
    const f = frameOf(EWORLD);
    f.name = { text: "zero-project", font: "704 120px A", x: 40, y: 500 };
    const paint = paintContext();
    expect(drawFocus(paint.ctx, 1280, f, "name", core)).toBe(true);
    expect(paint.calls).toContain("fillText");
  });
});

describe("anatomy in the engine", () => {
  let env: EngineHarness;
  let engine: FieldEngine;

  const start = (opts: Parameters<typeof engineHarness>[0] = {}) => {
    env = engineHarness(opts);
    const display = (globalThis as { document: { createElement(t: string): unknown } }).document
      .createElement("canvas") as HTMLCanvasElement;
    const fonts = { archivo: "A", bodoni: "B", mono: "M" };
    engine = new FieldEngine(display, fonts, { isUiTarget: () => false });
    engine.start();
  };
  const run = (seconds: number) => {
    for (let i = 0; i < Math.ceil((seconds * 1000) / 16); i++) env.advance(16);
  };
  const inner = () =>
    engine as unknown as {
      M: AlbumMorphology;
      MORPH: AlbumMorphology[];
      focusAmt: number;
      compareK: number;
      gl: { uniforms: FieldUniforms };
      compareBake(): unknown;
      backDeps(): { ghost: { m: AlbumMorphology; alpha: number } | null };
    };
  const enter = (alb: number) => {
    engine.enterAlbum(alb);
    run(3);
  };

  afterEach(() => {
    engine.stop();
    env.restore();
  });

  it("isolating a part fades in on the shader and out again", () => {
    start();
    enter(EWORLD);
    expect(inner().gl.uniforms.uFocusMix.value.x).toBe(0);
    engine.setAnatomyFocus("satellites");
    run(1);
    expect(inner().gl.uniforms.uFocusMix.value.x).toBeCloseTo(1, 5);
    engine.setAnatomyFocus(null);
    run(1);
    expect(inner().gl.uniforms.uFocusMix.value.x).toBe(0);
  });

  it("a part that does not exist is not isolated", () => {
    start();
    enter(ASG);
    engine.setAnatomyFocus("satellites");
    run(1);
    expect(inner().focusAmt).toBe(0);
  });

  it("the contraprova blends towards the median form and leaves the catalogue untouched", () => {
    start();
    enter(EWORLD);
    const sig = JSON.stringify(ALBUMS[EWORLD].signature);
    const stored = inner().MORPH[EWORLD];
    const snapshot = JSON.stringify(stored);
    engine.setAnatomyFocus("satellites");
    engine.setCompare(true);
    run(2);
    expect(engine.getSnapshot().compare).toBe(true);
    expect(visibleSatellites(inner().M)).toBe(2);
    engine.setCompare(false);
    run(2);
    expect(inner().compareK).toBe(0);
    expect(visibleSatellites(inner().M)).toBe(4);
    expect(JSON.stringify(ALBUMS[EWORLD].signature)).toBe(sig);
    expect(inner().MORPH[EWORLD]).toBe(stored);
    expect(JSON.stringify(stored)).toBe(snapshot);
  });

  it("only the parts baked into the crown rebake it", () => {
    start();
    enter(DARK);
    engine.setAnatomyFocus("gaps");
    engine.setCompare(true);
    run(0.2);
    expect(inner().compareBake()).not.toBeNull();
    engine.setCompare(false);
    run(2);
    engine.setAnatomyFocus("posture");
    engine.setCompare(true);
    run(0.2);
    expect(inner().compareBake()).toBeNull();
  });

  it("comparing needs a measured part", () => {
    start();
    enter(EWORLD);
    engine.setCompare(true);
    expect(engine.getSnapshot().compare).toBe(false);
    engine.setAnatomyFocus("name");
    engine.setCompare(true);
    run(0.1);
    expect(engine.getSnapshot().compare).toBe(false);
  });

  it("leaving for the collection returns everything to the record", () => {
    start();
    enter(EWORLD);
    engine.setAnatomyFocus("satellites");
    engine.setCompare(true);
    run(1);
    engine.goScale("collection");
    run(2);
    const snap = engine.getSnapshot();
    expect(snap.focus).toBeNull();
    expect(snap.compare).toBe(false);
    expect(inner().compareK).toBe(0);
  });

  it("reading a part keeps the instruments awake", () => {
    start();
    enter(EWORLD);
    engine.setAnatomyFocus("strata");
    const clock = vi.spyOn(performance, "now");
    clock.mockReturnValue(performance.now() + IDLE_MS + 1000);
    env.advance();
    expect(engine.getSnapshot().idle).toBe(false);
    engine.setAnatomyFocus(null);
    clock.mockReturnValue(performance.now() + IDLE_MS + 1000);
    env.advance();
    expect(engine.getSnapshot().idle).toBe(true);
    clock.mockRestore();
  });

  it("invites once, after some time with a record, with that record's own fact", () => {
    start();
    enter(DARK);
    expect(engine.getSnapshot().invite).toBeNull();
    run(ANATOMY.invite.dwell);
    const invite = engine.getSnapshot().invite;
    expect(invite?.part).toBe("gaps");
    expect(env.storage.get(ANATOMY.key)).toBe("invited");
    run(ANATOMY.invite.shown + 1);
    expect(engine.getSnapshot().invite).toBeNull();
    engine.goScale("collection");
    run(2);
    enter(LEBAR);
    run(ANATOMY.invite.dwell + 2);
    expect(engine.getSnapshot().invite).toBeNull();
  });

  it("a visitor who already opened the anatomy is never invited", () => {
    start();
    enter(DARK);
    engine.openAnatomy();
    run(ANATOMY.invite.dwell + 2);
    expect(engine.getSnapshot().invite).toBeNull();
    expect(env.storage.get(ANATOMY.key)).toBe("opened");
  });

  it("a question dims the scene less than an experiment hides the change", () => {
    start();
    enter(EWORLD);
    engine.setAnatomyFocus("satellites");
    run(1);
    expect(inner().gl.uniforms.uFocusMix.value.y).toBeCloseTo(ANATOMY.focus.dim.ask, 5);
    engine.setCompare(true);
    run(2);
    expect(inner().gl.uniforms.uFocusMix.value.y).toBeCloseTo(ANATOMY.focus.dim.what, 5);
  });

  it("pressing the world during the experiment peeks at the original, without navigating", () => {
    start();
    enter(EWORLD);
    engine.setAnatomyFocus("satellites");
    engine.setCompare(true);
    run(2);
    engine.beginPan();
    run(0.6);
    expect(engine.getSnapshot().peek).toBe(true);
    expect(inner().compareK).toBe(0);
    engine.endPan(true);
    run(0.6);
    const snap = engine.getSnapshot();
    expect(snap.scale).toBe("album");
    expect(snap.peek).toBe(false);
    expect(snap.compare).toBe(true);
    expect(inner().compareK).toBe(1);
  });

  it("Escape during the experiment returns to the record, not out of the album", () => {
    start();
    enter(EWORLD);
    engine.setAnatomyFocus("satellites");
    engine.setCompare(true);
    run(1);
    engine.back();
    run(0.1);
    expect(engine.getSnapshot().compare).toBe(false);
    expect(engine.getSnapshot().scale).toBe("album");
  });

  it("the ghost of the original is drawn only while the form is changed", () => {
    start();
    enter(EWORLD);
    engine.setAnatomyFocus("satellites");
    run(0.5);
    expect(inner().backDeps().ghost).toBeNull();
    engine.setCompare(true);
    run(2);
    const ghost = inner().backDeps().ghost;
    expect(ghost?.m).toBe(inner().MORPH[EWORLD]);
    expect(ghost?.alpha).toBeCloseTo(ANATOMY.ghost.alpha, 5);
  });

  it("with reduced motion the isolation and the comparison switch without easing", () => {
    start({ reduced: true });
    enter(EWORLD);
    engine.setAnatomyFocus("satellites");
    run(0.1);
    expect(inner().focusAmt).toBe(1);
    engine.setCompare(true);
    run(0.05);
    expect(inner().compareK).toBe(1);
  });
});
