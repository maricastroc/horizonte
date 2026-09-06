import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeTrackPcm, composeAlbum } from "../ingest/dsp";

const DIR = path.resolve(__dirname, "fixtures/parity");

type Golden = {
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

function readWav(file: string): Float32Array {
  const buf = fs.readFileSync(file);
  let at = 12;
  let dataOff = -1;
  let dataLen = 0;
  let bits = 16;
  while (at + 8 <= buf.length) {
    const id = buf.toString("ascii", at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    if (id === "fmt ") bits = buf.readUInt16LE(at + 22);
    if (id === "data") {
      dataOff = at + 8;
      dataLen = size;
      break;
    }
    at += 8 + size + (size & 1);
  }
  if (dataOff < 0 || bits !== 16) throw new Error(`unexpected wav: ${file}`);
  const n = Math.floor(dataLen / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(dataOff + i * 2) / 32768;
  return out;
}

function pearson(a: Float32Array, b: Float32Array): number {
  const n = a.length;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return num / Math.sqrt(da * db);
}

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
