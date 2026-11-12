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

const sat = (bodies: number, after: number, extra: Partial<typeof base> = {}) => {
  const high = after <= bodies;
  const minutes = after < bodies ? 45 : after > bodies ? 27 : 37;
  return ask({
    part: "satellites",
    ...base,
    high,
    ...extra,
    bodies,
    after,
    minutes,
    usual: 34,
    extra: minutes - 34,
    onsets: [22.7, 33.2, 43.7, 54.2],
  });
};

describe("the anatomy writers", () => {
  it("count small bodies in agreement, in both languages", () => {
    const cases: [number, number, string, string][] = [
      [
        4,
        2,
        "two small bodies remain. The ones that go stood for this record's extra 11 minutes.",
        "restam dois pequenos corpos. Os que somem representavam os 11 minutos a mais deste disco.",
      ],
      [3, 2, "two small bodies remain. The one that goes stood", "restam dois pequenos corpos. O que some representava"],
      [2, 1, "one small body remains.", "resta um pequeno corpo."],
      [2, 0, "the small bodies disappear.", "os pequenos corpos desaparecem."],
      [1, 0, "the small body disappears.", "o pequeno corpo desaparece."],
      [
        0,
        1,
        "a small body appears beside it. It stands for the 7 minutes this record doesn't have.",
        "surge um pequeno corpo ao lado. Ele representa os 7 minutos que faltam a este disco.",
      ],
      [0, 2, "two small bodies appear around it. They stand", "surgem dois pequenos corpos em volta. Eles representam"],
      [1, 2, "one more small body appears.", "surge mais um pequeno corpo."],
      [2, 4, "two more appear.", "surgem mais dois."],
      [2, 2, "its two small bodies stay, a little smaller.", "os dois pequenos corpos continuam lá, um pouco menores."],
      [1, 1, "its small body stays, a little smaller.", "o pequeno corpo continua lá, um pouco menor."],
      [0, 0, "it stays alone.", "a forma continua sozinha."],
    ];
    for (const [n, after, en, pt] of cases) {
      expect(ANATOMY_EN.phrase(sat(n, after)).result).toContain(en);
      expect(ANATOMY_PT.phrase(sat(n, after)).result).toContain(pt);
    }
  });

  it("a single minute stays singular", () => {
    const one = ask({ ...sat(1, 0).finding, minutes: 35, extra: 1 } as Finding);
    expect(ANATOMY_EN.phrase(one).result).toContain("extra 1 minute.");
    expect(ANATOMY_PT.phrase(one).result).toContain("representava o 1 minuto a mais deste disco.");
  });

  it("ask about small bodies by where they come from, or why there are none", () => {
    expect(ANATOMY_PT.phrase(sat(0, 0)).ask).toBe("Por que esta forma está sozinha?");
    expect(ANATOMY_PT.phrase(sat(1, 0)).ask).toBe("De onde vem o pequeno corpo ao lado?");
    expect(ANATOMY_PT.phrase(sat(3, 2)).ask).toBe("De onde vêm os três pequenos corpos?");
    expect(ANATOMY_EN.phrase(sat(3, 2)).ask).toBe("Where do the three small bodies come from?");
    expect(ANATOMY_EN.phrase(sat(0, 2)).ask).toBe("Why is this shape alone?");
  });

  it("near the typical length, nobody says 'no' where they mean 'none'", () => {
    const near = sat(0, 0, { near: true });
    expect(ANATOMY_EN.phrase(near).answer).toMatch(/this record has none:/);
    expect(ANATOMY_PT.phrase(near).answer).toMatch(/este disco não tem nenhum:/);
    expect(ANATOMY_EN.phrase(near).what).toBeNull();
    expect(ANATOMY_PT.phrase(near).what).toBeNull();
  });

  it("name the extremes only for the record that holds them, with the right gender", () => {
    const steady = ask({ part: "strata", ...base, strong: true, top: true, beat: "steady" }, "pulse");
    const free = ask(
      { part: "strata", ...base, high: false, strong: true, bottom: true, beat: "none" },
      "pulse",
    );
    expect(ANATOMY_PT.phrase(steady).answer).toContain("Nenhum disco da coleção é tão regular.");
    expect(ANATOMY_PT.phrase(free).answer).toContain("Nenhum disco da coleção tem um ritmo tão livre.");
    expect(ANATOMY_EN.phrase(steady).answer).toContain("No record here is as regular.");
    const dark = ask(
      { part: "posture", ...base, high: false, strong: true, bottom: true },
      "brightness",
    );
    expect(ANATOMY_PT.phrase(dark).answer).toContain("Nenhum disco da coleção é tão escuro.");
    const plain = ask({ part: "strata", ...base, strong: true, beat: "steady" }, "pulse");
    expect(ANATOMY_PT.phrase(plain).answer).not.toMatch(/Nenhum disco/);
    expect(ANATOMY_EN.phrase(plain).answer).not.toMatch(/No record here/);
  });

  it("intermediate layers are asked about in the direction of the record", () => {
    const layered = ask({ part: "strata", ...base, beat: "partial" }, "pulse");
    const faint = ask({ part: "strata", ...base, high: false, beat: "partial" }, "pulse");
    expect(ANATOMY_PT.phrase(layered).ask).toBe("Por que o anel se divide em camadas?");
    expect(ANATOMY_PT.phrase(layered).what).toBe("E se o ritmo fosse menos regular?");
    expect(ANATOMY_PT.phrase(faint).ask).toBe("Por que as camadas do anel mal aparecem?");
    expect(ANATOMY_PT.phrase(faint).what).toBe("E se o ritmo fosse mais regular?");
    expect(ANATOMY_EN.phrase(layered).ask).toBe("Why does the ring split into layers?");
    expect(ANATOMY_EN.phrase(faint).ask).toBe("Why are the ring's layers so faint?");
  });

  it("the name follows loudness in words, and its weight stays in the numbers", () => {
    const core = (o: Partial<typeof base>) =>
      ({ part: "core", ...base, ...o, nameWeight: 777 }) as Extract<Finding, { part: "core" }>;
    expect(ANATOMY_PT.nameFact(core({ top: true, strong: true }))).toMatch(/o mais pesado da coleção\.$/);
    expect(ANATOMY_EN.nameFact(core({ near: true }))).toMatch(/typical weight\.$/);
    expect(ANATOMY_EN.nameFact(core({ high: false }))).toMatch(/a little lighter than most\.$/);
    for (const w of [ANATOMY_EN, ANATOMY_PT]) expect(w.nameFact(core({}))).not.toMatch(/\d/);
  });

  it("the deeper layer adds the onsets and why length lives outside the ring", () => {
    expect(ANATOMY_EN.details(sat(3, 2))).toEqual([["Bodies appear at", "23 · 33 · 44 · 54 min"]]);
    expect(ANATOMY_PT.depth(sat(3, 2))).toMatch(/volta completa/);
    expect(ANATOMY_EN.depth(sat(3, 2))).toMatch(/one full turn/);
    const other = ask({ part: "contour", ...base }, "dynamics");
    expect(ANATOMY_EN.details(other)).toEqual([]);
    expect(ANATOMY_PT.depth(other)).toBeNull();
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
