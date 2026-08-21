import { describe, expect, it } from "vitest";
import { GEO, RING, RING_UNIT } from "../tokens";
import {
  albPos,
  hitTest,
  layoutFor,
  lockup,
  ringBufferScale,
  ringR,
  ringRotationTarget,
  sectorAt,
  variantFor,
} from "../composition/layout";
import { NEUTRAL_MORPHOLOGY } from "../morphology";
import { REACH } from "../tokens";
import { baseState } from "./fixtures";

const W = 1000;
const H = 1000;
const DESKTOP = layoutFor("desktop");
const UNIFORM = [0, 0.25, 0.5, 0.75, 1];

describe("variantFor", () => {
  it("world switches at the declared breakpoints", () => {
    expect(variantFor(767)).toBe("mobile");
    expect(variantFor(768)).toBe("tablet");
    expect(variantFor(1199)).toBe("tablet");
    expect(variantFor(1200)).toBe("desktop");
  });

  it("layoutFor returns the layout of its own variant", () => {
    for (const v of ["mobile", "tablet", "desktop"] as const) {
      expect(layoutFor(v).variant).toBe(v);
    }
  });

  it("on mobile the bodies queue up, one per screen", () => {
    expect(layoutFor("mobile").spreadX).toBeGreaterThan(1);
    expect(layoutFor("mobile").ringLabels).toBe("none");
  });

  it("a short screen uses the compact composition, however wide it is", () => {
    expect(variantFor(844, 390)).toBe("mobile");
    expect(variantFor(1400, 480)).toBe("mobile");
  });

  it("above the height floor, width decides again", () => {
    expect(variantFor(844, 520)).toBe("tablet");
    expect(variantFor(1400, 520)).toBe("desktop");
    expect(variantFor(700, 900)).toBe("mobile");
  });

  it("with no height given, nothing changes", () => {
    expect(variantFor(768)).toBe("tablet");
    expect(variantFor(1200)).toBe("desktop");
  });
});

describe("albPos", () => {
  it("the focused body lands on the field anchor", () => {
    const p = albPos(0, baseState({ nav: 0, zoom: 0 }), DESKTOP);
    expect(p.x).toBeCloseTo(GEO.anchorCollection.x, 10);
    expect(p.y).toBeCloseTo(GEO.anchorCollection.y, 10);
    expect(p.depth).toBe(1);
    expect(p.d).toBe(0);
  });

  it("zoom carries the focus from the field anchor to the album anchor", () => {
    const p = albPos(0, baseState({ nav: 0, zoom: 1 }), DESKTOP);
    expect(p.x).toBeCloseTo(GEO.anchorAlbum.x, 10);
    expect(p.y).toBeCloseTo(GEO.anchorAlbum.y, 10);
  });

  it("depth falls with distance from the focus", () => {
    const s = baseState({ nav: 0 });
    const d0 = albPos(0, s, DESKTOP).depth;
    const d1 = albPos(1, s, DESKTOP).depth;
    const d2 = albPos(2, s, DESKTOP).depth;
    expect(d0).toBeGreaterThan(d1);
    expect(d1).toBeGreaterThan(d2);
    expect(d2).toBeGreaterThan(0);
  });

  it("is symmetric around the focus", () => {
    const s = baseState({ nav: 2 });
    expect(albPos(1, s, DESKTOP).depth).toBeCloseTo(albPos(3, s, DESKTOP).depth, 10);
  });

  it("zoom gathers the neighbours towards the focus", () => {
    const isOpen = albPos(1, baseState({ nav: 0, zoom: 0 }), DESKTOP);
    const closed = albPos(1, baseState({ nav: 0, zoom: 1 }), DESKTOP);
    expect(closed.x - GEO.anchorAlbum.x).toBeLessThan(isOpen.x - GEO.anchorCollection.x);
  });
});

