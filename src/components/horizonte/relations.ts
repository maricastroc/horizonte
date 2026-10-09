import { clamp, lerp } from "./math";
import { MORPH, RELATIONS } from "./tokens";
import type { AlbumMorphology, Satellite } from "./morphology";
import { climaxAt, isSilent, sectionAt, sectionWeight, suspensionAt, type Score } from "./score";

export interface Relations {
  lean: number;
  leanY: number;
  reach: number;
  calm: number;
}

export const NEUTRAL_RELATIONS: Relations = {
  lean: 0,
  leanY: 0,
  reach: 1,
  calm: 0,
};

export function albumRelationsOf(density: number, loudness: number): Relations {
  const lean = lerp(RELATIONS.albumLean[0], RELATIONS.albumLean[1], clamp(density, 0, 1));
  return {
    lean,
    leanY: -lean * RELATIONS.leanDrop,
    reach: lerp(RELATIONS.albumReach[0], RELATIONS.albumReach[1], clamp(loudness, 0, 1)),
    calm: 0,
  };
}

export function relationsAt(score: Score, t: number): Relations {
  const k = sectionAt(score, t);
  const weight = sectionWeight(score.sections[k]);
  const climax = climaxAt(score, t);
  const calm = suspensionAt(score, t);
  const density = clamp(0.6 * score.level + 0.4 * score.articulation, 0, 1);

  const lean = clamp(
    lerp(RELATIONS.lean[0], RELATIONS.lean[1], density) -
      RELATIONS.leanSection * weight -
      RELATIONS.leanClimax * climax +
      RELATIONS.leanCalm * calm,
    RELATIONS.leanRange[0],
    RELATIONS.leanRange[1],
  );
  const reach = clamp(
    lerp(RELATIONS.reach[0], RELATIONS.reach[1], score.level) *
      (1 + RELATIONS.reachSection * weight) *
      (1 + RELATIONS.reachClimax * climax) *
      (1 - RELATIONS.reachCalm * calm),
    RELATIONS.reachRange[0],
    RELATIONS.reachRange[1],
  );
  return { lean, leanY: -lean * RELATIONS.leanDrop, reach, calm };
}

const GOLDEN = 0.6180339887498949;
const TAU = 2 * Math.PI;

const arcGap = (a: number, b: number) =>
  Math.abs(((((a - b + Math.PI) % TAU) + TAU) % TAU) - Math.PI);

function homeAngles(base: AlbumMorphology, count: number, clear: boolean): number[] {
  const [a0, a1] = RELATIONS.home.arc;
  const start = (((base.phase / TAU) % 1) + 1) % 1;
  const taken = clear ? base.satellites.filter((s) => s.weight > 0.02).map((s) => s.angle) : [];
  const out: number[] = [];
  for (let j = 0; out.length < count; j++) {
    const angle = a0 + ((start + j * GOLDEN) % 1) * (a1 - a0);
    if (
      clear &&
      j < RELATIONS.home.tries &&
      taken.some((a) => arcGap(a, angle) < RELATIONS.home.clear)
    ) {
      continue;
    }
    taken.push(angle);
    out.push(angle);
  }
  return out;
}

export interface Companions {
  bodies: Satellite[];
  pulls: number[];
  sounding: number;
}

function companionsOf(score: Score, t: number, base: AlbumMorphology, keep: boolean): Companions {
  const k = sectionAt(score, t);
  const sec = score.sections[k];
  const cluster = isSilent(sec) ? -1 : sec.cluster;
  const lastHeard = new Map<number, number>();
  for (let j = 0; j <= k; j++) lastHeard.set(score.sections[j].cluster, j);

  const dominant = score.materials.reduce((a, b) => (b.share > a.share ? b : a));
  const secondary = score.materials.filter((mat) => mat !== dominant);
  const spare = keep
    ? base.satellites
        .map((sat, i) => ({ sat, i }))
        .filter(({ sat }) => sat.weight > 0.02)
        .sort((a, b) => b.sat.weight * b.sat.size - a.sat.weight * a.sat.size)
        .slice(1)
        .map(({ i }) => i)
    : [];
  const lenders = new Map(
    [...secondary]
      .sort((a, b) => b.share - a.share)
      .slice(0, spare.length)
      .map((mat, j) => [mat, spare[j]] as const),
  );
  const own = secondary.filter((mat) => !lenders.has(mat));
  const angles = homeAngles(base, own.length, keep);
  const offset = keep ? base.satellites.length : 0;
  const pulls = keep ? base.satellites.map(() => 0) : [];
  let sounding = -1;

  for (const [mat, i] of lenders) {
    if (mat.first <= t && mat.cluster === cluster) {
      pulls[i] = 1;
      sounding = i;
    }
  }

  const bodies = own.map((mat, j) => {
    const size = Math.min(
      MORPH.satSize * lerp(RELATIONS.body.size[0], RELATIONS.body.size[1], Math.sqrt(mat.share)),
      base.coreRatio * RELATIONS.body.cap,
    );
    const angle = angles[j];
    const dist = base.rMax + RELATIONS.home.gap + size + RELATIONS.home.step * j;
    if (mat.first > t) return { angle, dist, size, weight: 0 };
    if (mat.cluster === cluster) {
      sounding = offset + j;
      return {
        angle,
        dist: base.rMax + RELATIONS.conjunction.gap + size,
        size,
        weight: RELATIONS.body.sounding,
      };
    }
    const behind = !score.returns && (lastHeard.get(mat.cluster) ?? -1) < k;
    return {
      angle,
      dist,
      size,
      weight: behind ? RELATIONS.body.left : RELATIONS.body.resting,
    };
  });
  return { bodies, pulls, sounding };
}

export function companionsAt(
  score: Score,
  t: number,
  base: AlbumMorphology,
  keep: boolean,
): Companions {
  if (!score.curated || score.materials.length === 0) {
    return {
      bodies: keep ? [] : base.satellites,
      pulls: keep ? base.satellites.map(() => 0) : [],
      sounding: -1,
    };
  }
  return companionsOf(score, t, base, keep);
}

export const bodiesAt = (score: Score, t: number, base: AlbumMorphology): Satellite[] =>
  companionsAt(score, t, base, false).bodies;

export function pulledSatellites(base: AlbumMorphology, pulls: number[]): Satellite[] {
  return base.satellites.map((sat, i) => {
    const p = pulls[i] ?? 0;
    if (p <= 0) return sat;
    return {
      ...sat,
      dist: lerp(sat.dist, Math.min(sat.dist, base.rMax + RELATIONS.conjunction.gap + sat.size), p),
    };
  });
}

export function approachBodies(from: Satellite[], to: Satellite[], k: number): Satellite[] {
  if (from.length !== to.length) return to.map((s) => ({ ...s, weight: s.weight * k }));
  return to.map((s, i) => {
    const f = from[i];
    let d = s.angle - f.angle;
    d = ((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    return {
      angle: f.angle + d * k,
      dist: f.dist + (s.dist - f.dist) * k,
      size: f.size + (s.size - f.size) * k,
      weight: f.weight + (s.weight - f.weight) * k,
    };
  });
}
