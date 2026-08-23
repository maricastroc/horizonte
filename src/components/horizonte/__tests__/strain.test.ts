import { describe, expect, it } from "vitest";
import { ALBUMS } from "../content";
import { boundsOf, chargeAt } from "../content/signature";
import {
  amplitudeOf,
  clearStrain,
  complianceOf,
  emptyStrain,
  loadOf,
  peakOf,
  scarCount,
  strainStep,
  STRAIN_BINS,
  type Strain,
} from "../composition/strain";
import { crownAt, morphologyOf } from "../morphology";
import { STRAIN } from "../tokens";

const AT = 0.25;
const AMP = STRAIN.ampRadius;

const hold = (s: Strain, load: number, seconds: number, dt = 1 / 30) => {
  for (let t = 0; t < seconds; t += dt) strainStep(s, 0, AT, load, AMP, dt);
};

const press = (s: Strain, load: number, seconds: number, from: number, to: number, dt = 1 / 30) => {
  const steps = Math.max(1, Math.round(seconds / dt));
  for (let i = 0; i < steps; i++)
    strainStep(s, 0, from + ((to - from) * i) / steps, load, AMP, dt);
};

const loudest = (v: Float32Array) => {
  let at = 0;
  for (let i = 1; i < STRAIN_BINS; i++) if (Math.abs(v[i]) > Math.abs(v[at])) at = i;
  return at;
};

const centre = (s: Strain) => s.elastic[Math.round(AT * STRAIN_BINS)];
const scar = (s: Strain) => s.plastic[Math.round(AT * STRAIN_BINS)];

function listen(a: number, k: number, dt = 1 / 15) {
  const A = ALBUMS[a];
  const bounds = boundsOf(A.signature, A.tracks.length);
  const albumS = A.signature.measured.durationS;
  const seconds = (bounds[k + 1] - bounds[k]) * albumS;
  const shape = morphologyOf(A.signature, A.tracks.length);
  const comp = complianceOf(A.signature.dynamics);
  const s = emptyStrain();
  for (let t = 0; t <= seconds; t += dt) {
    const turn = bounds[k] + t / albumS;
    const crown = crownAt(shape, turn);
    const amp = amplitudeOf(crown.outer - crown.inner);
    strainStep(s, a, turn, loadOf(chargeAt(A.signature, turn), comp, amp), amp, dt);
  }
  return { s, seconds };
}

