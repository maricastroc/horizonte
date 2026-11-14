import * as THREE from "three";
import { profileOf, writeProfile } from "@/components/horizonte/composition/relief";
import type { AlbumWithSignature } from "@/components/horizonte/content";
import {
  lobeAt,
  morphologyOf,
  satRadiusOf,
  type AlbumMorphology,
} from "@/components/horizonte/morphology";
import { RELIEF } from "@/components/horizonte/tokens";

const N = RELIEF.texels;

export interface Shape {
  morphology: AlbumMorphology;
  lo: number;
  hi: number;
  core: number;
  coreAt: [number, number, number];
  satellites: [number, number, number, number][];
}

export function createWarpTexture(): THREE.DataTexture {
  const t = new THREE.DataTexture(
    new Uint16Array(N * 4),
    N,
    1,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
  );
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

const profile = new Float32Array(N * 8);

export function bakeShape(
  album: AlbumWithSignature,
  selected: number,
  playing: number,
  shape: THREE.DataTexture,
  warp: THREE.DataTexture,
): Shape {
  const m = morphologyOf(album.signature, album.tracks.length);
  const band = profileOf(m, selected, playing, null, profile, 1);
  writeProfile(shape, profile);

  const data = warp.image.data as Uint16Array;
  for (let i = 0; i < N; i++) {
    const turn = (i + 0.5) / N;
    data[i * 4] = THREE.DataUtils.toHalfFloat(lobeAt(m, turn));
    data[i * 4 + 1] = THREE.DataUtils.toHalfFloat(-0.75 * lobeAt(m, turn + 0.17));
    data[i * 4 + 2] = THREE.DataUtils.toHalfFloat(0.6 * lobeAt(m, turn + 0.31));
    data[i * 4 + 3] = THREE.DataUtils.toHalfFloat(lobeAt(m, turn + 0.25));
  }
  warp.needsUpdate = true;

  const satellites = m.satellites.map((s, i): [number, number, number, number] => {
    if (s.weight <= 0.02) return [0, 0, 0, 0];
    const lift = (i % 2 === 0 ? 1 : -1) * 0.08 * (i + 1);
    return [Math.cos(s.angle) * s.dist, lift, Math.sin(s.angle) * s.dist, satRadiusOf(m, s)];
  });

  return {
    morphology: m,
    lo: band.lo,
    hi: band.hi,
    core: m.coreRatio * 0.9,
    coreAt: [m.eccX, 0, m.eccY],
    satellites,
  };
}

export function sectorAt(m: AlbumMorphology, turn: number): number {
  for (let k = 0; k < m.bounds.length - 1; k++) if (turn < m.bounds[k + 1]) return k;
  return m.bounds.length - 2;
}
