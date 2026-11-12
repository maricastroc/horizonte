import { describe, expect, it } from "vitest";
import { ALBUMS } from "../content";
import { morphologyOf, shellsAt, wholeCrownAt, type AlbumMorphology } from "../morphology";
import { blur, ncc } from "../perception/silhouette";
import { RING, SILHOUETTE } from "../tokens";

const G = 160;
const BASE = 50;
const SIGMA = 3.5;

const morphs = ALBUMS.map((a) => morphologyOf(a.signature, a.tracks.length));

function seenFromAfar(m: AlbumMorphology, crown: (t: number) => { inner: number; outer: number }) {
  const out = new Float32Array(G * G);
  const R = BASE * m.circuit;
  const c = Math.cos(-RING.anchor);
  const s = Math.sin(-RING.anchor);
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      const dx = (x - G / 2) / R;
      const dy = (y - G / 2) / (R * m.flatten);
      const bx = dx * c - dy * s;
      const by = dx * s + dy * c;
      const r = Math.hypot(bx, by);
      const w = crown((((Math.atan2(by, bx) / (2 * Math.PI)) % 1) + 1) % 1);
      out[y * G + x] = r > w.inner && r < w.outer ? 1 : 0;
    }
  return blur(out, G, G, SIGMA);
}

function pairs(imgs: Float32Array[]) {
  let sum = 0;
  let n = 0;
  let worst = -1;
  for (let i = 0; i < imgs.length; i++)
    for (let j = i + 1; j < imgs.length; j++) {
      const v = ncc(imgs[i], imgs[j]);
      sum += v;
      n++;
      worst = Math.max(worst, v);
    }
  return { mean: sum / n, worst };
}

describe("the collection does not let records converge", () => {
  const now = pairs(morphs.map((m) => seenFromAfar(m, (t) => wholeCrownAt(m, t, SILHOUETTE.smooth))));

  it("monochrome silhouettes at a glance stay apart", () => {
    expect(now.mean).toBeLessThanOrEqual(0.56);
    expect(now.worst).toBeLessThanOrEqual(0.9);
  });

  it("the raw crown, without the identity reading, fails that bar", () => {
    const raw = pairs(
      morphs.map((m) =>
        seenFromAfar(m, (t) => {
          const sh = shellsAt(m, t);
          return { inner: sh[0].inner, outer: sh[sh.length - 1].outer };
        }),
      ),
    );
    expect(raw.worst).toBeGreaterThan(0.9);
    expect(raw.worst).toBeGreaterThan(now.worst);
  });
});
