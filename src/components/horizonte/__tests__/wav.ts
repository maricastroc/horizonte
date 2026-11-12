import fs from "node:fs";
import path from "node:path";

export const CORPUS = path.resolve(__dirname, "../../../../.cache/analysis");

export const hasCorpus = fs.existsSync(CORPUS);

export function tracksOf(slug: string): string[] {
  if (!hasCorpus) return [];
  return fs
    .readdirSync(CORPUS)
    .filter((f) => f.startsWith(`${slug}--`) && f.endsWith(".wav"))
    .sort()
    .map((f) => path.join(CORPUS, f));
}

export function readWav(file: string): Float32Array {
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

export function pearson(a: ArrayLike<number>, b: ArrayLike<number>): number {
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
