import {
  binaryGeometry,
  curveAt,
  extentAt,
  type BinaryGeometry,
  type BinaryShape,
} from "../binary";
import { clamp } from "../math";
import {
  crownAt,
  satRadiusOf,
  shellsAt,
  type AlbumMorphology,
  type Satellite,
} from "../morphology";
import { BINARY, RING } from "../tokens";
import { COVER_SIZE } from "./cover";

const BW = BINARY.buffer[0];
const BH = BINARY.buffer[1];
const CX = BW / 2;
const CY = BH / 2;

function canvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = BW;
  c.height = BH;
  return c;
}

export const ribbonCenter = (m: AlbumMorphology) => (m.rMin + 1) / 2;

interface Slice {
  k: number;
  x: number;
  y: number;
  angle: number;
  column: number;
  alpha: number;
  lift: number;
  width: number;
  shells: { inner: number; outer: number }[];
}

interface Sector {
  t0: number;
  t1: number;
  lift: number;
}

export interface RibbonKey {
  alb: number;
  version: number;
  sel: number;
  hover: number;
  active: number;
  split: number;
  lead: number;
  offset: number;
}

const sameKey = (a: RibbonKey | null, b: RibbonKey) =>
  !!a &&
  a.alb === b.alb &&
  a.version === b.version &&
  a.sel === b.sel &&
  a.hover === b.hover &&
  a.active === b.active &&
  a.split === b.split &&
  a.lead === b.lead &&
  a.offset === b.offset;

export function quantize(shape: BinaryShape, offset: number) {
  const q = BINARY.bake;
  return {
    split: Math.round(shape.split / q.split) * q.split,
    lead: Math.round(shape.lead / q.lead) * q.lead,
    offset: Math.round((((offset % 1) + 1) % 1) / q.offset) * q.offset,
  };
}

class RibbonBake {
  readonly sectors: Sector[] = [];
  readonly geometry: BinaryGeometry;
  private ops: Slice[] = [];
  private cursor = 0;
  private colW: number;

  constructor(
    private cover: HTMLCanvasElement,
    readonly key: RibbonKey,
    readonly m: AlbumMorphology,
    readonly canvas: HTMLCanvasElement,
  ) {
    const { unitR, alpha } = RING;
    const r0 = ribbonCenter(m);
    this.geometry = binaryGeometry({ split: key.split, lead: key.lead }, r0);
    const g = this.geometry;
    const stretch = g.length / (2 * Math.PI * r0);
    const bounds = m.bounds;
    const n = bounds.length - 1;
    const slicesOf = (span: number) =>
      clamp(Math.round(span * RING.sliceDensity * stretch), 8, Math.round(96 * stretch));
    let total = 0;
    for (let k = 0; k < n; k++) total += slicesOf(bounds[k + 1] - bounds[k]);
    this.colW = Math.ceil(COVER_SIZE / Math.max(1, total)) + 2;

    for (let k = 0; k < n; k++) {
      const b0 = bounds[k];
      const b1 = bounds[k + 1];
      const span = b1 - b0;
      const gap =
        (Math.min(m.fragment, Math.max(0, span - 1.4 / 360), span * 0.42) / 2) *
        (1 - BINARY.fragment * key.split);
      const t0 = b0 + gap;
      const t1 = b1 - gap;
      const isAct = k === key.active;
      const isSel = k === key.sel;
      const isHov = k === key.hover;
      const base = isAct
        ? alpha.playing
        : isSel
          ? alpha.selected
          : isHov
            ? alpha.hover
            : alpha.normal;
      const lift = isSel || isAct ? RING.lift : 0;
      this.sectors.push({ t0, t1, lift });
      const SL = slicesOf(span);
      const step = (t1 - t0) / SL;
      for (let i = 0; i < SL; i++) {
        const ta = t0 + step * i;
        const a = curveAt(g, ta + key.offset);
        const b = curveAt(g, ta + step + key.offset);
        const gap = Math.hypot(b.x - a.x, b.y - a.y) * unitR;
        const n = Math.max(1, Math.ceil(gap / BINARY.slicePx));
        for (let j = 0; j < n; j++) {
          const t = ta + (step * j) / n;
          const p = j === 0 ? a : curveAt(g, t + key.offset);
          this.ops.push({
            k: p.k,
            x: p.x,
            y: p.y,
            angle: Math.atan2(p.ny, p.nx),
            column: Math.floor(t * COVER_SIZE),
            alpha: base,
            lift,
            width: Math.max(1, gap / n),
            shells: shellsAt(m, t),
          });
        }
      }
    }
    this.canvas.getContext("2d")!.clearRect(0, 0, BW, BH);
  }

