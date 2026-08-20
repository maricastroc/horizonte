import { describe, expect, it } from "vitest";
import { ALBUMS } from "../content";
import { morphologyOf } from "../morphology";
import { legacyMorphologyOf } from "../perception/legacy";
import {
  GUARDRAIL,
  DISTANT,
  measure,
  worstDistant,
  type PerceptionReport,
  type Subject,
} from "../perception/measure";
import type { Variant } from "../types";

const SUBJECTS: Subject[] = ALBUMS.map((a) => ({
  label: a.id,
  signature: a.signature,
  trackCount: a.tracks.length,
}));

const VARIANTS: Variant[] = ["desktop", "tablet", "mobile"];

const short = (s: string) => s.slice(0, 24);

function report(title: string, r: PerceptionReport) {
  const far = worstDistant(r);
  process.stdout.write(
    [
      `\n── ${title}  (sigma ${r.sigma.toFixed(2)} px de grade · ${r.variant})`,
      `   média de relance  ${r.mean.toFixed(3)}`,
      `   pior par          ${r.worst.score.toFixed(3)}   ${short(r.worst.a)} / ${short(r.worst.b)}`,
      `   par mais distinto ${r.best.score.toFixed(3)}   ${short(r.best.a)} / ${short(r.best.b)}`,
      `   tinta invariável  ${(r.invariant * 100).toFixed(1)}%`,
      `   segue a música    ${r.tracking.toFixed(3)}`,
      far
        ? `   pior par musicalmente distante  ${far.score.toFixed(3)}   ${short(far.a)} / ${short(far.b)}`
        : "   nenhum par musicalmente distante",
      "",
    ].join("\n"),
  );
}

function axes() {
  const rows = ALBUMS.map((a) => {
    const m = morphologyOf(a.signature, a.tracks.length);
    return {
      id: a.id,
      circuito: m.circuit,
      achatamento: m.flatten,
      nucleo: m.coreRatio,
      relevo: m.relief,
      camadas: m.strata,
      excentr: Math.hypot(m.eccX, m.eccY),
      falha: m.fragment,
      corpos: m.satellites.filter((x) => x.weight > 0.02).length,
    };
  });
  const keys = [
    "circuito",
    "achatamento",
    "nucleo",
    "relevo",
    "camadas",
    "excentr",
    "falha",
  ] as const;
  const head = ["album".padEnd(30), ...keys.map((k) => k.slice(0, 8).padStart(11)), "  corpos"].join(
    "",
  );
  const body = rows
    .map((r) =>
      [
        r.id.padEnd(30),
        ...keys.map((k) => r[k].toFixed(3).padStart(11)),
        String(r.corpos).padStart(8),
      ].join(""),
    )
    .join("\n");
  const span = keys
    .map((k) => {
      const v = rows.map((r) => r[k]);
      const lo = Math.min(...v);
      const hi = Math.max(...v);
      return `   ${k.padEnd(12)} ${lo.toFixed(3)} → ${hi.toFixed(3)}   ${(hi / Math.max(lo, 1e-6)).toFixed(2)}×`;
    })
    .join("\n");
  process.stdout.write(`\n── eixos morfológicos\n${head}\n${body}\n\n── amplitude\n${span}\n`);
}

describe("distância perceptual entre álbuns", () => {
  const atual = VARIANTS.map((variant) => measure(SUBJECTS, { variant }));
  const anterior = measure(SUBJECTS, { morphOf: (s) => legacyMorphologyOf(s.signature) });

  it("publica a medição do acervo", () => {
    report("referência anterior", anterior);
    atual.forEach((r) => report("morfologia atual", r));
    axes();
    expect(atual[0].pairs.length).toBe((SUBJECTS.length * (SUBJECTS.length - 1)) / 2);
  });

  for (const r of atual) {
    it(`${r.variant}: nenhum disco converge para a macroforma dos outros`, () => {
      expect(r.mean).toBeLessThanOrEqual(GUARDRAIL.mean);
      expect(r.worst.score, `${r.worst.a} / ${r.worst.b}`).toBeLessThanOrEqual(GUARDRAIL.worst);
      expect(r.invariant).toBeLessThanOrEqual(GUARDRAIL.invariant);
    });

    it(`${r.variant}: discos musicalmente distantes divergem de verdade`, () => {
      const far = worstDistant(r);
      expect(far, `nenhum par com distância musical ≥ ${DISTANT}`).toBeTruthy();
      expect(far!.score, `${far!.a} / ${far!.b}`).toBeLessThanOrEqual(GUARDRAIL.worstDistant);
    });

    it(`${r.variant}: a distância visual segue a distância musical`, () => {
      expect(r.tracking).toBeGreaterThanOrEqual(GUARDRAIL.tracking);
    });
  }

  it("o guardrail reprovaria a composição anterior", () => {
    expect(anterior.mean).toBeGreaterThan(GUARDRAIL.mean);
    expect(anterior.worst.score).toBeGreaterThan(GUARDRAIL.worst);
    expect(anterior.invariant).toBeGreaterThan(GUARDRAIL.invariant);
    expect(worstDistant(anterior)!.score).toBeGreaterThan(GUARDRAIL.worstDistant);
  });

  it("a medição não depende da resolução do rasterizador", () => {
    const grids = [216, 288, 384].map((gw) =>
      measure(SUBJECTS, { gw, gh: Math.round((gw * 900) / 1440) }),
    );
    const means = grids.map((g) => g.mean);
    const worst = grids.map((g) => g.worst.score);
    expect(Math.max(...means) - Math.min(...means)).toBeLessThan(0.02);
    expect(Math.max(...worst) - Math.min(...worst)).toBeLessThan(0.02);
  });
});
