import { describe, expect, it } from "vitest";
import { timecode } from "../format";
import { clamp, lerp } from "../math";
import { albumProgressOf, initialState, isEngaged, progressOf } from "../state";
import type { Mode } from "../types";

describe("clamp", () => {
  it("returns the value when it is inside", () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it("saturates at the ends", () => {
    expect(clamp(-3, 0, 1)).toBe(0);
    expect(clamp(9, 0, 1)).toBe(1);
    expect(clamp(0, 0, 1)).toBe(0);
    expect(clamp(1, 0, 1)).toBe(1);
  });

  it("works with negative bounds", () => {
    expect(clamp(-0.4, -0.5, 0.5)).toBe(-0.4);
    expect(clamp(-9, -0.5, 0.5)).toBe(-0.5);
  });
});

describe("lerp", () => {
  it("anchors at the extremes", () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it("interpolates in between", () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it("saturates instead of extrapolating", () => {
    expect(lerp(10, 20, -4)).toBe(10);
    expect(lerp(10, 20, 4)).toBe(20);
  });

  it("accepts inverted ranges", () => {
    expect(lerp(6.2, 4.3, 1)).toBeCloseTo(4.3, 10);
  });
});

describe("timecode", () => {
  it("formats minutes and seconds with two digits", () => {
    expect(timecode(0)).toBe("00:00");
    expect(timecode(9)).toBe("00:09");
    expect(timecode(75)).toBe("01:15");
    expect(timecode(600)).toBe("10:00");
  });

  it("truncates fractions instead of rounding", () => {
    expect(timecode(59.99)).toBe("00:59");
  });

  it("passes one hour without breaking the format", () => {
    expect(timecode(3671)).toBe("61:11");
  });

  it("reads negative as zero", () => {
    expect(timecode(-5)).toBe("00:00");
    expect(timecode(-0.2)).toBe("00:00");
  });
});

describe("progressOf", () => {
  it("is zero with no known duration", () => {
    expect(progressOf({ pos: 30, dur: 0 })).toBe(0);
  });

  it("is the fraction travelled", () => {
    expect(progressOf({ pos: 30, dur: 120 })).toBe(0.25);
  });

  it("saturates at 1 if the position passes the duration", () => {
    expect(progressOf({ pos: 200, dur: 120 })).toBe(1);
  });
});

describe("isEngaged", () => {
  it("is true with a track loaded under the transport", () => {
    expect(isEngaged("playing")).toBe(true);
    expect(isEngaged("paused")).toBe(true);
  });

  it("is false in modes with no established track", () => {
    const others: Mode[] = ["stopped", "collapse", "fusion"];
    for (const m of others) expect(isEngaged(m)).toBe(false);
  });
});

describe("initialState", () => {
  it("opens on the collection, with nothing playing", () => {
    const s = initialState();
    expect(s.scale).toBe("collection");
    expect(s.mode).toBe("stopped");
    expect(s.playAlb).toBe(-1);
    expect(s.hover).toBe(-1);
    expect(s.hoverBody).toBe(-1);
    expect(s.waveR).toBe(-1);
  });

  it("returns a new state on every call", () => {
    const a = initialState();
    const b = initialState();
    expect(a).not.toBe(b);
    a.alb = 7;
    expect(b.alb).toBe(0);
  });

  it("has no undefined or NaN field", () => {
    const s = initialState() as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(s)) {
      expect(v, k).toBeDefined();
      if (typeof v === "number") expect(Number.isNaN(v), k).toBe(false);
    }
  });
});

describe("albumProgressOf — the position in the record, not in the track", () => {
  const bounds = [0, 0.25, 0.75, 1];

  it("at the start of a track it lands on that track's boundary", () => {
    expect(albumProgressOf(bounds, 1, 0)).toBeCloseTo(0.25, 10);
  });

  it("at the end of a track it touches the next boundary", () => {
    expect(albumProgressOf(bounds, 1, 1)).toBeCloseTo(0.75, 10);
  });

  it("is continuous across the splice between tracks", () => {
    expect(albumProgressOf(bounds, 0, 1)).toBeCloseTo(albumProgressOf(bounds, 1, 0), 10);
    expect(albumProgressOf(bounds, 1, 1)).toBeCloseTo(albumProgressOf(bounds, 2, 0), 10);
  });

  it("traverses the sector proportionally", () => {
    expect(albumProgressOf(bounds, 1, 0.5)).toBeCloseTo(0.5, 10);
  });

  it("saturates track and progress outside the range", () => {
    expect(albumProgressOf(bounds, -5, 0.5)).toBeCloseTo(0.125, 10);
    expect(albumProgressOf(bounds, 99, 0.5)).toBeCloseTo(0.875, 10);
    expect(albumProgressOf(bounds, 0, -2)).toBe(0);
    expect(albumProgressOf(bounds, 2, 9)).toBe(1);
  });

  it("with no boundaries it returns zero", () => {
    expect(albumProgressOf([], 0, 0.5)).toBe(0);
  });
});