describe("the crown is one material with two regimes", () => {
  it("at rest it is the base morphology, undeformed", () => {
    const s = emptyStrain();
    expect(peakOf(s.field)).toBe(0);
    expect(scarCount(s)).toBe(0);
  });

  it("the music has to press hard enough to be felt at all", () => {
    const c = complianceOf(0.5);
    expect(loadOf(STRAIN.dead * 0.9, c, AMP)).toBe(0);
    expect(loadOf(-STRAIN.dead * 0.9, c, AMP)).toBe(0);
    expect(loadOf(1, c, AMP)).toBeCloseTo(c * AMP, 9);
    expect(loadOf(-1, c, AMP)).toBeCloseTo(-c * AMP, 9);
  });

  it("a compressed record yields less than a dynamic one", () => {
    expect(complianceOf(0)).toBe(STRAIN.compliance[0]);
    expect(complianceOf(1)).toBe(STRAIN.compliance[1]);
    expect(complianceOf(0.9)).toBeGreaterThan(complianceOf(0.1));
  });

  it("a thin crown cannot deform as far as a thick one", () => {
    expect(amplitudeOf(1)).toBe(STRAIN.ampRadius);
    expect(amplitudeOf(0.2)).toBeCloseTo(STRAIN.ampBand * 0.2, 9);
    expect(amplitudeOf(0.2)).toBeLessThan(amplitudeOf(0.9));
  });

  it("a common perturbation deforms and returns completely", () => {
    const s = emptyStrain();
    const gentle = STRAIN.yield * 0.55;
    hold(s, gentle, 30);
    expect(centre(s)).toBeGreaterThan(gentle * 0.8);
    expect(scar(s)).toBe(0);

    hold(s, 0, 180);
    expect(Math.abs(centre(s))).toBeLessThan(gentle * 0.02);
    expect(peakOf(s.plastic)).toBe(0);
    expect(peakOf(s.field)).toBeLessThan(gentle * 0.02);
  });

  it("a strong perturbation returns only part of the way and leaves a scar", () => {
    const s = emptyStrain();
    const strong = STRAIN.yield * 2.4;
    hold(s, strong, 40);
    const loaded = centre(s);
    expect(loaded).toBeGreaterThan(STRAIN.yield);

    hold(s, 0, 200);
    const i = Math.round(AT * STRAIN_BINS);
    expect(Math.abs(s.elastic[i])).toBeLessThan(loaded * 0.02);
    expect(s.field[i]).toBeGreaterThan(0);
    expect(s.field[i]).toBeLessThan(loaded);
    expect(s.field[i]).toBeCloseTo(loaded * STRAIN.harden, 2);
    expect(scarCount(s)).toBe(1);
  });

  it("compression leaves a dent, the mirror of the swelling", () => {
    const s = emptyStrain();
    hold(s, -STRAIN.yield * 2.4, 40);
    hold(s, 0, 200);
    expect(s.field[Math.round(AT * STRAIN_BINS)]).toBeLessThan(0);
    expect(scarCount(s)).toBe(1);
  });

  it("the residue only ever deepens, never recovers", () => {
    const s = emptyStrain();
    hold(s, STRAIN.yield * 3, 40);
    const deep = scar(s);
    hold(s, 0, 120);
    hold(s, STRAIN.yield * 1.2, 40);
    expect(scar(s)).toBeCloseTo(deep, 6);
  });

  it("what is drawn is the sum of the two regimes", () => {
    const s = emptyStrain();
    hold(s, STRAIN.yield * 2.4, 40);
    const i = Math.round(AT * STRAIN_BINS);
    expect(s.field[i]).toBeCloseTo(s.elastic[i] + s.plastic[i], 6);
  });

  it("the response does not depend on the frame rate", () => {
    const coarse = emptyStrain();
    const fine = emptyStrain();
    hold(coarse, STRAIN.yield * 2, 20, 1 / 12);
    hold(fine, STRAIN.yield * 2, 20, 1 / 60);
    expect(centre(coarse)).toBeCloseTo(centre(fine), 3);
  });

  it("another record wipes the material", () => {
    const s = emptyStrain();
    hold(s, STRAIN.yield * 3, 40);
    strainStep(s, 1, AT, 0, AMP, 1 / 30);
    expect(peakOf(s.field)).toBe(0);
    expect(s.album).toBe(1);
  });

  it("clearing is idempotent", () => {
    const s = emptyStrain();
    hold(s, STRAIN.yield * 3, 40);
    clearStrain(s);
    const version = s.version;
    clearStrain(s);
    expect(s.version).toBe(version);
    expect(peakOf(s.field)).toBe(0);
  });

  it("the redraw only fires when the material has actually moved", () => {
    const s = emptyStrain();
    hold(s, STRAIN.yield * 3, 40);
    const version = s.version;
    for (let i = 0; i < 5; i++) strainStep(s, 0, AT, STRAIN.yield * 3, AMP, 1 / 240);
    expect(s.version).toBe(version);
  });
});

