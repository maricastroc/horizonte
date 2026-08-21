import { beforeEach, describe, expect, it } from "vitest";
import { AudioAnalysis, FFT_SIZE, SMOOTHING, curvature } from "../audio/analysis";
import { CURATION } from "../content/curation.generated";
import { SIGNATURES } from "../content/signature.generated";
import { NEUTRAL_SIGNATURE } from "../content/signature";
import { fieldConstantsOf, reduceMotion } from "../field";
import { fakeContext, sineTrack, type FakeAnalyser } from "./fakes";

const SR = 44100;
const BINS = FFT_SIZE / 2;
const NYQUIST = SR / 2;

const binOf = (hz: number) => Math.round((hz / NYQUIST) * BINS);

function spectrumAt(tracks: [number, number, number][]): Uint8Array {
  const e = new Uint8Array(BINS);
  for (const [de, ate, value] of tracks) {
    for (let b = binOf(de); b <= Math.min(BINS - 1, binOf(ate)); b++) e[b] = value;
  }
  return e;
}

let analysis: AudioAnalysis;
let node: FakeAnalyser;

beforeEach(() => {
  const { ctx, analyser } = fakeContext(SR);
  node = analyser;
  analysis = new AudioAnalysis(ctx);
});

describe("analyser wiring", () => {
  it("uses the same fftSize and smoothing as the offline analysis", () => {
    expect(node.fftSize).toBe(FFT_SIZE);
    expect(node.smoothingTimeConstant).toBe(SMOOTHING);
  });
});

describe("bands", () => {
  it("bass energy does not leak into treble", () => {
    node.spectrum = spectrumAt([[20, 160, 255]]);
    node.wave = sineTrack(0.5);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);

    expect(analysis.frame.bass).toBeGreaterThan(0.9);
    expect(analysis.frame.treb).toBeLessThan(0.05);
  });

  it("treble energy does not leak into bass", () => {
    node.spectrum = spectrumAt([[2000, 11000, 255]]);
    node.wave = sineTrack(0.5);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);

    expect(analysis.frame.treb).toBeGreaterThan(0.9);
    expect(analysis.frame.bass).toBeLessThan(0.05);
  });

  it("silence in the spectrum takes the bands to zero", () => {
    node.spectrum = new Uint8Array(BINS);
    node.wave = sineTrack(0);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);

    expect(analysis.frame.bass).toBeLessThan(0.01);
    expect(analysis.frame.mid).toBeLessThan(0.01);
    expect(analysis.frame.treb).toBeLessThan(0.01);
  });
});

describe("normalization against the album signature", () => {
  it("with no reference, the raw level is the level", () => {
    node.spectrum = spectrumAt([[20, 160, 128]]);
    node.wave = sineTrack(0.5);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);
    const withoutRef = analysis.frame.bass;

    expect(withoutRef).toBeGreaterThan(0.4);
    expect(withoutRef).toBeLessThan(0.6);
  });

  it("with a reference, the same signal fills the record's usable range", () => {
    const raw = 128 / 255;
    analysis.setReference({
      ...NEUTRAL_SIGNATURE.reference,
      bass: [raw - 0.01, raw + 0.01],
    });
    node.spectrum = spectrumAt([[20, 160, 128]]);
    node.wave = sineTrack(0.5);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);

    expect(analysis.frame.bass).toBeGreaterThan(0.4);
    expect(analysis.frame.bass).toBeLessThan(0.6);
  });

  it("a signal above the record's p90 saturates at 1, not beyond", () => {
    analysis.setReference({ ...NEUTRAL_SIGNATURE.reference, bass: [0.1, 0.2] });
    node.spectrum = spectrumAt([[20, 160, 255]]);
    node.wave = sineTrack(0.5);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);

    expect(analysis.frame.bass).toBeLessThanOrEqual(1);
    expect(analysis.frame.bass).toBeGreaterThan(0.99);
  });
});

