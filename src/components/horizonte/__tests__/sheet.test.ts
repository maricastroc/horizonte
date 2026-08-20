import { describe, expect, it } from "vitest";
import { ALBUMS } from "../content";
import { legacyMorphologyOf } from "../perception/legacy";
import { silhouetteOf } from "../perception/silhouette";

const OUT = process.env.HORIZONTE_SHEET;

describe.runIf(OUT)("folha de contato", () => {
  it("escreve as silhuetas do acervo", async () => {
    const fs = await import("node:fs");
    const zlib = await import("node:zlib");
    const dir = OUT!;
    fs.mkdirSync(dir, { recursive: true });

    const png = (gray: Uint8Array, w: number, h: number) => {
      const raw = Buffer.alloc((w + 1) * h);
      for (let y = 0; y < h; y++) {
        raw[y * (w + 1)] = 0;
        for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = gray[y * w + x];
      }
      const crcT = new Int32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcT[n] = c;
      }
      const crc = (b: Buffer) => {
        let c = -1;
        for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8);
        return (c ^ -1) >>> 0;
      };
      const chunk = (type: string, data: Buffer) => {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length);
        const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
        const cc = Buffer.alloc(4);
        cc.writeUInt32BE(crc(td));
        return Buffer.concat([len, td, cc]);
      };
      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(w, 0);
      ihdr.writeUInt32BE(h, 4);
      ihdr[8] = 8;
      return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk("IHDR", ihdr),
        chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0)),
      ]);
    };

    const sheet = (name: string, legacy: boolean) => {
      const shots = ALBUMS.map((a) =>
        silhouetteOf(a.signature, a.tracks.length, {
          morph: legacy ? legacyMorphologyOf(a.signature) : undefined,
        }),
      );
      const tw = shots[0].gw;
      const th = shots[0].gh;
      const cols = 5;
      const rows = Math.ceil(shots.length / cols);
      const W = tw * cols;
      const H = th * rows;
      const px = new Uint8Array(W * H).fill(10);
      shots.forEach((s, i) => {
        const ox = (i % cols) * tw;
        const oy = Math.floor(i / cols) * th;
        for (let y = 0; y < th; y++)
          for (let x = 0; x < tw; x++)
            px[(oy + y) * W + ox + x] = Math.round((Math.max(-0.5, Math.min(1, s.data[y * tw + x])) + 0.5) * 168) + 4;
      });
      for (let c = 1; c < cols; c++) for (let y = 0; y < H; y++) px[y * W + c * tw] = 60;
      for (let r = 1; r < rows; r++) for (let x = 0; x < W; x++) px[r * th * W + x] = 60;
      fs.writeFileSync(`${dir}/${name}.png`, png(px, W, H));
    };

    sheet("antes", true);
    sheet("depois", false);
    expect(fs.existsSync(`${dir}/depois.png`)).toBe(true);
  });
});