  run(budgetMs: number): boolean {
    const x = this.canvas.getContext("2d")!;
    const { unitR } = RING;
    const r0 = this.geometry.r0;
    const started = budgetMs === Number.POSITIVE_INFINITY ? 0 : performance.now();
    while (this.cursor < this.ops.length) {
      const op = this.ops[this.cursor++];
      x.setTransform(1, 0, 0, 1, CX + op.x * unitR, CY + op.y * unitR);
      x.rotate(op.angle);
      x.globalAlpha = op.alpha;
      for (const sh of op.shells) {
        const inner = (sh.inner - op.lift - r0) * unitR * op.k;
        const outer = (sh.outer + op.lift - r0) * unitR * op.k;
        x.drawImage(
          this.cover,
          op.column,
          0,
          this.colW,
          COVER_SIZE,
          inner,
          -op.width * 1.7,
          Math.max(0.5, outer - inner),
          op.width * 3.4,
        );
      }
      if ((this.cursor & 15) === 0 && started && performance.now() - started > budgetMs) break;
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalAlpha = 1;
    return this.cursor >= this.ops.length;
  }
}

export class RibbonBakery {
  private job: RibbonBake | null = null;
  private current: RibbonBake | null = null;
  private previous: HTMLCanvasElement | null = null;
  private spare: HTMLCanvasElement[] = [];
  private wanted: RibbonKey | null = null;
  private out = canvas();
  private doneAt = Number.NEGATIVE_INFINITY;
  private composed = "";

  get geometry(): BinaryGeometry | null {
    return this.current ? this.current.geometry : null;
  }

  reset() {
    this.job = null;
    this.current = null;
    this.previous = null;
    this.wanted = null;
    this.composed = "";
  }

  draw(
    cover: HTMLCanvasElement,
    key: RibbonKey,
    m: AlbumMorphology,
    progress: number,
    ink: string,
    time: number,
  ): HTMLCanvasElement {
    this.wanted = key;
    const fresh =
      !this.current || this.current.key.alb !== key.alb || this.current.key.version !== key.version;
    if (!this.job && !sameKey(this.current ? this.current.key : null, key)) {
      const target = this.spare.pop() ?? canvas();
      this.job = new RibbonBake(cover, key, m, target);
    }
    let swapped = false;
    if (this.job) {
      if (this.job.run(fresh ? Number.POSITIVE_INFINITY : BINARY.bake.budget)) {
        if (this.previous) this.spare.push(this.previous);
        this.previous = fresh || !this.current ? null : this.current.canvas;
        this.current = this.job;
        this.job = null;
        this.doneAt = time;
        swapped = true;
      }
    }
    const blend = this.previous ? clamp((time - this.doneAt) / BINARY.bake.dissolve, 0, 1) : 1;
    if (blend >= 1 && this.previous) {
      this.spare.push(this.previous);
      this.previous = null;
    }
    const stamp = `${progress.toFixed(4)}:${blend.toFixed(3)}:${ink}`;
    if (!swapped && stamp === this.composed) return this.out;
    this.composed = stamp;

    const cur = this.current!;
    const x = this.out.getContext("2d")!;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, BW, BH);
    if (this.previous && blend < 1) {
      x.globalAlpha = 1 - blend;
      x.drawImage(this.previous, 0, 0);
      x.globalAlpha = blend;
      x.drawImage(cur.canvas, 0, 0);
      x.globalAlpha = 1;
    } else {
      x.drawImage(cur.canvas, 0, 0);
    }
    strokeSectors(x, cur, progress, ink);
    return this.out;
  }
}

