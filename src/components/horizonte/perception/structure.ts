import { pathAt, satRadiusOf, segmentAt, shellsAt, type AlbumMorphology } from "../morphology";
import { MORPH } from "../tokens";
import { blur, ncc } from "./silhouette";

const TAU = 6.283185307179586;

const INK = { crown: 0.82, satelliteRim: 0.62, dark: -0.45 } as const;

export const FRAME = {
  grid: 96,
  half: 2.6,
  rotations: 24,
  glanceR: 24 / (252 * 0.77),
} as const;

export interface FrameOptions {
  rotation?: number;
  grid?: number;
  field?: Float32Array | null;
}

export function bodyFrame(m: AlbumMorphology, opts: FrameOptions = {}): Float32Array {
  const g = opts.grid ?? FRAME.grid;
  const rot = opts.rotation ?? 0;
  const field = opts.field ?? null;
  const half = FRAME.half;
  const out = new Float32Array(g * g);
  const sats = m.satellites
    .filter((s) => s.weight > 0.02)
    .map((s) => ({
      x: Math.cos(s.angle + rot) * s.dist,
      y: Math.sin(s.angle + rot) * s.dist * m.flatten,
      r: satRadiusOf(m, s),
      w: s.weight,
    }));

  for (let py = 0; py < g; py++) {
    for (let px = 0; px < g; px++) {
      let acc = 0;
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const x = -half + ((px + (sx + 0.5) / 2) / g) * 2 * half;
          const y = -half + ((py + (sy + 0.5) / 2) / g) * 2 * half;
          acc += inkAt(x, y);
        }
      }
      out[py * g + px] = acc / 4;
    }
  }
  return out;

  function inkAt(x: number, y: number): number {
    const dy = y / m.flatten;
    const rr = Math.hypot(x, dy);
    let ink = 0;
    if (rr > m.rMin * 0.9 && rr < m.rMax * 1.6) {
      let a = Math.atan2(dy, x) - rot;
      a = ((a % TAU) + TAU) % TAU;
      const t = pathAt(m, a / TAU);
      if (t >= 0) {
        const k = segmentAt(m.bounds, t);
        const gap = Math.min(m.fragment, (m.bounds[k + 1] - m.bounds[k]) * 0.42) / 2;
        if (t > m.bounds[k] + gap && t < m.bounds[k + 1] - gap) {
          const sh = shellsAt(m, t);
          const top = sh.length - 1;
          const rise = field ? field[Math.floor(t * field.length) % field.length] : 0;
          for (let i = 0; i < sh.length; i++) {
            const outer = i === top ? sh[i].outer + rise : sh[i].outer;
            if (rr >= sh[i].inner && rr <= outer) {
              ink = INK.crown;
              break;
            }
          }
          if (rise > 0 && rr > sh[top].outer && rr <= sh[top].outer + rise) ink = INK.crown;
        }
      }
    }
    if (rr < m.coreRatio) return INK.dark;
    for (const s of sats) {
      const ddx = x - s.x;
      const ddy = (y - s.y) / m.flatten;
      const d = Math.hypot(ddx, ddy);
      if (d < s.r) return INK.dark;
      if (d < s.r * (1 + MORPH.satRim)) {
        const sa = Math.atan2(ddy, ddx);
        if (sa > MORPH.satArcSpan[0] - Math.PI && sa < MORPH.satArcSpan[1] - Math.PI) {
          ink = Math.max(ink, INK.satelliteRim * s.w);
        }
      }
    }
    return ink;
  }
}

const sigmaOf = (grid: number, sigmaR: number) => sigmaR / ((2 * FRAME.half) / grid);

export interface Glance {
  turns: Float32Array[];
  grid: number;
}

export function glanceOf(m: AlbumMorphology, opts: { rotate?: boolean; grid?: number; field?: Float32Array | null; sigmaR?: number } = {}): Glance {
  const grid = opts.grid ?? FRAME.grid;
  const sigma = sigmaOf(grid, opts.sigmaR ?? FRAME.glanceR);
  const n = opts.rotate === false ? 1 : FRAME.rotations;
  const turns: Float32Array[] = [];
  for (let k = 0; k < n; k++) {
    turns.push(blur(bodyFrame(m, { rotation: (k / FRAME.rotations) * TAU, grid, field: opts.field }), grid, grid, sigma));
  }
  return { turns, grid };
}

export function shapeSimilarity(a: Glance, b: Glance): number {
  let best = -1;
  for (const t of b.turns) best = Math.max(best, ncc(a.turns[0], t));
  return best;
}

export interface Topology {
  components: number;
  coverage: number;
  aspect: number;
  massVoid: number;
  dominance: number;
}

export function topologyOf(m: AlbumMorphology, opts: { grid?: number; field?: Float32Array | null } = {}): Topology {
  const g = opts.grid ?? FRAME.grid;
  const raw = bodyFrame(m, { grid: g, field: opts.field });
  const lit = new Uint8Array(g * g);
  let dark = 0;
  let litArea = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] > 0.4) {
      lit[i] = 1;
      litArea++;
    } else if (raw[i] < -0.2) dark++;
  }

  const label = new Int32Array(g * g).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < lit.length; i++) {
    if (!lit[i] || label[i] >= 0) continue;
    const id = sizes.length;
    let size = 0;
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const j = stack.pop()!;
      size++;
      const x = j % g;
      const y = (j - x) / g;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= g || ny >= g) continue;
        const q = ny * g + nx;
        if (lit[q] && label[q] < 0) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    sizes.push(size);
  }
  const minor = Math.max(4, litArea * 0.02);
  const components = sizes.filter((s) => s >= minor).length;
  const dominance = litArea ? Math.max(0, ...sizes) / litArea : 0;

  const bins = new Uint8Array(72);
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < lit.length; i++) {
    if (!lit[i]) continue;
    const x = ((i % g) + 0.5) / g - 0.5;
    const y = (Math.floor(i / g) + 0.5) / g - 0.5;
    const a = Math.atan2(y, x);
    bins[Math.floor((((a % TAU) + TAU) % TAU) / TAU * 72) % 72] = 1;
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  let coverage = 0;
  for (const b of bins) coverage += b;
  coverage /= 72;

  let aspect = 1;
  if (litArea > 2) {
    const mx = sx / litArea;
    const my = sy / litArea;
    const cxx = sxx / litArea - mx * mx;
    const cyy = syy / litArea - my * my;
    const cxy = sxy / litArea - mx * my;
    const tr = cxx + cyy;
    const det = cxx * cyy - cxy * cxy;
    const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const l1 = tr / 2 + disc;
    const l2 = tr / 2 - disc;
    aspect = l1 > 0 ? Math.sqrt(Math.max(0, l2) / l1) : 1;
  }

  return { components, coverage, aspect, massVoid: litArea ? dark / litArea : 0, dominance };
}

export function topologyDistance(a: Topology, b: Topology): number {
  const comp = Math.abs(Math.log2(Math.max(1, a.components)) - Math.log2(Math.max(1, b.components))) / 3;
  const parts = [
    Math.min(1, comp),
    Math.abs(a.coverage - b.coverage),
    Math.abs(a.aspect - b.aspect),
    Math.min(1, Math.abs(a.massVoid - b.massVoid)),
    Math.abs(a.dominance - b.dominance),
  ];
  return Math.sqrt(parts.reduce((s, v) => s + v * v, 0) / parts.length);
}
