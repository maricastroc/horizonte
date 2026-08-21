import { describe, expect, it } from "vitest";
import { CURATION } from "../content/curation.generated";
import { SIGNATURES } from "../content/signature.generated";
import {
  ENVELOPE_N,
  NEUTRAL_SIGNATURE,
  boundsOf,
  envelopeOf,
  sampleEnvelope,
  trackBiasOf,
  type AlbumSignature,
} from "../content/signature";
import { encodeEnvelope, signature } from "./fixtures";

describe("boundsOf — angle is time (P9)", () => {
  it("returns n+1 boundaries closing the circle", () => {
    const b = boundsOf(signature(0.5, 0.5, 0.5, 0.5, [1, 2, 3]), 3);
    expect(b).toHaveLength(4);
    expect(b[0]).toBe(0);
    expect(b[3]).toBeCloseTo(1, 10);
  });

  it("is strictly increasing", () => {
    const b = boundsOf(signature(0.5, 0.5, 0.5, 0.5, [3, 1, 4, 1, 5]), 5);
    for (let k = 1; k < b.length; k++) expect(b[k]).toBeGreaterThan(b[k - 1]);
  });

  it("gives each sector the fraction of its duration", () => {
    const b = boundsOf(signature(0.5, 0.5, 0.5, 0.5, [1, 3]), 2);
    expect(b[1] - b[0]).toBeCloseTo(0.25, 10);
    expect(b[2] - b[1]).toBeCloseTo(0.75, 10);
  });

  it("normalizes spans that do not sum to 1", () => {
    const b = boundsOf(signature(0.5, 0.5, 0.5, 0.5, [10, 30]), 2);
    expect(b[1]).toBeCloseTo(0.25, 10);
    expect(b[2]).toBeCloseTo(1, 10);
  });

  it("falls back to uniform sectors when the spans do not match the tracks", () => {
    const b = boundsOf(signature(0.5, 0.5, 0.5, 0.5, [1, 2]), 4);
    expect(b).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it("falls back to uniform sectors with no measured signature", () => {
    expect(boundsOf(NEUTRAL_SIGNATURE, 2)).toEqual([0, 0.5, 1]);
  });

  it("no sector in the catalogue falls below the 1.4° clickable minimum", () => {
    for (const album of CURATION) {
      const b = boundsOf(SIGNATURES[album.id], album.tracks.length);
      for (let k = 0; k < album.tracks.length; k++) {
        expect((b[k + 1] - b[k]) * 360).toBeGreaterThanOrEqual(1.4);
      }
    }
  });
});

describe("envelopeOf — shape is dynamics over time (P10)", () => {
  it("decodes to ENVELOPE_N normalized samples", () => {
    const sig = signature(0.5, 0.5, 0.5, 0.5, [], encodeEnvelope([0, 128, 255]));
    const env = envelopeOf(sig);
    expect(env).toHaveLength(ENVELOPE_N);
    expect(env[0]).toBeCloseTo(0, 6);
    expect(env[1]).toBeCloseTo(128 / 255, 6);
    expect(env[2]).toBeCloseTo(1, 6);
  });

  it("extends the last sample to the end of the buffer", () => {
    const env = envelopeOf(signature(0.5, 0.5, 0.5, 0.5, [], encodeEnvelope([10, 200])));
    expect(env[2]).toBeCloseTo(200 / 255, 6);
    expect(env[ENVELOPE_N - 1]).toBeCloseTo(200 / 255, 6);
  });

  it("with no measured envelope, it delivers a ring of constant thickness", () => {
    const env = envelopeOf(NEUTRAL_SIGNATURE);
    expect([...env].every((v) => v === 0.5)).toBe(true);
  });

  it("memoizes by signature", () => {
    const sig = signature(0.5, 0.5, 0.5, 0.5, [], encodeEnvelope([1, 2, 3]));
    expect(envelopeOf(sig)).toBe(envelopeOf(sig));
  });

  it("the whole catalogue decodes inside [0,1]", () => {
    for (const album of CURATION) {
      const env = envelopeOf(SIGNATURES[album.id]);
      expect(env).toHaveLength(ENVELOPE_N);
      for (const v of env) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("sampleEnvelope", () => {
  const env = envelopeOf(
    signature(0.5, 0.5, 0.5, 0.5, [], encodeEnvelope([0, 255, 0, 255])),
  );

  it("anchors t=0 and t=1 at the buffer's ends", () => {
    expect(sampleEnvelope(env, 0)).toBeCloseTo(env[0], 6);
    expect(sampleEnvelope(env, 1)).toBeCloseTo(env[ENVELOPE_N - 1], 6);
  });

  it("interpolates linearly between two samples", () => {
    const middle = 0.5 / (ENVELOPE_N - 1);
    expect(sampleEnvelope(env, middle)).toBeCloseTo(0.5, 6);
  });

  it("saturates outside [0,1] instead of leaving the buffer", () => {
    expect(sampleEnvelope(env, -5)).toBeCloseTo(env[0], 6);
    expect(sampleEnvelope(env, 5)).toBeCloseTo(env[ENVELOPE_N - 1], 6);
    expect(Number.isNaN(sampleEnvelope(env, 5))).toBe(false);
  });
});

describe("trackBiasOf — the track shifts the record (P11)", () => {
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

  it("with no measured envelope, no track shifts", () => {
    const bias = trackBiasOf(NEUTRAL_SIGNATURE, 4);
    expect(bias).toHaveLength(4);
    for (const b of bias) {
      expect(b.loudness).toBe(0);
      expect(b.dynamics).toBe(0);
    }
  });

  it("returns a per-track bias and is deterministic", () => {
    const sig = SIGNATURES["tristan-lohengrin-le-manoir"];
    const n = CURATION[0].tracks.length;
    const a = trackBiasOf(sig, n);
    const b = trackBiasOf(sig, n);
    expect(a).toHaveLength(n);
    expect(b).toEqual(a);
  });

  it("no bias in the catalogue exceeds the ±0.25 ceiling", () => {
    for (const album of CURATION) {
      for (const b of trackBiasOf(SIGNATURES[album.id], album.tracks.length)) {
        expect(Math.abs(b.loudness), album.id).toBeLessThanOrEqual(0.25);
        expect(Math.abs(b.dynamics), album.id).toBeLessThanOrEqual(0.25);
      }
    }
  });

  it("the album remains the anchor: the duration-weighted mean bias is zero", () => {
    for (const album of CURATION) {
      const n = album.tracks.length;
      const sig = SIGNATURES[album.id];
      const bounds = boundsOf(sig, n);
      const bias = trackBiasOf(sig, n);
      let mean = 0;
      for (let k = 0; k < n; k++) mean += bias[k].loudness * (bounds[k + 1] - bounds[k]);
      expect(Math.abs(mean), album.id).toBeLessThan(0.02);
    }
  });

  it("a heterogeneous record spreads more than a cohesive one", () => {
    const manoir = trackBiasOf(SIGNATURES["tristan-lohengrin-le-manoir"], 11);
    const impromptu = trackBiasOf(SIGNATURES["darin-wilson-impromptu"], 5);
    expect(spread(manoir.map((b) => b.loudness))).toBeGreaterThan(
      spread(impromptu.map((b) => b.loudness)),
    );
  });

  it("inside a record, the tracks are not all alike", () => {
    for (const album of CURATION) {
      const bias = trackBiasOf(SIGNATURES[album.id], album.tracks.length);
      if (album.tracks.length < 2) continue;
      expect(spread(bias.map((b) => b.loudness)), album.id).toBeGreaterThan(0.01);
    }
  });
});

describe("per-track brightness — the light breathes inside the record (P16)", () => {
  const withBrightness = (tb: number[] | undefined, spans: number[]) => {
    const s = signature(0.5, 0.5, 0.5, 0.5, spans, encodeEnvelope([0, 128, 255, 128]));
    return { ...s, trackBrightness: tb };
  };
  const iguais = (n: number) => new Array(n).fill(1 / n);

  it("with no per-track brightness published, the light does not move", () => {
    const s = withBrightness(undefined, iguais(4));
    for (const b of trackBiasOf(s, 4)) expect(b.brightness).toBe(0);
  });

  it("an array of the wrong length is ignored instead of misaligning the tracks", () => {
    const s = withBrightness([0.1, 0.9], iguais(4));
    for (const b of trackBiasOf(s, 4)) expect(b.brightness).toBe(0);
  });

  it("timbrally identical tracks produce no movement at all", () => {
    const s = withBrightness([0.6, 0.6, 0.6, 0.6], iguais(4));
    for (const b of trackBiasOf(s, 4)) expect(Math.abs(b.brightness)).toBeLessThan(1e-9);
  });

  it("a spread smaller than the measurement noise is muted by the gate", () => {
    const narrow = withBrightness([0.60, 0.61, 0.60, 0.61], iguais(4));
    const wide = withBrightness([0.30, 0.95, 0.35, 0.90], iguais(4));
    const amp = (s: AlbumSignature) => {
      const v = trackBiasOf(s, 4).map((b) => b.brightness);
      return Math.max(...v) - Math.min(...v);
    };
    expect(amp(narrow)).toBeLessThan(0.02);
    expect(amp(wide)).toBeGreaterThan(0.15);
  });

  it("the album remains the anchor: the duration-weighted mean bias is ~zero", () => {
    const spans = [0.4, 0.3, 0.2, 0.1];
    const s = withBrightness([0.2, 0.5, 0.7, 0.9], spans);
    const bias = trackBiasOf(s, 4);
    const media = bias.reduce((a, b, i) => a + b.brightness * spans[i], 0);
    expect(Math.abs(media)).toBeLessThan(0.02);
  });

  it("no track exceeds the declared ceiling", () => {
    const s = withBrightness([0, 1, 0, 1], iguais(4));
    for (const b of trackBiasOf(s, 4)) expect(Math.abs(b.brightness)).toBeLessThanOrEqual(0.12);
  });

  it("in the catalogue, heterogeneous records move the light and the uniform one does not", () => {
    const amp = (slug: string) => {
      const s = SIGNATURES[slug];
      const n = CURATION.find((a) => a.id === slug)!.tracks.length;
      const v = trackBiasOf(s, n).map((b) => b.brightness);
      return Math.max(...v) - Math.min(...v);
    };
    expect(amp("madison-kenny-all-systems-go")).toBeLessThan(0.02);
    expect(amp("le-morte-dabby-0p")).toBeGreaterThan(0.1);
  });

  it("every album in the catalogue publishes a per-track brightness aligned with its tracks", () => {
    for (const album of CURATION) {
      const s = SIGNATURES[album.id];
      expect(s.trackBrightness, album.id).toBeDefined();
      expect(s.trackBrightness!.length, album.id).toBe(album.tracks.length);
      for (const b of s.trackBrightness!) {
        expect(b, album.id).toBeGreaterThanOrEqual(0);
        expect(b, album.id).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("per-track pulse — the grid breathes inside the record (P17)", () => {
  const withPulse = (tp: number[] | undefined, spans: number[]) => {
    const s = signature(0.5, 0.5, 0.5, 0.5, spans, encodeEnvelope([0, 128, 255, 128]));
    return { ...s, trackPulse: tp };
  };
  const iguais = (n: number) => new Array(n).fill(1 / n);
  const amp = (s: AlbumSignature, n: number) => {
    const v = trackBiasOf(s, n).map((b) => b.pulse);
    return Math.max(...v) - Math.min(...v);
  };

  it("with no per-track pulse published, the spin does not move", () => {
    for (const b of trackBiasOf(withPulse(undefined, iguais(4)), 4)) expect(b.pulse).toBe(0);
  });

  it("an array of the wrong length is ignored", () => {
    for (const b of trackBiasOf(withPulse([0.1, 0.9], iguais(4)), 4)) expect(b.pulse).toBe(0);
  });

  it("tracks on the same grid produce no movement", () => {
    for (const b of trackBiasOf(withPulse([0.6, 0.6, 0.6, 0.6], iguais(4)), 4)) {
      expect(Math.abs(b.pulse)).toBeLessThan(1e-9);
    }
  });

  it("the pulse gate is narrower than the timbre one — it is noisier", () => {
    const spans = iguais(4);
    const base = signature(0.5, 0.5, 0.5, 0.5, spans, encodeEnvelope([0, 128, 255, 128]));
    const narrow = [0.50, 0.55, 0.50, 0.60];
    const withTimbre = { ...base, trackBrightness: narrow };
    const withGrid = { ...base, trackPulse: narrow };

    const ampT = (() => {
      const v = trackBiasOf(withTimbre, 4).map((b) => b.brightness);
      return Math.max(...v) - Math.min(...v);
    })();
    expect(ampT).toBeGreaterThan(0.02);
    expect(amp(withGrid, 4)).toBeLessThan(0.005);
  });

  it("a wide spread genuinely moves the grid", () => {
    expect(amp(withPulse([0.05, 0.95, 0.10, 0.90], iguais(4)), 4)).toBeGreaterThan(0.15);
  });

  it("the album remains the anchor: the duration-weighted mean bias is ~zero", () => {
    const spans = [0.4, 0.3, 0.2, 0.1];
    const s = withPulse([0.1, 0.4, 0.7, 0.95], spans);
    const media = trackBiasOf(s, 4).reduce((a, b, i) => a + b.pulse * spans[i], 0);
    expect(Math.abs(media)).toBeLessThan(0.02);
  });

  it("no track exceeds the declared ceiling", () => {
    for (const b of trackBiasOf(withPulse([0, 1, 0, 1], iguais(4)), 4)) {
      expect(Math.abs(b.pulse)).toBeLessThanOrEqual(0.12);
    }
  });

  it("the ceiling is soft: diverging a lot and a little do not give the same shift", () => {
    const s = withPulse([0.5, 0.6, 0.9, 1.0], iguais(4));
    const v = trackBiasOf(s, 4).map((b) => b.pulse);

    expect(v[3]).toBeGreaterThan(v[2]);
    expect(v[0]).toBeLessThan(v[1]);
    expect(new Set(v.map((x) => x.toFixed(4))).size).toBe(4);
    for (const x of v) expect(Math.abs(x)).toBeLessThan(0.12);
  });

  it("in the catalogue, the order between tracks survives the ceiling", () => {
    for (const album of CURATION) {
      const s = SIGNATURES[album.id];
      const tp = s.trackPulse;
      if (!tp) continue;
      const bias = trackBiasOf(s, album.tracks.length).map((b) => b.pulse);
      const order = tp.map((v, i) => ({ v, b: bias[i] })).sort((x, y) => x.v - y.v);
      for (let i = 1; i < order.length; i++) {
        expect(order[i].b, `${album.id} track ${i}`).toBeGreaterThanOrEqual(order[i - 1].b - 1e-9);
      }
    }
  });

  it("in the catalogue, the most grid-uniform record barely moves", () => {
    const ampOf = (slug: string) => {
      const n = CURATION.find((a) => a.id === slug)!.tracks.length;
      return amp(SIGNATURES[slug], n);
    };
    expect(ampOf("jono-terbakar-lebar")).toBeLessThan(0.05);
    expect(ampOf("mark-wilson-x-dark-thoughts")).toBeGreaterThan(0.15);
  });

  it("every album publishes a per-track pulse aligned with its tracks", () => {
    for (const album of CURATION) {
      const s = SIGNATURES[album.id];
      expect(s.trackPulse, album.id).toBeDefined();
      expect(s.trackPulse!.length, album.id).toBe(album.tracks.length);
      for (const v of s.trackPulse!) {
        expect(v, album.id).toBeGreaterThanOrEqual(0);
        expect(v, album.id).toBeLessThanOrEqual(1);
      }
    }
  });
});
