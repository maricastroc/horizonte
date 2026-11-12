import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ALBUMS } from "../content";
import { analyzeTrackPcm, composeAlbum } from "../ingest/dsp";
import { pearson, readWav } from "./wav";

const DIR = path.resolve(__dirname, "fixtures/parity");

type Golden = {
  sourceSlug: string;
  source: { license: string; url: string; attribution: string };
  sampleRate: number;
  tracks: string[];
  expected: {
    durationS: number;
    loudnessDb: number;
    dynamicsDb: number;
    brightnessHz: number;
    rolloffHz: number;
    bassRatio: number;
    pulse: number;
    trackPulse: number[];
    trackBrightnessHz: number[];
    spans: number[];
    envelopeBase64: string;
  };
};

const rel = (got: number, want: number) =>
  want === 0 ? Math.abs(got) : Math.abs((got - want) / want);

describe("conformance vector: browser DSP ↔ offline pipeline", () => {
  const golden: Golden = JSON.parse(
    fs.readFileSync(path.join(DIR, "golden.json"), "utf8"),
  );

  it("ships the committed fixture, so this runs without the 2.1 GB archive", () => {
    expect(golden.tracks.length).toBeGreaterThan(0);
    for (const t of golden.tracks) {
      expect(fs.existsSync(path.join(DIR, t))).toBe(true);
    }
  });

  it("comes from a catalogue album and carries its licence", () => {
    const album = ALBUMS.find((a) => a.id === golden.sourceSlug);
    expect(album, golden.sourceSlug).toBeTruthy();
    expect(golden.source.license).toBe(album!.license.name);
    expect(golden.source.url).toBe(album!.license.source);
    expect(golden.source.attribution).toBe(album!.license.attribution);
  });

  it("reproduces every descriptor the Python pipeline measured", () => {
    const analyses = golden.tracks.map((t) => analyzeTrackPcm(readWav(path.join(DIR, t))));
    const got = composeAlbum(analyses);
    const want = golden.expected;

    expect(rel(got.durationS, want.durationS)).toBeLessThan(0.01);
    expect(rel(got.loudnessDb, want.loudnessDb)).toBeLessThan(0.01);
    expect(rel(got.dynamicsDb, want.dynamicsDb)).toBeLessThan(0.01);
    expect(rel(got.brightnessHz, want.brightnessHz)).toBeLessThan(0.01);
    expect(rel(got.rolloffHz, want.rolloffHz)).toBeLessThan(0.01);
    expect(rel(got.bassRatio, want.bassRatio)).toBeLessThan(0.01);
    expect(rel(got.pulse, want.pulse)).toBeLessThan(0.02);

    expect(got.spans.length).toBe(want.spans.length);
    got.spans.forEach((s, i) => expect(rel(s, want.spans[i])).toBeLessThan(0.01));

    expect(got.trackPulse.length).toBe(want.trackPulse.length);
    got.trackPulse.forEach((v, i) => expect(rel(v, want.trackPulse[i])).toBeLessThan(0.02));

    expect(got.trackBrightnessHz.length).toBe(want.trackBrightnessHz.length);
    got.trackBrightnessHz.forEach((v, i) =>
      expect(rel(v, want.trackBrightnessHz[i])).toBeLessThan(0.01),
    );
  });

  it("reproduces the album envelope", () => {
    const analyses = golden.tracks.map((t) => analyzeTrackPcm(readWav(path.join(DIR, t))));
    const got = composeAlbum(analyses);

    const wantBytes = Buffer.from(golden.expected.envelopeBase64, "base64");
    expect(got.envelopeBytes.length).toBe(wantBytes.length);

    const a = new Float32Array(wantBytes.length);
    const b = new Float32Array(wantBytes.length);
    let maxDelta = 0;
    for (let i = 0; i < wantBytes.length; i++) {
      a[i] = got.envelopeBytes[i] / 255;
      b[i] = wantBytes[i] / 255;
      maxDelta = Math.max(maxDelta, Math.abs(got.envelopeBytes[i] - wantBytes[i]));
    }

    expect(pearson(a, b)).toBeGreaterThan(0.98);
    expect(maxDelta).toBeLessThanOrEqual(8);
  });
});
