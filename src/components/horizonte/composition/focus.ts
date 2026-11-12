import type { AnatomyPart } from "../anatomy";
import { satRadiusOf, shellsAt, type AlbumMorphology } from "../morphology";
import { ANATOMY } from "../tokens";
import { ls, type Ctx } from "./ctx";
import { gapOf } from "./ring";

export interface FocusSatellite {
  x: number;
  y: number;
  r: number;
  ry: number;
  w: number;
}

export interface BodyFrame {
  bx: number;
  by: number;
  R: number;
  flatten: number;
  rot: number;
  m: AlbumMorphology | null;
  satellites: FocusSatellite[];
  name: { text: string; font: string; x: number; y: number } | null;
}

export interface CoreShape {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export const emptyFrame = (): BodyFrame => ({
  bx: 0,
  by: 0,
  R: 0,
  flatten: 1,
  rot: 0,
  m: null,
  satellites: [],
  name: null,
});

export function resetFrame(f: BodyFrame) {
  f.m = null;
  f.satellites.length = 0;
  f.name = null;
}

const KEEP = "rgb(255,0,0)";
const SAT_MIN = 0.05;

function halo(
  x: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  spread: number,
) {
  const reach = rx * spread;
  x.save();
  x.translate(cx, cy);
  x.scale(1, ry / Math.max(rx, 1e-3));
  const g = x.createRadialGradient(0, 0, rx * 0.85, 0, 0, reach);
  g.addColorStop(0, "rgba(0,255,0,1)");
  g.addColorStop(0.45, "rgba(0,255,0,0.42)");
  g.addColorStop(1, "rgba(0,255,0,0)");
  x.fillStyle = g;
  x.fillRect(-reach, -reach, reach * 2, reach * 2);
  x.restore();
}

function ellipse(x: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  x.beginPath();
  x.ellipse(cx, cy, rx, ry, 0, 0, 6.2832);
  x.fillStyle = KEEP;
  x.fill();
}

const TAU = 6.283185307179586;

export function traceCrown(
  x: CanvasRenderingContext2D,
  m: AlbumMorphology,
  cx: number,
  cy: number,
  R: number,
  flatten: number,
  rot: number,
): boolean {
  const n = m.bounds.length - 1;
  if (n <= 0 || R <= 0) return false;
  const at = (t: number, r: number): [number, number] => {
    const a = t * TAU + rot;
    return [cx + Math.cos(a) * r * R, cy + Math.sin(a) * r * R * flatten];
  };
  for (let k = 0; k < n; k++) {
    const b0 = m.bounds[k];
    const b1 = m.bounds[k + 1];
    const g = gapOf(m, b1 - b0);
    const t0 = b0 + g;
    const t1 = b1 - g;
    if (t1 <= t0) continue;
    const steps = Math.max(2, Math.ceil((t1 - t0) * 160));
    const inner: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = t0 + ((t1 - t0) * i) / steps;
      const shells = shellsAt(m, t);
      const [ox, oy] = at(t, shells[shells.length - 1].outer);
      if (i === 0) x.moveTo(ox, oy);
      else x.lineTo(ox, oy);
      inner.push(t, shells[0].inner);
    }
    for (let i = inner.length - 2; i >= 0; i -= 2) {
      const [ix, iy] = at(inner[i], inner[i + 1]);
      x.lineTo(ix, iy);
    }
    x.closePath();
  }
  return true;
}

function crown(x: CanvasRenderingContext2D, f: BodyFrame, alpha = 1): boolean {
  if (!f.m) return false;
  x.beginPath();
  const any = traceCrown(x, f.m, f.bx, f.by, f.R, f.flatten, f.rot);
  x.globalAlpha = alpha;
  x.fillStyle = KEEP;
  if (any) x.fill();
  x.globalAlpha = 1;
  return any;
}

const LIGHT = "rgb(0,255,0)";

interface Span {
  t0: number;
  t1: number;
}

function spansOf(m: AlbumMorphology): Span[] {
  const out: Span[] = [];
  for (let k = 0; k < m.bounds.length - 1; k++) {
    const b0 = m.bounds[k];
    const b1 = m.bounds[k + 1];
    const g = gapOf(m, b1 - b0);
    if (b1 - g > b0 + g) out.push({ t0: b0 + g, t1: b1 - g });
  }
  return out;
}

function pointAt(f: BodyFrame, t: number, r: number): [number, number] {
  const a = t * TAU + f.rot;
  return [f.bx + Math.cos(a) * r * f.R, f.by + Math.sin(a) * r * f.R * f.flatten];
}

