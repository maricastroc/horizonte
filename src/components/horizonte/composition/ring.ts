import { ALBUMS, boundsOf } from "../content";
import { clamp } from "../math";
import {
  arcSpanOf,
  crownAt,
  isPathed,
  morphologyOf,
  pathTurn,
  shellsAt,
  type AlbumMorphology,
} from "../morphology";
import { STRAIN_BINS } from "./strain";
import { RING, SECTION_LAYER, STRAIN } from "../tokens";
import type { Score } from "../score";
import type { CoverAsset } from "./cover";
import { COVER_SIZE } from "./cover";

const C = RING.buffer / 2;

export const MIN_TURN = 1.4 / 360;

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
  lift: number;
}

function tracePath(x: CanvasRenderingContext2D, m: AlbumMorphology, t0: number, t1: number, lift: number) {
  const steps = Math.max(2, Math.ceil(Math.abs(t1 - t0) * 240));
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    const r = Math.max(6, (crownAt(m, t).inner - lift) * RING.unitR - 10);
    const a = pathTurn(m, t) * 6.2832;
    if (i === 0) x.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
}

interface SliceOp {
  turn: number;
  column: number;
  alpha: number;
  lift: number;
  arcPx: number;
  shells: { inner: number; outer: number }[];
}

export interface BakeStyle {
  alphaOf?: (k: number) => number;
  columnOf?: (t: number) => number;
  liftOf?: (k: number) => number;
}

