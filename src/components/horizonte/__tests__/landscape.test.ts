import { afterEach, describe, expect, it } from "vitest";
import { ALBUMS, registerAlbum, resetCatalog } from "../content";
import {
  jetAxisOf,
  landscapeOf,
  momentAt,
  morphologyOfState,
  returnShareOf,
  stateDistance,
  type FormState,
} from "../landscape";
import { LANDSCAPE } from "../tokens";

const everyTrack = () =>
  ALBUMS.flatMap((a, ai) => a.tracks.map((_, k) => ({ ai, k, id: `${a.id}/${k}` })));

const idOf = (id: string) => ALBUMS.findIndex((a) => a.id === id);

afterEach(() => resetCatalog());

describe("each track has an identity of its own", () => {
  it("tracks of the same record do not share a form", () => {
    for (const [ai, album] of ALBUMS.entries()) {
      if (album.tracks.length < 2) continue;
      let spread = 0;
      for (let i = 0; i < album.tracks.length; i++) {
        for (let j = i + 1; j < album.tracks.length; j++) {
          spread = Math.max(
            spread,
            stateDistance(landscapeOf(ai, i).identity, landscapeOf(ai, j).identity),
          );
        }
      }
      expect(spread, album.id).toBeGreaterThan(0.08);
    }
  });

  it("the identity reads the track's own measurements, not its position in the record", () => {
    const manoir = idOf("tristan-lohengrin-le-manoir");
    const chambre = landscapeOf(manoir, 5);
    const poursuivi = landscapeOf(manoir, 8);
    expect(chambre.form.articulation).toBeLessThan(poursuivi.form.articulation);
    expect(chambre.identity.flatten).toBeLessThan(poursuivi.identity.flatten);
    expect(chambre.identity.coreRatio).toBeLessThan(poursuivi.identity.coreRatio);
  });

  it("a record without measured form still gets a track identity, as a single section", () => {
    const source = ALBUMS[0];
    const at = registerAlbum({ ...source, id: "local-copy", provider: "local" });
    const L = landscapeOf(at, 0);
    expect(L.curated).toBe(false);
    expect(L.sections).toHaveLength(1);
    expect(Number.isFinite(L.identity.coreRatio)).toBe(true);
  });
});

describe("the landscape is a pure function of the music", () => {
  it("the same position always yields the same form", () => {
    for (const { ai, k } of everyTrack().filter((_, i) => i % 9 === 0)) {
      const L = landscapeOf(ai, k);
      for (const t of [0.05, 0.37, 0.81]) {
        const a = momentAt(L, t);
        const b = momentAt(landscapeOf(ai, k), t);
        expect(stateDistance(a.state, b.state)).toBe(0);
        expect(a.section).toBe(b.section);
      }
    }
  });

  it("seeking needs no history: the target depends on the position only", () => {
    const L = landscapeOf(idOf("darin-wilson-impromptu"), 3);
    const forward = [0.1, 0.5, 0.9].map((t) => momentAt(L, t).state);
    const backward = [0.9, 0.5, 0.1].map((t) => momentAt(L, t).state).reverse();
    forward.forEach((s, i) => expect(stateDistance(s, backward[i])).toBe(0));
  });
});

describe("memory: returns recover the state they return to", () => {
  it("a returning section takes the form of its first occurrence", () => {
    let returns = 0;
    for (const { ai, k } of everyTrack()) {
      const L = landscapeOf(ai, k);
      L.sections.forEach((s, i) => {
        if (s.recall < 0) return;
        returns++;
        const a: FormState = { ...L.states[i], thickness: 0 };
        const b: FormState = { ...L.states[s.recall], thickness: 0 };
        expect(stateDistance(a, b)).toBe(0);
        expect(L.drift[i]).toBe(L.drift[s.recall]);
      });
    }
    expect(returns).toBeGreaterThan(100);
  });

  it("matter accrues only with new material, never with returns", () => {
    for (const { ai, k } of everyTrack()) {
      const L = landscapeOf(ai, k);
      for (let i = 1; i < L.sections.length; i++) {
        expect(L.states[i].thickness).toBeGreaterThanOrEqual(L.states[i - 1].thickness - 1e-9);
        if (L.sections[i - 1].recall >= 0) {
          expect(L.states[i].thickness).toBeCloseTo(L.states[i - 1].thickness, 9);
        }
      }
    }
  });

  it("a record that returns to its material closes its circuit more than one that does not", () => {
    const solar = landscapeOf(idOf("darin-wilson-impromptu"), 3);
    expect(returnShareOf(solar.sections)).toBeGreaterThan(0.3);
    expect(solar.identity.closure).toBeGreaterThan(LANDSCAPE.closure[0] + 0.1);
  });
});

describe("the grammar keeps its bounds", () => {
  it("every moment of every track stays inside the ranges of the landscape", () => {
    for (const { ai, k, id } of everyTrack()) {
      const L = landscapeOf(ai, k);
      for (let i = 0; i <= 20; i++) {
        const m = morphologyOfState(L, momentAt(L, i / 20).state);
        expect(m.closure, id).toBeGreaterThanOrEqual(LANDSCAPE.closure[0]);
        expect(m.closure, id).toBeLessThanOrEqual(1);
        expect(m.flatten, id).toBeGreaterThanOrEqual(LANDSCAPE.flatten[0]);
        expect(m.flatten, id).toBeLessThanOrEqual(LANDSCAPE.flatten[1]);
        expect(m.bandRatio, id).toBeLessThanOrEqual(LANDSCAPE.band);
        expect(m.rMin, id).toBeGreaterThan(m.coreRatio);
        expect(m.rMax, id).toBeLessThan(2);
        expect(Number.isFinite(m.rMax), id).toBe(true);
      }
    }
  });

  it("silence does not invent timbre", () => {
    for (const { ai, k } of everyTrack()) {
      const L = landscapeOf(ai, k);
      L.sections.forEach((s, i) => {
        if (s.level > LANDSCAPE.silence || s.recall >= 0) return;
        expect(L.states[i].flatten).toBeCloseTo(L.identity.flatten, 9);
        expect(L.states[i].sharpness).toBe(1);
      });
    }
  });
});

describe("the jet follows the disk", () => {
  it("outside the landscape it keeps the art direction's diagonal exactly", () => {
    expect(jetAxisOf(0.3, 0)).toEqual([0.62, 0.78]);
    expect(jetAxisOf(0.9, 0)).toEqual([0.62, 0.78]);
  });

  it("an edge-on disk throws a vertical jet; a face-on disk keeps the diagonal", () => {
    const edge = jetAxisOf(LANDSCAPE.flatten[0], 1);
    expect(edge[0]).toBeCloseTo(1, 6);
    expect(edge[1]).toBeCloseTo(0, 6);
    const face = jetAxisOf(0.92, 1);
    expect(face[0]).toBeCloseTo(0.62, 2);
    expect(face[1]).toBeCloseTo(0.78, 2);
  });
});
