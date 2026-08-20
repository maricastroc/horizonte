export type AudioSource =
  | { kind: "local"; src: string; mime?: string }
  | { kind: "file"; url: string; name: string };

export type ProviderId = "curated" | "local";

export interface CoverProvenance {
  license: string;
  url?: string;
  source?: string;
  credit?: string;
}

export interface License {
  name: string;
  url: string;
  source: string;
  attribution: string;
  redistributable: boolean;
  cover: CoverProvenance;
  verifiedAt: string;
  changes: string[];
}

export interface Track {
  id: string;
  title: string;
  dur: number;
  source: AudioSource;
}

export type Ink = [number, number, number];

export interface Album {
  id: string;
  provider: ProviderId;
  artist: string;
  title: string;
  year: string;
  cat: string;
  cover: string;
  inkA: Ink;
  inkB: Ink;
  license: License;
  label?: string;
  note?: string;
  tracks: Track[];
}
