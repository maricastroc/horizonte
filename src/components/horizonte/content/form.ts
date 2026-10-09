import { FORMS } from "./form.generated";

export interface TrackForm {
  level: number;
  articulation: number;
  motion: number;
  recurrence: number;
  trajectory: number;
  sections: string;
  pauses: string;
}

export interface Section {
  at: number;
  end: number;
  level: number;
  articulation: number;
  brightness: number;
  contrast: number;
  cluster: number;
  slope: number;
  recall: number;
}

export interface Pause {
  at: number;
  end: number;
}

const SECTION_BYTES = 8;

const sectionCache = new WeakMap<TrackForm, Section[]>();
const pauseCache = new WeakMap<TrackForm, Pause[]>();

function bytesOf(b64: string): Uint8Array {
  if (!b64) return new Uint8Array(0);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const signed = (b: number) => (b > 127 ? b - 256 : b) / 127;

export function sectionsOf(form: TrackForm): Section[] {
  const hit = sectionCache.get(form);
  if (hit) return hit;
  const raw = bytesOf(form.sections);
  const out: Section[] = [];
  for (let i = 0; i + SECTION_BYTES <= raw.length; i += SECTION_BYTES) {
    out.push({
      at: ((raw[i] << 8) | raw[i + 1]) / 65535,
      end: 1,
      level: signed(raw[i + 2]),
      articulation: signed(raw[i + 3]),
      brightness: signed(raw[i + 4]),
      contrast: raw[i + 5] / 255,
      cluster: raw[i + 6],
      slope: signed(raw[i + 7]),
      recall: -1,
    });
  }
  if (!out.length) out.push(neutralSection());
  out[0].at = 0;
  for (let k = 0; k < out.length; k++) {
    out[k].end = k + 1 < out.length ? out[k + 1].at : 1;
    for (let j = 0; j < k - 1; j++) {
      if (out[j].cluster === out[k].cluster) {
        out[k].recall = j;
        break;
      }
    }
  }
  sectionCache.set(form, out);
  return out;
}

export function pausesOf(form: TrackForm): Pause[] {
  const hit = pauseCache.get(form);
  if (hit) return hit;
  const raw = bytesOf(form.pauses);
  const out: Pause[] = [];
  for (let i = 0; i + 4 <= raw.length; i += 4) {
    out.push({
      at: ((raw[i] << 8) | raw[i + 1]) / 65535,
      end: ((raw[i + 2] << 8) | raw[i + 3]) / 65535,
    });
  }
  pauseCache.set(form, out);
  return out;
}

export function neutralSection(): Section {
  return {
    at: 0,
    end: 1,
    level: 0,
    articulation: 0,
    brightness: 0,
    contrast: 0,
    cluster: 0,
    slope: 0,
    recall: -1,
  };
}

export function curatedFormOf(albumId: string, track: number): TrackForm | null {
  return FORMS[albumId]?.[track] ?? null;
}
