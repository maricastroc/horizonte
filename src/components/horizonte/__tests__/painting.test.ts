import { afterEach, beforeEach, describe, expect, it } from "vitest";
import frag from "@/shaders/field.frag.glsl";
import vert from "@/shaders/field.vert.glsl";
import { drawBack, frontShare, makeParticles, seatUnder, type Caption } from "../composition/back";
import { loadCovers, type CoverAsset } from "../composition/cover";
import { drawFront, frontTitle } from "../composition/front";
import { collectionBody, layoutFor } from "../composition/layout";
import { RingBakery } from "../composition/ring";
import { ALBUMS, boundsOf } from "../content";
import { fieldConstantsOf } from "../field";
import { morphologyOf, satRadiusOf, wholeReachOf } from "../morphology";
import { createFieldUniforms } from "../fieldMaterial";
import { initialState } from "../state";
import { NAMES, PARTICLES } from "../tokens";
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

const frontDeps = () => ({ fonts: FONTS, covers, weights });

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
    drawFront(short.ctx, 1400, 900, s, L, frontDeps());
    const long = paintContext(100_000);
    drawFront(long.ctx, 1400, 900, s, L, frontDeps());

    const size = (reg: ReturnType<typeof paintContext>) => {
      const f = reg.sources.filter((x) => x.includes("Archivo")).pop() ?? "";
      return Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);
    };
    expect(size(long)).toBeLessThan(size(short));
    expect(size(long)).toBeGreaterThan(0);
  });

  it("the weight is applied before the width fit", () => {
    const reg = paintContext(100_000);
    const artistWeight = fieldConstantsOf(ALBUMS[7].signature).artistWeight;
    const deps = { ...frontDeps(), artistWeight };
    drawFront(reg.ctx, 1400, 900, state({ alb: 7, nav: 7, navT: 7 }), layoutFor("desktop"), deps);
    const fromSource = reg.sources.filter((f) => f.includes("Archivo"));
    const targetWeight = Math.round(artistWeight);
    for (const f of fromSource.slice(-2)) expect(f.startsWith(`${targetWeight} `)).toBe(true);
  });

  it("on mobile the name is fitted to width too, otherwise it leaves the screen", () => {
    expect(layoutFor("mobile").fitCollection).toBeGreaterThan(0);
    expect(layoutFor("mobile").fitAlbum).toBeGreaterThan(0);
    const reg = paintContext(100_000);
    expect(() => drawFront(reg.ctx, 400, 900, state(), layoutFor("mobile"), frontDeps())).not.toThrow();
  });

  it("on mobile an over-wide name shrinks, as on desktop", () => {
    const L = layoutFor("mobile");
    const s = state({ alb: 0 });

    const short = paintContext(10);
    drawFront(short.ctx, 750, 1300, s, L, frontDeps());
    const long = paintContext(100_000);
    drawFront(long.ctx, 750, 1300, s, L, frontDeps());

    const size = (reg: ReturnType<typeof paintContext>) => {
      const f = reg.sources.filter((x) => x.includes("Archivo")).pop() ?? "";
      return Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);
    };
    expect(size(long)).toBeLessThan(size(short));
    expect(size(long)).toBeGreaterThan(0);
  });

  it("text is measured once per lockup line per frame, and neighbour names only once ever", () => {
    drawBack(paintContext(10).ctx, 1400, 900, state(), layoutFor("desktop"), backDeps());
    const back = paintContext(10);
    drawBack(back.ctx, 1400, 900, state(), layoutFor("desktop"), backDeps());
    expect(back.calls.filter((c) => c === "measureText")).toHaveLength(0);
    const front = paintContext(10);
    drawFront(front.ctx, 1400, 900, state(), layoutFor("desktop"), frontDeps());
    expect(front.calls.filter((c) => c === "measureText").length).toBeLessThanOrEqual(3);
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

describe("neighbour captions in the collection", () => {
  const W = 1440;
  const H = 900;
  const L = layoutFor("desktop");
  const s = state({ nav: 5, navT: 5, alb: 5 });
  type Lens = (x: number, y: number) => [number, number, number];

  const captionsOf = (st = s, lens?: Lens) => {
    const captions: Caption[] = [];
    drawBack(paintContext(400).ctx, W, H, st, L, { ...backDeps(), lens, captions });
    return captions;
  };

  const named = (list: Caption[], st = s) =>
    ALBUMS.map((a, i) => (list.some((c) => c.artist === a.artist) ? i : -1)).filter(
      (i) => i >= 0 && i !== st.alb,
    );

  it("they are handed to the front plane, never painted behind the bodies", () => {
    const reg = paintContext(400);
    const seen: string[] = [];
    const ctx = new Proxy(reg.ctx, {
      get(base, key: string) {
        if (key === "fillText") return (text: string) => seen.push(text);
        return Reflect.get(base, key);
      },
    });
    const captions: Caption[] = [];
    drawBack(ctx, W, H, s, L, { ...backDeps(), captions });
    expect(captions.length).toBeGreaterThan(0);
    for (const c of captions) expect(seen).not.toContain(c.artist);
  });

  it("only the nearest neighbours are named; further ones only when pointed at", () => {
    expect(named(captionsOf())).toEqual([6]);
    const pointed = { ...s, hoverBody: 8 };
    expect(named(captionsOf(pointed), pointed)).toContain(8);
  });

  it("a neighbour whose caption would cover the lockup goes unnamed rather than climbing", () => {
    expect(captionsOf().some((c) => c.artist === ALBUMS[4].artist)).toBe(false);
  });

  it("the meta line sits under the name, never on it", () => {
    for (const c of captionsOf()) {
      expect(c.step).toBeGreaterThan(c.tsz * NAMES.descent);
      expect(c.msz).toBeLessThan(c.tsz);
    }
  });

  it("without a lens, every caption sits the same gap under the shape drawn above it", () => {
    let checked = 0;
    for (const nav of [1, 2, 4, 5, 7, 9, 11]) {
      const st = state({ nav, navT: nav, alb: nav });
      const c = captionsOf(st).find((q) => q.artist === ALBUMS[nav + 1].artist);
      if (!c) continue;
      checked++;
      const m = morphOf(nav + 1);
      const body = collectionBody(W, H, st, L, nav + 1, m);
      const seat = seatUnder(m, body.R, c.half, c.tsz * NAMES.gap, c.top + c.bottom);
      expect((c.y - c.top - (body.cy + seat.base)) / c.tsz).toBeCloseTo(NAMES.gap, 3);
    }
    expect(checked).toBeGreaterThan(4);
  });

  it("under an uneven lens the gap is kept where the eye sees it, not on the canvas", () => {
    const c0 = captionsOf().find((q) => q.artist === ALBUMS[6].artist)!;
    const squeeze: Lens = (_x, y) => [0, -(y - c0.y) * 0.25, 0];
    const back = (qy: number) => {
      let py = qy;
      for (let k = 0; k < 40; k++) py = qy - squeeze(0, py)[1];
      return py;
    };
    const front = (qx: number, qy: number) => {
      let py = qy;
      for (let k = 0; k < 40; k++) {
        const [ox, oy] = squeeze(qx, py);
        py = qy - oy * frontShare(ox, oy, W, H);
      }
      return py;
    };
    const c = captionsOf(s, squeeze).find((q) => q.artist === ALBUMS[6].artist)!;
    const m = morphOf(6);
    const body = collectionBody(W, H, s, L, 6, m);
    const seat = seatUnder(m, body.R, c.half, c.tsz * NAMES.gap, c.top + c.bottom);
    const baseSeen = back(body.cy + seat.base);
    const labelSeen = front(c.x, c.y);
    expect((labelSeen - c.top - baseSeen) / c.tsz).toBeCloseTo(NAMES.gap, 2);
  });

  it("captions land inside the frame and below the navigation where the lens shows them", () => {
    const push: Lens = () => [200, 120, 0];
    const share = frontShare(200, 120, W, H);
    const list = captionsOf(s, push);
    expect(list.length).toBeGreaterThan(0);
    for (const c of list) {
      const x = c.x - 200 * share;
      const y = c.y - 120 * share;
      expect(x - c.half).toBeGreaterThanOrEqual(W * NAMES.edge - 1e-6);
      expect(x + c.half).toBeLessThanOrEqual(W * (1 - NAMES.edge) + 1e-6);
      expect(y - c.top).toBeGreaterThanOrEqual(H * NAMES.ceiling - 1e-6);
    }
  });

  it("the front plane draws them", () => {
    const reg = paintContext(400);
    const seen: string[] = [];
    const ctx = new Proxy(reg.ctx, {
      get(base, key: string) {
        if (key === "fillText") return (text: string) => seen.push(text);
        return Reflect.get(base, key);
      },
    });
    const captions = captionsOf();
    drawFront(ctx, W, H, s, L, { ...frontDeps(), captions });
    for (const c of captions) {
      expect(seen).toContain(c.artist);
      expect(seen).toContain(c.meta);
    }
  });
});

describe("a caption takes its seat under the crown, not under a moon", () => {
  it("it never sits on a satellite, and only drops below one when sliding aside is not enough", () => {
    let slid = 0;
    for (let i = 0; i < ALBUMS.length; i++) {
      const m = morphOf(i);
      const R = 150;
      for (const half of [40, 70, 100]) {
        const gap = 12;
        const height = 34;
        const seat = seatUnder(m, R, half, gap, height);
        const orbit = wholeReachOf(m) / m.rMax;
        for (const sat of m.satellites.filter((q) => q.weight > 0.02)) {
          const x = Math.cos(sat.angle) * sat.dist * orbit * R;
          const y = Math.sin(sat.angle) * sat.dist * orbit * R * m.flatten;
          const r = satRadiusOf(m, sat) * R;
          const across = Math.abs(x - seat.dx) < half + r;
          const along = y + r * m.flatten > seat.base + gap && y - r * m.flatten < seat.base + gap + height;
          expect(across && along).toBe(false);
        }
        expect(Math.abs(seat.dx)).toBeLessThanOrEqual(half);
        if (seat.dx !== 0) slid++;
      }
    }
    expect(slid).toBeGreaterThan(0);
  });
});
