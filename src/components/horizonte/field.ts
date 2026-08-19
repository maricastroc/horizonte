import type { AlbumSignature, TrackBias } from "./content/signature";
import { clamp, lerp } from "./math";
import { LIGHT } from "./tokens";

export interface FieldConstants {
  artistWeight: number;
  massScale: number;
  horizonScale: number;
  reactionCap: number;
  envelopeDepth: number;
  flatten: number;
  rimHardness: number;
  navLerp: number;
}

export const RANGE = {
  artistWeight: [505, 780],
  massScale: [0.88, 1.16],
  horizonScale: [0.95, 1.07],
  reactionCap: [0.05, 0.2],
  envelopeDepth: [0.1, 0.32],
  flatten: [0.57, 0.67],
  rimHardness: [2.6, 5.0],
  navLerp: [6.2, 4.3],
} as const;

export const heftOf = (s: AlbumSignature) => s.loudness * 0.68 + s.duration * 0.32;

export function fieldConstantsOf(sig: AlbumSignature, bias?: TrackBias): FieldConstants {
  const loudness = bias ? clamp(sig.loudness + bias.loudness, 0, 1) : sig.loudness;
  const dynamics = bias ? clamp(sig.dynamics + bias.dynamics, 0, 1) : sig.dynamics;
  const heft = loudness * 0.68 + sig.duration * 0.32;
  return {
    artistWeight: Math.round(lerp(RANGE.artistWeight[0], RANGE.artistWeight[1], sig.loudness)),
    massScale: lerp(RANGE.massScale[0], RANGE.massScale[1], heft),
    horizonScale: lerp(RANGE.horizonScale[0], RANGE.horizonScale[1], loudness),
    reactionCap: lerp(RANGE.reactionCap[0], RANGE.reactionCap[1], dynamics),
    envelopeDepth: lerp(RANGE.envelopeDepth[0], RANGE.envelopeDepth[1], dynamics),
    flatten: lerp(RANGE.flatten[0], RANGE.flatten[1], sig.brightness),
    rimHardness: lerp(RANGE.rimHardness[0], RANGE.rimHardness[1], sig.brightness),
    navLerp: lerp(RANGE.navLerp[0], RANGE.navLerp[1], sig.duration),
  };
}

export function mixConstants(a: FieldConstants, b: FieldConstants, t: number): FieldConstants {
  return {
    artistWeight: lerp(a.artistWeight, b.artistWeight, t),
    massScale: lerp(a.massScale, b.massScale, t),
    horizonScale: lerp(a.horizonScale, b.horizonScale, t),
    reactionCap: lerp(a.reactionCap, b.reactionCap, t),
    envelopeDepth: lerp(a.envelopeDepth, b.envelopeDepth, t),
    flatten: lerp(a.flatten, b.flatten, t),
    rimHardness: lerp(a.rimHardness, b.rimHardness, t),
    navLerp: lerp(a.navLerp, b.navLerp, t),
  };
}

export function reduceMotion(c: FieldConstants): FieldConstants {
  return {
    ...c,
    reactionCap: 0,
    massScale: 1 + (c.massScale - 1) * 0.25,
    navLerp: RANGE.navLerp[0],
  };
}

export const lightSweepOf = (progress: number) => (clamp(progress, 0, 1) - 0.5) * LIGHT.arc;

export function lightDirection(sweep: number): [number, number] {
  const c = Math.cos(sweep);
  const s = Math.sin(sweep);
  const [bx, by] = LIGHT.base;
  return [bx * c - by * s, bx * s + by * c];
}
