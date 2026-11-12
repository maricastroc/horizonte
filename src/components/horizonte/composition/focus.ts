import type { AnatomyPart } from "../anatomy";
import { pathTurn, satRadiusOf, shellsAt, type AlbumMorphology } from "../morphology";
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
    const a = pathTurn(m, t) * TAU + rot;
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

function crown(x: CanvasRenderingContext2D, f: BodyFrame): boolean {
  if (!f.m) return false;
  x.beginPath();
  const any = traceCrown(x, f.m, f.bx, f.by, f.R, f.flatten, f.rot);
  x.fillStyle = KEEP;
  if (any) x.fill();
  return any;
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
