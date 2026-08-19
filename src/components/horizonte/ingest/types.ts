import type { AlbumSignature } from "../content/signature";
import type { Album, Ink } from "../content/types";

export interface LocalTrackDraft {
  file: File;
  title: string;
  disc: number;
  track: number;
  order: number;
}

export interface LocalGroupDraft {
  key: string;
  artist: string;
  title: string;
  year: string;
  tracks: LocalTrackDraft[];
  artwork: Blob | null;
}

export interface TagData {
  title?: string;
  artist?: string;
  albumArtist?: string;
  album?: string;
  year?: string;
  disc?: number;
  track?: number;
  artwork?: Blob;
}

export type IngestPhase =
  | "reading"
  | "decoding"
  | "measuring"
  | "composing"
  | "done"
  | "failed"
  | "cancelled";

export interface IngestProbe {
  loudness: number;
  dynamics: number;
  brightness: number;
  duration: number;
}

export interface IngestStatus {
  phase: IngestPhase;
  progress: number;
  groupIndex: number;
  groupCount: number;
  artist: string;
  title: string;
  probe: IngestProbe | null;
  error: string | null;
}

export interface LocalAlbum extends Album {
  signature: AlbumSignature;
  inkA: Ink;
  inkB: Ink;
  objectUrls: string[];
}
