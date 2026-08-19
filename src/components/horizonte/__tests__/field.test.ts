import { describe, expect, it } from "vitest";
import { boundsOf } from "../content/signature";
import { CURATION } from "../content/curation.generated";
import { SIGNATURES } from "../content/signature.generated";
import {
  RANGE,
  fieldConstantsOf,
  heftOf,
  mixConstants,
  reduceMotion,
  type FieldConstants,
} from "../field";
import { signature } from "./fixtures";

const CONTRACT = {
  "tristan-lohengrin-le-manoir": {
    weight: 551, lens: 0.92, horizonte: 0.97, cap: 0.086,
    envelope: 0.153, flatten: 0.632, rim: 4.09, nav: 6.02,
    sectors: [11, 14.5, 65.3],
  },
  "jono-terbakar-lebar": {
    weight: 617, lens: 0.97, horizonte: 1.0, cap: 0.186,
    envelope: 0.3, flatten: 0.62, rim: 3.79, nav: 5.89,
    sectors: [9, 24.1, 57.7],
  },
  "le-morte-dabby-0p": {
    weight: 725, lens: 1.07, horizonte: 1.05, cap: 0.08,
    envelope: 0.144, flatten: 0.642, rim: 4.34, nav: 5.44,
    sectors: [7, 37.6, 77.1],
  },
  "mark-wilson-x-dark-thoughts": {
    weight: 679, lens: 1.02, horizonte: 1.03, cap: 0.123,
    envelope: 0.207, flatten: 0.623, rim: 3.88, nav: 5.82,
    sectors: [10, 22.6, 49.9],
  },
  "darin-wilson-impromptu": {
    weight: 678, lens: 1.01, horizonte: 1.03, cap: 0.11,
    envelope: 0.188, flatten: 0.636, rim: 4.19, nav: 5.89,
    sectors: [5, 61.6, 81.9],
  },
  "zero-project-e-world": {
    weight: 704, lens: 1.09, horizonte: 1.04, cap: 0.109,
    envelope: 0.187, flatten: 0.654, rim: 4.62, nav: 4.68,
    sectors: [16, 11.0, 39.5],
  },
  "tale-twist-wry-way": {
    weight: 712, lens: 1.04, horizonte: 1.04, cap: 0.066,
    envelope: 0.124, flatten: 0.653, rim: 4.59, nav: 5.79,
    sectors: [8, 30.0, 63.4],
  },
  "madison-kenny-all-systems-go": {
    weight: 748, lens: 1.05, horizonte: 1.06, cap: 0.053,
    envelope: 0.104, flatten: 0.67, rim: 5.0, nav: 6.17,
    sectors: [4, 78.9, 98.4],
  },
  "meho-mkultra": {
    weight: 678, lens: 1.06, horizonte: 1.03, cap: 0.096,
    envelope: 0.168, flatten: 0.589, rim: 3.05, nav: 4.92,
    sectors: [6, 31.2, 87.7],
  },
  "mescaline-sessions-jajce": {
    weight: 663, lens: 1.01, horizonte: 1.02, cap: 0.089,
    envelope: 0.157, flatten: 0.599, rim: 3.3, nav: 5.73,
    sectors: [4, 36.7, 129.3],
  },
} as const;

const round = (v: number, decimals: number) => Number(v.toFixed(decimals));

describe("signature → constantes do álbum", () => {
  it("todo álbum do acervo tem contrato publicado no mapa sensorial", () => {
    const withoutContract = CURATION.filter((a) => !(a.id in CONTRACT)).map((a) => a.id);
    expect(withoutContract).toEqual([]);
  });

  for (const album of CURATION.filter((a) => a.id in CONTRACT)) {
    const expected = CONTRACT[album.id as keyof typeof CONTRACT];

    it(`${album.title} deriva as constantes publicadas`, () => {
      const c = fieldConstantsOf(SIGNATURES[album.id]);
      expect({
        weight: c.artistWeight,
        lens: round(c.massScale, 2),
        horizonte: round(c.horizonScale, 2),
        cap: round(c.reactionCap, 3),
        envelope: round(c.envelopeDepth, 3),
        flatten: round(c.flatten, 3),
        rim: round(c.rimHardness, 2),
        nav: round(c.navLerp, 2),
      }).toEqual({
        weight: expected.weight,
        lens: expected.lens,
        horizonte: expected.horizonte,
        cap: expected.cap,
        envelope: expected.envelope,
        flatten: expected.flatten,
        rim: expected.rim,
        nav: expected.nav,
      });
    });

    it(`${album.title} setoriza o ring pelas durações reais (P9)`, () => {
      const [tracks, smaller, greater] = expected.sectors;
      const bounds = boundsOf(SIGNATURES[album.id], album.tracks.length);
      const degrees = bounds.slice(1).map((b, k) => (b - bounds[k]) * 360);

      expect(album.tracks.length).toBe(tracks);
      expect(round(Math.min(...degrees), 1)).toBe(smaller);
      expect(round(Math.max(...degrees), 1)).toBe(greater);
    });
  }
});