function band(
  x: CanvasRenderingContext2D,
  f: BodyFrame,
  t0: number,
  t1: number,
  outer: (t: number) => number,
  inner: (t: number) => number,
) {
  const steps = Math.max(2, Math.ceil((t1 - t0) * 160));
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    const [px, py] = pointAt(f, t, outer(t));
    if (i === 0) x.moveTo(px, py);
    else x.lineTo(px, py);
  }
  for (let i = steps; i >= 0; i--) {
    const t = t0 + ((t1 - t0) * i) / steps;
    const [px, py] = pointAt(f, t, inner(t));
    x.lineTo(px, py);
  }
  x.closePath();
}

const topOf = (m: AlbumMorphology, t: number) => {
  const sh = shellsAt(m, t);
  return sh[sh.length - 1].outer;
};

function openings(x: CanvasRenderingContext2D, f: BodyFrame, px: number): boolean {
  const m = f.m!;
  const n = m.bounds.length - 1;
  if (n < 2) return false;
  const P = ANATOMY.focus.part;
  const spanOf = (k: number) => m.bounds[k + 1] - m.bounds[k];
  const minT = (P.line * px) / (TAU * f.R * Math.max(m.rMax, 1e-3));
  x.fillStyle = LIGHT;
  for (let k = 0; k < n; k++) {
    const b = m.bounds[k];
    const before = gapOf(m, spanOf((k + n - 1) % n));
    const after = gapOf(m, spanOf(k));
    const half = Math.max(minT / 2, (before + after) / 2);
    const slit = Math.min(half, minT * P.slit);
    const mid = b + (after - before) / 2;
    for (const [w, a] of [[half, P.glow * P.slit / 4], [slit + minT / 2, P.glow], [slit, 1]] as const) {
      x.globalAlpha = a;
      x.beginPath();
      band(x, f, mid - w, mid + w, (t) => topOf(m, t) * 1.04, (t) => shellsAt(m, t)[0].inner * 0.96);
      x.fill();
    }
  }
  x.globalAlpha = 1;
  return true;
}

function interlayers(x: CanvasRenderingContext2D, f: BodyFrame, px: number): boolean {
  const m = f.m!;
  const spans = spansOf(m);
  if (!spans.length || shellsAt(m, spans[0].t0).length < 2) return false;
  const half = (ANATOMY.focus.part.line * px) / (2 * f.R);
  x.fillStyle = LIGHT;
  for (const { t0, t1 } of spans) {
    const steps = Math.max(2, Math.ceil((t1 - t0) * 160));
    const ts = Array.from({ length: steps + 1 }, (_, i) => t0 + ((t1 - t0) * i) / steps);
    const shells = ts.map((t) => shellsAt(m, t));
    for (let i = 0; i < shells[0].length - 1; i++) {
      const edge = (j: number, side: 1 | -1) => {
        const lo = shells[j][i].outer;
        const hi = shells[j][i + 1].inner;
        return (lo + hi) / 2 + side * Math.max(half, (hi - lo) / 2);
      };
      x.beginPath();
      ts.forEach((t, j) => {
        const [px2, py2] = pointAt(f, t, edge(j, 1));
        if (j === 0) x.moveTo(px2, py2);
        else x.lineTo(px2, py2);
      });
      for (let j = steps; j >= 0; j--) {
        const [px2, py2] = pointAt(f, ts[j], edge(j, -1));
        x.lineTo(px2, py2);
      }
      x.closePath();
      x.fill();
    }
  }
  return true;
}

function outline(x: CanvasRenderingContext2D, f: BodyFrame, px: number): boolean {
  const m = f.m!;
  const spans = spansOf(m);
  if (!spans.length) return false;
  const P = ANATOMY.focus.part;
  const trace = () => {
    x.beginPath();
    for (const { t0, t1 } of spans) {
      const steps = Math.max(2, Math.ceil((t1 - t0) * 160));
      for (let i = 0; i <= steps; i++) {
        const t = t0 + ((t1 - t0) * i) / steps;
        const [ox, oy] = pointAt(f, t, topOf(m, t));
        if (i === 0) x.moveTo(ox, oy);
        else x.lineTo(ox, oy);
      }
    }
  };
  x.lineJoin = "round";
  x.lineCap = "round";
  x.strokeStyle = LIGHT;
  x.globalAlpha = P.glow;
  x.lineWidth = P.edge * 4 * px;
  trace();
  x.stroke();
  x.globalAlpha = 1;
  x.strokeStyle = KEEP;
  x.lineWidth = P.edge * px;
  trace();
  x.stroke();
  return true;
}

