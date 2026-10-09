import { ALBUMS, boundsOf, envelopeOf, trackBiasOf } from "./content";
import {
  curatedFormOf,
  neutralSection,
  pausesOf,
  sectionsOf,
  type Pause,
  type Section,
  type TrackForm,
} from "./content/form";
import { ENVELOPE_N, type AlbumSignature } from "./content/signature";
import { clamp, lerp } from "./math";
import { lobesOf, morphologyOf, withExtent, type AlbumMorphology } from "./morphology";
import { LANDSCAPE, MORPH } from "./tokens";

export interface FormState {
  closure: number;
  spiral: number;
  flatten: number;
  coreRatio: number;
  lift: number;
  strata: number;
  scatter: number;
  thickness: number;
  sharpness: number;
}

export interface Landscape {
  album: number;
  track: number;
  duration: number;
  base: AlbumMorphology;
  form: TrackForm;
  curated: boolean;
  identity: FormState;
  sections: Section[];
  pauses: Pause[];
  states: FormState[];
  drift: number[];
  plate: number[];
  bounds: number[];
  lobeCos: number[];
  lobeSin: number[];
  relief: number;
}

export interface Moment {
  state: FormState;
  section: number;
  progress: number;
  suspension: number;
  tau: number;
}

const KEYS: (keyof FormState)[] = [
  "closure",
  "spiral",
  "flatten",
  "coreRatio",
  "lift",
  "strata",
  "scatter",
  "thickness",
  "sharpness",
];

const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const copyState = (s: FormState): FormState => ({ ...s });

export function approachState(from: FormState, to: FormState, k: number): FormState {
  const out = { ...from };
  for (const key of KEYS) out[key] = from[key] + (to[key] - from[key]) * k;
  return out;
}

export function stateDistance(a: FormState, b: FormState): number {
  let d = 0;
  for (const key of KEYS) d = Math.max(d, Math.abs(a[key] - b[key]));
  return d;
}

function sliceOf(env: Float32Array, a: number, b: number, n = 128): Float32Array {
  const out = new Float32Array(n);
  const x0 = a * (ENVELOPE_N - 1);
  const x1 = Math.max(x0 + 1, b * (ENVELOPE_N - 1));
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    const j = Math.min(ENVELOPE_N - 2, Math.floor(x));
    const f = Math.min(1, x - j);
    out[i] = env[j] + (env[j + 1] - env[j]) * f;
  }
  return out;
}

function fallbackForm(sig: AlbumSignature, track: number, trackCount: number): TrackForm {
  const bias = trackBiasOf(sig, trackCount)[track];
  return {
    level: clamp(sig.loudness + (bias?.loudness ?? 0), 0, 1),
    articulation: 0.5,
    motion: 0.3,
    recurrence: 0.6,
    trajectory: 0,
    sections: "",
    pauses: "",
  };
}

export function returnShareOf(sections: Section[]): number {
  let share = 0;
  for (const s of sections) if (s.recall >= 0) share += s.end - s.at;
  return share;
}

function identityOf(
  sig: AlbumSignature,
  base: AlbumMorphology,
  form: TrackForm,
  sections: Section[],
  track: number,
): FormState {
  const returning = Math.max(form.recurrence, returnShareOf(sections));
  const ramp = smooth(LANDSCAPE.closureRamp[0], LANDSCAPE.closureRamp[1], returning);
  const raw = lerp(LANDSCAPE.closure[0], LANDSCAPE.closure[1], ramp);
  const closure = raw >= LANDSCAPE.closureSnap ? 1 : raw;
  const open = 1 - (closure - LANDSCAPE.closure[0]) / (1 - LANDSCAPE.closure[0]);
  const own = lerp(LANDSCAPE.flatten[0], LANDSCAPE.flatten[1], form.articulation);
  const pulse = sig.trackPulse?.[track] ?? sig.pulse;
  return {
    closure,
    spiral: form.trajectory * LANDSCAPE.spiral * (0.4 + 0.6 * open),
    flatten: lerp(own, base.flatten, LANDSCAPE.flattenGenus),
    coreRatio: lerp(LANDSCAPE.core[0], LANDSCAPE.core[1], form.level),
    lift: 0,
    strata: pulse,
    scatter: LANDSCAPE.scatter * smooth(LANDSCAPE.scatterRamp[0], LANDSCAPE.scatterRamp[1], form.motion),
    thickness: 1,
    sharpness: 1,
  };
}

