import { envelopeOf, sampleEnvelope, type AlbumSignature } from "../content/signature";
import { clamp } from "../math";

export const LOOKAHEAD_S = 6;

export function leadOf(
  sig: AlbumSignature,
  albumPos: number,
  albumSeconds: number,
  lookaheadSeconds = LOOKAHEAD_S,
): number {
  if (!(albumSeconds > 0)) return 0;
  const env = envelopeOf(sig);
  const now = clamp(albumPos, 0, 1);
  const ahead = clamp(now + lookaheadSeconds / albumSeconds, 0, 1);
  return sampleEnvelope(env, ahead) - sampleEnvelope(env, now);
}
