import * as THREE from "three";
import { shellsAt, type AlbumMorphology } from "../morphology";
import { RELIEF, RING } from "../tokens";
import { gapOf } from "./ring";
import { STRAIN_BINS } from "./strain";

const N = RELIEF.texels;
const ROW = N * 4;

export interface ReliefBand {
  lo: number;
  hi: number;
}

export function createReliefTexture(): THREE.DataTexture {
  const t = new THREE.DataTexture(
    new Uint16Array(ROW * 2),
    N,
    2,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
  );
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}

interface Sector {
  b0: number;
  b1: number;
  t0: number;
  t1: number;
}

function sectorsOf(m: AlbumMorphology): Sector[] {
  const out: Sector[] = [];
  for (let k = 0; k < m.bounds.length - 1; k++) {
    const b0 = m.bounds[k];
    const b1 = m.bounds[k + 1];
    const g = gapOf(m, b1 - b0);
    out.push({ b0, b1, t0: b0 + g, t1: b1 - g });
  }
  return out;
}

function edgeAt(sectors: Sector[], t: number): { edge: number; k: number } {
  let edge = Number.NEGATIVE_INFINITY;
  let k = 0;
  for (let i = 0; i < sectors.length; i++) {
    const s = sectors[i];
    for (let wrap = -1; wrap <= 1; wrap++) {
      const u = t + wrap;
      const d = Math.min(u - s.t0, s.t1 - u);
      if (d > edge) {
        edge = d;
        k = i;
      }
    }
  }
  return { edge, k };
}

export function profileOf(
  m: AlbumMorphology,
  sel: number,
  active: number,
  field: Float32Array | null,
  out: Float32Array = new Float32Array(ROW * 2),
): ReliefBand {
  const sectors = sectorsOf(m);
  let lo = Number.POSITIVE_INFINITY;
  let hi = 0;
  out.fill(0);
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    const { edge, k } = edgeAt(sectors, t);
    const lift = k === sel || k === active ? RING.lift : 0;
    const shells = shellsAt(m, t);
    const last = shells.length - 1;
    const rise = field ? field[Math.min(STRAIN_BINS - 1, Math.floor(t * STRAIN_BINS))] : 0;
    const merged: { inner: number; outer: number }[] = [];
    shells.forEach((sh, j) => {
      const inner = sh.inner - lift;
      let outer = sh.outer + lift;
      if (j === last && rise !== 0) {
        const reach = sh.outer + rise;
        outer = Math.max(inner, rise > 0 ? Math.max(outer, reach) : Math.min(outer, reach));
      }
      const prev = merged[merged.length - 1];
      if (prev && inner - prev.outer < RELIEF.merge) prev.outer = Math.max(prev.outer, outer);
      else merged.push({ inner, outer });
    });
    for (let j = 0; j < Math.min(3, merged.length); j++) {
      const { inner, outer } = merged[j];
      const at = j < 2 ? i * 4 + j * 2 : ROW + i * 4;
      out[at] = inner;
      out[at + 1] = outer;
      if (inner < lo) lo = inner;
      if (outer > hi) hi = outer;
    }
    out[ROW + i * 4 + 2] = edge;
  }
  return { lo: Number.isFinite(lo) ? lo : 0, hi };
}

export function writeProfile(texture: THREE.DataTexture, profile: Float32Array) {
  const data = texture.image.data as Uint16Array;
  for (let i = 0; i < profile.length; i++) data[i] = THREE.DataUtils.toHalfFloat(profile[i]);
  texture.needsUpdate = true;
}
