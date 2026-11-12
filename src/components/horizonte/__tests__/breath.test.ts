import { describe, expect, it } from "vitest";
import { breathAt, periodOf, temperamentOf } from "../breath";
import { ALBUMS, type AlbumWithSignature } from "../content";
import { BREATH } from "../tokens";

const temps = ALBUMS.map((a) => temperamentOf(a)!);

describe("each record breathes in its own way while nothing plays", () => {
  it("every curated record has a temperament", () => {
    expect(temps.every(Boolean)).toBe(true);
  });

  it("a record without motion analysis does not breathe", () => {
    const local = { ...ALBUMS[0], id: "brought-by-the-visitor" } as AlbumWithSignature;
    expect(temperamentOf(local)).toBeNull();
  });

  it("the breath never jumps, not even where one cycle hands over to the next", () => {
    for (const T of temps) {
      const n = 2000;
      let worst = 0;
      let prev = breathAt(T, 0);
      for (let i = 1; i <= 2 * n; i++) {
        const v = breathAt(T, (i / n) * T.period);
        worst = Math.max(worst, Math.abs(v - prev));
        prev = v;
      }
      expect(worst).toBeLessThan(0.05);
    }
  });

  it("each breath goes from rest to its depth and back", () => {
    for (const T of temps) {
      const values = Array.from({ length: 400 }, (_, i) => breathAt(T, (i / 400) * T.period));
      expect(Math.min(...values)).toBeCloseTo(0, 2);
      expect(Math.max(...values)).toBeCloseTo(T.depth, 2);
    }
  });

  it("the catalogue spans a tick and a swell, a short breath and a long one", () => {
    const attack = temps.map((T) => T.rise / T.period);
    const hold = temps.map((T) => T.fall / T.period);
    expect(Math.max(...attack) - Math.min(...attack)).toBeGreaterThan(0.3);
    expect(Math.max(...hold) - Math.min(...hold)).toBeGreaterThan(0.35);
    const periods = temps.map((T) => T.period);
    expect(Math.max(...periods) - Math.min(...periods)).toBeGreaterThan(2);
  });

  it("with a grid, the breath lasts a whole number of beats, never shorter than the floor", () => {
    expect(periodOf(0.5, 0.5)).toBeCloseTo(0.5 * 8, 10);
    expect(periodOf(0.5, 0.9)).toBeCloseTo(0.9 * 4, 10);
    expect(periodOf(0.5, 0.15)).toBeCloseTo(0.15 * 16, 10);
    for (const beat of [0.3, 0.45, 0.6, 0.8, 1.1]) {
      const p = periodOf(0.5, beat);
      expect(Number.isInteger(Math.round((p / beat) * 1e6) / 1e6)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(BREATH.minPeriod);
    }
  });

  it("without a grid, the period follows how long the record holds", () => {
    expect(periodOf(0, 0)).toBe(BREATH.period[0]);
    expect(periodOf(1, 0)).toBe(BREATH.period[1]);
  });
});
