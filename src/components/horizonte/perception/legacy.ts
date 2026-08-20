import type { AlbumSignature } from "../content/signature";
import { lerp } from "../math";
import type { AlbumMorphology } from "../morphology";
import { RING } from "../tokens";

const LEGACY_CORE_AT_STAGE = 0.096 * 900;
const LEGACY_BASE_AT_STAGE = 0.305 * 900;
const LEGACY_BAND = (RING.Rout - RING.Rin) / RING.Rout;

export function legacyMorphologyOf(sig: AlbumSignature): AlbumMorphology {
  const horizonScale = lerp(0.95, 1.07, sig.loudness);
  const coreRatio = (LEGACY_CORE_AT_STAGE * horizonScale) / LEGACY_BASE_AT_STAGE;
  const bandRatio = LEGACY_BAND;
  return {
    bounds: [0, 1],
    plate: [1],
    circuit: 1,
    flatten: lerp(0.57, 0.67, sig.brightness),
    coreRatio,
    bandRatio,
    relief: 0,
    strata: 0,
    eccX: 0,
    eccY: 0,
    fragment: 0.0075,
    spread: 0,
    satellites: [],
    lobeCos: [],
    lobeSin: [],
    rMin: Math.max(coreRatio * 1.06, 1 - bandRatio),
    rMax: 1,
  };
}
