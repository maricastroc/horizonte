import type { AnatomyPart } from "../anatomy";
import { pathTurn, shellsAt, type AlbumMorphology } from "../morphology";
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

function crown(x: CanvasRenderingContext2D, f: BodyFrame): boolean {
  const m = f.m;
  if (!m || f.R <= 0) return false;
  const n = m.bounds.length - 1;
  const at = (t: number, r: number): [number, number] => {
    const a = pathTurn(m, t) * TAU + f.rot;
    return [f.bx + Math.cos(a) * r * f.R, f.by + Math.sin(a) * r * f.R * f.flatten];
  };
  x.fillStyle = KEEP;
  for (let k = 0; k < n; k++) {
    const b0 = m.bounds[k];
    const b1 = m.bounds[k + 1];
    const g = gapOf(m, b1 - b0);
    const t0 = b0 + g;
    const t1 = b1 - g;
    if (t1 <= t0) continue;
    const steps = Math.max(2, Math.ceil((t1 - t0) * 160));
    const inner: number[] = [];
    x.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = t0 + ((t1 - t0) * i) / steps;
      const shells = shellsAt(m, t);
      const lo = shells[0].inner;
      const hi = shells[shells.length - 1].outer;
      const [ox, oy] = at(t, hi);
      if (i === 0) x.moveTo(ox, oy);
      else x.lineTo(ox, oy);
      inner.push(t, lo);
    }
    for (let i = inner.length - 2; i >= 0; i -= 2) {
      const [ix, iy] = at(inner[i], inner[i + 1]);
      x.lineTo(ix, iy);
    }
    x.closePath();
    x.fill();
  }
  return n > 0;
}

export function drawFocus(
  mask: CanvasRenderingContext2D,
  W: number,
  f: BodyFrame,
  part: AnatomyPart,
  core: CoreShape,
): boolean {
  const sc = mask.canvas.width / Math.max(1, W);
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
    any = crown(mask, f);
  } else if (part === "posture") {
    const ring = crown(mask, f);
    ellipse(mask, core.x, core.y, core.rx * m, core.ry * m);
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