function sectionStates(identity: FormState, sections: Section[]) {
  const states: FormState[] = [];
  const drift: number[] = [];
  const plate: number[] = [];
  let accrual = 0;
  for (let k = 0; k < sections.length; k++) {
    const sec = sections[k];
    const thickness = 1 + LANDSCAPE.accrual * Math.tanh(accrual / LANDSCAPE.accrualScale);
    if (sec.recall >= 0) {
      states.push({ ...states[sec.recall], thickness });
      drift.push(drift[sec.recall]);
      plate.push(plate[sec.recall]);
      continue;
    }
    accrual += sec.contrast;
    const silent = sec.level <= LANDSCAPE.silence;
    const articulation = silent ? 0 : sec.articulation;
    const brightness = silent ? 0 : sec.brightness;
    const closure =
      k === 0
        ? identity.closure
        : clamp(
            identity.closure - LANDSCAPE.noveltyOpen * sec.contrast,
            LANDSCAPE.closure[0],
            1,
          );
    states.push({
      ...identity,
      closure,
      flatten: clamp(
        identity.flatten + LANDSCAPE.tilt * articulation,
        LANDSCAPE.flatten[0],
        LANDSCAPE.flatten[1],
      ),
      coreRatio: identity.coreRatio * (1 + 0.12 * sec.level),
      lift: sec.level * (sec.level < 0 ? LANDSCAPE.lift[0] : LANDSCAPE.lift[1]),
      thickness,
      sharpness: clamp(1 + LANDSCAPE.sharpen * brightness, 0.4, 1.6),
    });
    drift.push(clamp(sec.level * 1.2 + articulation * 0.5, -1, 1));
    plate.push(lerp(LANDSCAPE.plate[0], LANDSCAPE.plate[1], clamp(0.5 + sec.level * 0.9, 0, 1)));
  }
  return { states, drift, plate };
}

const cache = new WeakMap<AlbumSignature, Map<number, Landscape>>();

export function landscapeOf(albumIndex: number, track: number): Landscape {
  const album = ALBUMS[albumIndex];
  const sig = album.signature;
  let byTrack = cache.get(sig);
  if (!byTrack) {
    byTrack = new Map();
    cache.set(sig, byTrack);
  }
  const hit = byTrack.get(track);
  if (hit && hit.album === albumIndex) return hit;

  const n = album.tracks.length;
  const base = morphologyOf(sig, n);
  const curated = curatedFormOf(album.id, track);
  const form = curated ?? fallbackForm(sig, track, n);
  const sections = curated ? sectionsOf(curated) : [neutralSection()];
  const pauses = curated ? pausesOf(curated) : [];
  const identity = identityOf(sig, base, form, sections, track);
  const { states, drift, plate } = sectionStates(identity, sections);

  const albumBounds = boundsOf(sig, n);
  const lobes = lobesOf(sliceOf(envelopeOf(sig), albumBounds[track], albumBounds[track + 1]));
  const bias = trackBiasOf(sig, n)[track];
  const dynamics = clamp(sig.dynamics + (bias?.dynamics ?? 0), 0, 1);

  const out: Landscape = {
    album: albumIndex,
    track,
    duration: album.tracks[track]?.dur ?? 0,
    base,
    form,
    curated: !!curated,
    identity,
    sections,
    pauses,
    states,
    drift,
    plate,
    bounds: [...sections.map((s) => s.at), 1],
    lobeCos: lobes.cos,
    lobeSin: lobes.sin,
    relief: lerp(MORPH.relief[0], MORPH.relief[1], dynamics),
  };
  byTrack.set(track, out);
  return out;
}

export function sectionIndexAt(L: Landscape, t: number): number {
  for (let k = L.sections.length - 1; k >= 0; k--) if (t >= L.sections[k].at) return k;
  return 0;
}

