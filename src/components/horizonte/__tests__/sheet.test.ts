import { describe, expect, it } from "vitest";
import { ALBUMS } from "../content";
import { legacyMorphologyOf } from "../perception/legacy";
import { silhouetteOf } from "../perception/silhouette";
import { grayPng, inkToGray } from "./png";

const OUT = process.env.HORIZONTE_SHEET;

describe.runIf(OUT)("folha de contato", () => {
  it("writes the silhouettes of the catalogue", async () => {
    const fs = await import("node:fs");
    const dir = OUT!;
    fs.mkdirSync(dir, { recursive: true });

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
            px[(oy + y) * W + ox + x] = inkToGray(s.data[y * tw + x]);
      });
      for (let c = 1; c < cols; c++) for (let y = 0; y < H; y++) px[y * W + c * tw] = 60;
      for (let r = 1; r < rows; r++) for (let x = 0; x < W; x++) px[r * th * W + x] = 60;
      fs.writeFileSync(`${dir}/${name}.png`, grayPng(px, W, H));
    };

    sheet("before", true);
    sheet("after", false);
    expect(fs.existsSync(`${dir}/after.png`)).toBe(true);
  });
});