describe("the load presses one place at a time", () => {
  it("stays on the place it found while the music keeps pressing", () => {
    const s = emptyStrain();
    const drift = (STRAIN.hop - 5) / STRAIN_BINS;
    press(s, STRAIN.yield * 2.4, 60, AT, AT + drift);
    const found = Math.round(AT * STRAIN_BINS);
    const playhead = Math.round((AT + drift) * STRAIN_BINS);

    expect(s.site).toBeCloseTo(AT * STRAIN_BINS, 6);
    expect(loudest(s.elastic)).toBe(found);
    expect(s.elastic[playhead]).toBeLessThan(s.elastic[found] * 0.05);
  });

  it("moves on when the playhead outruns it, leaving the old place recovering", () => {
    const s = emptyStrain();
    const load = STRAIN.yield * 2.4;
    press(s, load, 60, AT, AT);
    const found = Math.round(AT * STRAIN_BINS);
    const held = s.elastic[found];

    const beyond = AT + (STRAIN.hop + 6) / STRAIN_BINS;
    press(s, load, 60, beyond, beyond);
    const moved = Math.round(beyond * STRAIN_BINS);

    expect(s.site).toBeCloseTo(beyond * STRAIN_BINS, 6);
    expect(loudest(s.elastic)).toBe(moved);
    expect(s.elastic[found]).toBeLessThan(held);
    expect(s.elastic[found]).toBeGreaterThan(0);
  });

  it("lets the place go once the music stops pressing", () => {
    const s = emptyStrain();
    press(s, STRAIN.yield * 2.4, 40, AT, AT);
    expect(s.site).toBeGreaterThanOrEqual(0);

    strainStep(s, 0, AT, 0, AMP, 1 / 30);
    expect(s.site).toBe(-1);

    const elsewhere = 0.6;
    press(s, STRAIN.yield * 2.4, 40, elsewhere, elsewhere);
    expect(s.site).toBeCloseTo(elsewhere * STRAIN_BINS, 6);
    expect(loudest(s.elastic)).toBe(Math.round(elsewhere * STRAIN_BINS));
  });

  it("puts the residue under the place that was pressed, not along the path", () => {
    const s = emptyStrain();
    const drift = (STRAIN.hop - 5) / STRAIN_BINS;
    press(s, STRAIN.yield * 2.4, 90, AT, AT + drift);
    press(s, 0, 200, AT + drift, AT + drift);

    expect(loudest(s.plastic)).toBe(Math.round(AT * STRAIN_BINS));
    let marked = 0;
    for (const v of s.plastic) if (Math.abs(v) > STRAIN.scarFloor) marked++;
    expect(marked).toBeLessThan(STRAIN.hop);
  });
});

describe("the catalogue under strain", () => {
  it("leaves scars a listener could count, on most records", () => {
    const counts: number[] = [];
    for (let a = 0; a < ALBUMS.length; a++)
      for (let k = 0; k < ALBUMS[a].tracks.length; k++) counts.push(scarCount(listen(a, k).s));
    const sorted = counts.slice().sort((x, y) => x - y);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeGreaterThanOrEqual(1);
    expect(Math.max(...counts)).toBeLessThanOrEqual(8);
    expect(counts.filter((c) => c === 0).length).toBeLessThanOrEqual(12);
  }, 300_000);

  it("a track that opens under tension is no longer silenced", () => {
    const a = 0;
    const k = ALBUMS[a].tracks.findIndex((t) => t.title === "La Salle de Torture");
    expect(k).toBeGreaterThanOrEqual(0);
    expect(scarCount(listen(a, k).s)).toBeGreaterThan(0);
  }, 120_000);

  it("leaves a footprint under the place pressed, not a trail along the path", () => {
    const widest: number[] = [];
    for (let a = 0; a < ALBUMS.length; a++)
      for (let k = 0; k < ALBUMS[a].tracks.length; k++) {
        const { s } = listen(a, k);
        let run = 0;
        let max = 0;
        for (let i = 0; i < STRAIN_BINS * 2; i++) {
          if (Math.abs(s.plastic[i % STRAIN_BINS]) > STRAIN.scarFloor) max = Math.max(max, ++run);
          else run = 0;
        }
        widest.push((Math.min(max, STRAIN_BINS) * 360) / STRAIN_BINS);
      }
    const sorted = widest.slice().sort((x, y) => x - y);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeLessThanOrEqual(10);
    expect(Math.max(...widest)).toBeLessThan(32);
  }, 300_000);

  it("the scarred arc stays a small fraction of the circuit", () => {
    for (let a = 0; a < ALBUMS.length; a++) {
      const { s } = listen(a, 0);
      let on = 0;
      for (const v of s.plastic) if (Math.abs(v) > STRAIN.scarFloor) on++;
      expect(on / STRAIN_BINS, ALBUMS[a].id).toBeLessThan(0.25);
    }
  }, 300_000);
});
