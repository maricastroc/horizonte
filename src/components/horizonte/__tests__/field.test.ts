import { describe, expect, it } from "vitest";
import { boundsOf } from "../content/signature";
import { CURATION } from "../content/curation.generated";
import { SIGNATURES } from "../content/signature.generated";
import {
  RANGE,
  fieldConstantsOf,
  heftOf,
  lightDirection,
  lightSweepOf,
  mixConstants,
  reduceMotion,
  type FieldConstants,
} from "../field";
import { trackBiasOf } from "../content/signature";
import { LIGHT } from "../tokens";
import { signature } from "./fixtures";

const CONTRACT = {
  "dust-time-gravity": {
    weight: 624, lens: 1.02, cap: 0.123,
     rim: 3.85, nav: 5.04,
    sectors: [7, 32, 83.1],
  },
  "tristan-lohengrin-le-manoir": {
    weight: 551, lens: 0.92, cap: 0.086,
     rim: 4.09, nav: 6.02,
    sectors: [11, 14.5, 65.3],
  },
  "jono-terbakar-lebar": {
    weight: 617, lens: 0.97, cap: 0.186,
     rim: 3.79, nav: 5.89,
    sectors: [9, 24.1, 57.7],
  },
  "le-morte-dabby-0p": {
    weight: 725, lens: 1.07, cap: 0.08,
     rim: 4.34, nav: 5.44,
    sectors: [7, 37.6, 77.1],
  },
  "mark-wilson-x-dark-thoughts": {
    weight: 679, lens: 1.02, cap: 0.123,
     rim: 3.88, nav: 5.82,
    sectors: [10, 22.6, 49.9],
  },
  "darin-wilson-impromptu": {
    weight: 678, lens: 1.01, cap: 0.11,
     rim: 4.19, nav: 5.89,
    sectors: [5, 61.6, 81.9],
  },
  "zero-project-e-world": {
    weight: 704, lens: 1.09, cap: 0.109,
     rim: 4.62, nav: 4.68,
    sectors: [16, 11.0, 39.5],
  },
  "tale-twist-wry-way": {
    weight: 712, lens: 1.04, cap: 0.066,
     rim: 4.59, nav: 5.79,
    sectors: [8, 30.0, 63.4],
  },
  "madison-kenny-all-systems-go": {
    weight: 748, lens: 1.05, cap: 0.053,
     rim: 5.0, nav: 6.17,
    sectors: [4, 78.9, 98.4],
  },
  "meho-mkultra": {
    weight: 678, lens: 1.06, cap: 0.096,
     rim: 3.05, nav: 4.92,
    sectors: [6, 31.2, 87.7],
  },
  "mescaline-sessions-jajce": {
    weight: 663, lens: 1.01, cap: 0.089,
     rim: 3.3, nav: 5.73,
    sectors: [4, 36.7, 129.3],
  },
  "smert-v-letnjuju-polnoch-chajka": {
    weight: 744, lens: 1.07, cap: 0.088,
     rim: 4.42, nav: 5.7,
    sectors: [6, 48.9, 74.4],
  },
  "grove-of-whispers-the-sheltering-sky": {
    weight: 570, lens: 0.97, cap: 0.107,
     rim: 4.06, nav: 5.26,
    sectors: [3, 58, 218.1],
  },
  "awake-in-the-dew-sounds-to-ascension": {
    weight: 777, lens: 1.09, cap: 0.112,
     rim: 4.15, nav: 5.65,
    sectors: [7, 38.7, 61.6],
  },
} as const;

const round = (v: number, decimals: number) => Number(v.toFixed(decimals));