describe("accent", () => {
  it("is zero when the level is business as usual", () => {
    node.spectrum = spectrumAt([[20, 160, 200]]);
    node.wave = sineTrack(0.5);
    for (let i = 0; i < 600; i++) analysis.update(0.05, true);

    expect(Math.abs(analysis.frame.accent.bass)).toBeLessThan(0.05);
  });

  it("rises when the band exceeds its own habit", () => {
    node.spectrum = spectrumAt([[20, 160, 60]]);
    node.wave = sineTrack(0.5);
    for (let i = 0; i < 600; i++) analysis.update(0.05, true);

    node.spectrum = spectrumAt([[20, 160, 255]]);
    for (let i = 0; i < 4; i++) analysis.update(0.05, true);

    expect(analysis.frame.accent.bass).toBeGreaterThan(0.3);
  });

  it("never leaves [-1, 1]", () => {
    node.wave = sineTrack(0.9);
    for (let i = 0; i < 60; i++) {
      node.spectrum = spectrumAt([[20, 160, i % 2 ? 255 : 0]]);
      analysis.update(0.05, true);
      const a = analysis.frame.accent;
      for (const v of [a.bass, a.mid, a.treb]) {
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("centroid", () => {
  it("a low spectrum reads dark", () => {
    node.spectrum = spectrumAt([[200, 300, 255]]);
    node.wave = sineTrack(0.5);
    for (let i = 0; i < 400; i++) analysis.update(0.05, true);

    expect(analysis.frame.centroid).toBeLessThan(0.25);
  });

  it("a high spectrum reads bright", () => {
    node.spectrum = spectrumAt([[2400, 2800, 255]]);
    node.wave = sineTrack(0.5);
    for (let i = 0; i < 400; i++) analysis.update(0.05, true);

    expect(analysis.frame.centroid).toBeGreaterThan(0.9);
  });

  it("stays in [0, 1] even with the whole spectrum full", () => {
    node.spectrum = spectrumAt([[20, 11000, 255]]);
    node.wave = sineTrack(0.5);
    for (let i = 0; i < 400; i++) analysis.update(0.05, true);

    expect(analysis.frame.centroid).toBeGreaterThanOrEqual(0);
    expect(analysis.frame.centroid).toBeLessThanOrEqual(1);
  });
});

describe("energy and flux", () => {
  it("a louder wave reads more energy", () => {
    node.spectrum = spectrumAt([[20, 11000, 128]]);

    node.wave = sineTrack(0.15);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);
    const low = analysis.frame.energy;

    node.wave = sineTrack(0.95);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);
    const high = analysis.frame.energy;

    expect(high).toBeGreaterThan(low);
  });

  it("a steady signal produces no flux", () => {
    node.spectrum = spectrumAt([[20, 11000, 180]]);
    node.wave = sineTrack(0.5);
    for (let i = 0; i < 400; i++) analysis.update(0.05, true);

    expect(analysis.frame.flux).toBeLessThan(0.05);
  });

  it("abrupt spectral changes produce flux", () => {
    node.wave = sineTrack(0.5);
    for (let i = 0; i < 40; i++) {
      node.spectrum = spectrumAt([[20, 11000, i % 2 ? 255 : 20]]);
      analysis.update(0.05, true);
    }

    expect(analysis.frame.flux).toBeGreaterThan(0.1);
  });
});

describe("silence", () => {
  it("with no playback the frame decays to zero without reading the spectrum", () => {
    node.spectrum = spectrumAt([[20, 11000, 255]]);
    node.wave = sineTrack(0.9);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);
    expect(analysis.frame.energy).toBeGreaterThan(0.1);

    for (let i = 0; i < 400; i++) analysis.update(0.05, false);

    const f = analysis.frame;
    expect(f.energy).toBeLessThan(0.001);
    expect(f.bass).toBeLessThan(0.001);
    expect(f.mid).toBeLessThan(0.001);
    expect(f.treb).toBeLessThan(0.001);
    expect(f.flux).toBeLessThan(0.001);
    expect(Math.abs(f.accent.bass)).toBeLessThan(0.001);
  });

  it("the decay returns the same frame, not a new object", () => {
    expect(analysis.update(0.05, false)).toBe(analysis.frame);
    expect(analysis.update(0.05, true)).toBe(analysis.frame);
  });
});

describe("curvature — perturbation bounded by the album's ceiling", () => {
  it("with no accent, it hands back the constant intact", () => {
    expect(curvature(0.075, 0, 0.15)).toBeCloseTo(0.075, 12);
  });

  it("the accent moves at most ±cap around the base", () => {
    expect(curvature(0.075, 1, 0.15)).toBeCloseTo(0.075 * 1.15, 12);
    expect(curvature(0.075, -1, 0.15)).toBeCloseTo(0.075 * 0.85, 12);
  });

  it("accents beyond ±1 saturate instead of breaking the ceiling", () => {
    expect(curvature(0.075, 40, 0.15)).toBeCloseTo(curvature(0.075, 1, 0.15), 12);
    expect(curvature(0.075, -40, 0.15)).toBeCloseTo(curvature(0.075, -1, 0.15), 12);
  });

  it("is monotonic in the accent", () => {
    const vs = [-1, -0.5, 0, 0.5, 1].map((a) => curvature(0.075, a, 0.15));
    for (let i = 1; i < vs.length; i++) expect(vs[i]).toBeGreaterThan(vs[i - 1]);
  });

  it("a zero ceiling freezes the property — the world stops reacting", () => {
    for (const a of [-1, -0.3, 0, 0.6, 1]) {
      expect(curvature(0.075, a, 0)).toBe(0.075);
    }
  });

  it("with prefers-reduced-motion no album reacts to anything", () => {
    for (const album of CURATION) {
      const c = reduceMotion(fieldConstantsOf(SIGNATURES[album.id]));
      expect(curvature(0.075, 1, c.reactionCap)).toBe(0.075);
      expect(curvature(0.42, -1, c.reactionCap)).toBe(0.42);
    }
  });

  it("dynamic records breathe more than compressed ones", () => {
    const cap = (id: string) => fieldConstantsOf(SIGNATURES[id]).reactionCap;
    const lebar = curvature(0.075, 1, cap("jono-terbakar-lebar"));
    const wryWay = curvature(0.075, 1, cap("tale-twist-wry-way"));
    expect(lebar).toBeGreaterThan(wryWay);
  });
});