function strokeSectors(
  x: CanvasRenderingContext2D,
  bake: RibbonBake,
  progress: number,
  ink: string,
) {
  const { unitR } = RING;
  const g = bake.geometry;
  const k = bake.key;
  x.save();
  x.strokeStyle = ink;
  bake.sectors.forEach((s, i) => {
    const isAct = i === k.active;
    const isSel = i === k.sel;
    x.globalAlpha = isAct ? 0.9 : isSel ? 0.55 : 0.18;
    x.lineWidth = isAct ? 4 : 2;
    const end = isAct ? s.t0 + (s.t1 - s.t0) * progress : s.t1;
    const steps = Math.max(2, Math.ceil((end - s.t0) * 480));
    x.beginPath();
    for (let j = 0; j <= steps; j++) {
      const t = s.t0 + ((end - s.t0) * j) / steps;
      const p = curveAt(g, t + k.offset);
      const off = ((crownAt(bake.m, t).inner - s.lift - g.r0) * unitR - 10) * p.k;
      const px = CX + p.x * unitR + p.nx * off;
      const py = CY + p.y * unitR + p.ny * off;
      if (j === 0) x.moveTo(px, py);
      else x.lineTo(px, py);
    }
    x.stroke();
  });
  x.restore();
}

export interface RibbonView {
  canvas: HTMLCanvasElement;
  geometry: BinaryGeometry;
  cx: number;
  cy: number;
  R: number;
  tilt: number;
  offset: number;
  alpha: number;
}

export function drawRibbon(
  x: CanvasRenderingContext2D,
  view: RibbonView,
  flatten: number,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  const sc = view.R / RING.unitR;
  x.save();
  x.globalCompositeOperation = "lighter";
  x.globalAlpha = alpha;
  x.translate(view.cx, view.cy);
  x.scale(1, flatten);
  x.rotate(view.tilt);
  x.drawImage(view.canvas, -CX * sc, -CY * sc, BW * sc, BH * sc);
  x.restore();
}

export function toScreen(
  view: Pick<RibbonView, "cx" | "cy" | "R" | "tilt">,
  flatten: number,
  ux: number,
  uy: number,
) {
  const c = Math.cos(view.tilt);
  const s = Math.sin(view.tilt);
  return {
    x: view.cx + (c * ux - s * uy) * view.R,
    y: view.cy + (s * ux + c * uy) * view.R * flatten,
  };
}

export function satelliteDistance(
  g: BinaryGeometry,
  tilt: number,
  alpha: number,
  m: AlbumMorphology,
  sat: Satellite,
  scale = 1,
): number {
  const clear =
    (extentAt(g, sat.angle - tilt) + (m.rMax - g.r0)) * scale + satRadiusOf(m, sat) + 0.08;
  return sat.dist + (Math.max(sat.dist, clear) - sat.dist) * alpha;
}

export function fitOf(
  g: BinaryGeometry,
  tilt: number,
  flatten: number,
  R: number,
  cx: number,
  cy: number,
  W: number,
  H: number,
  band: number,
): number {
  const [x0, x1, y0, y1] = BINARY.safe;
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  let lo = 0;
  let hi = 0;
  let top = 0;
  let bottom = 0;
  const n = g.table.length / 5;
  for (let i = 0; i < n; i += 6) {
    const x = g.table[i * 5] + g.table[i * 5 + 2] * band;
    const y = g.table[i * 5 + 1] + g.table[i * 5 + 3] * band;
    const dx = (c * x - s * y) * R;
    const dy = (s * x + c * y) * R * flatten;
    lo = Math.min(lo, dx);
    hi = Math.max(hi, dx);
    top = Math.min(top, dy);
    bottom = Math.max(bottom, dy);
  }
  let f = Number.POSITIVE_INFINITY;
  if (hi > 0) f = Math.min(f, (x1 * W - cx) / hi);
  if (lo < 0) f = Math.min(f, (cx - x0 * W) / -lo);
  if (bottom > 0) f = Math.min(f, (y1 * H - cy) / bottom);
  if (top < 0) f = Math.min(f, (cy - y0 * H) / -top);
  return Math.max(0.01, f);
}
