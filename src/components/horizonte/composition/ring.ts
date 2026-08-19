import { ALBUMS, boundsOf, envelopeOf, sampleEnvelope } from "../content";
import { clamp } from "../math";
import { RING } from "../tokens";
import type { CoverAsset } from "./cover";
import { COVER_SIZE } from "./cover";

const C = RING.buffer / 2;

const GAP_TURN = 0.0075;

const MIN_TURN = 1.4 / 360;

function buffer(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = RING.buffer;
  c.height = RING.buffer;
  return c;
}

function bakeArc(cover: HTMLCanvasElement, len: number): HTMLCanvasElement {
  const c = buffer();
  const x = c.getContext("2d")!;
  const { Rin, Rout, arcSlices: N } = RING;
  const th = Rout - Rin;
  const sw = COVER_SIZE / N;
  const arc = (2 * Math.PI * Rin) / N;

  x.translate(C, C);
  for (let i = 0; i < N; i++) {
    const t = i / N;
    if (t > len) continue;
    x.save();
    x.rotate(t * 6.2832);
    x.globalAlpha = Math.min(1, (len - t) / 0.13) * Math.min(1, t / 0.1);
    x.drawImage(cover, i * sw, 0, sw + 1.5, COVER_SIZE, Rin, -arc * 1.6, th, arc * 3.2);
    x.restore();
  }

  x.globalCompositeOperation = "destination-in";
  const g = x.createRadialGradient(0, 0, Rin * 0.94, 0, 0, Rout);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.28, "rgba(0,0,0,1)");
  g.addColorStop(0.8, "rgba(0,0,0,.9)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.beginPath();
  x.arc(0, 0, Rout, 0, 6.2832);
  x.fill();

  const out = buffer();
  const ox = out.getContext("2d")!;
  ox.filter = "blur(1.4px)";
  ox.drawImage(c, 0, 0);
  return out;
}

export interface SectorGeometry {
  t0: number;
  t1: number;
  inner: number;
}

function bakeSectors(
  cover: HTMLCanvasElement,
  bounds: number[],
  env: Float32Array,
  depth: number,
  sel: number,
  hover: number,
  active: number,
): { canvas: HTMLCanvasElement; sectors: SectorGeometry[] } {
  const c = buffer();
  const x = c.getContext("2d")!;
  const { Rin, Rout, alpha } = RING;
  const th = Rout - Rin;
  const n = bounds.length - 1;
  const sectors: SectorGeometry[] = [];

  let totalSlices = 0;
  const slicesOf = (span: number) => clamp(Math.round(span * 620), 8, 96);
  for (let k = 0; k < n; k++) totalSlices += slicesOf(bounds[k + 1] - bounds[k]);
  const colW = Math.ceil(COVER_SIZE / Math.max(1, totalSlices)) + 2;

  x.save();
  x.translate(C, C);
  for (let k = 0; k < n; k++) {
    const b0 = bounds[k];
    const b1 = bounds[k + 1];
    const span = b1 - b0;
    const g = Math.min(GAP_TURN, Math.max(0, span - MIN_TURN)) / 2;
    const t0 = b0 + g;
    const t1 = b1 - g;

    const isSel = k === sel;
    const isHov = k === hover;
    const isAct = k === active;
    const base = isAct
      ? alpha.playing
      : isSel
        ? alpha.selected
        : isHov
          ? alpha.hover
          : alpha.normal;
    const inner = isSel || isAct ? Rin - th * 0.16 : Rin;
    const baseTh = (isSel || isAct ? th * 1.16 : th * 0.82);
    sectors.push({ t0, t1, inner });

    const SL = slicesOf(span);
    const arcPx = (2 * Math.PI * inner) / Math.max(1, totalSlices);
    for (let i = 0; i < SL; i++) {
      const f = i / SL;
      const t = t0 + (t1 - t0) * f;

      const e = sampleEnvelope(env, b0 + span * f);
      const thick = baseTh * clamp(1 + depth * (e * 2 - 1), 0.55, 1.2);

      x.save();
      x.rotate(t * 6.2832);
      x.globalAlpha = base;
      x.drawImage(
        cover,
        Math.floor(t * COVER_SIZE),
        0,
        colW,
        COVER_SIZE,
        inner,
        -arcPx * 1.7,
        thick,
        arcPx * 3.4,
      );
      x.restore();
    }
  }
  x.restore();
  return { canvas: c, sectors };
}