describe("ringR and lockup", () => {
  it("the ring shrinks on entering the album and grows on playing", () => {
    const field = ringR(W, H, baseState({ zoom: 0, play: 0 }), DESKTOP);
    const album = ringR(W, H, baseState({ zoom: 1, play: 0 }), DESKTOP);
    const playing = ringR(W, H, baseState({ zoom: 1, play: 1 }), DESKTOP);
    expect(album).toBeLessThan(field);
    expect(playing).toBeGreaterThan(album);
  });

  it("the ring fits the screen's smaller dimension", () => {
    const s = baseState();
    expect(ringR(400, 1000, s, DESKTOP)).toBeCloseTo(ringR(1000, 400, s, DESKTOP), 10);
  });

  it("each variant scales the ring by its own factor", () => {
    const s = baseState();
    expect(ringR(W, H, s, layoutFor("mobile"))).toBeCloseTo(
      ringR(W, H, s, DESKTOP) * layoutFor("mobile").ringScale,
      10,
    );
  });

  it("ringBufferScale converts the radius into the baked buffer's scale", () => {
    expect(ringBufferScale(RING_UNIT)).toBeCloseTo(1, 10);
    expect(ringBufferScale(RING_UNIT * 3)).toBeCloseTo(3, 10);
  });

  it("the lockup yields space as the track takes the screen", () => {
    const stopped = lockup(W, H, baseState({ play: 0, zoom: 0 }), DESKTOP);
    const playing = lockup(W, H, baseState({ play: 1, zoom: 0 }), DESKTOP);
    const inside = lockup(W, H, baseState({ play: 0, zoom: 1 }), DESKTOP);

    expect(playing.size).toBeLessThan(stopped.size);
    expect(inside.size).toBeLessThan(stopped.size);
    expect(stopped.ty).toBeGreaterThan(stopped.ay);
    expect(stopped.my).toBeGreaterThan(stopped.ty);
    expect(stopped.tsize).toBeLessThan(stopped.size);
  });
});

describe("sectorAt", () => {
  it("maps the whole turn onto uniform sectors", () => {
    expect(sectorAt(UNIFORM, 0)).toBe(0);
    expect(sectorAt(UNIFORM, 0.24)).toBe(0);
    expect(sectorAt(UNIFORM, 0.26)).toBe(1);
    expect(sectorAt(UNIFORM, 0.99)).toBe(3);
  });

  it("respeita setores desiguais", () => {
    const bounds = [0, 0.1, 0.9, 1];
    expect(sectorAt(bounds, 0.05)).toBe(0);
    expect(sectorAt(bounds, 0.5)).toBe(1);
    expect(sectorAt(bounds, 0.95)).toBe(2);
  });

  it("saturates on the last sector instead of leaving the list", () => {
    expect(sectorAt(UNIFORM, 1)).toBe(3);
    expect(sectorAt(UNIFORM, 4)).toBe(3);
  });
});

describe("hitTest — scale field", () => {
  const s = baseState({ scale: "collection", nav: 0, zoom: 0 });
  const hit = (x: number, y: number) =>
    hitTest(x, y, W, H, s, DESKTOP, () => UNIFORM, 3, () => NEUTRAL_MORPHOLOGY);

  it("points at the body under the cursor", () => {
    const p = albPos(0, s, DESKTOP);
    expect(hit(p.x, p.y)).toEqual({ kind: "body", i: 0 });
  });

  it("points at the neighbour when the cursor travels to it", () => {
    const p = albPos(1, s, DESKTOP);
    expect(hit(p.x, p.y)).toEqual({ kind: "body", i: 1 });
  });

  it("returns empty in the space between bodies", () => {
    expect(hit(0.04, 0.95)).toEqual({ kind: "empty", i: -1 });
  });
});