describe("guardrails do mapa sensorial", () => {
  const derived = CURATION.map((a) => fieldConstantsOf(SIGNATURES[a.id]));

  const inRange = (
    key: keyof FieldConstants & keyof typeof RANGE,
  ) => {
    const [a, b] = RANGE[key];
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    for (const c of derived) {
      expect(c[key]).toBeGreaterThanOrEqual(lo);
      expect(c[key]).toBeLessThanOrEqual(hi);
    }
  };

  it("nenhum álbum ultrapassa os limites declarados em RANGE", () => {
    (Object.keys(RANGE) as (keyof typeof RANGE)[]).forEach(inRange);
  });

  it("só All Systems Go satura contra uma âncora, e por 0,2 Hz", () => {
    const saturatedList = CURATION.flatMap((album) => {
      const sig = SIGNATURES[album.id];
      return (["loudness", "dynamics", "brightness", "duration"] as const)
        .filter((k) => sig[k] === 0 || sig[k] === 1)
        .map((k) => `${album.id}.${k}`);
    });
    expect(saturatedList).toEqual(["madison-kenny-all-systems-go.brightness"]);
  });

  it("prefers-reduced-motion zera a perturbação ao vivo (P4)", () => {
    for (const c of derived) {
      const r = reduceMotion(c);
      expect(r.reactionCap).toBe(0);
      expect(r.navLerp).toBe(RANGE.navLerp[0]);
      expect(Math.abs(r.massScale - 1)).toBeCloseTo(Math.abs(c.massScale - 1) * 0.25, 10);
      expect(r.artistWeight).toBe(c.artistWeight);
      expect(r.flatten).toBe(c.flatten);
      expect(r.rimHardness).toBe(c.rimHardness);
      expect(r.envelopeDepth).toBe(c.envelopeDepth);
      expect(r.horizonScale).toBe(c.horizonScale);
    }
  });

  it("o acervo percorre os ranges de verdade, não em teoria", () => {
    const amplitude = (f: (c: FieldConstants) => number, key: keyof typeof RANGE) => {
      const vs = derived.map(f);
      const [a, b] = RANGE[key];
      return (Math.max(...vs) - Math.min(...vs)) / Math.abs(b - a);
    };

    expect(amplitude((c) => c.reactionCap, "reactionCap")).toBeGreaterThan(0.4);
    expect(amplitude((c) => c.artistWeight, "artistWeight")).toBeGreaterThan(0.4);
    expect(amplitude((c) => c.flatten, "flatten")).toBeGreaterThan(0.4);
  });
});

describe("fieldConstantsOf", () => {
  it("mapeia os extremos dos descritores nos extremos dos ranges", () => {
    const min = fieldConstantsOf(signature(0, 0, 0, 0));
    const max = fieldConstantsOf(signature(1, 1, 1, 1));

    expect(min.artistWeight).toBe(RANGE.artistWeight[0]);
    expect(max.artistWeight).toBe(RANGE.artistWeight[1]);
    expect(min.reactionCap).toBeCloseTo(RANGE.reactionCap[0], 10);
    expect(max.reactionCap).toBeCloseTo(RANGE.reactionCap[1], 10);
    expect(min.flatten).toBeCloseTo(RANGE.flatten[0], 10);
    expect(max.flatten).toBeCloseTo(RANGE.flatten[1], 10);
    expect(min.navLerp).toBeCloseTo(RANGE.navLerp[0], 10);
    expect(max.navLerp).toBeCloseTo(RANGE.navLerp[1], 10);
    expect(max.navLerp).toBeLessThan(min.navLerp);
  });

  it("o peso combina volume e duração na proporção 0,68/0,32 (P2)", () => {
    expect(heftOf(signature(1, 0, 0, 0))).toBeCloseTo(0.68, 10);
    expect(heftOf(signature(0, 0, 0, 1))).toBeCloseTo(0.32, 10);
    expect(heftOf(signature(1, 0, 0, 1))).toBeCloseTo(1, 10);
  });

  it("cada descritor move só os canais que lhe pertencem", () => {
    const base = fieldConstantsOf(signature(0.5, 0.5, 0.5, 0.5));
    const bright = fieldConstantsOf(signature(0.5, 0.5, 1, 0.5));

    expect(bright.flatten).toBeGreaterThan(base.flatten);
    expect(bright.rimHardness).toBeGreaterThan(base.rimHardness);
    expect(bright.reactionCap).toBe(base.reactionCap);
    expect(bright.artistWeight).toBe(base.artistWeight);
    expect(bright.navLerp).toBe(base.navLerp);
  });
});

describe("mixConstants", () => {
  const a = fieldConstantsOf(signature(0, 0, 0, 0));
  const b = fieldConstantsOf(signature(1, 1, 1, 1));

  it("devolve os extremos em t=0 e t=1", () => {
    expect(mixConstants(a, b, 0)).toEqual(a);
    expect(mixConstants(a, b, 1)).toEqual(b);
  });

  it("interpola linearmente no meio", () => {
    const m = mixConstants(a, b, 0.5);
    expect(m.massScale).toBeCloseTo((a.massScale + b.massScale) / 2, 10);
    expect(m.rimHardness).toBeCloseTo((a.rimHardness + b.rimHardness) / 2, 10);
  });

  it("satura fora de [0,1] em vez de extrapolar", () => {
    expect(mixConstants(a, b, -3)).toEqual(a);
    expect(mixConstants(a, b, 9)).toEqual(b);
  });
});
