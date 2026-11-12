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

export type IngestError =
  | { kind: "unsupported"; formats: string[] }
  | { kind: "empty" }
  | { kind: "unreadable"; file: string }
  | { kind: "tooLarge"; file: string; mb: number }
  | { kind: "tooLong"; file: string; minutes: number }
  | { kind: "recordTooLong" }
  | { kind: "failed" };

export class IngestFailure extends Error {
  constructor(public reason: IngestError) {
    super(reason.kind);
  }
}

export interface IngestStatus {
  phase: IngestPhase;
  progress: number;
  groupIndex: number;
  groupCount: number;
  artist: string;
  title: string;
  probe: IngestProbe | null;
  error: IngestError | null;
}