function suspensionAt(L: Landscape, t: number): number {
  if (!L.pauses.length || !(L.duration > 0)) return 0;
  const edge = LANDSCAPE.suspension.edge / L.duration;
  let v = 0;
  for (const p of L.pauses) {
    const rise = smooth(p.at - edge, p.at + edge, t);
    const fall = 1 - smooth(p.end - edge, p.end + edge, t);
    v = Math.max(v, Math.min(rise, fall));
  }
  return v;
}

export function momentAt(L: Landscape, t: number): Moment {
  const pos = clamp(t, 0, 1);
  const k = sectionIndexAt(L, pos);
  const sec = L.sections[k];
  const span = Math.max(1e-6, sec.end - sec.at);
  const u = clamp((pos - sec.at) / span, 0, 1);
  const seconds = (pos - sec.at) * L.duration;
  const state = copyState(L.states[k]);

  const rupture = k > 0 ? sec.contrast * Math.exp(-seconds / LANDSCAPE.rupture.decay) : 0;
  state.scatter = clamp(state.scatter + LANDSCAPE.rupture.scatter * rupture, 0, 1);
  state.closure = clamp(state.closure - LANDSCAPE.rupture.closure * rupture, LANDSCAPE.closure[0], 1);

  if (sec.slope > 0) state.strata = clamp(state.strata + LANDSCAPE.crescendo.strata * sec.slope * u, 0, 1);
  state.lift += LANDSCAPE.crescendo.lift * sec.slope * u;

  const suspension = suspensionAt(L, pos);
  state.scatter = clamp(state.scatter + LANDSCAPE.suspension.scatter * suspension, 0, 1);
  state.lift += LANDSCAPE.suspension.lift * suspension;

  return {
    state,
    section: k,
    progress: u,
    suspension,
    tau: lerp(LANDSCAPE.tau[0], LANDSCAPE.tau[1], clamp(sec.contrast * 2, 0, 1)),
  };
}

export function morphologyOfState(L: Landscape, st: FormState): AlbumMorphology {
  const base = L.base;
  const coreRatio = clamp(st.coreRatio, LANDSCAPE.core[0] * 0.8, LANDSCAPE.core[1] * 1.15);
  return withExtent({
    bounds: L.bounds,
    plate: L.plate,
    circuit: base.circuit,
    flatten: clamp(st.flatten, LANDSCAPE.flatten[0], LANDSCAPE.flatten[1]),
    coreRatio,
    bandRatio: Math.min(LANDSCAPE.band, (1 - coreRatio) * MORPH.bandFill * st.thickness),
    relief: L.relief * st.sharpness,
    strata: clamp(st.strata, 0, 1),
    eccX: base.eccX,
    eccY: base.eccY,
    fragment: lerp(LANDSCAPE.fragment[0], LANDSCAPE.fragment[1], clamp(st.scatter, 0, 1)),
    spread: base.spread,
    satellites: base.satellites.map((s) => ({ ...s, size: s.size * LANDSCAPE.satellite })),
    lobeCos: L.lobeCos,
    lobeSin: L.lobeSin,
    phase: base.phase,
    closure: clamp(st.closure, LANDSCAPE.closure[0], 1),
    spiral: st.spiral,
    drift: L.drift.map((d) => st.scatter * LANDSCAPE.drift * d + st.lift),
  });
}

const JET_BASE = Math.atan2(-0.62, 0.78);

export function jetAxisOf(flatten: number, mix: number): [number, number] {
  if (mix <= 0) return [0.62, 0.78];
  const edge = clamp((LANDSCAPE.jet.flat - flatten) / (LANDSCAPE.jet.flat - LANDSCAPE.flatten[0]), 0, 1);
  const th = JET_BASE + (-Math.PI / 2 - JET_BASE) * edge * clamp(mix, 0, 1);
  return [-Math.sin(th), Math.cos(th)];
}

export const landscapeRotation = (m: Pick<AlbumMorphology, "closure">) =>
  LANDSCAPE.face - (1 + m.closure) * Math.PI;
