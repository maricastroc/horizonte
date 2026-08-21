import { afterEach, beforeEach, describe, expect, it } from "vitest";
import frag from "@/shaders/field.frag.glsl";
import vert from "@/shaders/field.vert.glsl";
import { drawBack, makeParticles } from "../composition/back";
import { loadCovers, type CoverAsset } from "../composition/cover";
import { drawFront, frontTitle } from "../composition/front";
import { layoutFor } from "../composition/layout";
import { RingBakery } from "../composition/ring";
import { ALBUMS, boundsOf } from "../content";
import { fieldConstantsOf } from "../field";
import { morphologyOf } from "../morphology";
import { createFieldUniforms } from "../fieldMaterial";
import { initialState } from "../state";
import { PARTICLES } from "../tokens";
import type { FieldState, Mode, Scale, Variant } from "../types";
import { engineHarness, paintContext, type EngineHarness } from "./fakes";

const FONTS = { archivo: "Archivo", bodoni: "Bodoni", mono: "Mono" };

let env: EngineHarness;
let covers: CoverAsset[];
let rings: RingBakery;

const state = (over: Partial<FieldState> = {}): FieldState => ({ ...initialState(), ...over });

const weights = ALBUMS.map((a) => Math.round(fieldConstantsOf(a.signature).artistWeight));

const morphOf = (alb: number) =>
  morphologyOf(ALBUMS[alb].signature, ALBUMS[alb].tracks.length);

const backDeps = () => ({
  fonts: FONTS,
  covers,
  rings,
  weights: weights,
  parts: makeParticles(),
  C: fieldConstantsOf(ALBUMS[0].signature),
  morph: morphOf(0),
  morphOf,
});

beforeEach(() => {
  env = engineHarness();
  covers = loadCovers();
  rings = new RingBakery(covers);
});

afterEach(() => env.restore());

describe("shader contract", () => {
  const declared = (source: string) => {
    const names = new Set<string>();
    for (const m of source.matchAll(/uniform\s+\w+\s+([^;]+);/g)) {
      for (const label of m[1].split(",")) names.add(label.trim());
    }
    return names;
  };

  it("every shader uniform exists on the TypeScript side", () => {
    const uniforms = createFieldUniforms();
    const missing = [...declared(frag), ...declared(vert)].filter((n) => !(n in uniforms));
    expect(missing).toEqual([]);
  });

  it("every uniform declared in TypeScript is consumed by some shader", () => {
    const inShader = new Set([...declared(frag), ...declared(vert)]);
    const leftover = Object.keys(createFieldUniforms()).filter((n) => !inShader.has(n));
    expect(leftover).toEqual([]);
  });

  it("the shader's geometry attribute is what the material declares", () => {
    expect(vert).toContain("aP");
  });
});

describe("frontTitle", () => {
  it("in the collection it shows the record's name", () => {
    expect(frontTitle(state({ alb: 2 }))).toBe(ALBUMS[2].title);
  });

  it("in the album it shows the selected track", () => {
    expect(frontTitle(state({ scale: "album", alb: 2, sel: 1 }))).toBe(ALBUMS[2].tracks[1].title);
  });

  it("in the track it shows the one playing", () => {
    const s = state({ scale: "track", mode: "playing", alb: 2, trk: 3, sel: 0 });
    expect(frontTitle(s)).toBe(ALBUMS[2].tracks[3].title);
  });

  it("during the collapse it still shows the selection that started the gesture", () => {
    const s = state({ scale: "track", mode: "collapse", alb: 2, trk: 3, sel: 1 });
    expect(frontTitle(s)).toBe(ALBUMS[2].tracks[1].title);
  });

  it("past the fusion's midpoint, the title is already the destination's", () => {
    const s = state({ scale: "track", mode: "fusion", alb: 0, trk: 0, mix: 0.6, fuseAlb: 3, fuseB: 2 });
    expect(frontTitle(s)).toBe(ALBUMS[3].tracks[2].title);
  });

  it("before the fusion's midpoint, it is still the origin's", () => {
    const s = state({ scale: "track", mode: "fusion", alb: 0, trk: 1, mix: 0.4, fuseAlb: 3, fuseB: 2 });
    expect(frontTitle(s)).toBe(ALBUMS[0].tracks[1].title);
  });

  it("an index outside the record falls back to the album name", () => {
    expect(frontTitle(state({ scale: "album", alb: 0, sel: 999 }))).toBe(ALBUMS[0].title);
  });
});

