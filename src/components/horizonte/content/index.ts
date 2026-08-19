import { CURATION } from "./curation.generated";
import { SIGNATURES } from "./signature.generated";
import { NEUTRAL_SIGNATURE, type AlbumSignature } from "./signature";
import type { Album } from "./types";

export interface AlbumWithSignature extends Album {
  signature: AlbumSignature;
}

export type CuratedAlbumWithSignature = AlbumWithSignature;

const CURATED: AlbumWithSignature[] = CURATION.map((album) => {
  const signature = SIGNATURES[album.id] ?? NEUTRAL_SIGNATURE;
  return {
    ...album,
    signature,
    inkA: signature.inkA ?? album.inkA,
    inkB: signature.inkB ?? album.inkB,
  };
});

export const CURATED_COUNT = CURATED.length;

export const ALBUMS: AlbumWithSignature[] = [...CURATED];

const listeners = new Set<(index: number) => void>();

export function onCatalogChange(fn: (index: number) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function registerAlbum(album: AlbumWithSignature): number {
  const index = ALBUMS.length;
  ALBUMS.push(album);
  listeners.forEach((fn) => fn(index));
  return index;
}

export const localCount = () => ALBUMS.length - CURATED_COUNT;

export const nextLocalCat = () => `L—${String(localCount() + 1).padStart(3, "0")}`;

export function resetCatalog() {
  ALBUMS.length = 0;
  ALBUMS.push(...CURATED);
  listeners.forEach((fn) => fn(-1));
}

export { CURATION, SIGNATURES };
export {
  NEUTRAL_BIAS,
  NEUTRAL_SIGNATURE,
  boundsOf,
  envelopeOf,
  sampleEnvelope,
  trackBiasOf,
} from "./signature";
export type { AlbumSignature, TrackBias } from "./signature";
export type { Album, Track, AudioSource, License, ProviderId, Ink } from "./types";