export function drawGhost(
  x: CanvasRenderingContext2D,
  m: AlbumMorphology,
  cx: number,
  cy: number,
  R: number,
  rot: number,
  color: string,
  width: number,
) {
  x.save();
  x.globalAlpha = 1;
  x.globalCompositeOperation = "source-over";
  x.strokeStyle = color;
  x.lineWidth = width;
  x.lineJoin = "round";
  x.beginPath();
  traceCrown(x, m, cx, cy, R, m.flatten, rot);
  x.stroke();
  for (const sat of m.satellites) {
    if (sat.weight <= 0.02) continue;
    const r = satRadiusOf(m, sat) * R;
    x.beginPath();
    x.ellipse(
      cx + Math.cos(sat.angle) * sat.dist * R,
      cy + Math.sin(sat.angle) * sat.dist * R * m.flatten,
      r,
      r * m.flatten,
      0,
      0,
      TAU,
    );
    x.stroke();
  }
  x.restore();
}

export function traceOutline(
  x: CanvasRenderingContext2D,
  m: AlbumMorphology,
  cx: number,
  cy: number,
  R: number,
  flatten: number,
  rot: number,
) {
  const steps = 360;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * TAU + rot;
    const r = topOf(m, t) * R;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r * flatten;
    if (i === 0) x.moveTo(px, py);
    else x.lineTo(px, py);
  }
  x.closePath();
}

export function drawFacing(
  x: CanvasRenderingContext2D,
  m: AlbumMorphology,
  cx: number,
  cy: number,
  R: number,
  rot: number,
  color: string,
  width: number,
) {
  x.save();
  x.globalAlpha = 1;
  x.globalCompositeOperation = "source-over";
  x.strokeStyle = color;
  x.lineWidth = width;
  x.lineJoin = "round";
  x.setLineDash(ANATOMY.facing.dash.map((d) => d * width));
  x.beginPath();
  traceOutline(x, m, cx, cy, R, 1, rot);
  x.stroke();
  x.restore();
}

export function drawFocus(
  mask: CanvasRenderingContext2D,
  W: number,
  f: BodyFrame,
  part: AnatomyPart,
  core: CoreShape,
): boolean {
  const ratio = mask.canvas?.width / Math.max(1, W);
  const sc = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const px = 1 / sc;
  const m = ANATOMY.focus.margin;
  mask.setTransform(1, 0, 0, 1, 0, 0);
  mask.globalCompositeOperation = "source-over";
  mask.globalAlpha = 1;
  mask.fillStyle = "#000";
  mask.fillRect(0, 0, mask.canvas.width, mask.canvas.height);
  mask.setTransform(sc, 0, 0, sc, 0, 0);
  mask.globalCompositeOperation = "lighter";

  let any = false;
  if (part === "satellites") {
    for (const s of f.satellites) {
      if (s.w < SAT_MIN) continue;
      mask.globalAlpha = Math.min(1, s.w * 1.4);
      halo(mask, s.x, s.y, s.r * m, s.ry * m, ANATOMY.focus.halo.satellite);
      ellipse(mask, s.x, s.y, s.r * m, s.ry * m);
      any = true;
    }
    mask.globalAlpha = 1;
  } else if (part === "core") {
    halo(mask, core.x, core.y, core.rx * m, core.ry * m, ANATOMY.focus.halo.core);
    ellipse(mask, core.x, core.y, core.rx * m, core.ry * m);
    any = core.rx > 0;
  } else if (part === "gaps" || part === "strata" || part === "contour") {
    const draw = part === "gaps" ? openings : part === "strata" ? interlayers : outline;
    const half = crown(mask, f, ANATOMY.focus.part.crown);
    const own = half && draw(mask, f, px);
    if (half && !own) crown(mask, f);
    any = half;
  } else if (part === "posture") {
    const ring = crown(mask, f);
    ellipse(mask, core.x, core.y, core.rx * m, core.ry * m);
    if (ring) {
      mask.strokeStyle = KEEP;
      mask.lineWidth = ANATOMY.focus.part.line * 2 * px;
      mask.lineJoin = "round";
      mask.beginPath();
      traceOutline(mask, f.m!, f.bx, f.by, f.R, 1, f.rot);
      mask.stroke();
    }
    any = ring || core.rx > 0;
  } else if (part === "name" && f.name) {
    mask.font = f.name.font;
    mask.textBaseline = "alphabetic";
    ls(mask as Ctx, "-0.035em");
    mask.fillStyle = KEEP;
    mask.fillText(f.name.text, f.name.x, f.name.y);
    any = true;
  }

  mask.globalCompositeOperation = "source-over";
  mask.setTransform(1, 0, 0, 1, 0, 0);
  return any;
}
