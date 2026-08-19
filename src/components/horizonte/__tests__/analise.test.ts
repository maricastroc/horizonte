import { beforeEach, describe, expect, it } from "vitest";
import { AudioAnalysis, FFT_SIZE, SMOOTHING, curvature } from "../audio/analysis";
import { CURATION } from "../content/curation.generated";
import { SIGNATURES } from "../content/signature.generated";
import { NEUTRAL_SIGNATURE } from "../content/signature";
import { fieldConstantsOf, reduceMotion } from "../field";
import { contextoFalso, faixaSenoidal, type AnalisadorFalso } from "./fakes";

const SR = 44100;
const BINS = FFT_SIZE / 2;
const NYQUIST = SR / 2;

const binDe = (hz: number) => Math.round((hz / NYQUIST) * BINS);

function espectroEm(faixas: [number, number, number][]): Uint8Array {
  const e = new Uint8Array(BINS);
  for (const [de, ate, valor] of faixas) {
    for (let b = binDe(de); b <= Math.min(BINS - 1, binDe(ate)); b++) e[b] = valor;
  }
  return e;
}

let analise: AudioAnalysis;
let no: AnalisadorFalso;

beforeEach(() => {
  const { ctx, analisador } = contextoFalso(SR);
  no = analisador;
  analise = new AudioAnalysis(ctx);
});

describe("montagem do analisador", () => {
  it("usa o mesmo fftSize e suavização da análise offline", () => {
    expect(no.fftSize).toBe(FFT_SIZE);
    expect(no.smoothingTimeConstant).toBe(SMOOTHING);
  });
});

describe("bandas", () => {
  it("energia em graves não vaza para agudos", () => {
    no.espectro = espectroEm([[20, 160, 255]]);
    no.onda = faixaSenoidal(0.5);
    for (let i = 0; i < 200; i++) analise.update(0.05, true);

    expect(analise.frame.bass).toBeGreaterThan(0.9);
    expect(analise.frame.treb).toBeLessThan(0.05);
  });

  it("energia em agudos não vaza para graves", () => {
    no.espectro = espectroEm([[2000, 11000, 255]]);
    no.onda = faixaSenoidal(0.5);
    for (let i = 0; i < 200; i++) analise.update(0.05, true);

    expect(analise.frame.treb).toBeGreaterThan(0.9);
    expect(analise.frame.bass).toBeLessThan(0.05);
  });

  it("silêncio no espectro leva as bandas a zero", () => {
    no.espectro = new Uint8Array(BINS);
    no.onda = faixaSenoidal(0);
    for (let i = 0; i < 200; i++) analise.update(0.05, true);

    expect(analise.frame.bass).toBeLessThan(0.01);
    expect(analise.frame.mid).toBeLessThan(0.01);
    expect(analise.frame.treb).toBeLessThan(0.01);
  });
});

describe("normalização contra a assinatura do álbum", () => {
  it("sem referência, o nível cru já é o nível", () => {
    no.espectro = espectroEm([[20, 160, 128]]);
    no.onda = faixaSenoidal(0.5);
    for (let i = 0; i < 200; i++) analise.update(0.05, true);
    const semRef = analise.frame.bass;

    expect(semRef).toBeGreaterThan(0.4);
    expect(semRef).toBeLessThan(0.6);
  });

  it("com referência, o mesmo sinal ocupa toda a faixa útil do disco", () => {
    const cru = 128 / 255;
    analise.setReference({
      ...NEUTRAL_SIGNATURE.reference,
      bass: [cru - 0.01, cru + 0.01],
    });
    no.espectro = espectroEm([[20, 160, 128]]);
    no.onda = faixaSenoidal(0.5);
    for (let i = 0; i < 200; i++) analise.update(0.05, true);

    expect(analise.frame.bass).toBeGreaterThan(0.4);
    expect(analise.frame.bass).toBeLessThan(0.6);
  });

  it("um sinal acima do p90 do disco satura em 1, não além", () => {
    analise.setReference({ ...NEUTRAL_SIGNATURE.reference, bass: [0.1, 0.2] });
    no.espectro = espectroEm([[20, 160, 255]]);
    no.onda = faixaSenoidal(0.5);
    for (let i = 0; i < 200; i++) analise.update(0.05, true);

    expect(analise.frame.bass).toBeLessThanOrEqual(1);
    expect(analise.frame.bass).toBeGreaterThan(0.99);
  });
});

