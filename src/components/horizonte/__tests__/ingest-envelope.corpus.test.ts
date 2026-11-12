import { describe, expect, it } from "vitest";
import { SIGNATURES } from "../content/signature.generated";
import { analyzeTrackPcm, composeAlbum, ENV_WIN, SR, type TrackAnalysis } from "../ingest/dsp";
import { hasCorpus, pearson, readWav, tracksOf } from "./wav";

const ONE_SAMPLE = 1;

const analyses = new Map<string, { base: TrackAnalysis[]; shifted: TrackAnalysis[] }>();

function analysesOf(slug: string) {
  let hit = analyses.get(slug);
  if (!hit) {
    hit = { base: [], shifted: [] };
    for (const file of tracksOf(slug)) {
      const pcm = readWav(file);
      hit.base.push(analyzeTrackPcm(pcm));
      hit.shifted.push(analyzeTrackPcm(pcm.subarray(ONE_SAMPLE)));
    }
    analyses.set(slug, hit);
  }
  return hit;
}

const envelopesOf = (slug: string) => {
  const { base, shifted } = analysesOf(slug);
  return { base: composeAlbum(base).envelopeBytes, shifted: composeAlbum(shifted).envelopeBytes };
};

const rawEnvelopesOf = (slug: string) => {
  const { base, shifted } = analysesOf(slug);
  return { base: base.map((a) => a.envelope), shifted: shifted.map((a) => a.envelope) };
};

describe.skipIf(!hasCorpus)("album envelope stability", () => {
  const CHAOTIC = "zero-project-e-world";
  const STABLE = "meho-mkultra";

  it("a one-sample shift (45 µs) already rewrites a long record's envelope", () => {
    const { base, shifted } = envelopesOf(CHAOTIC);
    let maxDelta = 0;
    for (let i = 0; i < base.length; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(base[i] - shifted[i]));
    }
    expect(pearson(base, shifted)).toBeLessThan(0.99);
    expect(maxDelta).toBeGreaterThan(40);
  }, 120_000);

  it("the raw envelope, before decimation, is stable under the same shift", () => {
    const { base, shifted } = rawEnvelopesOf(CHAOTIC);
    expect(base).toHaveLength(shifted.length);
    base.forEach((track, k) => {
      const n = Math.min(track.length, shifted[k].length);
      expect(pearson(track.subarray(0, n), shifted[k].subarray(0, n))).toBeGreaterThan(0.999);
    });
  }, 120_000);

  it("a record with a slow envelope crosses decimation without moving", () => {
    const { base, shifted } = envelopesOf(STABLE);
    let maxDelta = 0;
    for (let i = 0; i < base.length; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(base[i] - shifted[i]));
    }
    expect(pearson(base, shifted)).toBeGreaterThan(0.999);
    expect(maxDelta).toBeLessThanOrEqual(2);
  }, 120_000);

  it("the catalogue's decimation is aggressive enough to allow aliasing", () => {
    const sig = SIGNATURES[CHAOTIC];
    expect(sig.measured.durationS / ENV_WIN / 512).toBeGreaterThan(40);
    expect(SR * ENV_WIN).toBe(4410);
  });
});
