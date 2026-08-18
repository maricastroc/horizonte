export type { Track } from "../content/types";
export type { AlbumSignature } from "../content";
// O resto do motor conhece o álbum já enriquecido com a assinatura sensorial.
export type { CuratedAlbumWithSignature as Album } from "../content";
export { ALBUMS, trackAt, envelopeOf, sampleEnvelope, boundsOf } from "../content";