describe("acento", () => {
  it("é zero quando o nível já é o de sempre", () => {
    no.espectro = espectroEm([[20, 160, 200]]);
    no.onda = faixaSenoidal(0.5);
    for (let i = 0; i < 600; i++) analise.update(0.05, true);

    expect(Math.abs(analise.frame.accent.bass)).toBeLessThan(0.05);
  });

  it("sobe quando a banda passa do próprio hábito", () => {
    no.espectro = espectroEm([[20, 160, 60]]);
    no.onda = faixaSenoidal(0.5);
    for (let i = 0; i < 600; i++) analise.update(0.05, true);

    no.espectro = espectroEm([[20, 160, 255]]);
    for (let i = 0; i < 4; i++) analise.update(0.05, true);

    expect(analise.frame.accent.bass).toBeGreaterThan(0.3);
  });

  it("nunca sai de [-1, 1]", () => {
    no.onda = faixaSenoidal(0.9);
    for (let i = 0; i < 60; i++) {
      no.espectro = espectroEm([[20, 160, i % 2 ? 255 : 0]]);
      analise.update(0.05, true);
      const a = analise.frame.accent;
      for (const v of [a.bass, a.mid, a.treb]) {
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("centróide", () => {
  it("um espectro grave lê escuro", () => {
    no.espectro = espectroEm([[200, 300, 255]]);
    no.onda = faixaSenoidal(0.5);
    for (let i = 0; i < 400; i++) analise.update(0.05, true);

    expect(analise.frame.centroid).toBeLessThan(0.25);
  });

  it("um espectro agudo lê brilhante", () => {
    no.espectro = espectroEm([[2400, 2800, 255]]);
    no.onda = faixaSenoidal(0.5);
    for (let i = 0; i < 400; i++) analise.update(0.05, true);

    expect(analise.frame.centroid).toBeGreaterThan(0.9);
  });

  it("fica em [0, 1] mesmo com o espectro inteiro cheio", () => {
    no.espectro = espectroEm([[20, 11000, 255]]);
    no.onda = faixaSenoidal(0.5);
    for (let i = 0; i < 400; i++) analise.update(0.05, true);

    expect(analise.frame.centroid).toBeGreaterThanOrEqual(0);
    expect(analise.frame.centroid).toBeLessThanOrEqual(1);
  });
});

describe("energia e fluxo", () => {
  it("uma onda mais alta lê mais energia", () => {
    no.espectro = espectroEm([[20, 11000, 128]]);

    no.onda = faixaSenoidal(0.15);
    for (let i = 0; i < 200; i++) analise.update(0.05, true);
    const baixa = analise.frame.energy;

    no.onda = faixaSenoidal(0.95);
    for (let i = 0; i < 200; i++) analise.update(0.05, true);
    const alta = analise.frame.energy;

    expect(alta).toBeGreaterThan(baixa);
  });

  it("um sinal estável não produz fluxo", () => {
    no.espectro = espectroEm([[20, 11000, 180]]);
    no.onda = faixaSenoidal(0.5);
    for (let i = 0; i < 400; i++) analise.update(0.05, true);

    expect(analise.frame.flux).toBeLessThan(0.05);
  });

  it("mudanças bruscas de espectro produzem fluxo", () => {
    no.onda = faixaSenoidal(0.5);
    for (let i = 0; i < 40; i++) {
      no.espectro = espectroEm([[20, 11000, i % 2 ? 255 : 20]]);
      analise.update(0.05, true);
    }

    expect(analise.frame.flux).toBeGreaterThan(0.1);
  });
});

describe("silêncio", () => {
  it("sem reprodução o quadro decai para zero sem ler o espectro", () => {
    no.espectro = espectroEm([[20, 11000, 255]]);
    no.onda = faixaSenoidal(0.9);
    for (let i = 0; i < 200; i++) analise.update(0.05, true);
    expect(analise.frame.energy).toBeGreaterThan(0.1);

    for (let i = 0; i < 400; i++) analise.update(0.05, false);

    const f = analise.frame;
    expect(f.energy).toBeLessThan(0.001);
    expect(f.bass).toBeLessThan(0.001);
    expect(f.mid).toBeLessThan(0.001);
    expect(f.treb).toBeLessThan(0.001);
    expect(f.flux).toBeLessThan(0.001);
    expect(Math.abs(f.accent.bass)).toBeLessThan(0.001);
  });

  it("o decaimento devolve o mesmo quadro, não um novo objeto", () => {
    expect(analise.update(0.05, false)).toBe(analise.frame);
    expect(analise.update(0.05, true)).toBe(analise.frame);
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

  it("teto zero congela a propriedade — o mundo para de reagir", () => {
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
    const teto = (id: string) => fieldConstantsOf(SIGNATURES[id]).reactionCap;
    const lebar = curvature(0.075, 1, teto("jono-terbakar-lebar"));
    const wryWay = curvature(0.075, 1, teto("tale-twist-wry-way"));
    expect(lebar).toBeGreaterThan(wryWay);
  });
});
