import { describe, expect, it } from "vitest";
import { CURATION } from "../content/curation.generated";
import { SIGNATURES } from "../content/signature.generated";
import { LOOKAHEAD_S, leadOf } from "../audio/anticipation";
import { NEUTRAL_SIGNATURE } from "../content/signature";
import { encodeEnvelope, signature } from "./fixtures";

const rise = Array.from({ length: 512 }, (_, i) => Math.round((i / 511) * 255));
const ramp = signature(0.5, 0.5, 0.5, 0.5, [], encodeEnvelope(rise));

describe("leadOf — the field reads ahead", () => {
  it("on a rising passage, the signal is positive", () => {
    expect(leadOf(ramp, 0.1, 100, 20)).toBeGreaterThan(0);
  });

  it("on a falling passage, the signal is negative", () => {
    const fall = signature(0.5, 0.5, 0.5, 0.5, [], encodeEnvelope([...rise].reverse()));
    expect(leadOf(fall, 0.1, 100, 20)).toBeLessThan(0);
  });

  it("with no measured envelope, it anticipates nothing", () => {
    expect(leadOf(NEUTRAL_SIGNATURE, 0.3, 2400)).toBe(0);
  });

  it("with no known duration, it anticipates nothing", () => {
    expect(leadOf(ramp, 0.3, 0)).toBe(0);
    expect(leadOf(ramp, 0.3, NaN)).toBe(0);
  });

  it("at the end of the record there is nothing to anticipate", () => {
    expect(leadOf(ramp, 1, 100, 20)).toBe(0);
  });

  it("a wider horizon sees further", () => {
    expect(Math.abs(leadOf(ramp, 0.1, 100, 40))).toBeGreaterThan(
      Math.abs(leadOf(ramp, 0.1, 100, 10)),
    );
  });

  it("always stays within [-1, 1] across the catalogue", () => {
    for (const album of CURATION) {
      const sig = SIGNATURES[album.id];
      for (let i = 0; i <= 200; i++) {
        const v = leadOf(sig, i / 200, sig.measured.durationS, LOOKAHEAD_S);
        expect(Math.abs(v), album.id).toBeLessThanOrEqual(1);
      }
    }
  });

  it("every record in the catalogue has enough structure for the signal to exist", () => {
    for (const album of CURATION) {
      const sig = SIGNATURES[album.id];
      let larger = 0;
      for (let i = 0; i <= 500; i++) {
        larger = Math.max(larger, Math.abs(leadOf(sig, i / 500, sig.measured.durationS)));
      }
      expect(larger, album.id).toBeGreaterThan(0.1);
    }
  });
});
