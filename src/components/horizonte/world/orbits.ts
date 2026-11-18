import { profileOf } from "../composition/relief";
import { clamp } from "../math";
import { satRadiusOf, type AlbumMorphology } from "../morphology";
import { RELIEF, RING } from "../tokens";

export const ORBIT = { margin: 0.04, lean: [0.08, 0.3] } as const;

const scratch = new Float32Array(RELIEF.texels * 8);
const rests = new WeakMap<AlbumMorphology, number>();

export const postureOf = (m: AlbumMorphology) => Math.acos(clamp(m.flatten, 0.2, 0.98));

export function crownRestOf(m: AlbumMorphology): number {
  const known = rests.get(m);
  if (known !== undefined) return known;
  const reach = profileOf(m, -1, -1, null, scratch).hi + RING.lift;
  rests.set(m, reach);
  return reach;
}

export function orbitLeanOf(m: AlbumMorphology): number {
  const first = m.satellites.find((sat) => sat.weight > 0.02);
  if (!first) return ORBIT.lean[0];
  const clear = crownRestOf(m) + satRadiusOf(m, first) + ORBIT.margin;
  const lean = Math.atan(Math.max(0, 1 - first.dist / clear) / Math.tan(postureOf(m)));
  return clamp(lean, ORBIT.lean[0], ORBIT.lean[1]);
}

export function orbitsOf(m: AlbumMorphology, reach: number, lean: number): number[] {
  const seen = Math.cos(lean);
  let floor = 0;
  let shift = 0;
  return m.satellites.map((sat) => {
    if (sat.weight <= 0.02) return sat.dist + shift;
    const r = satRadiusOf(m, sat);
    const dist = Math.max(sat.dist + shift, (reach + r + ORBIT.margin) / seen, floor + r + ORBIT.margin);
    shift = dist - sat.dist;
    floor = dist + r;
    return dist;
  });
}
