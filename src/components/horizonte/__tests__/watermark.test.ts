import { describe, expect, it } from "vitest";
import { ALBUMS } from "../content";
import { boundsOf, chargeAt } from "../content/signature";
import {
  clearWatermark,
  depthOf,
  emptyWatermark,
  observe,
  tierOf,
  turnGap,
  widthOf,
  type Watermark,
} from "../composition/watermark";
import { WATERMARK } from "../tokens";

const ALBUM = 0;
const TRACK = 0;
const SPAN = 0.2;

const feed = (w: Watermark, charges: number[], from = 0.1, stride = 0.02) =>
  charges.map((c, i) => observe(w, ALBUM, TRACK, from + i * stride, c, SPAN));

interface Heard {
  turn: number;
  charge: number;
}

function listen(albIdx: number, trk: number, fps = 30): { w: Watermark; heard: Heard[] } {
  const album = ALBUMS[albIdx];
  const bounds = boundsOf(album.signature, album.tracks.length);
  const seconds = (bounds[trk + 1] - bounds[trk]) * album.signature.measured.durationS;
  const span = bounds[trk + 1] - bounds[trk];
  const w = emptyWatermark();
  const heard: Heard[] = [];
  for (let t = 0; t <= seconds; t += 1 / fps) {
    const turn = bounds[trk] + t / album.signature.measured.durationS;
    const charge = chargeAt(album.signature, turn);
    heard.push({ turn, charge });
    observe(w, albIdx, trk, turn, charge, span);
  }
  return { w, heard };
}

describe("a mark is a new maximum, not a sample of the signal", () => {
  it("a fresh field carries no marks", () => {
    const w = emptyWatermark();
    expect(w.marks).toHaveLength(0);
    expect(w.version).toBe(0);
  });

  it("the first reading of a track never leaves a mark", () => {
    const w = emptyWatermark();
    expect(observe(w, ALBUM, TRACK, 0.1, 0.95, SPAN)).toBe(false);
    expect(w.marks).toHaveLength(0);
  });

  it("a mark needs to beat the entry level by the declared step", () => {
    const w = emptyWatermark();
    feed(w, [0.2]);
    expect(observe(w, ALBUM, TRACK, 0.2, 0.2 + WATERMARK.step * 0.9, SPAN)).toBe(false);
    expect(observe(w, ALBUM, TRACK, 0.3, 0.2 + WATERMARK.step * 1.1, SPAN)).toBe(true);
    expect(w.marks).toHaveLength(1);
  });

  it("a field below the floor never deposits, however long you listen", () => {
    const w = emptyWatermark();
    feed(w, [-1, -0.8, -0.5, -0.2, 0, WATERMARK.floor - 0.01]);
    expect(w.marks).toHaveLength(0);
  });

  it("the depth is quantized into a few levels, not a curve", () => {
    const depths = new Set<number>();
    for (let c = WATERMARK.floor; c <= 1; c += 0.01) depths.add(depthOf(tierOf(c)));
    expect(depths.size).toBe(WATERMARK.tiers);
    expect(tierOf(1)).toBe(WATERMARK.tiers);
    expect(tierOf(WATERMARK.floor)).toBe(1);
  });

  it("the width follows the sector, inside its own bounds", () => {
    expect(widthOf(0)).toBe(WATERMARK.width[0]);
    expect(widthOf(1)).toBe(WATERMARK.width[1]);
    expect(widthOf(0.1)).toBeGreaterThanOrEqual(WATERMARK.width[0]);
    expect(widthOf(0.1)).toBeLessThanOrEqual(WATERMARK.width[1]);
  });

  it("the turn gap closes around the circle", () => {
    expect(turnGap(0.01, 0.99)).toBeCloseTo(0.02, 9);
    expect(turnGap(0.2, 0.3)).toBeCloseTo(0.1, 9);
  });

  it("never keeps more marks than declared", () => {
    const w = emptyWatermark();
    for (let i = 0; i < 200; i++) {
      w.peak = -2;
      observe(w, ALBUM, TRACK, i / 200, 0.9, SPAN);
    }
    expect(w.marks.length).toBeLessThanOrEqual(WATERMARK.max);
  });
});