describe("signature → album constants", () => {
  it("every album in the catalogue has a contract published in the sensory map", () => {
    const withoutContract = CURATION.filter((a) => !(a.id in CONTRACT)).map((a) => a.id);
    expect(withoutContract).toEqual([]);
  });

  for (const album of CURATION.filter((a) => a.id in CONTRACT)) {
    const expected = CONTRACT[album.id as keyof typeof CONTRACT];

    it(`${album.title} derives the published constants`, () => {
      const c = fieldConstantsOf(SIGNATURES[album.id]);
      expect({
        weight: c.artistWeight,
        lens: round(c.massScale, 2),
        cap: round(c.reactionCap, 3),
        rim: round(c.rimHardness, 2),
        nav: round(c.navLerp, 2),
      }).toEqual({
        weight: expected.weight,
        lens: expected.lens,
        cap: expected.cap,
        rim: expected.rim,
        nav: expected.nav,
      });
    });

    it(`${album.title} sectorizes the ring by real durations (P9)`, () => {
      const [tracks, smaller, greater] = expected.sectors;
      const bounds = boundsOf(SIGNATURES[album.id], album.tracks.length);
      const degrees = bounds.slice(1).map((b, k) => (b - bounds[k]) * 360);

      expect(album.tracks.length).toBe(tracks);
      expect(round(Math.min(...degrees), 1)).toBe(smaller);
      expect(round(Math.max(...degrees), 1)).toBe(greater);
    });
  }
});

describe("sensory map guardrails", () => {
  const derived = CURATION.map((a) => fieldConstantsOf(SIGNATURES[a.id]));

  const inRange = (
    key: keyof FieldConstants & keyof typeof RANGE,
  ) => {
    const [a, b] = RANGE[key];
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    for (const c of derived) {
      expect(c[key]).toBeGreaterThanOrEqual(lo);
      expect(c[key]).toBeLessThanOrEqual(hi);
    }
  };

  it("no album exceeds the limits declared in RANGE", () => {
    (Object.keys(RANGE) as (keyof typeof RANGE)[]).forEach(inRange);
  });

  it("only All Systems Go saturates against an anchor, and by 0.2 Hz", () => {
    const saturatedList = CURATION.flatMap((album) => {
      const sig = SIGNATURES[album.id];
      return (["loudness", "dynamics", "brightness", "duration"] as const)
        .filter((k) => sig[k] === 0 || sig[k] === 1)
        .map((k) => `${album.id}.${k}`);
    });
    expect(saturatedList).toEqual(["madison-kenny-all-systems-go.brightness"]);
  });

  it("prefers-reduced-motion zeroes the live perturbation (P4)", () => {
    for (const c of derived) {
      const r = reduceMotion(c);
      expect(r.reactionCap).toBe(0);
      expect(r.navLerp).toBe(RANGE.navLerp[0]);
      expect(Math.abs(r.massScale - 1)).toBeCloseTo(Math.abs(c.massScale - 1) * 0.25, 10);
      expect(r.artistWeight).toBe(c.artistWeight);
      expect(r.rimHardness).toBe(c.rimHardness);
    }
  });

  it("the catalogue spans the ranges for real, not in theory", () => {
    const amplitude = (f: (c: FieldConstants) => number, key: keyof typeof RANGE) => {
      const vs = derived.map(f);
      const [a, b] = RANGE[key];
      return (Math.max(...vs) - Math.min(...vs)) / Math.abs(b - a);
    };

    expect(amplitude((c) => c.reactionCap, "reactionCap")).toBeGreaterThan(0.4);
    expect(amplitude((c) => c.artistWeight, "artistWeight")).toBeGreaterThan(0.4);
    expect(amplitude((c) => c.rimHardness, "rimHardness")).toBeGreaterThan(0.4);
  });
});