describe("hitTest — album scale", () => {
  const s = baseState({ scale: "album", alb: 0, nav: 0, zoom: 1, play: 0 });
  const R = ringR(W, H, s, DESKTOP);
  const center = albPos(0, s, DESKTOP);
  const M = NEUTRAL_MORPHOLOGY;
  const flatten = M.flatten;

  const point = (radius: number, back = 0, st = s) => {
    const ang = back * Math.PI * 2;
    const c = albPos(st.alb, st, DESKTOP);
    return hitTest(
      c.x + (Math.cos(ang) * radius) / W,
      c.y + (Math.sin(ang) * radius * flatten) / H,
      W,
      H,
      st,
      DESKTOP,
      () => UNIFORM,
      3,
      () => M,
    );
  };

  it("the body's core is a transport target", () => {
    expect(point(0)).toEqual({ kind: "body", i: 0 });
    expect(point(R * M.coreRatio * 0.9)).toEqual({ kind: "body", i: 0 });
  });

  it("the body's target never invades the corona", () => {
    const bodyR = Math.min(M.coreRatio * REACH.core, M.rMin * REACH.inner * 0.98);
    expect(bodyR).toBeLessThan(M.rMin * REACH.inner);
  });

  it("the ring band selects the track by angle", () => {
    expect(point(R, 0.125)).toEqual({ kind: "track", i: 0 });
    expect(point(R, 0.375)).toEqual({ kind: "track", i: 1 });
    expect(point(R, 0.625)).toEqual({ kind: "track", i: 2 });
    expect(point(R, 0.875)).toEqual({ kind: "track", i: 3 });
  });

  it("the band covers the corona's full thickness", () => {
    expect(point(R * M.rMin * 0.95, 0.125)).toEqual({ kind: "track", i: 0 });
    expect(point(R * M.rMax * 1.1, 0.125)).toEqual({ kind: "track", i: 0 });
  });

  it("outside the corona it is empty again", () => {
    expect(point(R * 1.5)).toEqual({ kind: "empty", i: -1 });
  });

  it("the ring rotation follows the pointed sector", () => {
    const rotated = baseState({ ...s, ringRot: Math.PI });
    expect(point(R, 0.125, s)).toEqual({ kind: "track", i: 0 });
    expect(point(R, 0.125, rotated)).toEqual({ kind: "track", i: 2 });
  });

  it("the body's flattening enters the target calculation", () => {
    const bodyR = Math.min(M.coreRatio * REACH.core, M.rMin * REACH.inner * 0.98);
    const py = R * M.rMin * 0.95 * flatten;
    expect(py / R).toBeLessThan(bodyR);
    expect(py / flatten / R).toBeGreaterThan(M.rMin * REACH.inner);
    expect(
      hitTest(center.x, center.y - py / H, W, H, s, DESKTOP, () => UNIFORM, 3, () => M).kind,
    ).toBe("track");
  });
});

describe("ringRotationTarget — the ring is the record's clock (P13)", () => {
  const bounds = [0, 0.25, 0.75, 1];

  it("at rest, every record shows the same canonical orientation", () => {
    expect(ringRotationTarget(bounds, 0, 0, false)).toBe(RING.anchor);
    expect(ringRotationTarget(bounds, 2, 0.9, false)).toBe(RING.anchor);
  });

  it("while playing, it closes exactly one turn across the album", () => {
    const start = ringRotationTarget(bounds, 0, 0, true);
    const end = ringRotationTarget(bounds, 2, 1, true);
    expect(start - end).toBeCloseTo(6.2832, 6);
  });

  it("the playing point always sits on the anchor", () => {
    for (const [trk, p] of [[0, 0], [0, 0.5], [1, 0.3], [2, 0.8]] as const) {
      const rot = ringRotationTarget(bounds, trk, p, true);
      const sector = bounds[trk] + (bounds[trk + 1] - bounds[trk]) * p;
      expect(sector * 6.2832 + rot).toBeCloseTo(RING.anchor, 10);
    }
  });

  it("crosses the splice between tracks without a jump", () => {
    expect(ringRotationTarget(bounds, 0, 1, true)).toBeCloseTo(
      ringRotationTarget(bounds, 1, 0, true),
      10,
    );
  });

  it("is monotonic along the record", () => {
    let previous = Infinity;
    for (const [trk, p] of [[0, 0], [0, 0.9], [1, 0.2], [1, 0.9], [2, 0.5]] as const) {
      const rot = ringRotationTarget(bounds, trk, p, true);
      expect(rot).toBeLessThan(previous);
      previous = rot;
    }
  });
});
