import type { AlbumSignature } from "../content/signature";
import type { Album, Ink, License, Track } from "../content/types";
import { encodeEnvelope, norm, type AlbumMeasurement } from "./dsp";
import { extensionOf } from "./formats";
import { readTags } from "./metadata";
import type { LocalGroupDraft, LocalTrackDraft } from "./types";

const collator = new Intl.Collator("pt", { numeric: true, sensitivity: "base" });

export const FALLBACK_ARTIST = "Disco local";
export const FALLBACK_TITLE = "Untitled";

const stripExtension = (name: string) => {
  const i = name.lastIndexOf(".");
  return i <= 0 ? name : name.slice(0, i);
};

export function titleFromFilename(name: string): string {
  const bare = stripExtension(name).replace(/_/g, " ");
  const cleaned = bare
    .replace(/^\s*\d{1,3}\s*[-.–—]\s*/, "")
    .replace(/^\s*\d{1,3}\s+/, "")
    .trim();
  return cleaned || bare.trim() || FALLBACK_TITLE;
}

function directoryOf(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";
  if (!rel) return "";
  const parts = rel.split("/").filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : "";
}

export function orderTracks(tracks: LocalTrackDraft[]): LocalTrackDraft[] {
  const numbered = tracks.length > 0 && tracks.every((t) => t.track > 0);
  const out = tracks.slice();
  if (numbered) {
    out.sort((a, b) => a.disc - b.disc || a.track - b.track || a.order - b.order);
  } else {
    out.sort((a, b) => collator.compare(a.file.name, b.file.name) || a.order - b.order);
  }
  return out;
}

export async function groupFiles(files: File[]): Promise<LocalGroupDraft[]> {
  const groups = new Map<string, LocalGroupDraft>();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const tags = await readTags(file);
    const dir = directoryOf(file);
    const albumTag = tags.album?.trim() ?? "";
    const groupArtist = (tags.albumArtist || tags.artist || "").trim();

    const key = albumTag
      ? `alb:${groupArtist.toLowerCase()}|${albumTag.toLowerCase()}`
      : dir
        ? `dir:${dir.toLowerCase()}`
        : "loose:";

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        artist: groupArtist || tags.artist?.trim() || dir || FALLBACK_ARTIST,
        title: albumTag || dir || "",
        year: tags.year ?? "",
        tracks: [],
        artwork: null,
      };
      groups.set(key, group);
    }
    if (!group.year && tags.year) group.year = tags.year;
    if (!group.artwork && tags.artwork) group.artwork = tags.artwork;
    if (group.artist === FALLBACK_ARTIST && tags.artist) group.artist = tags.artist.trim();

    group.tracks.push({
      file,
      title: tags.title?.trim() || titleFromFilename(file.name),
      disc: tags.disc && tags.disc > 0 ? tags.disc : 1,
      track: tags.track && tags.track > 0 ? tags.track : 0,
      order: i,
    });
  }

  return [...groups.values()].map((group) => {
    const tracks = orderTracks(group.tracks);
    const title =
      group.title ||
      (tracks.length === 1 ? tracks[0].title : "") ||
      directoryOf(tracks[0].file) ||
      FALLBACK_TITLE;
    return { ...group, tracks, title };
  });
}

export function signatureOf(m: AlbumMeasurement, inkA: Ink, inkB: Ink): AlbumSignature {
  return {
    loudness: norm(m.loudnessDb, "loudness"),
    dynamics: norm(m.dynamicsDb, "dynamics"),
    brightness: norm(m.brightnessHz, "brightness", true),
    duration: norm(m.durationS, "duration"),
    pulse: norm(m.pulse, "pulse"),
    measured: {
      loudnessDb: m.loudnessDb,
      dynamicsDb: m.dynamicsDb,
      brightnessHz: m.brightnessHz,
      rolloffHz: m.rolloffHz,
      bassRatio: m.bassRatio,
      pulse: m.pulse,
      durationS: m.durationS,
    },
    spans: m.spans,
    trackBrightness: m.trackBrightnessHz.map((hz) => norm(hz, "brightness", true)),
    trackPulse: m.trackPulse.map((v) => norm(v, "pulse")),
    envelope: encodeEnvelope(m.envelopeBytes),
    reference: m.reference,
    inkA,
    inkB,
  };
}

export const LOCAL_LICENSE: License = {
  name: "Arquivo local",
  url: "",
  source: "",
  attribution: "A file from your device. Nothing was sent to any server.",
  redistributable: false,
  cover: { license: "From the file itself" },
  verifiedAt: "",
  changes: [],
};

export interface AssembleInput {
  id: string;
  cat: string;
  draft: LocalGroupDraft;
  durations: number[];
  urls: string[];
  cover: string;
  signature: AlbumSignature;
}

export function assembleAlbum(input: AssembleInput): Album & { signature: AlbumSignature } {
  const tracks: Track[] = input.draft.tracks.map((t, i) => ({
    id: `${input.id}/${i}`,
    title: t.title,
    dur: input.durations[i],
    source: { kind: "file", url: input.urls[i], name: t.file.name },
  }));

  return {
    id: input.id,
    provider: "local",
    artist: input.draft.artist || FALLBACK_ARTIST,
    title: input.draft.title || FALLBACK_TITLE,
    year: input.draft.year,
    cat: input.cat,
    cover: input.cover,
    inkA: input.signature.inkA ?? [0.5, 0.5, 0.5],
    inkB: input.signature.inkB ?? [0.5, 0.5, 0.5],
    license: LOCAL_LICENSE,
    tracks,
    signature: input.signature,
  };
}

export const isAudioFile = (file: File) =>
  file.type.startsWith("audio/") || extensionOf(file.name).length > 0;
