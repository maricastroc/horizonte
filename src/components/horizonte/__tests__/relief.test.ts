import { describe, expect, it } from "vitest";
import { ALBUMS } from "../content";
import { morphologyOf, shellsAt, wholeCrownAt } from "../morphology";
import { profileOf, createReliefTexture, writeProfile } from "../composition/relief";
import { gapOf } from "../composition/ring";
import { STRAIN_BINS } from "../composition/strain";
import { RELIEF, RING, SILHOUETTE } from "../tokens";

const N = RELIEF.texels;
const ROW = N * 4;

const morphOf = (alb: number) => morphologyOf(ALBUMS[alb].signature, ALBUMS[alb].tracks.length);

const texelOf = (t: number) => Math.min(N - 1, Math.floor(t * N));

function shellsIn(p: Float32Array, i: number) {
  const pairs = [
    [p[i * 4], p[i * 4 + 1]],
    [p[i * 4 + 2], p[i * 4 + 3]],
    [p[ROW + i * 4], p[ROW + i * 4 + 1]],
  ];
  return pairs.filter(([a, b]) => b > a);
}

const edgeIn = (p: Float32Array, i: number) => p[ROW + i * 4 + 2];

describe("relief profile", () => {
  it("is positive inside every sector and negative in the gaps between them", () => {
    for (let alb = 0; alb < ALBUMS.length; alb++) {
      const m = morphOf(alb);
      const p = new Float32Array(ROW * 2);
      profileOf(m, -1, -1, null, p);
      for (let k = 0; k < m.bounds.length - 1; k++) {
        const b0 = m.bounds[k];
        const b1 = m.bounds[k + 1];
        const g = gapOf(m, b1 - b0);
        expect(edgeIn(p, texelOf((b0 + b1) / 2))).toBeGreaterThan(0);
        if (g * N > 1.5) expect(edgeIn(p, texelOf(b1 === 1 ? 0 : b1))).toBeLessThan(0);
      }
    }
  });

  it("reproduces the shells the ring paints when nothing is lifted", () => {
    for (let alb = 0; alb < ALBUMS.length; alb++) {
      const m = morphOf(alb);
      const p = new Float32Array(ROW * 2);
      profileOf(m, -1, -1, null, p);
      for (const i of [0, 137, 512, 901]) {
        const t = (i + 0.5) / N;
        const drawn = shellsAt(m, t);
        const stored = shellsIn(p, i);
        expect(stored.length).toBeLessThanOrEqual(drawn.length);
        expect(stored[0][0]).toBeCloseTo(drawn[0].inner, 6);
        expect(stored[stored.length - 1][1]).toBeCloseTo(drawn[drawn.length - 1].outer, 6);
      }
    }
  });

  it("merges lifted shells instead of carving a groove inside the plate", () => {
    const alb = ALBUMS.findIndex((_, i) => morphOf(i).strata > 0.05);
    const m = morphOf(alb);
    const mid = (m.bounds[0] + m.bounds[1]) / 2;
    const i = texelOf(mid);
    const p = new Float32Array(ROW * 2);
    profileOf(m, 0, -1, null, p);
    const stored = shellsIn(p, i);
    for (let j = 1; j < stored.length; j++) {
      expect(stored[j][0] - stored[j - 1][1]).toBeGreaterThanOrEqual(RELIEF.merge);
    }
    const drawn = shellsAt(m, (i + 0.5) / N);
    expect(stored[0][0]).toBeCloseTo(drawn[0].inner - RING.lift, 6);
  });

  it("carries the strain into the outermost shell, both swelling and cutting", () => {
    const m = morphOf(0);
    const field = new Float32Array(STRAIN_BINS);
    const up = Math.floor(STRAIN_BINS * 0.25);
    const down = Math.floor(STRAIN_BINS * 0.75);
    field[up] = 0.08;
    field[down] = -0.03;
    const base = new Float32Array(ROW * 2);
    const bent = new Float32Array(ROW * 2);
    profileOf(m, -1, -1, null, base);
    const band = profileOf(m, -1, -1, field, bent);
    const at = (bin: number) => texelOf((bin + 0.5) / STRAIN_BINS);
    const top = (p: Float32Array, i: number) => shellsIn(p, i).at(-1)![1];
    expect(top(bent, at(up))).toBeCloseTo(top(base, at(up)) + 0.08, 4);
    expect(top(bent, at(down))).toBeCloseTo(top(base, at(down)) - 0.03, 4);
    expect(band.hi).toBeGreaterThanOrEqual(top(bent, at(up)));
  });

  it("writes the profile into the half-float texture and flags the upload", () => {
    const tex = createReliefTexture();
    const p = new Float32Array(ROW * 2);
    profileOf(morphOf(1), -1, -1, null, p);
    const before = tex.version;
    writeProfile(tex, p);
    expect(tex.version).toBeGreaterThan(before);
    expect((tex.image.data as Uint16Array).some((v) => v !== 0)).toBe(true);
  });
});

describe("the whole crown seen from the collection", () => {
  it("has no steps where the plates change thickness from track to track", () => {
    const n = 4096;
    const jump = (at: (t: number) => { inner: number; outer: number }) => {
      let worst = 0;
      let prev = at(0);
      for (let i = 1; i <= n; i++) {
        const c = at(i / n);
        worst = Math.max(worst, Math.abs(c.inner - prev.inner), Math.abs(c.outer - prev.outer));
        prev = c;
      }
      return worst;
    };
    let rawWorst = 0;
    for (let alb = 0; alb < ALBUMS.length; alb++) {
      const m = morphOf(alb);
      const raw = jump((t) => {
        const sh = shellsAt(m, t);
        return { inner: sh[0].inner, outer: sh[sh.length - 1].outer };
      });
      rawWorst = Math.max(rawWorst, raw);
      expect(jump((t) => wholeCrownAt(m, t, SILHOUETTE.smooth))).toBeLessThan(0.004);
    }
    expect(rawWorst).toBeGreaterThan(0.04);
  });

  it("stays within the reach of the album it hides", () => {
    for (let alb = 0; alb < ALBUMS.length; alb++) {
      const m = morphOf(alb);
      for (let i = 0; i < 64; i++) {
        const c = wholeCrownAt(m, i / 64, SILHOUETTE.smooth);
        expect(c.inner).toBeGreaterThanOrEqual(m.rMin - 1e-6);
        expect(c.outer).toBeLessThanOrEqual(m.rMax + 1e-6);
      }
    }
  });

  it("is one solid band, with no sector gaps and no strata", () => {
    const m = morphOf(ALBUMS.findIndex((_, i) => morphOf(i).strata > 0.05));
    const p = new Float32Array(ROW * 2);
    profileOf(m, 2, 3, null, p, true);
    for (let i = 0; i < N; i += 17) {
      expect(shellsIn(p, i)).toHaveLength(1);
      expect(edgeIn(p, i)).toBeGreaterThan(0);
    }
  });
});
