import type { AxisReading, CompareAxis, Finding, Question, QuestionPart } from "../anatomy";
import type { Album } from "../content";
import type { IngestError, IngestPhase, IngestProbe } from "../ingest/types";
import type { Fault, Scale } from "../types";
import type { Locale } from "./locale";

export interface Phrasing {
  ask: string;
  answer: string;
  what: string | null;
  label: string;
  result: string;
}

export interface AnatomyWriter {
  phrase(q: Question): Phrasing;
  measure: Record<CompareAxis, string>;
  shown(axis: CompareAxis, value: number): string;
  standing(r: AxisReading): string;
  drawn: Record<QuestionPart, string>;
  details(q: Question): [string, string][];
  depth(q: Question): string | null;
  nameFact(core: Extract<Finding, { part: "core" }>): string;
  colourNote: string;
}

export interface CeremonyReading {
  label: string;
  words: [string, string, string];
}

export interface Copy {
  locale: Locale;
  language: {
    label: string;
    short: Record<Locale, string>;
    name: Record<Locale, string>;
  };
  title: string;
  scale: Record<Scale, string>;
  scaleNav: string;
  albumsNav: string;
  albumsOpen: string;
  albumsClose: string;
  albumCount: (n: number) => string;
  trackCount: (n: number) => string;
  tracksOf: (title: string) => string;
  collectionAt: (at: number, of: number) => string;
  intake: { idle: string; dragging: string };
  transport: {
    previous: string;
    play: string;
    pause: string;
    resume: string;
    next: string;
    back: string;
  };
  sound: { on: string; muted: string; volume: string };
  seek: { label: string; value: (position: string, duration: string) => string };
  hint: { drag: string; swipe: string };
  fault: Record<Fault, string>;
  announce: {
    collection: (n: number) => string;
    track: (number: string, title: string, artist: string) => string;
  };
  canvas: { tracks: (n: number) => string };
  ceremony: {
    phase: Record<IngestPhase, string>;
    readings: Record<keyof IngestProbe, CeremonyReading>;
    private: string;
    stop: string;
    error: (e: IngestError) => string;
  };
  local: { artist: string; title: string; license: string; attribution: string };
  credit: (album: Album) => string;
  anatomy: {
    views: string;
    tracks: string;
    shape: string;
    findOut: string;
    inNumbers: string;
    also: string;
    more: string;
    nextQuestion: string;
    asItIs: string;
    compare: string;
    hold: string;
    keys: string;
    settled: string;
    rows: { measure: string; record: string; usual: string; standing: string; drawn: string };
    usual: (shown: string, of: number) => string;
    write: AnatomyWriter;
  };
}
