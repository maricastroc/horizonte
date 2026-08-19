import { beforeEach, describe, expect, it } from "vitest";
import { AudioAnalysis, FFT_SIZE, SMOOTHING, curvature } from "../audio/analysis";
import { CURATION } from "../content/curation.generated";
import { SIGNATURES } from "../content/signature.generated";
import { NEUTRAL_SIGNATURE } from "../content/signature";
import { fieldConstantsOf, reduceMotion } from "../field";
import { fakeContext, sineTrack, type FakeAnalyser } from "./fakes";

const SR = 44100;
const BINS = FFT_SIZE / 2;
const NYQUIST = SR / 2;

const binOf = (hz: number) => Math.round((hz / NYQUIST) * BINS);

function spectrumAt(tracks: [number, number, number][]): Uint8Array {
  const e = new Uint8Array(BINS);
  for (const [de, ate, value] of tracks) {
    for (let b = binOf(de); b <= Math.min(BINS - 1, binOf(ate)); b++) e[b] = value;
  }
  return e;
}

let analysis: AudioAnalysis;
let no: FakeAnalyser;

beforeEach(() => {
  const { ctx, analyser } = fakeContext(SR);
  no = analyser;
  analysis = new AudioAnalysis(ctx);
});

describe("montagem do analyser", () => {
  it("usa o mesmo fftSize e suavização da análise offline", () => {
    expect(no.fftSize).toBe(FFT_SIZE);
    expect(no.smoothingTimeConstant).toBe(SMOOTHING);
  });
});

describe("bandas", () => {
  it("energia em graves não vaza para agudos", () => {
    no.spectrum = spectrumAt([[20, 160, 255]]);
    no.wave = sineTrack(0.5);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);

    expect(analysis.frame.bass).toBeGreaterThan(0.9);
    expect(analysis.frame.treb).toBeLessThan(0.05);
  });

  it("energia em agudos não vaza para graves", () => {
    no.spectrum = spectrumAt([[2000, 11000, 255]]);
    no.wave = sineTrack(0.5);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);

    expect(analysis.frame.treb).toBeGreaterThan(0.9);
    expect(analysis.frame.bass).toBeLessThan(0.05);
  });

  it("silêncio no espectro leva as bandas a zero", () => {
    no.spectrum = new Uint8Array(BINS);
    no.wave = sineTrack(0);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);

    expect(analysis.frame.bass).toBeLessThan(0.01);
    expect(analysis.frame.mid).toBeLessThan(0.01);
    expect(analysis.frame.treb).toBeLessThan(0.01);
  });
});

describe("normalização contra a signature do álbum", () => {
  it("sem referência, o nível cru já é o nível", () => {
    no.spectrum = spectrumAt([[20, 160, 128]]);
    no.wave = sineTrack(0.5);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);
    const withoutRef = analysis.frame.bass;

    expect(withoutRef).toBeGreaterThan(0.4);
    expect(withoutRef).toBeLessThan(0.6);
  });

  it("com referência, o mesmo sinal ocupa toda a faixa útil do disco", () => {
    const raw = 128 / 255;
    analysis.setReference({
      ...NEUTRAL_SIGNATURE.reference,
      bass: [raw - 0.01, raw + 0.01],
    });
    no.spectrum = spectrumAt([[20, 160, 128]]);
    no.wave = sineTrack(0.5);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);

    expect(analysis.frame.bass).toBeGreaterThan(0.4);
    expect(analysis.frame.bass).toBeLessThan(0.6);
  });

  it("um sinal acima do p90 do disco satura em 1, não além", () => {
    analysis.setReference({ ...NEUTRAL_SIGNATURE.reference, bass: [0.1, 0.2] });
    no.spectrum = spectrumAt([[20, 160, 255]]);
    no.wave = sineTrack(0.5);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);

    expect(analysis.frame.bass).toBeLessThanOrEqual(1);
    expect(analysis.frame.bass).toBeGreaterThan(0.99);
  });
});

