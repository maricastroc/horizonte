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

describe("trackBiasOf — a faixa desloca o disco (P11)", () => {
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

  it("sem envelope medido, nenhuma faixa se desloca", () => {
    const bias = trackBiasOf(NEUTRAL_SIGNATURE, 4);
    expect(bias).toHaveLength(4);
    for (const b of bias) {
      expect(b.loudness).toBe(0);
      expect(b.dynamics).toBe(0);
    }
  });

  it("devolve um viés por faixa e é determinístico", () => {
    const sig = SIGNATURES["tristan-lohengrin-le-manoir"];
    const n = CURATION[0].tracks.length;
    const a = trackBiasOf(sig, n);
    const b = trackBiasOf(sig, n);
    expect(a).toHaveLength(n);
    expect(b).toEqual(a);
  });

  it("nenhum viés do acervo passa do teto de ±0,25", () => {
    for (const album of CURATION) {
      for (const b of trackBiasOf(SIGNATURES[album.id], album.tracks.length)) {
        expect(Math.abs(b.loudness), album.id).toBeLessThanOrEqual(0.25);
        expect(Math.abs(b.dynamics), album.id).toBeLessThanOrEqual(0.25);
      }
    }
  });

  it("o álbum continua sendo a âncora: o viés médio por duração é zero", () => {
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

  it("disco heterogêneo se espalha mais que disco coeso", () => {
    const manoir = trackBiasOf(SIGNATURES["tristan-lohengrin-le-manoir"], 11);
    const impromptu = trackBiasOf(SIGNATURES["darin-wilson-impromptu"], 5);
    expect(spread(manoir.map((b) => b.loudness))).toBeGreaterThan(
      spread(impromptu.map((b) => b.loudness)),
    );
  });

  it("dentro de um disco, as faixas não são todas iguais", () => {
    for (const album of CURATION) {
      const bias = trackBiasOf(SIGNATURES[album.id], album.tracks.length);
      if (album.tracks.length < 2) continue;
      expect(spread(bias.map((b) => b.loudness)), album.id).toBeGreaterThan(0.01);
    }
  });
});

describe("brilho por faixa — a luz respira dentro do disco (P16)", () => {
  const comBrilho = (tb: number[] | undefined, spans: number[]) => {
    const s = signature(0.5, 0.5, 0.5, 0.5, spans, encodeEnvelope([0, 128, 255, 128]));
    return { ...s, trackBrightness: tb };
  };
  const iguais = (n: number) => new Array(n).fill(1 / n);

  it("sem brilho por faixa publicado, a luz não se move", () => {
    const s = comBrilho(undefined, iguais(4));
    for (const b of trackBiasOf(s, 4)) expect(b.brightness).toBe(0);
  });

  it("um array de tamanho errado é ignorado em vez de desalinhar as faixas", () => {
    const s = comBrilho([0.1, 0.9], iguais(4));
    for (const b of trackBiasOf(s, 4)) expect(b.brightness).toBe(0);
  });

  it("faixas timbricamente iguais não produzem movimento nenhum", () => {
    const s = comBrilho([0.6, 0.6, 0.6, 0.6], iguais(4));
    for (const b of trackBiasOf(s, 4)) expect(Math.abs(b.brightness)).toBeLessThan(1e-9);
  });

  it("um espalhamento menor que o ruído de medição é abafado pelo portão", () => {
    const estreito = comBrilho([0.60, 0.61, 0.60, 0.61], iguais(4));
    const largo = comBrilho([0.30, 0.95, 0.35, 0.90], iguais(4));
    const amp = (s: AlbumSignature) => {
      const v = trackBiasOf(s, 4).map((b) => b.brightness);
      return Math.max(...v) - Math.min(...v);
    };
    expect(amp(estreito)).toBeLessThan(0.02);
    expect(amp(largo)).toBeGreaterThan(0.15);
  });

  it("o álbum continua sendo a âncora: o viés médio por duração é ~zero", () => {
    const spans = [0.4, 0.3, 0.2, 0.1];
    const s = comBrilho([0.2, 0.5, 0.7, 0.9], spans);
    const bias = trackBiasOf(s, 4);
    const media = bias.reduce((a, b, i) => a + b.brightness * spans[i], 0);
    expect(Math.abs(media)).toBeLessThan(0.02);
  });

  it("nenhuma faixa passa do teto declarado", () => {
    const s = comBrilho([0, 1, 0, 1], iguais(4));
    for (const b of trackBiasOf(s, 4)) expect(Math.abs(b.brightness)).toBeLessThanOrEqual(0.12);
  });

  it("no acervo, discos heterogêneos movem a luz e o disco uniforme não", () => {
    const amp = (slug: string) => {
      const s = SIGNATURES[slug];
      const n = CURATION.find((a) => a.id === slug)!.tracks.length;
      const v = trackBiasOf(s, n).map((b) => b.brightness);
      return Math.max(...v) - Math.min(...v);
    };
    expect(amp("madison-kenny-all-systems-go")).toBeLessThan(0.02);
    expect(amp("le-morte-dabby-0p")).toBeGreaterThan(0.1);
  });

  it("todo álbum do acervo publica um brilho por faixa alinhado com as faixas", () => {
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

describe("pulso por faixa — a grade respira dentro do disco (P17)", () => {
  const comPulso = (tp: number[] | undefined, spans: number[]) => {
    const s = signature(0.5, 0.5, 0.5, 0.5, spans, encodeEnvelope([0, 128, 255, 128]));
    return { ...s, trackPulse: tp };
  };
  const iguais = (n: number) => new Array(n).fill(1 / n);
  const amp = (s: AlbumSignature, n: number) => {
    const v = trackBiasOf(s, n).map((b) => b.pulse);
    return Math.max(...v) - Math.min(...v);
  };

  it("sem pulso por faixa publicado, o giro não se move", () => {
    for (const b of trackBiasOf(comPulso(undefined, iguais(4)), 4)) expect(b.pulse).toBe(0);
  });

  it("um array de tamanho errado é ignorado", () => {
    for (const b of trackBiasOf(comPulso([0.1, 0.9], iguais(4)), 4)) expect(b.pulse).toBe(0);
  });

  it("faixas com a mesma grade não produzem movimento", () => {
    for (const b of trackBiasOf(comPulso([0.6, 0.6, 0.6, 0.6], iguais(4)), 4)) {
      expect(Math.abs(b.pulse)).toBeLessThan(1e-9);
    }
  });

  it("o portão do pulso é mais estreito que o do timbre — ele é mais ruidoso", () => {
    const spans = iguais(4);
    const base = signature(0.5, 0.5, 0.5, 0.5, spans, encodeEnvelope([0, 128, 255, 128]));
    const estreito = [0.50, 0.55, 0.50, 0.60];
    const comTimbre = { ...base, trackBrightness: estreito };
    const comGrade = { ...base, trackPulse: estreito };

    const ampT = (() => {
      const v = trackBiasOf(comTimbre, 4).map((b) => b.brightness);
      return Math.max(...v) - Math.min(...v);
    })();
    expect(ampT).toBeGreaterThan(0.02);
    expect(amp(comGrade, 4)).toBeLessThan(0.005);
  });

  it("um espalhamento largo move a grade de verdade", () => {
    expect(amp(comPulso([0.05, 0.95, 0.10, 0.90], iguais(4)), 4)).toBeGreaterThan(0.15);
  });

  it("o álbum continua sendo a âncora: o viés médio por duração é ~zero", () => {
    const spans = [0.4, 0.3, 0.2, 0.1];
    const s = comPulso([0.1, 0.4, 0.7, 0.95], spans);
    const media = trackBiasOf(s, 4).reduce((a, b, i) => a + b.pulse * spans[i], 0);
    expect(Math.abs(media)).toBeLessThan(0.02);
  });

  it("nenhuma faixa passa do teto declarado", () => {
    for (const b of trackBiasOf(comPulso([0, 1, 0, 1], iguais(4)), 4)) {
      expect(Math.abs(b.pulse)).toBeLessThanOrEqual(0.12);
    }
  });

  it("o teto é macio: divergir muito e divergir pouco não dão o mesmo deslocamento", () => {
    const s = comPulso([0.5, 0.6, 0.9, 1.0], iguais(4));
    const v = trackBiasOf(s, 4).map((b) => b.pulse);

    expect(v[3]).toBeGreaterThan(v[2]);
    expect(v[0]).toBeLessThan(v[1]);
    expect(new Set(v.map((x) => x.toFixed(4))).size).toBe(4);
    for (const x of v) expect(Math.abs(x)).toBeLessThan(0.12);
  });

  it("no acervo, a ordem entre as faixas sobrevive ao teto", () => {
    for (const album of CURATION) {
      const s = SIGNATURES[album.id];
      const tp = s.trackPulse;
      if (!tp) continue;
      const bias = trackBiasOf(s, album.tracks.length).map((b) => b.pulse);
      const ordem = tp.map((v, i) => ({ v, b: bias[i] })).sort((x, y) => x.v - y.v);
      for (let i = 1; i < ordem.length; i++) {
        expect(ordem[i].b, `${album.id} faixa ${i}`).toBeGreaterThanOrEqual(ordem[i - 1].b - 1e-9);
      }
    }
  });

  it("no acervo, o disco mais uniforme em grade quase não se move", () => {
    const de = (slug: string) => {
      const n = CURATION.find((a) => a.id === slug)!.tracks.length;
      return amp(SIGNATURES[slug], n);
    };
    expect(de("jono-terbakar-lebar")).toBeLessThan(0.05);
    expect(de("mark-wilson-x-dark-thoughts")).toBeGreaterThan(0.15);
  });

  it("todo álbum publica um pulso por faixa alinhado com as faixas", () => {
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