describe("back painting", () => {
  const scales: Scale[] = ["collection", "album", "track"];
  const modes: Mode[] = ["stopped", "collapse", "playing", "paused", "fusion"];
  const variants: Variant[] = ["desktop", "tablet", "mobile"];

  it("crosses the whole scale/mode/variant matrix without breaking", () => {
    for (const scale of scales) {
      for (const mode of modes) {
        for (const variant of variants) {
          const s = state({
            scale, mode, alb: 3, sel: 1, trk: 1, playAlb: mode === "stopped" ? -1 : 3,
            play: 0.5, fadeSel: 0.5, mix: mode === "fusion" ? 0.5 : 0, fuseAlb: 4, fuseB: 0,
            dur: 200, pos: 50, energy: 0.6,
          });
          const reg = paintContext();
          expect(() => drawBack(reg.ctx, 1400, 900, s, layoutFor(variant), backDeps()),
            `${scale}/${mode}/${variant}`).not.toThrow();
          expect(reg.calls.length, `${scale}/${mode}/${variant}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("paints the background before any body", () => {
    const reg = paintContext();
    drawBack(reg.ctx, 1400, 900, state(), layoutFor("desktop"), backDeps());
    expect(reg.calls[0]).toBe("fillRect");
  });

  it("uses the type weight the engine derived, it does not recompute", () => {
    const reg = paintContext();
    const deps = { ...backDeps(), weights: ALBUMS.map(() => 777) };
    drawBack(reg.ctx, 1400, 900, state({ nav: 0 }), layoutFor("desktop"), deps);
    expect(reg.sources.some((f) => f.startsWith("777 "))).toBe(true);
  });

  it("the artist name shrinks when it does not fit the usable width", () => {
    const L = layoutFor("desktop");
    const s = state({ alb: 0 });

    const short = paintContext(10);
    drawBack(short.ctx, 1400, 900, s, L, backDeps());
    const long = paintContext(100_000);
    drawBack(long.ctx, 1400, 900, s, L, backDeps());

    const size = (reg: ReturnType<typeof paintContext>) => {
      const f = reg.sources.filter((x) => x.includes("Archivo")).pop() ?? "";
      return Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);
    };
    expect(size(long)).toBeLessThan(size(short));
    expect(size(long)).toBeGreaterThan(0);
  });

  it("the weight is applied before the width fit", () => {
    const reg = paintContext(100_000);
    const deps = { ...backDeps(), C: fieldConstantsOf(ALBUMS[7].signature) };
    drawBack(reg.ctx, 1400, 900, state({ alb: 7 }), layoutFor("desktop"), deps);
    const fromSource = reg.sources.filter((f) => f.includes("Archivo"));
    const targetWeight = Math.round(deps.C.artistWeight);
    for (const f of fromSource.slice(-2)) expect(f.startsWith(`${targetWeight} `)).toBe(true);
  });

  it("on mobile the name is fitted to width too, otherwise it leaves the screen", () => {
    expect(layoutFor("mobile").fitCollection).toBeGreaterThan(0);
    expect(layoutFor("mobile").fitAlbum).toBeGreaterThan(0);
    const reg = paintContext(100_000);
    expect(() => drawBack(reg.ctx, 400, 900, state(), layoutFor("mobile"), backDeps())).not.toThrow();
  });

  it("on mobile an over-wide name shrinks, as on desktop", () => {
    const L = layoutFor("mobile");
    const s = state({ alb: 0 });

    const short = paintContext(10);
    drawBack(short.ctx, 750, 1300, s, L, backDeps());
    const long = paintContext(100_000);
    drawBack(long.ctx, 750, 1300, s, L, backDeps());

    const size = (reg: ReturnType<typeof paintContext>) => {
      const f = reg.sources.filter((x) => x.includes("Archivo")).pop() ?? "";
      return Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);
    };
    expect(size(long)).toBeLessThan(size(short));
    expect(size(long)).toBeGreaterThan(0);
  });

  it("measures the text once per frame when fitting is on", () => {
    const reg = paintContext(10);
    drawBack(reg.ctx, 1400, 900, state(), layoutFor("desktop"), backDeps());
    expect(reg.calls.filter((c) => c === "measureText")).toHaveLength(1);
  });
});

describe("front painting", () => {
  it("crosses the scales without breaking", () => {
    for (const scale of ["collection", "album", "track"] as Scale[]) {
      const reg = paintContext();
      const s = state({ scale, alb: 1, sel: 1, trk: 1, play: 0.4 });
      expect(() => drawFront(reg.ctx, 1400, 900, s, layoutFor("desktop"), { fonts: FONTS, covers }),
        scale).not.toThrow();
    }
  });

  it("clears the layer before writing", () => {
    const reg = paintContext();
    drawFront(reg.ctx, 1400, 900, state(), layoutFor("desktop"), { fonts: FONTS, covers });
    expect(reg.calls[0]).toBe("clearRect");
  });

  it("writes the title in Bodoni and the subtitle in mono", () => {
    const reg = paintContext();
    drawFront(reg.ctx, 1400, 900, state(), layoutFor("desktop"), { fonts: FONTS, covers });
    expect(reg.sources.some((f) => f.includes("Bodoni"))).toBe(true);
    expect(reg.sources.some((f) => f.includes("Mono"))).toBe(true);
  });
});

describe("particles", () => {
  it("they are born in the declared quantity and inside the record", () => {
    const parts = makeParticles();
    expect(parts).toHaveLength(PARTICLES);
    for (const q of parts) {
      expect(q.r).toBeGreaterThan(0);
      expect(q.r).toBeLessThan(1);
      expect(q.a).toBeGreaterThanOrEqual(0);
      expect(q.z).toBeGreaterThanOrEqual(0);
      expect(q.z).toBeLessThanOrEqual(1);
    }
  });

  it("they spin in both directions", () => {
    const parts = makeParticles();
    expect(parts.some((q) => q.s > 0)).toBe(true);
    expect(parts.some((q) => q.s < 0)).toBe(true);
  });
});

describe("RingBakery", () => {
  it("the ring boundaries are the record signature's", () => {
    for (let i = 0; i < ALBUMS.length; i++) {
      expect(rings.bounds(i)).toEqual(boundsOf(ALBUMS[i].signature, ALBUMS[i].tracks.length));
    }
  });

  it("the boundaries come memoized across frames", () => {
    expect(rings.bounds(2)).toBe(rings.bounds(2));
  });

  it("each record's arc is baked once and reused", () => {
    const a = rings.arc(1);
    expect(rings.arc(1)).toBe(a);
  });

  it("a new cover invalidates the baked arc", () => {
    const a = rings.arc(1);
    covers[1].version++;
    expect(rings.arc(1)).not.toBe(a);
  });

  it("the sector always returns the same output buffer", () => {
    const s = rings.seg(0, 0, -1, -1, 0, "rgba(0,0,0,1)");
    expect(rings.seg(0, 1, -1, -1, 0, "rgba(0,0,0,1)")).toBe(s);
  });
});
