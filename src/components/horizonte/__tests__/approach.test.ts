import { describe, expect, it } from "vitest";
import { namePlates, stagesOf } from "../composition/approach";
import { profileOf } from "../composition/relief";
import { ALBUMS } from "../content";
import { morphologyOf } from "../morphology";
import { RELIEF } from "../tokens";

const at = (fadeSel: number, scale: "album" | "collection" = "album") => stagesOf({ fadeSel, scale });

describe("the approach unfolds in order", () => {
  it("light comes first, then the plates part, then satellites, then the track names", () => {
    const first = (key: "light" | "open" | "satellites" | "labels") => {
      for (let i = 0; i <= 1000; i++) if (at(i / 1000)[key] > 0.5) return i;
      return 1001;
    };
    expect(first("light")).toBeLessThan(first("open"));
    expect(first("open")).toBeLessThan(first("satellites"));
    expect(first("satellites")).toBeLessThan(first("labels"));
  });

  it("everything rests at the ends", () => {
    expect(at(0)).toEqual({ light: 0, open: 0, satellites: 0, labels: 0, push: 0 });
    const end = at(1);
    expect([end.light, end.open, end.satellites, end.labels]).toEqual([1, 1, 1, 1]);
    expect(end.push).toBeCloseTo(0, 10);
  });

  it("the camera pushes in only on the way in", () => {
    expect(at(0.5).push).toBeCloseTo(1, 10);
    expect(at(0.5, "collection").push).toBe(0);
  });

});

describe("the crown opens into plates", () => {
  const alb = ALBUMS.findIndex((a) => morphologyOf(a.signature, a.tracks.length).strata > 0.05);
  const m = morphologyOf(ALBUMS[alb].signature, ALBUMS[alb].tracks.length);
  const N = RELIEF.texels;
  const ROW = N * 4;
  const gapTexel = Math.floor(m.bounds[1] * N);
  const profile = (open: number) => {
    const p = new Float32Array(ROW * 2);
    profileOf(m, -1, -1, null, p, open);
    return p;
  };
  const bandsAt = (p: Float32Array, i: number) =>
    [
      [p[i * 4], p[i * 4 + 1]],
      [p[i * 4 + 2], p[i * 4 + 3]],
      [p[ROW + i * 4], p[ROW + i * 4 + 1]],
    ].filter(([a, b]) => b > a).length;

  it("the seam between two tracks closes when the crown is shut and opens with it", () => {
    const edge = (open: number) => profile(open)[ROW + gapTexel * 4 + 2];
    expect(edge(0)).toBeGreaterThan(0);
    expect(edge(1)).toBeLessThan(0);
    expect(edge(0.5)).toBeLessThan(edge(0));
    expect(edge(0.5)).toBeGreaterThan(edge(1));
  });

  it("strata appear only once the crown has opened enough", () => {
    const mid = Math.floor(((m.bounds[0] + m.bounds[1]) / 2) * N);
    expect(bandsAt(profile(0), mid)).toBe(1);
    expect(bandsAt(profile(1), mid)).toBeGreaterThan(1);
  });
});

describe("names follow the shelf", () => {
  it("at rest there is one name", () => {
    expect(namePlates({ nav: 3, alb: 3, scale: "collection" }, 10)).toEqual([
      { alb: 3, alpha: 1, shift: 0 },
    ]);
  });

  it("halfway, both names share the lockup, each sliding from its side", () => {
    const plates = namePlates({ nav: 3.5, alb: 4, scale: "collection" }, 10);
    expect(plates.map((p) => p.alb)).toEqual([3, 4]);
    expect(plates[0].alpha).toBeCloseTo(plates[1].alpha, 10);
    expect(plates[0].shift).toBeLessThan(0);
    expect(plates[1].shift).toBeGreaterThan(0);
  });

  it("inside an album the name does not move", () => {
    expect(namePlates({ nav: 3.4, alb: 3, scale: "album" }, 10)).toEqual([
      { alb: 3, alpha: 1, shift: 0 },
    ]);
  });
});
