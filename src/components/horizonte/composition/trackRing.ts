import { withExtent, type AlbumMorphology } from "../morphology";
import { clamp, lerp } from "../math";
import type { Score } from "../score";
import { RING, TRACK_RING } from "../tokens";
import { SectorBake } from "./ring";
import { ringBufferScale } from "./layout";

export interface TrackRingView {
  canvas: HTMLCanvasElement;
  cx: number;
  cy: number;
  R: number;
  flatten: number;
  tilt: number;
  rot: number;
  alpha: number;
}

function buffer(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = RING.buffer;
  c.height = RING.buffer;
  return c;
}

export function trackRingMorphology(score: Score): AlbumMorphology {
  return withExtent({
    bounds: [...score.sections.map((s) => s.at), 1],
    plate: score.sections.map((s) =>
      lerp(TRACK_RING.plate[0], TRACK_RING.plate[1], clamp(0.5 + s.level * 0.9, 0, 1)),
    ),
    circuit: 1,
    flatten: 1,
    coreRatio: 0.2,
    bandRatio: TRACK_RING.band,
    relief: 0,
    strata: 0,
    eccX: 0,
    eccY: 0,
    fragment: 0.008,
    spread: 0,
    satellites: [],
    lobeCos: [],
    lobeSin: [],
    phase: 0,
    closure: 1,
    spiral: 0,
    drift: [],
  });
}

export function echoColumn(score: Score, t: number): number {
  const sections = score.sections;
  for (let k = sections.length - 1; k >= 0; k--) {
    const s = sections[k];
    if (t < s.at) continue;
    if (s.recall < 0) return t;
    const r = sections[s.recall];
    const u = (t - s.at) / Math.max(1e-6, s.end - s.at);
    return r.at + u * (r.end - r.at);
  }
  return t;
}

export function sectionAlpha(
  score: Score,
  k: number,
  active: number,
  alpha: { future: number; heard: number; active: number; echo: number },
): number {
  if (k === active) return alpha.active;
  if (k < active) {
    const now = score.sections[active];
    if (now && score.sections[k].cluster === now.cluster) return alpha.echo;
    return alpha.heard;
  }
  return alpha.future;
}

export class TrackRingBakery {
  private canvas = buffer();
  private key = "";

  bake(
    cover: HTMLCanvasElement,
    coverVersion: number,
    score: Score,
    active: number,
  ): HTMLCanvasElement {
    const key = `${score.album}:${score.track}:${coverVersion}:${active}`;
    if (key === this.key) return this.canvas;
    this.key = key;
    const m = trackRingMorphology(score);
    const job = new SectorBake(
      cover,
      m.bounds,
      m,
      -1,
      -1,
      active,
      this.canvas,
      TRACK_RING.density,
      {
        alphaOf: (k) => sectionAlpha(score, k, active, TRACK_RING.alpha),
        liftOf: (k) => (k === active ? RING.lift * 0.6 : 0),
        columnOf: (t) => echoColumn(score, t),
      },
    );
    job.run(Number.POSITIVE_INFINITY);
    return this.canvas;
  }
}

export function drawTrackRingHalf(
  x: CanvasRenderingContext2D,
  view: TrackRingView,
  near: boolean,
  W: number,
  H: number,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  const sc = ringBufferScale(view.R);
  x.save();
  x.translate(view.cx, view.cy);
  x.rotate(view.tilt);
  x.beginPath();
  if (near) x.rect(-W * 2, 0, W * 4, H * 2);
  else x.rect(-W * 2, -H * 2, W * 4, H * 2);
  x.clip();
  x.scale(1, view.flatten);
  x.rotate(view.rot);
  x.globalAlpha = alpha;
  x.globalCompositeOperation = near ? "source-over" : "lighter";
  x.drawImage(view.canvas, -sc / 2, -sc / 2, sc, sc);
  x.restore();
}
