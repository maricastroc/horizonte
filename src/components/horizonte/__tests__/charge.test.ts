import { describe, expect, it } from "vitest";
import { ALBUMS } from "../content";
import {
  boundsOf,
  chargeAt,
  chargeOf,
  chargeWindowOf,
  ENVELOPE_N,
  NEUTRAL_SIGNATURE,
  type AlbumSignature,
} from "../content/signature";
import { CHARGE } from "../tokens";

const median = (v: number[]) => v.slice().sort((a, b) => a - b)[Math.floor(v.length / 2)];

function correlation(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const u = xs[i] - mx;
    const v = ys[i] - my;
    sxy += u * v;
    sxx += u * u;
    syy += v * v;
  }
  return sxx * syy < 1e-12 ? 0 : sxy / Math.sqrt(sxx * syy);
}

function trackSpan(sig: AlbumSignature, trackCount: number, k: number) {
  const bounds = boundsOf(sig, trackCount);
  const from = Math.floor(bounds[k] * (ENVELOPE_N - 1));
  const to = Math.max(from + 1, Math.floor(bounds[k + 1] * (ENVELOPE_N - 1)));
  return { from, to, seconds: (bounds[k + 1] - bounds[k]) * sig.measured.durationS };
}

function shape(sig: AlbumSignature, trackCount: number, k: number, samples: number): number[] {
  const curve = chargeOf(sig);
  const bounds = boundsOf(sig, trackCount);
  const from = bounds[k] * (ENVELOPE_N - 1);
  const to = bounds[k + 1] * (ENVELOPE_N - 1);
  const out: number[] = [];
  for (let i = 0; i < samples; i++) {
    const x = from + ((to - from) * i) / (samples - 1);
    const lo = Math.floor(x);
    const hi = Math.min(ENVELOPE_N - 1, lo + 1);
    out.push(curve[lo] + (curve[hi] - curve[lo]) * (x - lo));
  }
  return out;
}

describe("the charge curve is a property of the record, measured once", () => {
  it("hands back the same buffer on every call", () => {
    const sig = ALBUMS[0].signature;
    expect(chargeOf(sig)).toBe(chargeOf(sig));
    expect(chargeOf(sig).length).toBe(ENVELOPE_N);
  });

  it("with no measured envelope, the field never charges", () => {
    const curve = chargeOf(NEUTRAL_SIGNATURE);
    expect(Array.from(curve).every((v) => v === 0)).toBe(true);
    expect(chargeAt(NEUTRAL_SIGNATURE, 0.4)).toBe(0);
  });

  it("stays inside its declared range across the catalogue", () => {
    for (const album of ALBUMS) {
      for (const v of chargeOf(album.signature)) {
        expect(Math.abs(v), album.id).toBeLessThanOrEqual(1);
      }
    }
  });

  it("every record charges enough for the signal to exist", () => {
    for (const album of ALBUMS) {
      let peak = 0;
      for (const v of chargeOf(album.signature)) peak = Math.max(peak, Math.abs(v));
      expect(peak, album.id).toBeGreaterThan(0.5);
    }
  });

  it("the window never falls below the record's own envelope resolution", () => {
    for (const album of ALBUMS) {
      const w = chargeWindowOf(album.signature);
      expect(w.fast, album.id).toBeGreaterThanOrEqual(CHARGE.fastSeconds);
      expect(w.fast, album.id).toBeGreaterThanOrEqual(CHARGE.stepFloor * w.step);
      expect(w.slow).toBeCloseTo(w.fast * CHARGE.ratio, 6);
    }
  });

  it("the knee keeps the order between charged and very charged", () => {
    const sig = ALBUMS[0].signature;
    const curve = chargeOf(sig);
    const stuck = Array.from(curve).filter((v) => Math.abs(v) >= 0.999).length;
    expect(stuck).toBeLessThan(ENVELOPE_N * 0.02);
  });
});

describe("the charge is not the clock in disguise", () => {
  it("inside a track it barely tracks linear progress", () => {
    const scores: number[] = [];
    for (const album of ALBUMS) {
      const n = album.tracks.length;
      const curve = chargeOf(album.signature);
      for (let k = 0; k < n; k++) {
        const { from, to } = trackSpan(album.signature, n, k);
        const values: number[] = [];
        const clock: number[] = [];
        for (let i = from; i <= to; i++) {
          values.push(curve[i]);
          clock.push((i - from) / (to - from));
        }
        scores.push(Math.abs(correlation(values, clock)));
      }
    }
    expect(median(scores)).toBeLessThanOrEqual(0.7);
  });

  it("two tracks of the same length write different histories", () => {
    const tracks: { seconds: number; shape: number[] }[] = [];
    for (const album of ALBUMS) {
      const n = album.tracks.length;
      for (let k = 0; k < n; k++) {
        tracks.push({
          seconds: trackSpan(album.signature, n, k).seconds,
          shape: shape(album.signature, n, k, 24),
        });
      }
    }
    tracks.sort((a, b) => a.seconds - b.seconds);

    const scores: number[] = [];
    for (let i = 0; i < tracks.length; i++) {
      for (let j = i + 1; j < tracks.length; j++) {
        if ((tracks[j].seconds - tracks[i].seconds) / tracks[i].seconds > 0.04) break;
        scores.push(correlation(tracks[i].shape, tracks[j].shape));
      }
    }
    expect(scores.length).toBeGreaterThan(40);
    expect(scores.reduce((a, b) => a + b, 0) / scores.length).toBeLessThanOrEqual(0.6);
  });

  it("the same position always gives the same charge, whatever the path", () => {
    const sig = ALBUMS[3].signature;
    const forward = [0.1, 0.2, 0.3, 0.62].map((p) => chargeAt(sig, p));
    const backward = [0.9, 0.62].map((p) => chargeAt(sig, p));
    expect(backward[1]).toBe(forward[3]);
    expect(chargeAt(sig, -1)).toBe(chargeAt(sig, 0));
    expect(chargeAt(sig, 2)).toBe(chargeAt(sig, 1));
  });
});
