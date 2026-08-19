import { CURATION } from "./curation.generated";
import { SIGNATURES } from "./signature.generated";
import { NEUTRAL_SIGNATURE, type AlbumSignature } from "./signature";
import type { Album } from "./types";

export interface CuratedAlbumWithSignature extends Album {
  signature: AlbumSignature;
}

export const ALBUMS: CuratedAlbumWithSignature[] = CURATION.map((album) => {
  const signature = SIGNATURES[album.id] ?? NEUTRAL_SIGNATURE;
  return {
    ...album,
    signature,
    inkA: signature.inkA ?? album.inkA,
    inkB: signature.inkB ?? album.inkB,
  };
});

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
