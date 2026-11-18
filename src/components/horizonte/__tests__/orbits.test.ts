import { describe, expect, it } from "vitest";
import { ALBUMS } from "../content";
import { profileOf } from "../composition/relief";
import { morphologyOf, satRadiusOf } from "../morphology";
import { RING } from "../tokens";
import { ORBIT, crownRestOf, orbitLeanOf, orbitsOf, postureOf } from "../world/orbits";

const RECORDS = ALBUMS.map((album) => {
  const m = morphologyOf(album.signature, album.tracks.length);
  return { album, m, lean: orbitLeanOf(m) };
});

type Shape = (typeof RECORDS)[number]["m"];

const shown = (m: Shape) => m.satellites.map((sat, j) => ({ sat, j })).filter(({ sat }) => sat.weight > 0.02);

describe("orbits around the crown", () => {
  it("the crown at rest, with any track lifted, stays inside its stated reach", () => {
    for (const { album, m } of RECORDS) {
      const reach = crownRestOf(m);
      for (let k = 0; k < album.tracks.length; k++) {
        expect(profileOf(m, k, k, null).hi, album.id).toBeLessThanOrEqual(reach + 1e-6);
      }
      expect(reach).toBeCloseTo(profileOf(m, -1, -1, null).hi + RING.lift, 6);
    }
  });

  it("no satellite's footprint on the crown's plane reaches the crown, on any record", () => {
    for (const { album, m, lean } of RECORDS) {
      const reach = crownRestOf(m);
      const orbit = orbitsOf(m, reach, lean);
      for (const { sat, j } of shown(m)) {
        const nearest = orbit[j] * Math.cos(lean) - satRadiusOf(m, sat);
        expect(nearest, `${album.id} #${j}`).toBeGreaterThanOrEqual(reach + ORBIT.margin - 1e-9);
      }
    }
  });

  it("the catalogue's orbits used to cut into the crown, which is what this guards", () => {
    const cutting = RECORDS.filter(({ m }) =>
      shown(m).some(({ sat }) => sat.dist - satRadiusOf(m, sat) < crownRestOf(m)),
    );
    expect(cutting.length).toBeGreaterThan(0);
  });

  it("no satellite touches the one on the next orbit, wherever they meet", () => {
    for (const { album, m, lean } of RECORDS) {
      const orbit = orbitsOf(m, crownRestOf(m), lean);
      const seen = shown(m);
      for (let i = 1; i < seen.length; i++) {
        const inner = orbit[seen[i - 1].j] + satRadiusOf(m, seen[i - 1].sat);
        const outer = orbit[seen[i].j] - satRadiusOf(m, seen[i].sat);
        expect(outer - inner, `${album.id} #${seen[i].j}`).toBeGreaterThanOrEqual(ORBIT.margin - 1e-9);
      }
    }
  });

  it("orbits only ever move outward from where the record's length put them, and keep their order", () => {
    for (const { m, lean } of RECORDS) {
      const orbit = orbitsOf(m, crownRestOf(m), lean);
      m.satellites.forEach((sat, j) => {
        expect(orbit[j]).toBeGreaterThanOrEqual(sat.dist);
        if (j > 0) expect(orbit[j]).toBeGreaterThan(orbit[j - 1]);
      });
    }
  });

  it("when the crown swells, the orbits give way by at least as much", () => {
    for (const { album, m, lean } of RECORDS) {
      const rest = crownRestOf(m);
      const calm = orbitsOf(m, rest, lean);
      for (const swell of [0.03, 0.12, 0.3]) {
        const wide = orbitsOf(m, rest + swell, lean);
        for (const { sat, j } of shown(m)) {
          expect(wide[j], album.id).toBeGreaterThanOrEqual(calm[j]);
          const nearest = wide[j] * Math.cos(lean) - satRadiusOf(m, sat);
          expect(nearest, album.id).toBeGreaterThanOrEqual(rest + swell + ORBIT.margin - 1e-9);
        }
      }
    }
  });

  it("the orbital plane leans off the crown's, slightly and within bounds", () => {
    for (const { lean } of RECORDS) {
      expect(lean).toBeGreaterThanOrEqual(ORBIT.lean[0]);
      expect(lean).toBeLessThanOrEqual(ORBIT.lean[1]);
    }
    expect(ORBIT.lean[1]).toBeLessThan(0.35);
  });

  it("leaning back, the innermost satellite dips no lower than it did on its old orbit", () => {
    for (const { album, m, lean } of RECORDS) {
      const first = shown(m)[0];
      if (!first || lean >= ORBIT.lean[1] - 1e-9) continue;
      const orbit = orbitsOf(m, crownRestOf(m), lean);
      const before = first.sat.dist * Math.cos(postureOf(m));
      const now = orbit[first.j] * Math.cos(postureOf(m) + lean);
      expect(now, album.id).toBeLessThanOrEqual(before + 1e-6);
    }
  });
});