export class SectorBake {
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
    density: number,
    style: BakeStyle = {},
  ) {
    const { alpha, unitR } = RING;
    const n = bounds.length - 1;
    let totalSlices = 0;
    const slicesOf = (span: number) => clamp(Math.round(span * density), 8, 96);
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
      const base = style.alphaOf
        ? style.alphaOf(k)
        : isAct
          ? alpha.playing
          : isSel
            ? alpha.selected
            : isHov
              ? alpha.hover
              : alpha.normal;
      const lift = style.liftOf ? style.liftOf(k) : isSel || isAct ? RING.lift : 0;

      const mid = crownAt(m, (t0 + t1) / 2);
      this.sectors.push({ t0, t1, inner: (mid.inner - lift) * unitR, lift });

      const SL = slicesOf(span);
      const arcPx = (2 * Math.PI * mid.inner * unitR * Math.min(1, m.closure)) / Math.max(1, totalSlices);
      for (let i = 0; i < SL; i++) {
        const t = t0 + ((t1 - t0) * i) / SL;
        this.ops.push({
          turn: pathTurn(m, t),
          column: Math.floor((style.columnOf ? style.columnOf(t) : t) * COVER_SIZE),
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

function bakeSectors(
  cover: HTMLCanvasElement,
  bounds: number[],
  m: AlbumMorphology,
  sel: number,
  hover: number,
  active: number,
): { canvas: HTMLCanvasElement; sectors: SectorGeometry[] } {
  const job = new SectorBake(cover, bounds, m, sel, hover, active, buffer(), RING.sliceDensity);
  job.run(Number.POSITIVE_INFINITY);
  return { canvas: job.canvas, sectors: job.sectors };
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
    x.rotate(pathTurn(m, t) * 6.2832);
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

export interface SectionLayer {
  score: Score;
  active: number;
}

function drawSectionLayer(
  x: CanvasRenderingContext2D,
  cover: HTMLCanvasElement,
  m: AlbumMorphology,
  sector: SectorGeometry,
  layer: SectionLayer,
) {
  const { unitR } = RING;
  const span = sector.t1 - sector.t0;
  const sections = layer.score.sections;
  const steps = Math.max(24, Math.round(span * 900));
  const arcPx = (2 * Math.PI * unitR * span) / steps;
  const colW = Math.ceil(COVER_SIZE / 280) + 2;
  x.save();
  for (let k = 0; k < sections.length; k++) {
    const sec = sections[k];
    const a = sector.t0 + span * sec.at + SECTION_LAYER.gap / 2;
    const b = sector.t0 + span * sec.end - SECTION_LAYER.gap / 2;
    if (b <= a) continue;
    const plate =
      SECTION_LAYER.plate[0] +
      (SECTION_LAYER.plate[1] - SECTION_LAYER.plate[0]) *
        Math.min(1, Math.max(0, 0.5 + sec.level * 0.9));
    const rise = SECTION_LAYER.thickness * plate * unitR;
    const lift = k === layer.active ? RING.lift * unitR : 0;
    x.globalAlpha = sectionLayerAlpha(layer, k);
    const n = Math.max(2, Math.round(((b - a) / span) * steps));
    for (let i = 0; i < n; i++) {
      const t = a + ((b - a) * i) / n;
      const u = sec.at + ((t - a) / Math.max(1e-6, b - a)) * (sec.end - sec.at);
      const local =
        sec.recall >= 0
          ? sections[sec.recall].at +
            ((u - sec.at) / Math.max(1e-6, sec.end - sec.at)) *
              (sections[sec.recall].end - sections[sec.recall].at)
          : u;
      const col = sector.t0 + span * local;
      const top = shellsAt(m, t).at(-1)!.outer * unitR + lift;
      x.save();
      x.rotate(pathTurn(m, t) * 6.2832);
      x.drawImage(
        cover,
        Math.floor(col * COVER_SIZE),
        0,
        colW,
        COVER_SIZE,
        top + 2,
        -arcPx * 1.7,
        rise,
        arcPx * 3.4,
      );
      x.restore();
    }
  }
  x.restore();
}

function sectionLayerAlpha(layer: SectionLayer, k: number): number {
  const { future, heard, active, echo } = SECTION_LAYER.alpha;
  if (k === layer.active) return active;
  if (k < layer.active) {
    const now = layer.score.sections[layer.active];
    return now && layer.score.sections[k].cluster === now.cluster ? echo : heard;
  }
  return future;
}

interface SegCacheKey {
  alb: number;
  version: number;
  sel: number;
  hover: number;
  active: number;
  shape: number;
}

export interface SegShape {
  m: AlbumMorphology;
  version: number;
  time: number;
  span?: number;
  density?: number;
}

export class RingBakery {
  private arcs: (HTMLCanvasElement | null)[];
  private arcVersion: number[];
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
  private layerKey = "";
  private doneAt = Number.NEGATIVE_INFINITY;

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
      this.arcs[i] = bakeArc(cover.canvas, arcSpanOf(this.morph(i)));
      this.arcVersion[i] = cover.version;
    }
    return this.arcs[i]!;
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
    layer: SectionLayer | null = null,
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
        this.job = new SectorBake(
          cover.canvas,
          m.bounds,
          m,
          sel,
          hover,
          active,
          target,
          shape.density ?? RING.landscapeDensity,
        );
      } else {
        const baked = bakeSectors(cover.canvas, m.bounds, m, sel, hover, active);
        this.segSlices = baked.canvas;
        this.segSectors = baked.sectors;
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

    const moved = Math.abs(progress - this.segProgress) * (shape?.span ?? 1) >= 0.0008;
    const fading = blend !== this.segBlend;
    const layerKey = layer ? `${layer.score.album}:${layer.score.track}:${layer.active}` : "";
    const relayered = layerKey !== this.layerKey;
    this.layerKey = layerKey;
    if (!stale && !swapped && !moved && !fading && !relayered && fieldVersion === this.segMarks) {
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

    if (layer && this.segSectors[active]) {
      x.save();
      x.translate(C, C);
      drawSectionLayer(x, cover.canvas, m, this.segSectors[active], layer);
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
      const end = isAct ? s.t0 + (s.t1 - s.t0) * progress : s.t1;
      if (isPathed(m)) tracePath(x, m, s.t0, end, s.lift);
      else x.arc(0, 0, Math.max(6, s.inner - 10), s.t0 * 6.2832, end * 6.2832);
      x.stroke();
    });
    x.restore();
    return this.segOut;
  }
}
