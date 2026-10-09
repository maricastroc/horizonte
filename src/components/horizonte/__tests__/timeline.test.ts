import { describe, expect, it } from "vitest";
import { ALBUMS } from "../content";
import {
  landscapeOf,
  landscapeRotation,
  momentAt,
  morphologyOfState,
} from "../landscape";
import { bodyFrame } from "../perception/structure";
import { grayPng, inkToGray } from "./png";
import { TIMELINE_MOMENTS, TIMELINE_TRACKS } from "./samples";

const OUT = process.env.HORIZONTE_TIMELINE;

describe.runIf(OUT)("timeline contact sheet", () => {
  it("writes identity and six moments for each contrasting track", async () => {
    const fs = await import("node:fs");
    fs.mkdirSync(OUT!, { recursive: true });
    const grid = 120;
    const cols = TIMELINE_MOMENTS.length + 2;
    const rows = TIMELINE_TRACKS.length;
    const W = cols * grid;
    const H = rows * grid;
    const px = new Uint8Array(W * H).fill(10);

    TIMELINE_TRACKS.forEach(([id, track], r) => {
      const alb = ALBUMS.findIndex((a) => a.id === id);
      const L = landscapeOf(alb, track);
      const frames = [
        L.base,
        morphologyOfState(L, L.identity),
        ...TIMELINE_MOMENTS.map((t) => morphologyOfState(L, momentAt(L, t).state)),
      ];
      frames.forEach((m, c) => {
        const data = bodyFrame(m, { grid, rotation: c === 0 ? -1.9 : landscapeRotation(m) });
        for (let y = 0; y < grid; y++) {
          for (let x = 0; x < grid; x++) px[(r * grid + y) * W + c * grid + x] = inkToGray(data[y * grid + x]);
        }
      });
    });
    for (let c = 1; c < cols; c++) for (let y = 0; y < H; y++) px[y * W + c * grid] = c === 1 || c === 2 ? 120 : 60;
    for (let r = 1; r < rows; r++) for (let x = 0; x < W; x++) px[r * grid * W + x] = 60;
    fs.writeFileSync(`${OUT}/timeline.png`, grayPng(px, W, H));
    expect(fs.existsSync(`${OUT}/timeline.png`)).toBe(true);
  });
});
