import { describe, expect, it } from "vitest";
import { CURATION } from "../content/curation.generated";
import { SIGNATURES } from "../content/signature.generated";
import {
  ENVELOPE_N,
  NEUTRAL_SIGNATURE,
  boundsOf,
  envelopeOf,
  sampleEnvelope,
} from "../content/signature";
import { encodeEnvelope, signature } from "./fixtures";

describe("boundsOf — ângulo é tempo (P9)", () => {
  it("devolve n+1 fronteiras fechando o círculo", () => {
    const b = boundsOf(signature(0.5, 0.5, 0.5, 0.5, [1, 2, 3]), 3);
    expect(b).toHaveLength(4);
    expect(b[0]).toBe(0);
    expect(b[3]).toBeCloseTo(1, 10);
  });

  it("é estritamente crescente", () => {
    const b = boundsOf(signature(0.5, 0.5, 0.5, 0.5, [3, 1, 4, 1, 5]), 5);
    for (let k = 1; k < b.length; k++) expect(b[k]).toBeGreaterThan(b[k - 1]);
  });

  it("dá a cada setor a fração da sua duração", () => {
    const b = boundsOf(signature(0.5, 0.5, 0.5, 0.5, [1, 3]), 2);
    expect(b[1] - b[0]).toBeCloseTo(0.25, 10);
    expect(b[2] - b[1]).toBeCloseTo(0.75, 10);
  });

  it("normaliza spans que não somam 1", () => {
    const b = boundsOf(signature(0.5, 0.5, 0.5, 0.5, [10, 30]), 2);
    expect(b[1]).toBeCloseTo(0.25, 10);
    expect(b[2]).toBeCloseTo(1, 10);
  });

  it("cai em setores uniformes quando os spans não batem com as faixas", () => {
    const b = boundsOf(signature(0.5, 0.5, 0.5, 0.5, [1, 2]), 4);
    expect(b).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it("cai em setores uniformes sem signature medida", () => {
    expect(boundsOf(NEUTRAL_SIGNATURE, 2)).toEqual([0, 0.5, 1]);
  });

  it("nenhum setor do acervo fica abaixo do mínimo clicável de 1,4°", () => {
    for (const album of CURATION) {
      const b = boundsOf(SIGNATURES[album.id], album.tracks.length);
      for (let k = 0; k < album.tracks.length; k++) {
        expect((b[k + 1] - b[k]) * 360).toBeGreaterThanOrEqual(1.4);
      }
    }
  });
});

describe("envelopeOf — forma é dinâmica no tempo (P10)", () => {
  it("decodifica para ENVELOPE_N amostras normalizadas", () => {
    const sig = signature(0.5, 0.5, 0.5, 0.5, [], encodeEnvelope([0, 128, 255]));
    const env = envelopeOf(sig);
    expect(env).toHaveLength(ENVELOPE_N);
    expect(env[0]).toBeCloseTo(0, 6);
    expect(env[1]).toBeCloseTo(128 / 255, 6);
    expect(env[2]).toBeCloseTo(1, 6);
  });

  it("estende a última amostra até o fim do buffer", () => {
    const env = envelopeOf(signature(0.5, 0.5, 0.5, 0.5, [], encodeEnvelope([10, 200])));
    expect(env[2]).toBeCloseTo(200 / 255, 6);
    expect(env[ENVELOPE_N - 1]).toBeCloseTo(200 / 255, 6);
  });

  it("sem envelope medido, entrega um ring de espessura constante", () => {
    const env = envelopeOf(NEUTRAL_SIGNATURE);
    expect([...env].every((v) => v === 0.5)).toBe(true);
  });

  it("memoiza por signature", () => {
    const sig = signature(0.5, 0.5, 0.5, 0.5, [], encodeEnvelope([1, 2, 3]));
    expect(envelopeOf(sig)).toBe(envelopeOf(sig));
  });

  it("todo o acervo decodifica dentro de [0,1]", () => {
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

  it("ancora t=0 e t=1 nas pontas do buffer", () => {
    expect(sampleEnvelope(env, 0)).toBeCloseTo(env[0], 6);
    expect(sampleEnvelope(env, 1)).toBeCloseTo(env[ENVELOPE_N - 1], 6);
  });

  it("interpola linearmente entre duas amostras", () => {
    const middle = 0.5 / (ENVELOPE_N - 1);
    expect(sampleEnvelope(env, middle)).toBeCloseTo(0.5, 6);
  });

  it("satura fora de [0,1] em vez de sair do buffer", () => {
    expect(sampleEnvelope(env, -5)).toBeCloseTo(env[0], 6);
    expect(sampleEnvelope(env, 5)).toBeCloseTo(env[ENVELOPE_N - 1], 6);
    expect(Number.isNaN(sampleEnvelope(env, 5))).toBe(false);
  });
});