describe("fieldConstantsOf", () => {
  it("maps descriptor extremes onto range extremes", () => {
    const min = fieldConstantsOf(signature(0, 0, 0, 0));
    const max = fieldConstantsOf(signature(1, 1, 1, 1));

    expect(min.artistWeight).toBe(RANGE.artistWeight[0]);
    expect(max.artistWeight).toBe(RANGE.artistWeight[1]);
    expect(min.reactionCap).toBeCloseTo(RANGE.reactionCap[0], 10);
    expect(max.reactionCap).toBeCloseTo(RANGE.reactionCap[1], 10);
    expect(min.rimHardness).toBeCloseTo(RANGE.rimHardness[0], 10);
    expect(max.rimHardness).toBeCloseTo(RANGE.rimHardness[1], 10);
    expect(min.navLerp).toBeCloseTo(RANGE.navLerp[0], 10);
    expect(max.navLerp).toBeCloseTo(RANGE.navLerp[1], 10);
    expect(max.navLerp).toBeLessThan(min.navLerp);
  });

  it("weight blends loudness and duration at 0.68/0.32 (P2)", () => {
    expect(heftOf(signature(1, 0, 0, 0))).toBeCloseTo(0.68, 10);
    expect(heftOf(signature(0, 0, 0, 1))).toBeCloseTo(0.32, 10);
    expect(heftOf(signature(1, 0, 0, 1))).toBeCloseTo(1, 10);
  });

  it("each descriptor moves only the channels that belong to it", () => {
    const base = fieldConstantsOf(signature(0.5, 0.5, 0.5, 0.5));
    const bright = fieldConstantsOf(signature(0.5, 0.5, 1, 0.5));

    expect(bright.rimHardness).toBeGreaterThan(base.rimHardness);
    expect(bright.reactionCap).toBe(base.reactionCap);
    expect(bright.artistWeight).toBe(base.artistWeight);
    expect(bright.navLerp).toBe(base.navLerp);
  });
});

describe("mixConstants", () => {
  const a = fieldConstantsOf(signature(0, 0, 0, 0));
  const b = fieldConstantsOf(signature(1, 1, 1, 1));

  it("returns the extremes at t=0 and t=1", () => {
    expect(mixConstants(a, b, 0)).toEqual(a);
    expect(mixConstants(a, b, 1)).toEqual(b);
  });

  it("interpolates linearly in between", () => {
    const m = mixConstants(a, b, 0.5);
    expect(m.massScale).toBeCloseTo((a.massScale + b.massScale) / 2, 10);
    expect(m.rimHardness).toBeCloseTo((a.rimHardness + b.rimHardness) / 2, 10);
  });

  it("saturates outside [0,1] instead of extrapolating", () => {
    expect(mixConstants(a, b, -3)).toEqual(a);
    expect(mixConstants(a, b, 9)).toEqual(b);
  });
});