describe("what the listener heard is what the circuit keeps", () => {
  it("pausing changes nothing: the same reading again is not a new event", () => {
    const w = emptyWatermark();
    feed(w, [0.2, 0.9]);
    const before = w.version;
    for (let i = 0; i < 50; i++) observe(w, ALBUM, TRACK, 0.12, 0.9, SPAN);
    expect(w.version).toBe(before);
    expect(w.marks).toHaveLength(1);
  });

  it("going back over ground already heard does not duplicate the mark", () => {
    const w = emptyWatermark();
    observe(w, ALBUM, TRACK, 0.10, 0.0, SPAN);
    observe(w, ALBUM, TRACK, 0.20, 0.9, SPAN);
    expect(w.marks).toHaveLength(1);
    const kept = { ...w.marks[0] };

    for (let i = 0; i <= 20; i++) observe(w, ALBUM, TRACK, 0.1 + (i / 20) * 0.1, 0.9, SPAN);
    expect(w.marks).toHaveLength(1);
    expect(w.marks[0].turn).toBeCloseTo(kept.turn, 9);
  });

  it("revisiting keeps the deepest mark, never a shallower one", () => {
    const w = emptyWatermark();
    observe(w, ALBUM, TRACK, 0.10, 0.0, SPAN);
    observe(w, ALBUM, TRACK, 0.20, 1.0, SPAN);
    const deep = w.marks[0].depth;

    w.peak = -2;
    observe(w, ALBUM, TRACK, 0.2005, WATERMARK.floor, SPAN);
    expect(w.marks).toHaveLength(1);
    expect(w.marks[0].depth).toBe(deep);
  });

  it("skipping forward leaves the gap: only what was heard is written", () => {
    const album = ALBUMS[4];
    const bounds = boundsOf(album.signature, album.tracks.length);
    const span = bounds[1] - bounds[0];
    const full = listen(4, 0).w;

    const skipped = emptyWatermark();
    for (const { turn, charge } of listen(4, 0).heard) {
      const into = (turn - bounds[0]) / span;
      if (into > 0.25 && into < 0.75) continue;
      observe(skipped, 4, 0, turn, charge, span);
    }

    const middle = (mark: { turn: number }) => {
      const into = (mark.turn - bounds[0]) / span;
      return into > 0.25 && into < 0.75;
    };
    expect(full.marks.length).toBeGreaterThan(0);
    expect(skipped.marks.some(middle)).toBe(false);
    expect(skipped.marks.length).toBeLessThanOrEqual(full.marks.length);
  });

  it("the next track keeps the marks and starts its own ceiling", () => {
    const w = emptyWatermark();
    feed(w, [0.2, 0.9]);
    expect(w.marks).toHaveLength(1);
    observe(w, ALBUM, TRACK + 1, 0.5, 0.2, SPAN);
    expect(w.track).toBe(TRACK + 1);
    expect(w.marks).toHaveLength(1);
    expect(observe(w, ALBUM, TRACK + 1, 0.52, 0.9, SPAN)).toBe(true);
    expect(w.marks).toHaveLength(2);
  });

  it("another record wipes the visit", () => {
    const w = emptyWatermark();
    feed(w, [0.2, 0.9]);
    observe(w, ALBUM + 1, 0, 0.4, 0.2, SPAN);
    expect(w.marks).toHaveLength(0);
    expect(w.album).toBe(ALBUM + 1);
  });

  it("clearing empties the visit and is idempotent", () => {
    const w = emptyWatermark();
    feed(w, [0.2, 0.9]);
    clearWatermark(w);
    expect(w.marks).toHaveLength(0);
    const version = w.version;
    clearWatermark(w);
    expect(w.version).toBe(version);
  });

  it("listening twice to the same track writes the same object", () => {
    const a = listen(2, 0).w;
    const b = listen(2, 0).w;
    expect(b.marks).toEqual(a.marks);
  });
});

describe("the catalogue writes different objects", () => {
  it("a full listen leaves marks a listener could count", () => {
    const counts: number[] = [];
    for (let a = 0; a < ALBUMS.length; a++) {
      for (let k = 0; k < ALBUMS[a].tracks.length; k++) counts.push(listen(a, k).w.marks.length);
    }
    const sorted = counts.slice().sort((x, y) => x - y);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeGreaterThanOrEqual(2);
    expect(Math.max(...counts)).toBeLessThanOrEqual(6);
    expect(counts.filter((c) => c === 0).length).toBeLessThan(counts.length * 0.25);
  }, 120_000);

  it("two tracks of the same length do not leave the same object", () => {
    const same = (a: Watermark, b: Watermark) => {
      if (a.marks.length !== b.marks.length) return false;
      return a.marks.every((mark, i) => {
        const other = b.marks[i];
        const intoA = mark.turn;
        const intoB = other.turn;
        return Math.abs(intoA - intoB) < 0.004 && mark.tier === other.tier;
      });
    };

    const tracks: { seconds: number; w: Watermark }[] = [];
    for (let a = 0; a < ALBUMS.length; a++) {
      const album = ALBUMS[a];
      const bounds = boundsOf(album.signature, album.tracks.length);
      for (let k = 0; k < album.tracks.length; k++) {
        tracks.push({
          seconds: (bounds[k + 1] - bounds[k]) * album.signature.measured.durationS,
          w: listen(a, k).w,
        });
      }
    }
    tracks.sort((x, y) => x.seconds - y.seconds);

    let pairs = 0;
    let identical = 0;
    for (let i = 0; i < tracks.length; i++) {
      for (let j = i + 1; j < tracks.length; j++) {
        if ((tracks[j].seconds - tracks[i].seconds) / tracks[i].seconds > 0.04) break;
        pairs++;
        if (same(tracks[i].w, tracks[j].w)) identical++;
      }
    }
    expect(pairs).toBeGreaterThan(40);
    expect(identical / pairs).toBeLessThan(0.25);
  }, 120_000);

  it("the deposit never reaches the ring labels", () => {
    expect(WATERMARK.depth[1]).toBeLessThan(0.16);
    expect(WATERMARK.depth[0]).toBeLessThan(WATERMARK.depth[1]);
  });
});
