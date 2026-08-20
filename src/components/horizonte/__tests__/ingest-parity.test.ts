import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SIGNATURES } from "../content/signature.generated";
import { ENVELOPE_N, envelopeOf } from "../content/signature";
import { analyzeTrackPcm, composeAlbum, encodeEnvelope, norm } from "../ingest/dsp";

const CACHE = path.resolve(__dirname, "../../../../.cache/analysis");
const has = fs.existsSync(CACHE);

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
  if (dataOff < 0 || bits !== 16) throw new Error(`wav inesperado: ${file}`);
  const n = Math.floor(dataLen / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(dataOff + i * 2) / 32768;
  return out;
}

function tracksOf(slug: string): string[] {
  return fs
    .readdirSync(CACHE)
    .filter((f) => f.startsWith(`${slug}--`) && f.endsWith(".wav"))
    .sort()
    .map((f) => path.join(CACHE, f));
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

describe.skipIf(!has)("paridade browser ↔ pipeline offline", () => {
  const slugs = Object.keys(SIGNATURES).filter((s) => tracksOf(s).length > 0);

  it("encontra o cache de análise", () => {
    expect(slugs.length).toBeGreaterThan(0);
  });

  const rows: string[] = [];

  for (const slug of slugs) {
    it(
      `reproduz a assinatura de ${slug}`,
      () => {
        const want = SIGNATURES[slug];
        const analyses = tracksOf(slug).map((f) => analyzeTrackPcm(readWav(f)));
        const got = composeAlbum(analyses);

        const wantEnv = envelopeOf(want);
        const gotEnv = new Float32Array(ENVELOPE_N);
        for (let i = 0; i < ENVELOPE_N; i++) gotEnv[i] = got.envelopeBytes[i] / 255;
        const r = pearson(gotEnv, wantEnv);

        let maxByte = 0;
        for (let i = 0; i < ENVELOPE_N; i++) {
          maxByte = Math.max(maxByte, Math.abs(gotEnv[i] - wantEnv[i]) * 255);
        }

        rows.push(
          [
            slug.padEnd(30),
            `loud ${(rel(got.loudnessDb, want.measured.loudnessDb) * 100).toFixed(4)}%`,
            `dyn ${(rel(got.dynamicsDb, want.measured.dynamicsDb) * 100).toFixed(4)}%`,
            `bright ${(rel(got.brightnessHz, want.measured.brightnessHz) * 100).toFixed(4)}%`,
            `roll ${(rel(got.rolloffHz, want.measured.rolloffHz) * 100).toFixed(4)}%`,
            `bass ${(rel(got.bassRatio, want.measured.bassRatio) * 100).toFixed(4)}%`,
            `pulse ${(rel(got.pulse, want.measured.pulse) * 100).toFixed(4)}%`,
            `dur ${(rel(got.durationS, want.measured.durationS) * 100).toFixed(4)}%`,
            `r ${r.toFixed(6)}`,
            `maxΔb ${maxByte.toFixed(0)}`,
          ].join("  "),
        );

        expect(rel(got.loudnessDb, want.measured.loudnessDb)).toBeLessThan(0.01);
        expect(rel(got.dynamicsDb, want.measured.dynamicsDb)).toBeLessThan(0.01);
        expect(rel(got.brightnessHz, want.measured.brightnessHz)).toBeLessThan(0.01);
        expect(rel(got.rolloffHz, want.measured.rolloffHz)).toBeLessThan(0.01);
        expect(rel(got.bassRatio, want.measured.bassRatio)).toBeLessThan(0.01);
        expect(rel(got.pulse, want.measured.pulse)).toBeLessThan(0.02);
        expect(rel(got.durationS, want.measured.durationS)).toBeLessThan(0.01);
        expect(r).toBeGreaterThan(0.98);

        expect(got.spans.length).toBe(want.spans.length);
        got.spans.forEach((s, i) => expect(rel(s, want.spans[i])).toBeLessThan(0.01));

        expect(norm(got.loudnessDb, "loudness")).toBeCloseTo(want.loudness, 2);
        expect(norm(got.dynamicsDb, "dynamics")).toBeCloseTo(want.dynamics, 2);
        expect(norm(got.brightnessHz, "brightness", true)).toBeCloseTo(want.brightness, 2);
        expect(norm(got.durationS, "duration")).toBeCloseTo(want.duration, 2);
        expect(norm(got.pulse, "pulse")).toBeCloseTo(want.pulse, 2);

        expect(got.trackPulse.length).toBe(want.trackPulse?.length);
        got.trackPulse.forEach((v, i) => {
          expect(norm(v, "pulse")).toBeCloseTo(want.trackPulse![i], 3);
        });

        expect(got.trackBrightnessHz.length).toBe(want.trackBrightness?.length);
        got.trackBrightnessHz.forEach((hz, i) => {
          expect(norm(hz, "brightness", true)).toBeCloseTo(want.trackBrightness![i], 3);
        });

        if (process.env.PARITY_REPORT) {
          fs.appendFileSync(process.env.PARITY_REPORT, `${rows[rows.length - 1]}\n`);
        }
        if (process.env.PARITY_STRICT) {
          expect(encodeEnvelope(got.envelopeBytes)).toBe(want.envelope);
        }
      },
      120_000,
    );
  }
});
