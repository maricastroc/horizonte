import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SIGNATURES } from "../content/signature.generated";
import { analyzeTrackPcm, composeAlbum, ENV_WIN, SR } from "../ingest/dsp";

const CACHE = path.resolve(__dirname, "../../../../.cache/analysis");
const has = fs.existsSync(CACHE);

function readWav(file: string): Float32Array {
  const buf = fs.readFileSync(file);
  let at = 12;
  let dataOff = -1;
  let dataLen = 0;
  while (at + 8 <= buf.length) {
    const id = buf.toString("ascii", at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    if (id === "data") {
      dataOff = at + 8;
      dataLen = size;
      break;
    }
    at += 8 + size + (size & 1);
  }
  const n = Math.floor(dataLen / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(dataOff + i * 2) / 32768;
  return out;
}

const pcmCache = new Map<string, Float32Array[]>();

function pcmsOf(slug: string): Float32Array[] {
  let hit = pcmCache.get(slug);
  if (!hit) {
    hit = tracksOf(slug).map(readWav);
    pcmCache.set(slug, hit);
  }
  return hit;
}

function tracksOf(slug: string): string[] {
  return fs
    .readdirSync(CACHE)
    .filter((f) => f.startsWith(`${slug}--`) && f.endsWith(".wav"))
    .sort()
    .map((f) => path.join(CACHE, f));
}

function pearson(a: ArrayLike<number>, b: ArrayLike<number>): number {
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

const envelopeOfAlbum = (slug: string, shift: number) =>
  composeAlbum(pcmsOf(slug).map((p) => analyzeTrackPcm(p.subarray(shift)))).envelopeBytes;

const rawEnvelopesOfAlbum = (slug: string, shift: number) =>
  pcmsOf(slug).map((p) => analyzeTrackPcm(p.subarray(shift)).envelope);

const ONE_SAMPLE = 1;

describe.skipIf(!has)("album envelope stability", () => {
  const CHAOTIC = "zero-project-e-world";
  const STABLE = "meho-mkultra";

  it("a one-sample shift (45 µs) already rewrites a long record's envelope", () => {
    const base = envelopeOfAlbum(CHAOTIC, 0);
    const shifted = envelopeOfAlbum(CHAOTIC, ONE_SAMPLE);
    let maxDelta = 0;
    for (let i = 0; i < base.length; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(base[i] - shifted[i]));
    }
    expect(pearson(base, shifted)).toBeLessThan(0.99);
    expect(maxDelta).toBeGreaterThan(40);
  }, 120_000);

  it("the raw envelope, before decimation, is stable under the same shift", () => {
    const base = rawEnvelopesOfAlbum(CHAOTIC, 0);
    const shifted = rawEnvelopesOfAlbum(CHAOTIC, ONE_SAMPLE);
    expect(base).toHaveLength(shifted.length);
    base.forEach((track, k) => {
      const n = Math.min(track.length, shifted[k].length);
      expect(pearson(track.subarray(0, n), shifted[k].subarray(0, n))).toBeGreaterThan(0.999);
    });
  }, 120_000);

  it("a record with a slow envelope crosses decimation without moving", () => {
    const base = envelopeOfAlbum(STABLE, 0);
    const shifted = envelopeOfAlbum(STABLE, ONE_SAMPLE);
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
