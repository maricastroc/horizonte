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
      resize: (w: number, h: number) => ({ dw: Math.max(2, w), dh: Math.max(2, h) }),
      dispose: () => {},
    }),
  };
});

import { ALBUMS } from "../content";
import { boundsOf } from "../content/signature";
import { FieldEngine } from "../engine/FieldEngine";
import * as T from "../engine/transport";
import type { Catalog } from "../engine/transport";
import { hitTest, layoutFor, sectorAt } from "../composition/layout";
import { NEUTRAL_MORPHOLOGY } from "../morphology";
import { MORPH } from "../tokens";
import { initialState } from "../state";
import { engineHarness, type EngineHarness, type FakeAudio } from "./fakes";

const FONTS = { archivo: "A", bodoni: "B", mono: "M" };

let env: EngineHarness | null = null;
let engine: FieldEngine | null = null;

const m = () => engine as FieldEngine;
const a = () => env as EngineHarness;

function world(options: Parameters<typeof engineHarness>[0] = {}) {
  env = engineHarness(options);
  const display = (globalThis as { document: { createElement(t: string): unknown } }).document
    .createElement("canvas") as HTMLCanvasElement;
  engine = new FieldEngine(display, FONTS, { isUiTarget: () => false });
  engine.start();
}

afterEach(() => {
  if (!env) return;
  engine?.stop();
  env.restore();
  env = null;
  engine = null;
});

describe("a throttled tab does not skip phases of the sequence", () => {
  const source = () =>
    (m() as unknown as { bus: { current: { el: FakeAudio } } }).bus.current.el.src;

  it("the integration step is clamped, however long the real interval is", () => {
    world();
    m().playTrack(0, 0);
    const before = m().st.seqT;
    a().advance(60_000);
    expect(m().st.seqT - before).toBeLessThanOrEqual(0.05 + 1e-9);
  });

  it("the fusion swaps the file even with five-second frames", () => {
    world();
    m().playTrack(0, 0);
    for (let i = 0; i < 80; i++) a().advance(16);

    const before = source();
    m().skip(1);
    for (let i = 0; i < 60; i++) a().advance(5000);

    expect(m().st.mode).toBe("playing");
    expect(m().st.fuseLoaded).toBe(true);
    expect(source()).not.toBe(before);
  });

  it("the collapse also reaches its end, only in slow motion", () => {
    world();
    m().playTrack(0, 0);
    for (let i = 0; i < 60; i++) a().advance(5000);
    expect(m().st.mode).toBe("playing");
  });
});

describe("single-track records", () => {
  const aTrack: Catalog = {
    size: 1,
    trackCount: () => 1,
    trackDuration: () => 60,
    hasTrack: (alb, trk) => alb === 0 && trk === 0,
  };

  it("skipping cycles over the track itself without overflowing", () => {
    const s = { ...initialState(), scale: "track" as const, mode: "playing" as const, playAlb: 0, trk: 0 };
    T.skip(s, aTrack, 1);
    expect(s.fuseB).toBe(0);
    expect(s.mode).toBe("fusion");
  });

  it("moving the selection never leaves the record", () => {
    const s = { ...initialState(), scale: "album" as const };
    T.stepSel(s, aTrack, 1);
    expect(s.sel).toBe(0);
    T.stepSel(s, aTrack, -1);
    expect(s.sel).toBe(0);
  });

  it("a single track's ring is the whole turn", () => {
    const bounds = [0, 1];
    expect(sectorAt(bounds, 0)).toBe(0);
    expect(sectorAt(bounds, 0.999)).toBe(0);
    expect(sectorAt(bounds, 1)).toBe(0);
  });
});

describe("degenerate window", () => {
  it("a tiny screen does not produce invalid measurements", () => {
    world({ innerWidth: 1, innerHeight: 1 });
    for (let i = 0; i < 30; i++) a().advance(16);

    for (const [k, v] of Object.entries(m().st)) {
      if (typeof v === "number") expect(Number.isFinite(v), k).toBe(true);
    }
  });

  it("the hit-test survives degenerate dimensions", () => {
    const s = { ...initialState(), scale: "album" as const };
    const h = hitTest(0.5, 0.5, 2, 2, s, layoutFor("desktop"), () => [0, 1], 1, () => NEUTRAL_MORPHOLOGY);
    expect(["body", "track", "empty"]).toContain(h.kind);
  });
});

describe("state invariants", () => {
  it("no numeric field becomes NaN during a long session", () => {
    world();
    m().enterAlbum(3);
    for (let i = 0; i < 40; i++) a().advance(16);
    m().playTrack(3, 1);
    for (let i = 0; i < 200; i++) a().advance(16);
    m().skip(1);
    for (let i = 0; i < 200; i++) a().advance(16);
    m().transport();
    for (let i = 0; i < 60; i++) a().advance(16);
    m().back();
    m().back();
    for (let i = 0; i < 120; i++) a().advance(16);

    for (const [k, v] of Object.entries(m().st)) {
      if (typeof v === "number") {
        expect(Number.isNaN(v), k).toBe(false);
        expect(Number.isFinite(v), k).toBe(true);
      }
    }
  });

  it("the album index never escapes the catalogue", () => {
    world();
    for (const target of [-50, 0, 4, 99, 2]) {
      m().st.navT = target;
      for (let i = 0; i < 60; i++) a().advance(16);
      expect(m().st.alb).toBeGreaterThanOrEqual(0);
      expect(m().st.alb).toBeLessThan(ALBUMS.length);
    }
  });

  it("the selection never points outside the open record", () => {
    world();
    for (let i = 0; i < ALBUMS.length; i++) {
      m().enterAlbum(i);
      a().advance(16);
      for (let k = 0; k < 30; k++) m().stepSel(1);
      expect(m().st.sel).toBeGreaterThanOrEqual(0);
      expect(m().st.sel).toBeLessThan(ALBUMS[i].tracks.length);
    }
  });
});

describe("sensory signature at the edges", () => {
  it("the ring boundaries sum to a full turn across the catalogue", () => {
    for (const a of ALBUMS) {
      const b = boundsOf(a.signature, a.tracks.length);
      expect(b[0]).toBe(0);
      expect(b[b.length - 1]).toBeCloseTo(1, 9);
    }
  });

  it("a record saturated in brightness stays within the painting limits", () => {
    const saturated = ALBUMS.find((a) => a.signature.brightness === 1);
    expect(saturated).toBeDefined();
    world();
    const i = ALBUMS.indexOf(saturated!);
    m().enterAlbum(i);
    for (let k = 0; k < 60; k++) a().advance(16);

    const C = (m() as unknown as { C: { rimHardness: number } }).C;
    const M = (m() as unknown as { M: { flatten: number; coreRatio: number } }).M;
    expect(M.flatten).toBeGreaterThanOrEqual(MORPH.flatten[0]);
    expect(M.flatten).toBeLessThanOrEqual(MORPH.flatten[1]);
    expect(M.coreRatio).toBeLessThanOrEqual(MORPH.core[1]);
    expect(C.rimHardness).toBeLessThanOrEqual(5);
  });
});
