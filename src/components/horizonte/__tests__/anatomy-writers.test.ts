import { describe, expect, it } from "vitest";
import {
  questionsOf,
  readingOf,
  type AxisReading,
  type CompareAxis,
  type Finding,
  type Question,
} from "../anatomy";
import { CURATED_COUNT } from "../content";
import { ANATOMY_EN } from "../i18n/anatomy.en";
import { ANATOMY_PT } from "../i18n/anatomy.pt-BR";

const reading = (axis: CompareAxis, rank = 3, value = 1, median = 0): AxisReading => ({
  axis,
  value,
  median,
  rank,
  of: 14,
  near: false,
});

const base = { near: false, high: true, strong: false, top: false, bottom: false };

const ask = (finding: Finding, axis: CompareAxis = "duration"): Question => ({
  part: finding.part,
  finding,
  reading: reading(axis),
  experiment: !finding.near,
  score: 0,
});

const sat = (bodies: number, after: number, extra: Partial<typeof base> = {}) =>
  ask({ part: "satellites", ...base, ...extra, bodies, after, minutes: 40, usual: 34 });

describe("the anatomy writers", () => {
  it("count small bodies in agreement, in both languages", () => {
    const cases: [number, number, string, string][] = [
      [4, 2, "two of its four small bodies dissolve", "dois dos seus quatro pequenos corpos se dissolvem"],
      [3, 2, "one of its three small bodies dissolves", "um dos seus três pequenos corpos se dissolve"],
      [2, 0, "its two small bodies dissolve", "seus dois pequenos corpos se dissolvem"],
      [1, 0, "its small body dissolves", "seu pequeno corpo se dissolve"],
      [0, 1, "a small body appears beside it", "surge um pequeno corpo ao lado"],
      [0, 2, "two small bodies appear around it", "surgem dois pequenos corpos em volta"],
      [1, 2, "one more small body appears around it", "surge mais um pequeno corpo em volta"],
      [2, 4, "two small bodies appear around it", "surgem mais dois pequenos corpos em volta"],
      [2, 2, "its small bodies shrink", "seus pequenos corpos encolhem"],
      [1, 1, "its small body shrinks", "seu pequeno corpo encolhe"],
      [0, 0, "it stays a single body", "a forma continua sendo um corpo só"],
    ];
    for (const [n, after, en, pt] of cases) {
      expect(ANATOMY_EN.phrase(sat(n, after)).result).toContain(en);
      expect(ANATOMY_PT.phrase(sat(n, after)).result).toContain(pt);
    }
  });

  it("ask about small bodies by how many there are", () => {
    expect(ANATOMY_PT.phrase(sat(0, 0)).ask).toBe("Por que a forma é um corpo só?");
    expect(ANATOMY_PT.phrase(sat(1, 0)).ask).toBe("Por que há um pequeno corpo ao lado?");
    expect(ANATOMY_PT.phrase(sat(3, 2)).ask).toBe("Por que há três pequenos corpos em volta?");
    expect(ANATOMY_EN.phrase(sat(3, 2)).ask).toBe("Why are there three small bodies around it?");
  });

  it("near the usual length, nobody says 'no' where they mean 'none'", () => {
    const near = sat(0, 0, { near: true });
    expect(ANATOMY_EN.phrase(near).answer).toMatch(/at this length, none\.$/);
    expect(ANATOMY_PT.phrase(near).answer).toMatch(/com essa duração, nenhum aparece\.$/);
    expect(ANATOMY_EN.phrase(near).what).toBeNull();
    expect(ANATOMY_PT.phrase(near).what).toBeNull();
  });

  it("name the extremes only for the record that holds them, with the right gender", () => {
    const steady = ask({ part: "strata", ...base, strong: true, top: true, beat: "steady" }, "pulse");
    const loose = ask(
      { part: "strata", ...base, high: false, strong: true, bottom: true, beat: "none" },
      "pulse",
    );
    expect(ANATOMY_PT.phrase(steady).answer).toContain("batida firme, a mais firme da coleção");
    expect(ANATOMY_PT.phrase(loose).answer).toContain("é o mais solto da coleção");
    expect(ANATOMY_EN.phrase(steady).answer).toContain("the steadiest here");
    const plain = ask({ part: "strata", ...base, strong: true, beat: "steady" }, "pulse");
    expect(ANATOMY_PT.phrase(plain).answer).not.toContain("da coleção.");
    expect(ANATOMY_EN.phrase(plain).answer).not.toContain("here.");
  });

  it("grade the question by how far the record sits from the usual", () => {
    const edge = (high: boolean, strong: boolean) =>
      ANATOMY_PT.phrase(ask({ part: "contour", ...base, high, strong }, "dynamics")).ask;
    expect(edge(true, true)).toBe("Por que a borda é tão recortada?");
    expect(edge(true, false)).toBe("Por que a borda é recortada?");
    expect(edge(false, true)).toBe("Por que a borda é tão lisa?");
    expect(edge(false, false)).toBe("Por que a borda é quase lisa?");
  });

  it("rank records with each language's ordinals", () => {
    const at = (rank: number) => ({ ...reading("brightness", rank) });
    expect([1, 2, 3, 4, 11, 12, 13].map((r) => ANATOMY_EN.standing(at(r)))).toEqual([
      "brightest of 14",
      "2nd brightest of 14",
      "3rd brightest of 14",
      "4th brightest of 14",
      "11th brightest of 14",
      "12th brightest of 14",
      "13th brightest of 14",
    ]);
    expect([1, 12, 14].map((r) => ANATOMY_PT.standing(at(r)))).toEqual([
      "o mais brilhante de 14",
      "12º mais brilhante de 14",
      "o mais escuro de 14",
    ]);
  });

  it("write measurements with each language's decimal mark", () => {
    expect(ANATOMY_EN.shown("loudness", -12.34)).toBe("−12.3 dB");
    expect(ANATOMY_PT.shown("loudness", -12.34)).toBe("−12,3 dB");
    expect(ANATOMY_PT.shown("pulse", 0.4567)).toBe("0,46");
    expect(ANATOMY_PT.shown("dynamics", 9.25)).toMatch(/^9,[23] dB de variação$/);
    expect(ANATOMY_PT.shown("duration", 2040)).toBe("34 min");
  });

  it("every curated record reads in one language at a time", () => {
    const english = /\b(the|why|because|record|ring|what if)\b/i;
    const portuguese = /[ãõçáéíóúê]|\b(disco|anel|porque|por que)\b/i;
    for (let i = 0; i < CURATED_COUNT; i++) {
      for (const q of questionsOf(i)) {
        const pt = ANATOMY_PT.phrase(q);
        const en = ANATOMY_EN.phrase(q);
        for (const text of [pt.ask, pt.answer, pt.what ?? "", pt.result, pt.label]) {
          expect(text).not.toMatch(english);
        }
        for (const text of [en.ask, en.answer, en.what ?? "", en.result, en.label]) {
          expect(text).not.toMatch(portuguese);
        }
      }
    }
  });

  it("both writers agree on whether there is an experiment", () => {
    for (let i = 0; i < CURATED_COUNT; i++) {
      for (const q of questionsOf(i)) {
        expect(ANATOMY_PT.phrase(q).what === null).toBe(ANATOMY_EN.phrase(q).what === null);
        expect(Boolean(ANATOMY_PT.phrase(q).label)).toBe(Boolean(ANATOMY_EN.phrase(q).label));
      }
    }
  });

  it("the deeper layer reads the same reading in both languages", () => {
    const r = readingOf(0, "duration");
    expect(ANATOMY_PT.shown("duration", r.value)).toBe(ANATOMY_EN.shown("duration", r.value));
    expect(Object.keys(ANATOMY_PT.drawn)).toEqual(Object.keys(ANATOMY_EN.drawn));
    expect(Object.keys(ANATOMY_PT.measure)).toEqual(Object.keys(ANATOMY_EN.measure));
  });
});
