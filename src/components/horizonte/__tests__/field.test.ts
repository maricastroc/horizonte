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

const CONTRATO = {
  "tristan-lohengrin-le-manoir": {
    peso: 551, lente: 0.92, horizonte: 0.97, teto: 0.086,
    envelope: 0.153, achatamento: 0.632, rim: 4.09, nav: 6.02,
    setores: [11, 14.5, 65.3],
  },
  "jono-terbakar-lebar": {
    peso: 617, lente: 0.97, horizonte: 1.0, teto: 0.186,
    envelope: 0.3, achatamento: 0.62, rim: 3.79, nav: 5.89,
    setores: [9, 24.1, 57.7],
  },
  "le-morte-dabby-0p": {
    peso: 725, lente: 1.07, horizonte: 1.05, teto: 0.08,
    envelope: 0.144, achatamento: 0.642, rim: 4.34, nav: 5.44,
    setores: [7, 37.6, 77.1],
  },
  "mark-wilson-x-dark-thoughts": {
    peso: 679, lente: 1.02, horizonte: 1.03, teto: 0.123,
    envelope: 0.207, achatamento: 0.623, rim: 3.88, nav: 5.82,
    setores: [10, 22.6, 49.9],
  },
  "darin-wilson-impromptu": {
    peso: 678, lente: 1.01, horizonte: 1.03, teto: 0.11,
    envelope: 0.188, achatamento: 0.636, rim: 4.19, nav: 5.89,
    setores: [5, 61.6, 81.9],
  },
  "zero-project-e-world": {
    peso: 704, lente: 1.09, horizonte: 1.04, teto: 0.109,
    envelope: 0.187, achatamento: 0.654, rim: 4.62, nav: 4.68,
    setores: [16, 11.0, 39.5],
  },
  "tale-twist-wry-way": {
    peso: 712, lente: 1.04, horizonte: 1.04, teto: 0.066,
    envelope: 0.124, achatamento: 0.653, rim: 4.59, nav: 5.79,
    setores: [8, 30.0, 63.4],
  },
  "madison-kenny-all-systems-go": {
    peso: 748, lente: 1.05, horizonte: 1.06, teto: 0.053,
    envelope: 0.104, achatamento: 0.67, rim: 5.0, nav: 6.17,
    setores: [4, 78.9, 98.4],
  },
  "meho-mkultra": {
    peso: 678, lente: 1.06, horizonte: 1.03, teto: 0.096,
    envelope: 0.168, achatamento: 0.589, rim: 3.05, nav: 4.92,
    setores: [6, 31.2, 87.7],
  },
  "mescaline-sessions-jajce": {
    peso: 663, lente: 1.01, horizonte: 1.02, teto: 0.089,
    envelope: 0.157, achatamento: 0.599, rim: 3.3, nav: 5.73,
    setores: [4, 36.7, 129.3],
  },
} as const;

const round = (v: number, casas: number) => Number(v.toFixed(casas));

describe("assinatura → constantes do álbum", () => {
  it("todo álbum do acervo tem contrato publicado no mapa sensorial", () => {
    const semContrato = CURATION.filter((a) => !(a.id in CONTRATO)).map((a) => a.id);
    expect(semContrato).toEqual([]);
  });

  for (const album of CURATION.filter((a) => a.id in CONTRATO)) {
    const esperado = CONTRATO[album.id as keyof typeof CONTRATO];

    it(`${album.title} deriva as constantes publicadas`, () => {
      const c = fieldConstantsOf(SIGNATURES[album.id]);
      expect({
        peso: c.artistWeight,
        lente: round(c.massScale, 2),
        horizonte: round(c.horizonScale, 2),
        teto: round(c.reactionCap, 3),
        envelope: round(c.envelopeDepth, 3),
        achatamento: round(c.flatten, 3),
        rim: round(c.rimHardness, 2),
        nav: round(c.navLerp, 2),
      }).toEqual({
        peso: esperado.peso,
        lente: esperado.lente,
        horizonte: esperado.horizonte,
        teto: esperado.teto,
        envelope: esperado.envelope,
        achatamento: esperado.achatamento,
        rim: esperado.rim,
        nav: esperado.nav,
      });
    });

    it(`${album.title} setoriza o anel pelas durações reais (P9)`, () => {
      const [faixas, menor, maior] = esperado.setores;
      const bounds = boundsOf(SIGNATURES[album.id], album.tracks.length);
      const graus = bounds.slice(1).map((b, k) => (b - bounds[k]) * 360);

      expect(album.tracks.length).toBe(faixas);
      expect(round(Math.min(...graus), 1)).toBe(menor);
      expect(round(Math.max(...graus), 1)).toBe(maior);
    });
  }
});

describe("guardrails do mapa sensorial", () => {
  const derivadas = CURATION.map((a) => fieldConstantsOf(SIGNATURES[a.id]));

  const dentroDoRange = (
    chave: keyof FieldConstants & keyof typeof RANGE,
  ) => {
    const [a, b] = RANGE[chave];
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    for (const c of derivadas) {
      expect(c[chave]).toBeGreaterThanOrEqual(lo);
      expect(c[chave]).toBeLessThanOrEqual(hi);
    }
  };

  it("nenhum álbum ultrapassa os limites declarados em RANGE", () => {
    (Object.keys(RANGE) as (keyof typeof RANGE)[]).forEach(dentroDoRange);
  });

  it("só All Systems Go satura contra uma âncora, e por 0,2 Hz", () => {
    const saturados = CURATION.flatMap((album) => {
      const sig = SIGNATURES[album.id];
      return (["loudness", "dynamics", "brightness", "duration"] as const)
        .filter((k) => sig[k] === 0 || sig[k] === 1)
        .map((k) => `${album.id}.${k}`);
    });
    expect(saturados).toEqual(["madison-kenny-all-systems-go.brightness"]);
  });

  it("prefers-reduced-motion zera a perturbação ao vivo (P4)", () => {
    for (const c of derivadas) {
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
    const amplitude = (f: (c: FieldConstants) => number, chave: keyof typeof RANGE) => {
      const vs = derivadas.map(f);
      const [a, b] = RANGE[chave];
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
    const brilhante = fieldConstantsOf(signature(0.5, 0.5, 1, 0.5));

    expect(brilhante.flatten).toBeGreaterThan(base.flatten);
    expect(brilhante.rimHardness).toBeGreaterThan(base.rimHardness);
    expect(brilhante.reactionCap).toBe(base.reactionCap);
    expect(brilhante.artistWeight).toBe(base.artistWeight);
    expect(brilhante.navLerp).toBe(base.navLerp);
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
