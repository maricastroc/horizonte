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
      `\n── ${title}  (sigma ${r.sigma.toFixed(2)} px de grid · ${r.variant})`,
      `   mean at a glance  ${r.mean.toFixed(3)}`,
      `   worst pair       ${r.worst.score.toFixed(3)}   ${short(r.worst.a)} / ${short(r.worst.b)}`,
      `   most distinct    ${r.best.score.toFixed(3)}   ${short(r.best.a)} / ${short(r.best.b)}`,
      `   invariant ink    ${(r.invariant * 100).toFixed(1)}%`,
      `   tracks the music ${r.tracking.toFixed(3)}`,
      far
        ? `   worst distant pair  ${far.score.toFixed(3)}   ${short(far.a)} / ${short(far.b)}`
        : "   no musically distant pair",
      "",
    ].join("\n"),
  );
}

function axes() {
  const rows = ALBUMS.map((a) => {
    const m = morphologyOf(a.signature, a.tracks.length);
    return {
      id: a.id,
      circuit: m.circuit,
      flatten: m.flatten,
      core: m.coreRatio,
      relief: m.relief,
      strata: m.strata,
      ecc: Math.hypot(m.eccX, m.eccY),
      fragment: m.fragment,
      bodies: m.satellites.filter((x) => x.weight > 0.02).length,
    };
  });
  const keys = [
    "circuit",
    "flatten",
    "core",
    "relief",
    "strata",
    "ecc",
    "fragment",
  ] as const;
  const head = ["album".padEnd(30), ...keys.map((k) => k.slice(0, 8).padStart(11)), "  bodies"].join(
    "",
  );
  const body = rows
    .map((r) =>
      [
        r.id.padEnd(30),
        ...keys.map((k) => r[k].toFixed(3).padStart(11)),
        String(r.bodies).padStart(8),
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
  process.stdout.write(`\n── morphological axes\n${head}\n${body}\n\n── span\n${span}\n`);
}

describe("perceptual distance between albums", () => {
  const current = VARIANTS.map((variant) => measure(SUBJECTS, { variant }));
  const previous = measure(SUBJECTS, { morphOf: (s) => legacyMorphologyOf(s.signature) });

  it("publishes the catalogue measurement", () => {
    report("previous reference", previous);
    current.forEach((r) => report("current morphology", r));
    axes();
    expect(current[0].pairs.length).toBe((SUBJECTS.length * (SUBJECTS.length - 1)) / 2);
  });

  for (const r of current) {
    it(`${r.variant}: no record converges on the others' macro-shape`, () => {
      expect(r.mean).toBeLessThanOrEqual(GUARDRAIL.mean);
      expect(r.worst.score, `${r.worst.a} / ${r.worst.b}`).toBeLessThanOrEqual(GUARDRAIL.worst);
      expect(r.invariant).toBeLessThanOrEqual(GUARDRAIL.invariant);
    });

    it(`${r.variant}: musically distant records genuinely diverge`, () => {
      const far = worstDistant(r);
      expect(far, `no pair with musical distance ≥ ${DISTANT}`).toBeTruthy();
      expect(far!.score, `${far!.a} / ${far!.b}`).toBeLessThanOrEqual(GUARDRAIL.worstDistant);
    });

    it(`${r.variant}: visual distance follows musical distance`, () => {
      expect(r.tracking).toBeGreaterThanOrEqual(GUARDRAIL.tracking);
    });
  }

  it("the guardrail would fail the previous composition", () => {
    expect(previous.mean).toBeGreaterThan(GUARDRAIL.mean);
    expect(previous.worst.score).toBeGreaterThan(GUARDRAIL.worst);
    expect(previous.invariant).toBeGreaterThan(GUARDRAIL.invariant);
    expect(worstDistant(previous)!.score).toBeGreaterThan(GUARDRAIL.worstDistant);
  });

  it("the measurement does not depend on the rasterizer's resolution", () => {
    const grids = [216, 288, 384].map((gw) =>
      measure(SUBJECTS, { gw, gh: Math.round((gw * 900) / 1440) }),
    );
    const means = grids.map((g) => g.mean);
    const worst = grids.map((g) => g.worst.score);
    expect(Math.max(...means) - Math.min(...means)).toBeLessThan(0.02);
    expect(Math.max(...worst) - Math.min(...worst)).toBeLessThan(0.02);
  });
});
