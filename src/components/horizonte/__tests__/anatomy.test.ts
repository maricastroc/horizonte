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
  nameWeightOf,
  satelliteOnsets,
  questionsOf,
  readingOf,
  visibleSatellites,
  type CompareAxis,
  type Question,
} from "../anatomy";
import { ALBUMS, CURATED_COUNT } from "../content";
import { ANATOMY_EN } from "../i18n/anatomy.en";
import { ANATOMY_PT } from "../i18n/anatomy.pt-BR";
import { FieldEngine } from "../engine/FieldEngine";
import type { FieldUniforms } from "../fieldMaterial";
import { morphologyOf, pulseSpreadOf, shellsAt, type AlbumMorphology } from "../morphology";
import { drawFacing, drawFocus, drawGhost, emptyFrame } from "../composition/focus";
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

const say = (q: Question) => ANATOMY_EN.phrase(q);
const part = (alb: number, p: Question["part"]) => questionsOf(alb).find((q) => q.part === p)!;

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
        for (const w of [ANATOMY_EN, ANATOMY_PT]) {
          const p = w.phrase(q);
          expect(p.ask.endsWith("?")).toBe(true);
          expect(p.answer.length).toBeGreaterThan(20);
          expect(p.what === null).toBe(!q.experiment);
        }
        expect(q.reading.axis).toBe(AXIS_OF[q.part]);
        expect(q.finding.part).toBe(q.part);
      }
    }
  });

  it("each record leads with what stands out in it", () => {
    expect(say(questionsOf(EWORLD)[0]).ask).toBe("Where do the four small bodies come from?");
    expect(say(questionsOf(DARK)[0]).ask).toBe("Why is the ring broken apart?");
    expect(say(questionsOf(MKULTRA)[0]).ask).toBe("Why is the shape so flat?");
    expect(say(questionsOf(ASG)[0]).ask).toBe("Why does the shape look so open?");
    expect(say(questionsOf(LEBAR)[0]).ask).toBe("Why is its edge so jagged?");
    expect(ANATOMY_PT.phrase(questionsOf(EWORLD)[0]).ask).toBe("De onde vêm os quatro pequenos corpos?");
    expect(ANATOMY_PT.phrase(questionsOf(MKULTRA)[0]).ask).toBe("Por que a forma está tão achatada?");
  });

  it("the experiment says which way the record would change", () => {
    const sat = (i: number) => say(part(i, "satellites"));
    const pos = (i: number) => say(part(i, "posture"));
    expect([sat(EWORLD).what, sat(EWORLD).label]).toEqual(["What if the record were shorter?", "Shorter"]);
    expect([sat(ASG).what, sat(ASG).label]).toEqual(["What if the record were longer?", "Longer"]);
    expect([pos(MKULTRA).what, pos(MKULTRA).label]).toEqual(["What if it had more treble?", "More treble"]);
    expect([pos(ASG).what, pos(ASG).label]).toEqual(["What if it had less treble?", "Less treble"]);
    const ptPos = ANATOMY_PT.phrase(part(MKULTRA, "posture"));
    expect([ptPos.what, ptPos.label]).toEqual(["E se o som tivesse mais agudos?", "Mais agudos"]);
  });

  it("the result names what the eye will see, counted by the real morphology", () => {
    const sat = (i: number) => say(part(i, "satellites"));
    expect(sat(EWORLD).result).toBe(
      "At 34 minutes, the collection's typical length, two small bodies remain. " +
        "The ones that go stood for this record's extra 41 minutes.",
    );
    expect(sat(ASG).result).toContain("two small bodies appear");
    expect(ANATOMY_PT.phrase(part(EWORLD, "satellites")).result).toBe(
      "Com 34 minutos, a duração típica da coleção, restam dois pequenos corpos. " +
        "Os que somem representavam os 41 minutos a mais deste disco.",
    );
    expect(visibleSatellites(compareMorphology(EWORLD, "duration"))).toBe(2);
  });

  it("speaks without technical numbers, except minutes", () => {
    for (let i = 0; i < CURATED_COUNT; i++) {
      for (const q of questionsOf(i)) {
        const en = say(q);
        for (const text of [en.ask, en.answer, en.what ?? "", en.result]) {
          expect(text.replace(/\d+ minutes/g, "")).not.toMatch(/\d|dB|Hz|median/);
        }
        const pt = ANATOMY_PT.phrase(q);
        for (const text of [pt.ask, pt.answer, pt.what ?? "", pt.result]) {
          expect(text.replace(/\d+ minutos?/g, "")).not.toMatch(/\d|dB|Hz|mediana/);
        }
      }
    }
  });

  it("a record close to the usual gets a neutral question and no experiment", () => {
    const core = part(MKULTRA, "core");
    expect(core.experiment).toBe(false);
    expect(say(core).what).toBeNull();
    expect(say(core).ask).toBe("What sets the size of its dark center?");
    expect(ANATOMY_PT.phrase(core).ask).toBe("O que define o tamanho do centro escuro?");
    expect(core.score).toBeCloseTo(0, 4);
  });

  it("gaps are explained by the rhythm between tracks, never by dynamics", () => {
    const gaps = part(DARK, "gaps");
    expect(gaps.reading.axis).toBe("spread");
    expect(say(gaps).answer).toMatch(/beat|rhythm/);
    expect(say(gaps).answer).not.toMatch(/dynamic|volume|loud/i);
    expect(ANATOMY_PT.phrase(gaps).answer).toMatch(/batida|ritmo/);
    expect(ANATOMY_PT.phrase(gaps).answer).not.toMatch(/dinâmic|volume|forte|suave/i);
  });

  it("gaps are one measure of the whole record, not a break at each change", () => {
    for (let i = 0; i < CURATED_COUNT; i++) {
      const q = part(i, "gaps");
      const en = say(q).answer;
      const pt = ANATOMY_PT.phrase(q).answer;
      expect(en).not.toMatch(/each change/i);
      expect(pt).not.toMatch(/cada mudança/i);
      if (q.finding.near) continue;
      expect(en).toMatch(/whole ring|only open|all of them/);
      expect(pt).toMatch(/anel inteiro|só se abrem|todos eles/);
      expect(say(q).result).toMatch(/all around the ring/);
      expect(ANATOMY_PT.phrase(q).result).toMatch(/em todo o anel/);
    }
  });

  it("layers are asked about in the same direction the experiment moves them", () => {
    for (let i = 0; i < CURATED_COUNT; i++) {
      const q = part(i, "strata");
      if (!q.experiment || q.finding.part !== "strata") continue;
      const en = say(q);
      const pt = ANATOMY_PT.phrase(q);
      if (q.finding.high) {
        expect(en.ask).not.toMatch(/faint|no layers/);
        expect(pt.ask).not.toMatch(/mal aparecem|não tem/);
        expect(en.what).toBe("What if the rhythm were less regular?");
        expect(pt.what).toBe("E se o ritmo fosse menos regular?");
      } else {
        expect(en.ask).not.toMatch(/^Why (does the ring have|does the ring split into) layers/);
        expect(en.what).toBe("What if the rhythm were more regular?");
        expect(pt.what).toBe("E se o ritmo fosse mais regular?");
      }
      for (const text of [en.ask, en.answer, en.what, pt.ask, pt.answer, pt.what]) {
        expect(text).not.toMatch(/\bfirm\b|\bloos(e|er)\b|strong beat|firme|solta|batida forte/i);
      }
    }
  });

  it("the dark center's experiment changes the whole body, and never the name", () => {
    for (let i = 0; i < CURATED_COUNT; i++) {
      const q = part(i, "core");
      if (!q.experiment) continue;
      expect(say(q).result).toMatch(/whole body/);
      expect(ANATOMY_PT.phrase(q).result).toMatch(/corpo inteiro/);
      for (const text of [say(q).answer, say(q).result, ANATOMY_PT.phrase(q).result]) {
        expect(text).not.toMatch(/\bname\b|\bnome\b/i);
      }
      expect(say(q).what).toMatch(/overall/);
      expect(ANATOMY_PT.phrase(q).what).toMatch(/volume médio/);
    }
  });

  it("the edge is explained by its shape alone, not by how it moves while playing", () => {
    for (let i = 0; i < CURATED_COUNT; i++) {
      const q = part(i, "contour");
      expect(say(q).answer).not.toMatch(/playing|pulses/i);
      expect(ANATOMY_PT.phrase(q).answer).not.toMatch(/ao tocar|pulsa/i);
    }
  });

  it("length never claims the main body would grow", () => {
    for (let i = 0; i < CURATED_COUNT; i++) {
      const q = part(i, "satellites");
      expect(say(q).answer).not.toMatch(/instead of growing|grows? with/i);
      expect(ANATOMY_PT.phrase(q).answer).not.toMatch(/em vez de crescer|cresce com/i);
    }
  });

  it("the typical length is the median the counterproof uses", () => {
    const f = part(EWORLD, "satellites").finding;
    if (f.part !== "satellites") throw new Error("satellites");
    expect(f.usual).toBe(Math.round(readingOf(EWORLD, "duration").median / 60));
    expect(f.usual).toBe(34);
    expect(f.extra).toBe(f.minutes - f.usual);
    expect(compareSignature(ALBUMS[EWORLD].signature, "duration").duration).toBe(medianOf("duration"));
  });

  it("the minutes at which small bodies appear are the morphology's own", () => {
    const onsets = satelliteOnsets();
    expect(onsets.map(Math.round)).toEqual([23, 33, 44, 54]);
    const sig = ALBUMS[EWORLD].signature;
    const at = (min: number) =>
      visibleSatellites(morphologyOf({ ...sig, duration: (min * 60 - 900) / 4500 }, 12));
    onsets.forEach((min, i) => {
      expect(at(min - 0.1)).toBe(i);
      expect(at(min + 0.1)).toBe(i + 1);
    });
  });

  it("the invitation is the record's leading question", () => {
    for (let i = 0; i < CURATED_COUNT; i++) {
      expect(inviteOf(i)).toEqual({ part: questionsOf(i)[0].part });
    }
  });

  it("the deeper layer keeps the measurements and their standing", () => {
    const standing = (alb: number, axis: CompareAxis) => ANATOMY_EN.standing(readingOf(alb, axis));
    expect(standing(EWORLD, "duration")).toBe("longest of 14");
    expect(standing(EWORLD, "pulse")).toBe("most regular of 14");
    expect(standing(ASG, "duration")).toBe("shortest of 14");
    expect(standing(ASG, "brightness")).toBe("brightest of 14");
    expect(standing(ASG, "dynamics")).toBe("lowest contrast of 14");
    expect(standing(LEBAR, "dynamics")).toBe("highest contrast of 14");
    expect(standing(DARK, "spread")).toBe("most uneven of 14");
    expect(standing(MKULTRA, "brightness")).toBe("darkest of 14");
    expect(standing(DUST, "pulse")).toBe("least regular of 14");
    expect(standing(LEBAR, "brightness")).toBe("12th brightest of 14");
    expect(nameWeightOf(EWORLD)).toBe(704);
    const core = part(EWORLD, "core").finding;
    if (core.part !== "core") throw new Error("core");
    expect(core.nameWeight).toBe(704);
    expect(ANATOMY_EN.details(part(EWORLD, "core"))).toEqual([["Name weight", "704"]]);
    expect(ANATOMY_EN.nameFact(core)).toBe(
      "The name follows average loudness too: the louder the record, the thicker its letters. " +
        "This one is set a little heavier than most.",
    );
    expect(ANATOMY_PT.details(part(EWORLD, "satellites"))).toEqual([
      ["Corpos surgem em", "23 · 33 · 44 · 54 min"],
    ]);
  });

  it("medians come from the fourteen curated records only", () => {
    for (const axis of ["duration", "pulse", "dynamics", "brightness", "loudness"] as const) {
      const xs = ALBUMS.slice(0, CURATED_COUNT)
        .map((a) => a.signature[axis])
        .sort((a, b) => a - b);
      expect(medianOf(axis)).toBeCloseTo((xs[6] + xs[7]) / 2, 9);
    }
    expect(ANATOMY_EN.shown("duration", readingOf(EWORLD, "duration").median)).toBe("34 min");
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

  const KEEP = "rgb(255,0,0)";
  const LIGHT = "rgb(0,255,0)";
  const record = () => {
    const paint = paintContext();
    const ops: { op: string; style: string; alpha: number }[] = [];
    const ctx = new Proxy(paint.ctx as unknown as Record<string, unknown>, {
      get(target, key: string) {
        const value = target[key];
        if (key === "moveTo") {
          return (...args: number[]) => {
            ops.push({ op: key, style: args.map((v) => Math.round(v)).join(","), alpha: 1 });
            return (value as (...a: unknown[]) => unknown)(...args);
          };
        }
        if (key !== "fill" && key !== "stroke") return value;
        return (...args: unknown[]) => {
          const style = paint.props[key === "fill" ? "fillStyle" : "strokeStyle"];
          ops.push({ op: key, style: String(style), alpha: Number(paint.props.globalAlpha ?? 1) });
          return (value as (...a: unknown[]) => unknown)(...args);
        };
      },
      set(target, key: string, value) {
        target[key] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, ops, calls: paint.calls };
  };
  const lit = (ops: { op: string; style: string }[], op: string, style: string) =>
    ops.filter((o) => o.op === op && o.style === style).length;

  it("draws the crown from the morphology, one closed sector per track", () => {
    const paint = paintContext();
    expect(drawFocus(paint.ctx, 1280, frameOf(DARK), "contour", core)).toBe(true);
    expect(paint.calls.filter((c) => c === "closePath")).toHaveLength(ALBUMS[DARK].tracks.length);
    expect(paint.calls).not.toContain("drawImage");
  });

  it("the parts that live in the ring keep it at half light, each with a light of its own", () => {
    for (const part of ["gaps", "strata", "contour"] as const) {
      const r = record();
      expect(drawFocus(r.ctx, 1280, frameOf(EWORLD), part, core)).toBe(true);
      const half = r.ops.filter((o) => o.op === "fill" && o.style === KEEP);
      expect(half).toHaveLength(1);
      expect(half[0].alpha).toBeCloseTo(ANATOMY.focus.part.crown, 5);
    }
  });

  it("gaps light a slit inside every break, with a faint glow across it", () => {
    const r = record();
    drawFocus(r.ctx, 1280, frameOf(DARK), "gaps", core);
    expect(lit(r.ops, "fill", LIGHT)).toBe(3 * ALBUMS[DARK].tracks.length);
    expect(lit(r.ops, "stroke", LIGHT)).toBe(0);
  });

  it("layers light the space between them, in every sector", () => {
    const r = record();
    const f = frameOf(EWORLD);
    drawFocus(r.ctx, 1280, f, "strata", core);
    const layers = shellsAt(f.m!, 0.01).length;
    expect(layers).toBe(3);
    expect(lit(r.ops, "fill", LIGHT)).toBe(ALBUMS[EWORLD].tracks.length * (layers - 1));
  });

  it("a ring of a single layer falls back to lighting the whole crown", () => {
    const r = record();
    drawFocus(r.ctx, 1280, frameOf(DUST), "strata", core);
    expect(lit(r.ops, "fill", LIGHT)).toBe(0);
    expect(r.ops.some((o) => o.op === "fill" && o.style === KEEP && o.alpha === 1)).toBe(true);
  });

  it("the edge keeps a band along the outline, with a glow that follows it", () => {
    const r = record();
    drawFocus(r.ctx, 1280, frameOf(LEBAR), "contour", core);
    expect(lit(r.ops, "stroke", KEEP)).toBe(1);
    const glow = r.ops.filter((o) => o.op === "stroke" && o.style === LIGHT);
    expect(glow).toHaveLength(1);
    expect(glow[0].alpha).toBeCloseTo(ANATOMY.focus.part.glow, 5);
    expect(lit(r.ops, "fill", LIGHT)).toBe(0);
  });

  it("posture keeps the face-on outline lit, so the reference is never dimmed", () => {
    const r = record();
    expect(drawFocus(r.ctx, 1280, frameOf(MKULTRA), "posture", core)).toBe(true);
    expect(lit(r.ops, "stroke", KEEP)).toBe(1);
  });

  it("the face-on reference is one closed dashed outline, round whatever the tilt", () => {
    const paint = paintContext();
    const m = morphologyOf(ALBUMS[MKULTRA].signature, ALBUMS[MKULTRA].tracks.length);
    drawFacing(paint.ctx, m, 640, 400, 260, 0.3, "rgba(239,235,227,0.5)", 1.1);
    expect(paint.calls.filter((c) => c === "setLineDash")).toHaveLength(1);
    expect(paint.calls.filter((c) => c === "closePath")).toHaveLength(1);
    expect(paint.calls.filter((c) => c === "stroke")).toHaveLength(1);
    expect(paint.calls).not.toContain("fill");
    expect(paint.calls).not.toContain("ellipse");
  });

  it("gaps, layers and edge no longer light the same thing", () => {
    const sign = (part: "gaps" | "strata" | "contour") => {
      const r = record();
      drawFocus(r.ctx, 1280, frameOf(EWORLD), part, core);
      return JSON.stringify(r.ops.map((o) => [o.op, o.style]));
    };
    expect(new Set([sign("gaps"), sign("strata"), sign("contour")]).size).toBe(3);
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

  it("during the counterproof the mask follows each baked step of the ring", () => {
    start();
    enter(DARK);
    engine.setAnatomyFocus("gaps");
    run(0.5);
    const keys = new Set<string>();
    engine.setCompare(true);
    for (let i = 0; i < 80; i++) {
      env.advance(16);
      keys.add((engine as unknown as { focusKey: string }).focusKey.split("|").at(-1)!);
    }
    expect(keys.size).toBeGreaterThanOrEqual(ANATOMY.compare.steps);
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

  it("the face-on reference appears only while posture is asked about", () => {
    start();
    enter(MKULTRA);
    const facing = () => (inner().backDeps() as unknown as { facing: number }).facing;
    expect(facing()).toBe(0);
    engine.setAnatomyFocus("contour");
    run(1);
    expect(facing()).toBe(0);
    engine.setAnatomyFocus("posture");
    run(1);
    expect(facing()).toBeCloseTo(1, 5);
    engine.setCompare(true);
    run(2);
    expect(facing()).toBeCloseTo(1, 5);
    engine.setCompare(false);
    engine.setAnatomyFocus(null);
    run(1);
    expect(facing()).toBe(0);
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