describe("acento", () => {
  it("é zero quando o nível já é o de sempre", () => {
    no.spectrum = spectrumAt([[20, 160, 200]]);
    no.wave = sineTrack(0.5);
    for (let i = 0; i < 600; i++) analysis.update(0.05, true);

    expect(Math.abs(analysis.frame.accent.bass)).toBeLessThan(0.05);
  });

  it("sobe quando a banda passa do próprio hábito", () => {
    no.spectrum = spectrumAt([[20, 160, 60]]);
    no.wave = sineTrack(0.5);
    for (let i = 0; i < 600; i++) analysis.update(0.05, true);

    no.spectrum = spectrumAt([[20, 160, 255]]);
    for (let i = 0; i < 4; i++) analysis.update(0.05, true);

    expect(analysis.frame.accent.bass).toBeGreaterThan(0.3);
  });

  it("nunca sai de [-1, 1]", () => {
    no.wave = sineTrack(0.9);
    for (let i = 0; i < 60; i++) {
      no.spectrum = spectrumAt([[20, 160, i % 2 ? 255 : 0]]);
      analysis.update(0.05, true);
      const a = analysis.frame.accent;
      for (const v of [a.bass, a.mid, a.treb]) {
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("centróide", () => {
  it("um espectro grave lê escuro", () => {
    no.spectrum = spectrumAt([[200, 300, 255]]);
    no.wave = sineTrack(0.5);
    for (let i = 0; i < 400; i++) analysis.update(0.05, true);

    expect(analysis.frame.centroid).toBeLessThan(0.25);
  });

  it("um espectro agudo lê brilhante", () => {
    no.spectrum = spectrumAt([[2400, 2800, 255]]);
    no.wave = sineTrack(0.5);
    for (let i = 0; i < 400; i++) analysis.update(0.05, true);

    expect(analysis.frame.centroid).toBeGreaterThan(0.9);
  });

  it("fica em [0, 1] mesmo com o espectro inteiro cheio", () => {
    no.spectrum = spectrumAt([[20, 11000, 255]]);
    no.wave = sineTrack(0.5);
    for (let i = 0; i < 400; i++) analysis.update(0.05, true);

    expect(analysis.frame.centroid).toBeGreaterThanOrEqual(0);
    expect(analysis.frame.centroid).toBeLessThanOrEqual(1);
  });
});

describe("energia e fluxo", () => {
  it("uma onda mais alta lê mais energia", () => {
    no.spectrum = spectrumAt([[20, 11000, 128]]);

    no.wave = sineTrack(0.15);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);
    const low = analysis.frame.energy;

    no.wave = sineTrack(0.95);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);
    const high = analysis.frame.energy;

    expect(high).toBeGreaterThan(low);
  });

  it("um sinal estável não produz fluxo", () => {
    no.spectrum = spectrumAt([[20, 11000, 180]]);
    no.wave = sineTrack(0.5);
    for (let i = 0; i < 400; i++) analysis.update(0.05, true);

    expect(analysis.frame.flux).toBeLessThan(0.05);
  });

  it("mudanças bruscas de espectro produzem fluxo", () => {
    no.wave = sineTrack(0.5);
    for (let i = 0; i < 40; i++) {
      no.spectrum = spectrumAt([[20, 11000, i % 2 ? 255 : 20]]);
      analysis.update(0.05, true);
    }

    expect(analysis.frame.flux).toBeGreaterThan(0.1);
  });
});

describe("silêncio", () => {
  it("sem reprodução o quadro decai para zero sem ler o espectro", () => {
    no.spectrum = spectrumAt([[20, 11000, 255]]);
    no.wave = sineTrack(0.9);
    for (let i = 0; i < 200; i++) analysis.update(0.05, true);
    expect(analysis.frame.energy).toBeGreaterThan(0.1);

    for (let i = 0; i < 400; i++) analysis.update(0.05, false);

    const f = analysis.frame;
    expect(f.energy).toBeLessThan(0.001);
    expect(f.bass).toBeLessThan(0.001);
    expect(f.mid).toBeLessThan(0.001);
    expect(f.treb).toBeLessThan(0.001);
    expect(f.flux).toBeLessThan(0.001);
    expect(Math.abs(f.accent.bass)).toBeLessThan(0.001);
  });

  it("o decaimento devolve o mesmo quadro, não um novo objeto", () => {
    expect(analysis.update(0.05, false)).toBe(analysis.frame);
    expect(analysis.update(0.05, true)).toBe(analysis.frame);
  });
});

describe("curvature — perturbação limitada pelo teto do álbum", () => {
  it("sem acento, entrega a constante intacta", () => {
    expect(curvature(0.075, 0, 0.15)).toBeCloseTo(0.075, 12);
  });

  it("o acento move no máximo ±cap em torno da base", () => {
    expect(curvature(0.075, 1, 0.15)).toBeCloseTo(0.075 * 1.15, 12);
    expect(curvature(0.075, -1, 0.15)).toBeCloseTo(0.075 * 0.85, 12);
  });

  it("acentos fora de ±1 saturam em vez de estourar o teto", () => {
    expect(curvature(0.075, 40, 0.15)).toBeCloseTo(curvature(0.075, 1, 0.15), 12);
    expect(curvature(0.075, -40, 0.15)).toBeCloseTo(curvature(0.075, -1, 0.15), 12);
  });

  it("é monotônica no acento", () => {
    const vs = [-1, -0.5, 0, 0.5, 1].map((a) => curvature(0.075, a, 0.15));
    for (let i = 1; i < vs.length; i++) expect(vs[i]).toBeGreaterThan(vs[i - 1]);
  });

  it("teto zero congela a propriedade — o world para de reagir", () => {
    for (const a of [-1, -0.3, 0, 0.6, 1]) {
      expect(curvature(0.075, a, 0)).toBe(0.075);
    }
  });

  it("com prefers-reduced-motion nenhum álbum reage a nada", () => {
    for (const album of CURATION) {
      const c = reduceMotion(fieldConstantsOf(SIGNATURES[album.id]));
      expect(curvature(0.075, 1, c.reactionCap)).toBe(0.075);
      expect(curvature(0.42, -1, c.reactionCap)).toBe(0.42);
    }
  });

  it("discos dinâmicos respiram mais que discos comprimidos", () => {
    const cap = (id: string) => fieldConstantsOf(SIGNATURES[id]).reactionCap;
    const lebar = curvature(0.075, 1, cap("jono-terbakar-lebar"));
    const wryWay = curvature(0.075, 1, cap("tale-twist-wry-way"));
    expect(lebar).toBeGreaterThan(wryWay);
  });
});
