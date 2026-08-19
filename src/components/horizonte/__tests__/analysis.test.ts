import { describe, expect, it } from "vitest";
import { CURATION } from "../content/curation.generated";
import { SIGNATURES } from "../content/signature.generated";
import { curvature } from "../audio/analysis";
import { fieldConstantsOf, reduceMotion } from "../field";

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
