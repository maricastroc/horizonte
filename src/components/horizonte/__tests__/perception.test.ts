import { describe, expect, it } from "vitest";
import { ALBUMS } from "../content";
import { morphologyOf, satRadiusOf } from "../morphology";
import { MORPH } from "../tokens";
import { legacyMorphologyOf } from "../perception/legacy";
import {
  GUARDRAIL,
  DISTANT,
  measure,
  worstDistant,
  type PerceptionReport,
  type Subject,
} from "../perception/measure";
import { glanceOf, shapeSimilarity, topologyOf } from "../perception/structure";
import type { Variant } from "../types";

const STRUCTURE_GUARD = { albumMean: 0.86 } as const;

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
    const [desktop] = current;
    const grids = [
      desktop,
      ...[216, 384].map((gw) => measure(SUBJECTS, { gw, gh: Math.round((gw * 900) / 1440) })),
    ];
    const means = grids.map((g) => g.mean);
    const worst = grids.map((g) => g.worst.score);
    expect(Math.max(...means) - Math.min(...means)).toBeLessThan(0.02);
    expect(Math.max(...worst) - Math.min(...worst)).toBeLessThan(0.02);
  });
});

describe("the satellite stays subordinate to the body", () => {
  const visible = (m: ReturnType<typeof morphologyOf>) =>
    m.satellites.filter((s) => s.weight > 0.02);

  it("no record draws a satellite as wide as its own core", () => {
    for (const a of ALBUMS) {
      const m = morphologyOf(a.signature, a.tracks.length);
      for (const s of visible(m)) {
        expect(satRadiusOf(m, s), a.id).toBeLessThanOrEqual(m.coreRatio * MORPH.satCap + 1e-9);
      }
    }
  });

  it("the cap scales the whole orbit, so each satellite stays smaller than the previous one", () => {
    for (const a of ALBUMS) {
      const m = morphologyOf(a.signature, a.tracks.length);
      const radii = visible(m).map((s) => satRadiusOf(m, s));
      for (let i = 1; i < radii.length; i++) {
        expect(radii[i], `${a.id} · satellite ${i}`).toBeLessThan(radii[i - 1]);
      }
    }
  });

  it("duration still reads in how many bodies orbit", () => {
    const count = ALBUMS.map((a) => ({
      duration: a.signature.duration,
      bodies: visible(morphologyOf(a.signature, a.tracks.length)).length,
    }));
    const longest = count.reduce((a, b) => (b.duration > a.duration ? b : a));
    const shortest = count.reduce((a, b) => (b.duration < a.duration ? b : a));
    expect(longest.bodies).toBeGreaterThan(shortest.bodies);
    expect(shortest.bodies).toBe(0);
  });
});

describe("structure, once position, scale and rotation are discounted", () => {
  const shapes = ALBUMS.map((a) => ({ id: a.id, m: morphologyOf(a.signature, a.tracks.length) }));
  const glances = shapes.map((s) => glanceOf(s.m));
  const pairs: { a: string; b: string; score: number }[] = [];
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      pairs.push({ a: shapes[i].id, b: shapes[j].id, score: shapeSimilarity(glances[i], glances[j]) });
    }
  }
  const mean = pairs.reduce((s, p) => s + p.score, 0) / pairs.length;
  const worst = pairs.reduce((w, p) => (p.score > w.score ? p : w));

  it("publishes the structural measurement and the topology of each record", () => {
    const rows = shapes
      .map((s) => {
        const t = topologyOf(s.m);
        return `   ${s.id.slice(0, 30).padEnd(32)}${String(t.components).padStart(4)}${t.coverage.toFixed(2).padStart(9)}${t.aspect.toFixed(2).padStart(8)}${t.massVoid.toFixed(2).padStart(10)}${t.dominance.toFixed(2).padStart(11)}`;
      })
      .join("\n");
    process.stdout.write(
      [
        "\n── structure (centered, scale-normalized, best rotation)",
        `   mean ${mean.toFixed(3)}   worst ${worst.score.toFixed(3)}  ${short(worst.a)} / ${short(worst.b)}`,
        `   ${"record".padEnd(32)}comp coverage  aspect  mass/void  dominance`,
        rows,
        "",
      ].join("\n"),
    );
    expect(pairs.length).toBe((shapes.length * (shapes.length - 1)) / 2);
  });

  it("a record rotated in its own plane is the same structure", () => {
    const m = shapes[0].m;
    const turned = glanceOf(m, { rotate: false });
    const self = shapeSimilarity(turned, glances[0]);
    expect(self).toBeGreaterThan(0.999);
  });

  it("the albums do not get structurally closer than they are today", () => {
    expect(mean).toBeLessThanOrEqual(STRUCTURE_GUARD.albumMean);
  });

  it("the measure separates the previous composition from the current one", () => {
    const legacy = ALBUMS.map((a) => glanceOf(legacyMorphologyOf(a.signature), { rotate: false }));
    let sum = 0;
    let n = 0;
    for (let i = 0; i < legacy.length; i++) {
      for (let j = i + 1; j < legacy.length; j++) {
        sum += shapeSimilarity(legacy[i], legacy[j]);
        n++;
      }
    }
    expect(sum / n).toBeGreaterThan(mean);
  });
});
