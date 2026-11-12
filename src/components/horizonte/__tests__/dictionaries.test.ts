import { describe, expect, it } from "vitest";
import { ALBUMS, CURATED_COUNT, type Album } from "../content";
import { COPY } from "../i18n";
import type { IngestError } from "../ingest/types";

const EN = COPY.en;
const PT = COPY["pt-BR"];

type Shape = string | Shape[] | { [k: string]: Shape };

const SAMPLE_ARGS: Record<string, unknown[]> = {
  albumCount: [14],
  trackCount: [7],
  tracksOf: ["0p"],
  collectionAt: [3, 14],
  value: ["01:02", "03:04"],
  collection: [14],
  track: ["03", "Title", "Artist"],
  tracks: [7],
  usual: ["34 min", 14],
};

function shapeOf(v: unknown, key = ""): Shape {
  if (typeof v === "string") return "string";
  if (typeof v === "function") {
    if (key in SAMPLE_ARGS) return `fn:${typeof (v as (...a: unknown[]) => unknown)(...SAMPLE_ARGS[key])}`;
    return `fn/${(v as () => unknown).length}`;
  }
  if (Array.isArray(v)) return v.map((x) => shapeOf(x));
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, shapeOf((v as Record<string, unknown>)[k], k)]),
    );
  }
  return typeof v;
}

function leaves(v: unknown, path = ""): [string, string][] {
  if (typeof v === "string") return [[path, v]];
  if (typeof v === "function" && path.split(".").at(-1)! in SAMPLE_ARGS) {
    const out = (v as (...a: unknown[]) => unknown)(...SAMPLE_ARGS[path.split(".").at(-1)!]);
    return typeof out === "string" ? [[path, out]] : [];
  }
  if (Array.isArray(v)) return v.flatMap((x, i) => leaves(x, `${path}.${i}`));
  if (v && typeof v === "object") {
    return Object.entries(v).flatMap(([k, x]) => leaves(x, path ? `${path}.${k}` : k));
  }
  return [];
}

const SHARED = new Set([
  "locale",
  "title",
  "language.label",
  "language.short.en",
  "language.short.pt-BR",
  "language.name.en",
  "language.name.pt-BR",
  "sound.volume",
  "announce.track",
  "anatomy.write.measure.loudness",
]);

describe("the dictionaries", () => {
  it("share the same keys and the same kinds of value", () => {
    expect(shapeOf(PT)).toEqual(shapeOf(EN));
  });

  it("leave no string empty", () => {
    for (const copy of [EN, PT]) {
      for (const [path, text] of leaves(copy)) expect(text.trim(), path).not.toBe("");
    }
  });

  it("translate everything except names and shared words", () => {
    const en = new Map(leaves(EN));
    for (const [path, text] of leaves(PT)) {
      if (SHARED.has(path) || path === "locale") continue;
      expect(text, path).not.toBe(en.get(path));
    }
  });

  it("count in each language's own plural", () => {
    expect([EN.trackCount(1), EN.trackCount(7)]).toEqual(["1 track", "7 tracks"]);
    expect([PT.trackCount(1), PT.trackCount(7)]).toEqual(["1 faixa", "7 faixas"]);
    expect([PT.albumCount(1), PT.albumCount(14)]).toEqual(["1 álbum", "14 álbuns"]);
    expect([EN.canvas.tracks(1), PT.canvas.tracks(12)]).toEqual(["1 TRACK", "12 FAIXAS"]);
    expect(PT.announce.collection(14)).toBe("Coleção · 14 corpos");
    expect(PT.seek.value("00:30", "02:00")).toBe("00:30 de 02:00");
  });

  it("explain every ingestion failure, naming the file when there is one", () => {
    const errors: IngestError[] = [
      { kind: "unsupported", formats: ["MP3", "WAV"] },
      { kind: "empty" },
      { kind: "unreadable", file: "a.flac" },
      { kind: "tooLarge", file: "a.wav", mb: 410 },
      { kind: "tooLong", file: "a.mp3", minutes: 52 },
      { kind: "recordTooLong" },
      { kind: "failed" },
    ];
    for (const e of errors) {
      const en = EN.ceremony.error(e);
      const pt = PT.ceremony.error(e);
      expect(en).not.toBe(pt);
      for (const text of [en, pt]) {
        expect(text.length).toBeGreaterThan(10);
        if ("file" in e) expect(text).toContain(e.file);
        if (e.kind === "unsupported") expect(text).toContain("MP3, WAV");
      }
    }
  });
});

describe("credits", () => {
  const withNote = ALBUMS.findIndex((a) => a.note);

  it("English keeps the attribution exactly as the licence asks", () => {
    expect(EN.credit(ALBUMS[0])).toBe(ALBUMS[0].license.attribution);
  });

  it("Portuguese rebuilds the same attribution in Portuguese", () => {
    const album = ALBUMS[0];
    const credit = PT.credit(album);
    expect(credit).toContain(`${album.artist} — ${album.title}`);
    expect(credit).toContain(album.year);
    expect(credit).toContain(`Licenciado sob ${album.license.name}.`);
    expect(credit).not.toMatch(/self-released|Licensed under/);
  });

  it("every curator note shown in the credit has its Portuguese version", () => {
    for (const a of ALBUMS.slice(0, CURATED_COUNT)) {
      expect(Boolean(a.notePt), a.id).toBe(Boolean(a.note));
    }
    expect(PT.credit(ALBUMS[withNote])).toContain(ALBUMS[withNote].notePt!);
    expect(EN.credit(ALBUMS[withNote])).toContain(ALBUMS[withNote].note!);
  });

  it("a local record is credited to the visitor's device, in each language", () => {
    const local = { ...ALBUMS[0], provider: "local", note: undefined } as Album;
    expect(EN.credit(local)).toBe(EN.local.attribution);
    expect(PT.credit(local)).toBe(PT.local.attribution);
  });
});
