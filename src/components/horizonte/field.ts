import type { AlbumSignature } from "./content/signature";

const lerp = (a: number, b: number, t: number) => a + (b - a) * (t < 0 ? 0 : t > 1 ? 1 : t);

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

export function fieldConstantsOf(sig: AlbumSignature): FieldConstants {
  const heft = heftOf(sig);
  return {
    artistWeight: Math.round(lerp(RANGE.artistWeight[0], RANGE.artistWeight[1], sig.loudness)),
    massScale: lerp(RANGE.massScale[0], RANGE.massScale[1], heft),
    horizonScale: lerp(RANGE.horizonScale[0], RANGE.horizonScale[1], sig.loudness),
    reactionCap: lerp(RANGE.reactionCap[0], RANGE.reactionCap[1], sig.dynamics),
    envelopeDepth: lerp(RANGE.envelopeDepth[0], RANGE.envelopeDepth[1], sig.dynamics),
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
