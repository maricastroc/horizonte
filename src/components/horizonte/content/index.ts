import { CURATION } from "./curation.generated";
import { SIGNATURES } from "./signature.generated";
import { NEUTRAL_SIGNATURE, type AlbumSignature } from "./signature";
import type { Album } from "./types";

export interface AlbumWithSignature extends Album {
  signature: AlbumSignature;
}

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

export const OPENING_ID = "zero-project-e-world";

export const OPENING = Math.max(0, CURATED.findIndex((a) => a.id === OPENING_ID));

export const ALBUMS: AlbumWithSignature[] = [...CURATED];

const listeners = new Set<(index: number) => void>();

export function onCatalogChange(fn: (index: number) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let unnamedAs: { artist: string; title: string } | null = null;

function nameAlbum(album: Album) {
  if (!unnamedAs || !album.unnamed) return;
  for (const field of album.unnamed) album[field] = unnamedAs[field];
}

export function nameUnnamed(names: { artist: string; title: string }) {
  unnamedAs = names;
  ALBUMS.forEach(nameAlbum);
}

export function registerAlbum(album: AlbumWithSignature): number {
  const index = ALBUMS.length;
  nameAlbum(album);
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
  chargeAt,
  chargeOf,
  chargeWindowOf,
  envelopeOf,
  sampleEnvelope,
  trackBiasOf,
} from "./signature";
export type { AlbumSignature, ChargeWindow, TrackBias } from "./signature";
export type { Album, Track, AudioSource, License, ProviderId, Ink } from "./types";
