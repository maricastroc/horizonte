import { ALBUMS } from "./content";
import {
  curatedFormOf,
  neutralSection,
  pausesOf,
  sectionsOf,
  type Pause,
  type Section,
} from "./content/form";
import type { AlbumSignature } from "./content/signature";
import { clamp } from "./math";
import { SCORE } from "./tokens";

export interface Material {
  cluster: number;
  share: number;
  first: number;
  rank: number;
}

export interface Score {
  album: number;
  track: number;
  duration: number;
  curated: boolean;
  level: number;
  articulation: number;
  motion: number;
  recurrence: number;
  trajectory: number;
  sections: Section[];
  pauses: Pause[];
  materials: Material[];
  returns: boolean;
  climax: number;
  rupture: number;
}

const silent = (s: Section) => s.level <= SCORE.silence;

function materialsOf(sections: Section[]): Material[] {
  const share = new Map<number, number>();
  const first = new Map<number, number>();
  for (const s of sections) {
    if (silent(s)) continue;
    share.set(s.cluster, (share.get(s.cluster) ?? 0) + (s.end - s.at));
    if (!first.has(s.cluster)) first.set(s.cluster, s.at);
  }
  const ranked = [...share.entries()]
    .filter(([, v]) => v >= SCORE.minShare)
    .sort((a, b) => b[1] - a[1])
    .slice(0, SCORE.maxMaterials)
    .map(([cluster, v], rank) => ({ cluster, share: v, first: first.get(cluster) ?? 0, rank }));
  return ranked.sort((a, b) => a.first - b.first);
}

function climaxOf(sections: Section[]): number {
  let mean = 0;
  let weight = 0;
  for (const s of sections) {
    if (silent(s)) continue;
    mean += s.level * (s.end - s.at);
    weight += s.end - s.at;
  }
  if (weight <= 0) return -1;
  mean /= weight;
  let best = -1;
  for (let k = 0; k < sections.length; k++) {
    const s = sections[k];
    const span = s.end - s.at;
    if (silent(s) || span < SCORE.climaxSpan || span > SCORE.climaxMaxSpan) continue;
    if (best < 0 || s.level > sections[best].level) best = k;
  }
  if (best < 0 || sections[best].level - mean < SCORE.climaxLift) return -1;
  return best;
}

function ruptureOf(sections: Section[]): number {
  let best = -1;
  for (let k = 1; k < sections.length; k++) {
    const s = sections[k];
    if (silent(s) || s.contrast < SCORE.rupture) continue;
    if (best < 0 || s.contrast > sections[best].contrast) best = k;
  }
  return best;
}

const cache = new WeakMap<AlbumSignature, Map<number, Score>>();

export function scoreOf(albumIndex: number, track: number): Score {
  const album = ALBUMS[albumIndex];
  let byTrack = cache.get(album.signature);
  if (!byTrack) {
    byTrack = new Map();
    cache.set(album.signature, byTrack);
  }
  const hit = byTrack.get(track);
  if (hit && hit.album === albumIndex) return hit;

  const form = curatedFormOf(album.id, track);
  const sections = form ? sectionsOf(form) : [neutralSection()];
  const out: Score = {
    album: albumIndex,
    track,
    duration: album.tracks[track]?.dur ?? 0,
    curated: !!form,
    level: form?.level ?? album.signature.loudness,
    articulation: form?.articulation ?? 0.5,
    motion: form?.motion ?? 0.3,
    recurrence: form?.recurrence ?? 0.6,
    trajectory: form?.trajectory ?? 0,
    sections,
    pauses: form ? pausesOf(form) : [],
    materials: materialsOf(sections),
    returns: sections.some((s) => s.recall >= 0),
    climax: climaxOf(sections),
    rupture: ruptureOf(sections),
  };
  byTrack.set(track, out);
  return out;
}

const densityCache = new WeakMap<AlbumSignature, number>();

export function albumDensityOf(albumIndex: number): number {
  const album = ALBUMS[albumIndex];
  const hit = densityCache.get(album.signature);
  if (hit !== undefined) return hit;
  let articulation = 0;
  let weight = 0;
  album.tracks.forEach((t, k) => {
    const form = curatedFormOf(album.id, k);
    if (!form) return;
    articulation += form.articulation * t.dur;
    weight += t.dur;
  });
  const density = clamp(
    0.6 * album.signature.loudness + 0.4 * (weight > 0 ? articulation / weight : 0.5),
    0,
    1,
  );
  densityCache.set(album.signature, density);
  return density;
}

export function sectionAt(score: Score, t: number): number {
  for (let k = score.sections.length - 1; k >= 0; k--) if (t >= score.sections[k].at) return k;
  return 0;
}

const smooth = (e0: number, e1: number, x: number) => {
  const u = clamp((x - e0) / Math.max(1e-6, e1 - e0), 0, 1);
  return u * u * (3 - 2 * u);
};

export function suspensionAt(score: Score, t: number): number {
  if (!score.pauses.length || !(score.duration > 0)) return 0;
  const edge = SCORE.pauseEdge / score.duration;
  let v = 0;
  for (const p of score.pauses) {
    v = Math.max(
      v,
      Math.min(smooth(p.at - edge, p.at + edge, t), 1 - smooth(p.end - edge, p.end + edge, t)),
    );
  }
  return v;
}

export function climaxAt(score: Score, t: number): number {
  if (score.climax < 0 || !(score.duration > 0)) return 0;
  const s = score.sections[score.climax];
  const rise = Math.min((s.end - s.at) * 0.3, SCORE.climaxRise / score.duration);
  const release = SCORE.climaxRelease / score.duration;
  return Math.min(smooth(s.at, s.at + rise, t), 1 - smooth(s.end, s.end + release, t));
}

export const sectionWeight = (s: Section) =>
  silent(s) ? -1 : clamp(s.level / SCORE.levelSpan, -1, 1);

export const isSilent = silent;
