import { NEUTRAL_RESPONSE, type Response } from "./audio/analysis";
import type { AlbumWithSignature } from "./content";
import { curatedMotionOf, type TrackMotion } from "./content/motion";
import { boundsOf, rankAt, softKnee } from "./content/signature";
import { clamp, lerp } from "./math";
import { MOTION } from "./tokens";

export type MotionQualities = TrackMotion;

export interface Routing {
  mass: number;
  light: number;
}

export interface MotionResponse extends Response, Routing {}

export const NEUTRAL_ROUTING: Routing = { mass: 1, light: 1 };

export const NEUTRAL_MOTION: MotionResponse = { ...NEUTRAL_RESPONSE, ...NEUTRAL_ROUTING };

const GRADED = ["sharpness", "sustain", "weight", "contrast"] as const;

const qualitiesCache = new WeakMap<AlbumWithSignature, (MotionQualities | null)[]>();

const logLerp = (a: number, b: number, t: number) => Math.exp(lerp(Math.log(a), Math.log(b), t));

function gradedTracks(album: AlbumWithSignature): (MotionQualities | null)[] {
  const n = album.tracks.length;
  const rows = curatedMotionOf(album.id);
  if (!rows || rows.length !== n) return new Array(n).fill(null);

  const bounds = boundsOf(album.signature, n);
  const out: (MotionQualities | null)[] = rows.map((r) => (r ? { ...r } : null));

  for (const key of GRADED) {
    let sum = 0;
    let weight = 0;
    const values: number[] = [];
    rows.forEach((r, k) => {
      if (!r) return;
      const w = bounds[k + 1] - bounds[k];
      sum += r[key] * w;
      weight += w;
      values.push(r[key]);
    });
    if (weight <= 0) continue;
    const anchor = sum / weight;
    const sorted = values.sort((a, b) => a - b);
    const spread = rankAt(sorted, 0.9) - rankAt(sorted, 0.1);
    const gate = MOTION.gate[key];
    const open = clamp((spread - gate.floor) / gate.knee, 0, 1);
    out.forEach((q, k) => {
      if (!q) return;
      const deviation = softKnee((rows[k]![key] - anchor) * open, MOTION.track.cap, MOTION.track.knee);
      q[key] = clamp(anchor + deviation, 0, 1);
    });
  }
  return out;
}

export function motionQualitiesOf(album: AlbumWithSignature, track: number): MotionQualities | null {
  let rows = qualitiesCache.get(album);
  if (!rows) {
    rows = gradedTracks(album);
    qualitiesCache.set(album, rows);
  }
  return rows[track] ?? null;
}

export function responseOf(q: MotionQualities): Response {
  const attack = logLerp(MOTION.attack[0], MOTION.attack[1], q.sharpness);
  let release = logLerp(MOTION.release[0], MOTION.release[1], q.sustain);
  if (q.beat > 0) release = Math.min(release, q.beat * MOTION.beatRelease);
  release = Math.max(release, attack);
  const habit = clamp(release * MOTION.habitRatio, MOTION.habit[0], MOTION.habit[1]);
  const depth = lerp(MOTION.depth[0], MOTION.depth[1], q.contrast);
  return { attack, release, habit, depth };
}

export function routingOf(q: MotionQualities): Routing {
  const { floor, slope } = MOTION.route;
  return {
    mass: clamp(floor + slope * q.weight, floor, 1),
    light: clamp(floor + slope * (1 - q.weight), floor, 1),
  };
}

export function motionResponseOf(q: MotionQualities | null): MotionResponse {
  return q ? { ...responseOf(q), ...routingOf(q) } : NEUTRAL_MOTION;
}

export function approachMotion(current: MotionResponse, target: MotionResponse, k: number) {
  current.attack += (target.attack - current.attack) * k;
  current.release += (target.release - current.release) * k;
  current.habit += (target.habit - current.habit) * k;
  current.depth += (target.depth - current.depth) * k;
  current.mass += (target.mass - current.mass) * k;
  current.light += (target.light - current.light) * k;
}