describe("track bias in the constants (P11)", () => {
  const sig = signature(0.5, 0.5, 0.5, 0.5);

  it("with no bias, the result is identical to the album's", () => {
    expect(fieldConstantsOf(sig, { loudness: 0, dynamics: 0, brightness: 0, pulse: 0 })).toEqual(
      fieldConstantsOf(sig),
    );
  });

  it("the track moves mass and reaction ceiling", () => {
    const base = fieldConstantsOf(sig);
    const strong = fieldConstantsOf(sig, { loudness: 0.2, dynamics: 0.2, brightness: 0, pulse: 0 });
    expect(strong.massScale).toBeGreaterThan(base.massScale);
    expect(strong.reactionCap).toBeGreaterThan(base.reactionCap);
  });

  it("the track moves neither the typography nor the album's inertia", () => {
    const base = fieldConstantsOf(sig);
    const other = fieldConstantsOf(sig, { loudness: -0.25, dynamics: 0.25, brightness: 0.12, pulse: 0 });
    expect(other.artistWeight).toBe(base.artistWeight);
    expect(other.navLerp).toBe(base.navLerp);
  });

  it("the track's pulse moves only the field's spin", () => {
    const base = fieldConstantsOf(sig);
    const firme = fieldConstantsOf(sig, { loudness: 0, dynamics: 0, brightness: 0, pulse: 0.12 });
    const loose = fieldConstantsOf(sig, { loudness: 0, dynamics: 0, brightness: 0, pulse: -0.12 });

    expect(firme.swirl).toBeGreaterThan(base.swirl);
    expect(loose.swirl).toBeLessThan(base.swirl);
    expect(firme.rimHardness).toBe(base.rimHardness);
    expect(firme.artistWeight).toBe(base.artistWeight);
  });

  it("the track's brightness moves only the hardness of the light", () => {
    const base = fieldConstantsOf(sig);
    const clara = fieldConstantsOf(sig, { loudness: 0, dynamics: 0, brightness: 0.12, pulse: 0 });
    const escura = fieldConstantsOf(sig, { loudness: 0, dynamics: 0, brightness: -0.12, pulse: 0 });

    expect(clara.rimHardness).toBeGreaterThan(base.rimHardness);
    expect(escura.rimHardness).toBeLessThan(base.rimHardness);
    expect(clara.navLerp).toBe(base.navLerp);
    expect(escura.navLerp).toBe(base.navLerp);
  });

  it("no track in the catalogue escapes the album's guardrails", () => {
    for (const album of CURATION) {
      const s = SIGNATURES[album.id];
      for (const bias of trackBiasOf(s, album.tracks.length)) {
        const c = fieldConstantsOf(s, bias);
        expect(c.massScale, album.id).toBeGreaterThanOrEqual(RANGE.massScale[0]);
        expect(c.massScale, album.id).toBeLessThanOrEqual(RANGE.massScale[1]);
        expect(c.reactionCap, album.id).toBeGreaterThanOrEqual(RANGE.reactionCap[0]);
        expect(c.reactionCap, album.id).toBeLessThanOrEqual(RANGE.reactionCap[1]);
        expect(c.rimHardness, album.id).toBeGreaterThanOrEqual(RANGE.rimHardness[0]);
        expect(c.rimHardness, album.id).toBeLessThanOrEqual(RANGE.rimHardness[1]);
        expect(c.swirl, album.id).toBeGreaterThanOrEqual(RANGE.swirl[0]);
        expect(c.swirl, album.id).toBeLessThanOrEqual(RANGE.swirl[1]);
      }
    }
  });

  it("the artist weight is the same across every track of a record", () => {
    for (const album of CURATION) {
      const s = SIGNATURES[album.id];
      const weights = trackBiasOf(s, album.tracks.length).map(
        (bias) => fieldConstantsOf(s, bias).artistWeight,
      );
      expect(new Set(weights).size, album.id).toBe(1);
    }
  });

  it("reduceMotion still zeroes the track's reaction ceiling", () => {
    const c = reduceMotion(
      fieldConstantsOf(signature(0.9, 0.9, 0.5, 0.5), {
        loudness: 0.2,
        dynamics: 0.25,
        brightness: 0.1,
        pulse: 0.1,
      }),
    );
    expect(c.reactionCap).toBe(0);
  });
});

describe("the light crosses the track (P12)", () => {
  it("the sweep is symmetric around the track's midpoint", () => {
    expect(lightSweepOf(0.5)).toBe(0);
    expect(lightSweepOf(0)).toBeCloseTo(-LIGHT.arc / 2, 10);
    expect(lightSweepOf(1)).toBeCloseTo(LIGHT.arc / 2, 10);
  });

  it("is monotonic and saturates outside the track", () => {
    expect(lightSweepOf(0.25)).toBeLessThan(lightSweepOf(0.75));
    expect(lightSweepOf(-4)).toBe(lightSweepOf(0));
    expect(lightSweepOf(9)).toBe(lightSweepOf(1));
  });

  it("the direction rotates without changing magnitude", () => {
    const base = Math.hypot(...lightDirection(0));
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      expect(Math.hypot(...lightDirection(lightSweepOf(p)))).toBeCloseTo(base, 10);
    }
  });

  it("at the track's midpoint the light sits in the handoff's historical direction", () => {
    const [x, y] = lightDirection(lightSweepOf(0.5));
    expect(x).toBeCloseTo(LIGHT.base[0], 10);
    expect(y).toBeCloseTo(LIGHT.base[1], 10);
  });

  it("the total arc travelled is the declared one", () => {
    const ang = (p: number) => Math.atan2(...(lightDirection(lightSweepOf(p)).reverse() as [number, number]));
    expect(ang(1) - ang(0)).toBeCloseTo(LIGHT.arc, 6);
  });
});
