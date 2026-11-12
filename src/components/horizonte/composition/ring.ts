import { ALBUMS, boundsOf } from "../content";
import { clamp, lerp } from "../math";
import {
  crownAt,
  morphologyOf,
  shellsAt,
  wholeCrownAt,
  type AlbumMorphology,
} from "../morphology";
import { STRAIN_BINS } from "./strain";
import { COLOR, DEPTH, LIGHT, RING, SILHOUETTE, STRAIN, rgba, type Rgb } from "../tokens";
import type { CoverAsset } from "./cover";
import { COVER_SIZE } from "./cover";

const C = RING.buffer / 2;

const MIN_TURN = 1.4 / 360;

export const gapOf = (m: Pick<AlbumMorphology, "fragment">, span: number) =>
  Math.min(m.fragment, Math.max(0, span - MIN_TURN), span * 0.42) / 2;

function buffer(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = RING.buffer;
  c.height = RING.buffer;
  return c;
}

function bakeArc(cover: HTMLCanvasElement, len: number): HTMLCanvasElement {
  const c = buffer();
  const x = c.getContext("2d")!;
  const N = RING.arcSlices;
  const Rin = RING.unitR * RING.arcIn;
  const Rout = RING.unitR * RING.arcOut;
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

interface SliceOp {
  turn: number;
  column: number;
  alpha: number;
  lift: number;
  arcPx: number;
  shells: { inner: number; outer: number }[];
}

class SectorBake {
  readonly sectors: SectorGeometry[] = [];
  private ops: SliceOp[] = [];
  private cursor = 0;
  private colW: number;

  constructor(
    private cover: HTMLCanvasElement,
    bounds: number[],
    m: AlbumMorphology,
    sel: number,
    hover: number,
    active: number,
    readonly canvas: HTMLCanvasElement,
  ) {
    const { alpha, unitR } = RING;
    const n = bounds.length - 1;
    let totalSlices = 0;
    const slicesOf = (span: number) => clamp(Math.round(span * 620), 8, 96);
    for (let k = 0; k < n; k++) totalSlices += slicesOf(bounds[k + 1] - bounds[k]);
    this.colW = Math.ceil(COVER_SIZE / Math.max(1, totalSlices)) + 2;

    for (let k = 0; k < n; k++) {
      const b0 = bounds[k];
      const b1 = bounds[k + 1];
      const span = b1 - b0;
      const g = gapOf(m, span);
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
      const lift = isSel || isAct ? RING.lift : 0;

      const mid = crownAt(m, (t0 + t1) / 2);
      this.sectors.push({ t0, t1, inner: (mid.inner - lift) * unitR });

      const SL = slicesOf(span);
      const arcPx = (2 * Math.PI * mid.inner * unitR) / Math.max(1, totalSlices);
      for (let i = 0; i < SL; i++) {
        const t = t0 + (t1 - t0) * (i / SL);
        this.ops.push({
          turn: t,
          column: Math.floor(t * COVER_SIZE),
          alpha: base,
          lift,
          arcPx,
          shells: shellsAt(m, t),
        });
      }
    }
    this.canvas.getContext("2d")!.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  run(budgetMs: number): boolean {
    const x = this.canvas.getContext("2d")!;
    const { unitR } = RING;
    const started = budgetMs === Number.POSITIVE_INFINITY ? 0 : performance.now();
    x.save();
    x.translate(C, C);
    while (this.cursor < this.ops.length) {
      const op = this.ops[this.cursor++];
      x.save();
      x.rotate(op.turn * 6.2832);
      x.globalAlpha = op.alpha;
      for (const sh of op.shells) {
        const inner = (sh.inner - op.lift) * unitR;
        const outer = (sh.outer + op.lift) * unitR;
        x.drawImage(
          this.cover,
          op.column,
          0,
          this.colW,
          COVER_SIZE,
          inner,
          -op.arcPx * 1.7,
          Math.max(2, outer - inner),
          op.arcPx * 3.4,
        );
      }
      x.restore();
      if ((this.cursor & 15) === 0 && started && performance.now() - started > budgetMs) break;
    }
    x.restore();
    return this.cursor >= this.ops.length;
  }
}

function drawDeformation(
  x: CanvasRenderingContext2D,
  cover: HTMLCanvasElement,
  m: AlbumMorphology,
  field: Float32Array,
) {
  const { unitR } = RING;
  const arcPx = (2 * Math.PI * unitR) / STRAIN_BINS;
  const colW = Math.ceil(COVER_SIZE / STRAIN_BINS) + 2;

  x.save();
  for (let i = 0; i < STRAIN_BINS; i++) {
    const rise = field[i] * unitR;
    if (Math.abs(rise) < 0.4) continue;
    const t = i / STRAIN_BINS;
    const shells = shellsAt(m, t);
    const base = shells[shells.length - 1].outer * unitR;
    x.save();
    x.rotate(t * 6.2832);
    if (rise > 0) {
      x.globalAlpha = STRAIN.alpha;
      x.globalCompositeOperation = "source-over";
      x.drawImage(
        cover,
        Math.floor(t * COVER_SIZE),
        0,
        colW,
        COVER_SIZE,
        base - 1,
        -arcPx * 1.6,
        rise + 1,
        arcPx * 3.2,
      );
    } else {
      x.globalCompositeOperation = "destination-out";
      x.fillStyle = "#000";
      x.fillRect(base + rise, -arcPx * 1.6, -rise + 1, arcPx * 3.2);
    }
    x.restore();
  }
  x.restore();
}

interface SegCacheKey {
  alb: number;
  version: number;
  sel: number;
  hover: number;
  active: number;
  shape: number;
}

function crownPath(x: CanvasRenderingContext2D, m: AlbumMorphology, ox: number, oy: number) {
  const { unitR } = RING;
  const n = SILHOUETTE.step;
  const rows: { inner: number; outer: number }[] = [];
  for (let i = 0; i <= n; i++) rows.push(wholeCrownAt(m, i / n, SILHOUETTE.smooth));
  x.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 6.2832;
    const r = rows[i].outer * unitR;
    if (i === 0) x.moveTo(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
    else x.lineTo(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
  }
  x.closePath();
  for (let i = n; i >= 0; i--) {
    const a = (i / n) * 6.2832;
    const r = rows[i].inner * unitR;
    if (i === n) x.moveTo(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
    else x.lineTo(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
  }
  x.closePath();
}

export function lightInBuffer(flatten: number, rot: number): [number, number] {
  const lx = LIGHT.base[0];
  const ly = -LIGHT.base[1] / Math.max(0.05, flatten);
  const c = Math.cos(-rot);
  const sn = Math.sin(-rot);
  const vx = lx * c - ly * sn;
  const vy = lx * sn + ly * c;
  const len = Math.hypot(vx, vy) || 1;
  return [vx / len, vy / len];
}

export const brighten = (v: Rgb, k: number): Rgb => [
  v[0] + (1 - v[0]) * k,
  v[1] + (1 - v[1]) * k,
  v[2] + (1 - v[2]) * k,
];

export interface Silhouette {
  sharp: HTMLCanvasElement;
  rim: HTMLCanvasElement;
  soft: HTMLCanvasElement;
}

export function bakeSilhouette(
  cover: HTMLCanvasElement,
  m: AlbumMorphology,
  ink: Rgb,
  rot: number,
  sheen: number,
): Silhouette {
  const plates = buffer();
  new SectorBake(cover, m.bounds, m, -1, -1, -1, plates).run(Number.POSITIVE_INFINITY);
  const sharp = buffer();
  const x = sharp.getContext("2d")!;
  x.save();
  x.filter = `blur(${SILHOUETTE.veil}px)`;
  x.drawImage(plates, 0, 0);
  x.filter = "none";
  x.globalCompositeOperation = "destination-in";
  crownPath(x, m, C, C);
  x.fill();
  x.globalCompositeOperation = "destination-over";
  x.fillStyle = COLOR.body;
  crownPath(x, m, C, C);
  x.fill();
  x.globalCompositeOperation = "source-atop";
  x.globalAlpha = lerp(SILHOUETTE.face[0], SILHOUETTE.face[1], sheen);
  x.fillRect(0, 0, RING.buffer, RING.buffer);

  const [lx, ly] = lightInBuffer(m.flatten, rot);
  const reach = RING.unitR * m.rMax;
  const fill = x.createLinearGradient(C - lx * reach, C - ly * reach, C + lx * reach, C + ly * reach);
  fill.addColorStop(0, `rgba(0,0,0,${SILHOUETTE.shade})`);
  fill.addColorStop(0.5, "rgba(0,0,0,0)");
  const lift = lerp(SILHOUETTE.lift[0], SILHOUETTE.lift[1], sheen);
  fill.addColorStop(1, rgba(brighten(ink, SILHOUETTE.rimWhite), lift));
  x.globalAlpha = 1;
  x.fillStyle = fill;
  x.fillRect(0, 0, RING.buffer, RING.buffer);
  x.restore();

  const half = RING.buffer * SILHOUETTE.rimScale;
  const rim = document.createElement("canvas");
  rim.width = half;
  rim.height = half;
  const r = rim.getContext("2d")!;
  const color = rgba(brighten(ink, SILHOUETTE.rimWhite), 1);
  SILHOUETTE.rim.forEach((shift, i) => {
    const layer = document.createElement("canvas");
    layer.width = half;
    layer.height = half;
    const l = layer.getContext("2d")!;
    l.scale(SILHOUETTE.rimScale, SILHOUETTE.rimScale);
    l.fillStyle = color;
    crownPath(l, m, C, C);
    l.fill();
    l.globalCompositeOperation = "destination-out";
    crownPath(l, m, C - lx * shift, C - ly * shift);
    l.fill();
    r.globalAlpha = SILHOUETTE.rimAlpha[i];
    r.filter = `blur(${SILHOUETTE.rimBlur}px)`;
    r.drawImage(layer, 0, 0);
  });

  const soft = document.createElement("canvas");
  soft.width = DEPTH.soft;
  soft.height = DEPTH.soft;
  const sx = soft.getContext("2d")!;
  sx.filter = `blur(${DEPTH.softBlur}px)`;
  sx.drawImage(sharp, 0, 0, DEPTH.soft, DEPTH.soft);
  sx.globalCompositeOperation = "lighter";
  sx.drawImage(rim, 0, 0, DEPTH.soft, DEPTH.soft);
  return { sharp, rim, soft };
}

export interface SegShape {
  m: AlbumMorphology;
  version: number;
  time: number;
}

export class RingBakery {
  private arcs: (HTMLCanvasElement | null)[];
  private arcVersion: number[];
  private silhouettes: (Silhouette | null)[];
  private silhouetteVersion: number[];
  private segKey: SegCacheKey | null = null;
  private segSlices: HTMLCanvasElement | null = null;
  private segSpare: HTMLCanvasElement | null = null;
  private segPrev: HTMLCanvasElement | null = null;
  private segSectors: SectorGeometry[] = [];
  private segOut = buffer();
  private segProgress = -1;
  private segMarks = -1;
  private segBlend = 1;
  private job: SectorBake | null = null;
  private doneAt = Number.NEGATIVE_INFINITY;

  constructor(private covers: CoverAsset[]) {
    this.arcs = covers.map(() => null);
    this.arcVersion = covers.map(() => -1);
    this.silhouettes = covers.map(() => null);
    this.silhouetteVersion = covers.map(() => -1);
  }

  sync() {
    while (this.arcs.length > this.covers.length) {
      this.arcs.pop();
      this.arcVersion.pop();
      this.silhouettes.pop();
      this.silhouetteVersion.pop();
    }
    while (this.arcs.length < this.covers.length) {
      this.arcs.push(null);
      this.arcVersion.push(-1);
      this.silhouettes.push(null);
      this.silhouetteVersion.push(-1);
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

  silhouette(i: number): Silhouette {
    const cover = this.covers[i];
    if (!this.silhouettes[i] || this.silhouetteVersion[i] !== cover.version) {
      const album = ALBUMS[i];
      this.silhouettes[i] = bakeSilhouette(
        cover.canvas,
        this.morph(i),
        album.inkA,
        RING.anchor,
        album.signature.brightness,
      );
      this.silhouetteVersion[i] = cover.version;
    }
    return this.silhouettes[i]!;
  }

  bounds(alb: number): number[] {
    const album = ALBUMS[alb];
    return boundsOf(album.signature, album.tracks.length);
  }

  morph(alb: number): AlbumMorphology {
    const album = ALBUMS[alb];
    return morphologyOf(album.signature, album.tracks.length);
  }

  seg(
    alb: number,
    sel: number,
    hover: number,
    active: number,
    progress: number,
    ink: string,
    field: Float32Array | null = null,
    fieldVersion = 0,
    shape: SegShape | null = null,
  ): HTMLCanvasElement {
    const cover = this.covers[alb];
    const m = shape ? shape.m : this.morph(alb);
    const key: SegCacheKey = {
      alb,
      version: cover.version,
      sel,
      hover,
      active,
      shape: shape ? shape.version : -1,
    };
    const stale =
      !this.segKey ||
      this.segKey.alb !== key.alb ||
      this.segKey.version !== key.version ||
      this.segKey.sel !== key.sel ||
      this.segKey.hover !== key.hover ||
      this.segKey.active !== key.active ||
      this.segKey.shape !== key.shape;

    if (stale) {
      if (shape) {
        const target = this.job ? this.job.canvas : (this.segSpare ?? buffer());
        this.segSpare = null;
        this.job = new SectorBake(cover.canvas, m.bounds, m, sel, hover, active, target);
      } else {
        const job = new SectorBake(cover.canvas, this.bounds(alb), m, sel, hover, active, buffer());
        job.run(Number.POSITIVE_INFINITY);
        this.segSlices = job.canvas;
        this.segSectors = job.sectors;
        this.segPrev = null;
        this.segSpare = null;
        this.job = null;
      }
      this.segKey = key;
    }

    let swapped = false;
    if (this.job) {
      const first = !this.segSlices || !shape || this.segSectors.length !== m.bounds.length - 1;
      if (this.job.run(first ? Number.POSITIVE_INFINITY : RING.bakeBudget)) {
        const free = this.segPrev;
        this.segPrev = first ? null : this.segSlices;
        this.segSlices = this.job.canvas;
        this.segSectors = this.job.sectors;
        this.segSpare = free;
        this.job = null;
        this.doneAt = shape ? shape.time : 0;
        swapped = true;
      }
    }
    const blend =
      shape && this.segPrev ? clamp((shape.time - this.doneAt) / RING.dissolve, 0, 1) : 1;

    const moved = Math.abs(progress - this.segProgress) >= 0.0008;
    const fading = blend !== this.segBlend;
    if (!stale && !swapped && !moved && !fading && fieldVersion === this.segMarks) {
      return this.segOut;
    }
    this.segProgress = progress;
    this.segMarks = fieldVersion;
    this.segBlend = blend;

    const x = this.segOut.getContext("2d")!;
    x.clearRect(0, 0, RING.buffer, RING.buffer);
    if (this.segPrev && blend < 1) {
      x.globalAlpha = 1 - blend;
      x.drawImage(this.segPrev, 0, 0);
      x.globalAlpha = blend;
      x.drawImage(this.segSlices!, 0, 0);
      x.globalAlpha = 1;
    } else {
      x.drawImage(this.segSlices!, 0, 0);
    }

    if (field) {
      x.save();
      x.translate(C, C);
      drawDeformation(x, cover.canvas, m, field);
      x.restore();
    }

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
        Math.max(6, s.inner - 10),
        s.t0 * 6.2832,
        (isAct ? s.t0 + (s.t1 - s.t0) * progress : s.t1) * 6.2832,
      );
      x.stroke();
    });
    x.restore();
    return this.segOut;
  }
}
