import { ANATOMY_EN } from "./anatomy.en";
import type { Copy } from "./types";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const LOCAL = {
  artist: "Local album",
  title: "Untitled",
  license: "Local file",
  attribution: "A file from your device. Nothing was sent to any server.",
};

export const EN: Copy = {
  locale: "en",
  language: {
    label: "Language",
    short: { en: "EN", "pt-BR": "PT" },
    name: { en: "English", "pt-BR": "Português (Brasil)" },
  },
  title: "Horizonte",
  scale: { collection: "Collection", album: "Album", track: "Track" },
  scaleNav: "Scale",
  albumsNav: "Albums",
  albumsOpen: "Albums",
  albumsClose: "Close",
  albumCount: (n) => plural(n, "album", "albums"),
  trackCount: (n) => plural(n, "track", "tracks"),
  tracksOf: (title) => `Tracks of ${title}`,
  collectionAt: (at, of) => `Collection · ${at}/${of}`,
  intake: { idle: "Bring a record", dragging: "Drop to measure" },
  transport: {
    previous: "◂◂ Previous",
    play: "▸ Play",
    pause: "❙❙ Pause",
    resume: "▸ Resume",
    next: "Next ▸▸",
    back: "◂ Back",
  },
  sound: { on: "Sound", muted: "Mute", volume: "Volume" },
  seek: {
    label: "Position in track",
    value: (position, duration) => `${position} of ${duration}`,
  },
  hint: { drag: "Drag to explore", swipe: "Swipe to explore" },
  fault: {
    source: "Could not load this track.",
    blocked: "The browser blocked the sound — ask again.",
  },
  announce: {
    collection: (n) => `Collection · ${plural(n, "body", "bodies")}`,
    track: (number, title, artist) => `${number} · ${title} — ${artist}`,
  },
  canvas: { tracks: (n) => plural(n, "TRACK", "TRACKS") },
  ceremony: {
    phase: {
      reading: "opening the record",
      decoding: "measuring the record",
      measuring: "measuring the record",
      composing: "tracing the horizon",
      done: "the record is in",
      failed: "could not measure it",
      cancelled: "measurement stopped",
    },
    readings: {
      loudness: { label: "its weight", words: ["light", "dense", "heavy"] },
      dynamics: { label: "its dynamics", words: ["compressed", "breathing", "open"] },
      brightness: { label: "its light", words: ["dark", "warm", "cutting"] },
      duration: { label: "its crossing", words: ["short", "long", "vast"] },
    },
    private: "Nothing leaves this device.",
    stop: "Stop",
    error: (e) => {
      switch (e.kind) {
        case "unsupported":
          return `This browser cannot read those files. It reads: ${e.formats.join(", ")}.`;
        case "empty":
          return "No recognized audio file.";
        case "unreadable":
          return `Could not read “${e.file}”.`;
        case "tooLarge":
          return `“${e.file}” is too large to measure (${e.mb} MB).`;
        case "tooLong":
          return `“${e.file}” is too long to measure (${e.minutes} min).`;
        case "recordTooLong":
          return "This record is too long to measure in one pass.";
        case "failed":
          return "Something went wrong while measuring this record.";
      }
    },
  },
  local: LOCAL,
  credit: (album) =>
    [album.provider === "local" ? LOCAL.attribution : album.license.attribution, album.note]
      .filter(Boolean)
      .join(" — "),
  anatomy: {
    views: "Album views",
    tracks: "Tracks",
    shape: "Why this shape?",
    findOut: "Find out ›",
    inNumbers: "In numbers",
    also: "Also",
    more: "More about this shape",
    nextQuestion: "Next question ›",
    asItIs: "As it is",
    compare: "Compare",
    hold: "Hold the image to compare",
    keys: "Esc returns",
    settled: "It already sits where most records here do, so there is nothing to change.",
    rows: {
      measure: "Measure",
      record: "This record",
      usual: "Usual here",
      standing: "Standing",
      drawn: "Drawn as",
    },
    usual: (shown, of) => `${shown} (median of the ${of})`,
    write: ANATOMY_EN,
  },
};
