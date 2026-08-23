import { clamp, lerp } from "../math";
import { STRAIN } from "../tokens";

export const STRAIN_BINS = 512;

export interface Strain {
  album: number;
  version: number;
  site: number;
  elastic: Float32Array;
  plastic: Float32Array;
  field: Float32Array;
  shown: Float32Array;
}

export function emptyStrain(): Strain {
  return {
    album: -1,
    version: 0,
    site: -1,
    elastic: new Float32Array(STRAIN_BINS),
    plastic: new Float32Array(STRAIN_BINS),
    field: new Float32Array(STRAIN_BINS),
    shown: new Float32Array(STRAIN_BINS),
  };
}

export function clearStrain(s: Strain) {
  if (s.album < 0) return;
  s.album = -1;
  s.site = -1;
  s.elastic.fill(0);
  s.plastic.fill(0);
  s.field.fill(0);
  s.shown.fill(0);
  s.version++;
}

export function binGap(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, STRAIN_BINS - d);
}

export const complianceOf = (dynamics: number) =>
  lerp(STRAIN.compliance[0], STRAIN.compliance[1], clamp(dynamics, 0, 1));

export const amplitudeOf = (band: number) =>
  Math.min(STRAIN.ampRadius, STRAIN.ampBand * band);

export function loadOf(charge: number, compliance: number, amplitude: number): number {
  const d = STRAIN.dead;
  const raw =
    charge > d ? (charge - d) / (1 - d) : charge < -d ? (charge + d) / (1 - d) : 0;
  return raw * compliance * amplitude;
}

export function strainStep(
  s: Strain,
  album: number,
  turn: number,
  load: number,
  amplitude: number,
  dt: number,
  playing = true,
): void {
  if (album < 0) return;
  if (s.album !== album) {
    clearStrain(s);
    s.album = album;
  }

  const drive = amplitude > 0 ? Math.min(1, Math.abs(load) / amplitude) : 0;
  const spread = lerp(STRAIN.spread[0], STRAIN.spread[1], drive) * STRAIN_BINS;
  const at = ((turn % 1) + 1) % 1 * STRAIN_BINS;
  if (load === 0) s.site = -1;
  else if (s.site < 0 || binGap(at, s.site) > STRAIN.hop) s.site = at;
  const under = s.site < 0 ? at : s.site;
  const kRise = 1 - Math.exp(-dt / STRAIN.rise);
  const kRelax = 1 - Math.exp(-dt / STRAIN.relax);
  const kCreep = playing ? Math.exp(-dt / STRAIN.creep) : 1;

  for (let i = 0; i < STRAIN_BINS; i++) {
    const dist = binGap(i, under);
    const reach = dist < spread ? Math.cos(((dist / spread) * Math.PI) / 2) ** 2 : 0;
    const target = load * reach;
    const now = s.elastic[i];
    const k = Math.abs(target) > Math.abs(now) ? kRise : kRelax;
    const next = now + (target - now) * k;
    s.elastic[i] = next;
    if (kCreep < 1) s.plastic[i] *= kCreep;

    if (next > STRAIN.yield) {
      const scar = next * STRAIN.harden;
      if (scar > s.plastic[i]) s.plastic[i] = scar;
    } else if (next < -STRAIN.yield) {
      const scar = next * STRAIN.harden;
      if (scar < s.plastic[i]) s.plastic[i] = scar;
    }
    s.field[i] = next + s.plastic[i];
  }

  let drift = 0;
  for (let i = 0; i < STRAIN_BINS; i++) {
    const d = Math.abs(s.field[i] - s.shown[i]);
    if (d > drift) drift = d;
  }
  if (drift > STRAIN.redraw) {
    s.shown.set(s.field);
    s.version++;
  }
}

export function scarCount(s: Strain): number {
  let n = 0;
  let inside = false;
  for (let i = 0; i <= STRAIN_BINS; i++) {
    const on = Math.abs(s.plastic[i % STRAIN_BINS]) > STRAIN.scarFloor;
    if (on && !inside) n++;
    inside = on;
  }
  return n;
}

export function peakOf(v: Float32Array): number {
  let peak = 0;
  for (const x of v) if (Math.abs(x) > peak) peak = Math.abs(x);
  return peak;
}
