import { CURATION } from "./curation.generated";
import type { Album, Track } from "./types";

export const ALBUMS: Album[] = CURATION;

export { CURATION };
export type { Album, Track, AudioSource, License, ProviderId, Ink } from "./types";

export const trackAt = (alb: number, trk: number): Track | undefined =>
  ALBUMS[alb]?.tracks[trk];