interface SegCacheKey {
  alb: number;
  version: number;
  sel: number;
  hover: number;
  active: number;
  depth: number;
}

export class RingBakery {
  private arcs: (HTMLCanvasElement | null)[];
  private arcVersion: number[];
  private segKey: SegCacheKey | null = null;
  private segSlices: HTMLCanvasElement | null = null;
  private segSectors: SectorGeometry[] = [];
  private segOut = buffer();
  private segProgress = -1;

  constructor(private covers: CoverAsset[]) {
    this.arcs = covers.map(() => null);
    this.arcVersion = covers.map(() => -1);
  }

  sync() {
    while (this.arcs.length > this.covers.length) {
      this.arcs.pop();
      this.arcVersion.pop();
    }
    while (this.arcs.length < this.covers.length) {
      this.arcs.push(null);
      this.arcVersion.push(-1);
    }
    this.segKey = null;
  }

  arc(i: number): HTMLCanvasElement {
    const cover = this.covers[i];
    if (!this.arcs[i] || this.arcVersion[i] !== cover.version) {
      this.arcs[i] = bakeArc(cover.canvas, 0.52 + (i % 3) * 0.06);
      this.arcVersion[i] = cover.version;
    }
    return this.arcs[i]!;
  }

  bounds(alb: number): number[] {
    const album = ALBUMS[alb];
    return boundsOf(album.signature, album.tracks.length);
  }

  seg(
    alb: number,
    sel: number,
    hover: number,
    active: number,
    progress: number,
    ink: string,
    depth: number,
  ): HTMLCanvasElement {
    const cover = this.covers[alb];
    const key: SegCacheKey = {
      alb,
      version: cover.version,
      sel,
      hover,
      active,
      depth: Math.round(depth * 200),
    };
    const stale =
      !this.segKey ||
      this.segKey.alb !== key.alb ||
      this.segKey.version !== key.version ||
      this.segKey.sel !== key.sel ||
      this.segKey.hover !== key.hover ||
      this.segKey.active !== key.active ||
      this.segKey.depth !== key.depth;

    if (stale) {
      const album = ALBUMS[alb];
      const baked = bakeSectors(
        cover.canvas,
        this.bounds(alb),
        envelopeOf(album.signature),
        depth,
        sel,
        hover,
        active,
      );
      this.segSlices = baked.canvas;
      this.segSectors = baked.sectors;
      this.segKey = key;
    }

    if (!stale && Math.abs(progress - this.segProgress) < 0.0008) return this.segOut;
    this.segProgress = progress;

    const x = this.segOut.getContext("2d")!;
    x.clearRect(0, 0, RING.buffer, RING.buffer);
    x.drawImage(this.segSlices!, 0, 0);

    x.save();
    x.translate(C, C);
    this.segSectors.forEach((s, k) => {
      const isAct = k === active;
      const isSel = k === sel;
      x.globalAlpha = isAct ? 0.9 : isSel ? 0.55 : 0.18;
      x.strokeStyle = ink;
      x.lineWidth = isAct ? 4 : 2;
      x.beginPath();
      x.arc(
        0,
        0,
        s.inner - 10,
        s.t0 * 6.2832,
        (isAct ? s.t0 + (s.t1 - s.t0) * progress : s.t1) * 6.2832,
      );
      x.stroke();
    });
    x.restore();
    return this.segOut;
  }
}
