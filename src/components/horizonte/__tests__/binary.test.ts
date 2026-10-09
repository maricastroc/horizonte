import { describe, expect, it } from "vitest";
import {
  axisOf,
  binaryAt,
  binaryGeometry,
  binaryPlanOf,
  binaryWeightOf,
  curveAt,
  massesOf,
  SINGLE,
} from "../binary";
import { ALBUMS } from "../content";
import { morphologyOf } from "../morphology";
import { BINARY_WEIGHT } from "../content/binary.generated";
import { scoreOf, sectionAt } from "../score";
import { BINARY } from "../tokens";

const idOf = (id: string) => ALBUMS.findIndex((a) => a.id === id);
const everyTrack = () => ALBUMS.flatMap((a, ai) => a.tracks.map((_, k) => ({ ai, k })));
const gap = (a: number, b: number) =>
  Math.abs(((((a - b + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);

describe("the binary weight of a track", () => {
  it("is measured for every track and stays in range", () => {
    for (const a of ALBUMS) {
      expect(BINARY_WEIGHT[a.id]).toHaveLength(a.tracks.length);
    }
    for (const { ai, k } of everyTrack()) {
      const w = binaryWeightOf(ai, k);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });

  it("belongs to the track, not to the album", () => {
    const eworld = idOf("zero-project-e-world");
    const ws = ALBUMS[eworld].tracks.map((_, k) => binaryWeightOf(eworld, k));
    expect(Math.max(...ws) - Math.min(...ws)).toBeGreaterThan(0.6);
  });

  it("leaves most of the catalog with a single centre", () => {
    const ws = everyTrack().map(({ ai, k }) => binaryWeightOf(ai, k));
    expect(ws.filter((w) => w < BINARY.floor).length / ws.length).toBeGreaterThan(0.5);
  });
});

describe("the binary plan follows the music", () => {
  const eworld = idOf("zero-project-e-world");
  const score = scoreOf(eworld, 3);
  const plan = binaryPlanOf(score)!;

  it("pairs the two leading materials in the order they are heard", () => {
    expect(plan).not.toBeNull();
    const pair = score.materials.filter((m) => m.cluster === plan.first || m.cluster === plan.second);
    expect(pair).toHaveLength(2);
    const first = pair.find((m) => m.cluster === plan.first)!;
    const second = pair.find((m) => m.cluster === plan.second)!;
    expect(first.first).toBeLessThan(second.first);
    expect(plan.arrival).toBe(second.first);
  });

  it("keeps a single centre until the second material arrives", () => {
    expect(binaryAt(score, plan, plan.arrival - 0.01)).toEqual(SINGLE);
    expect(binaryAt(score, plan, plan.arrival + 0.02).split).toBeGreaterThan(0);
  });

  it("hands the weight to whichever material is sounding, and gives it back on its return", () => {
    const leads = score.sections
      .filter((s) => s.cluster === plan.first || s.cluster === plan.second)
      .filter((s) => s.at >= plan.arrival || s.cluster === plan.first)
      .map((s) => ({ cluster: s.cluster, lead: binaryAt(score, plan, (s.at + s.end) / 2).lead }));
    for (const l of leads) {
      if (l.cluster === plan.second) expect(l.lead).toBeLessThan(0.5);
    }
    const after = leads.filter((l, i) => i > 0 && l.cluster === plan.first && leads[i - 1].cluster === plan.second);
    expect(after.length).toBeGreaterThan(0);
    for (const l of after) expect(l.lead).toBe(BINARY.lead);
  });

  it("never splits beyond what the measured weight allows", () => {
    for (const { ai, k } of everyTrack()) {
      const s = scoreOf(ai, k);
      const p = binaryPlanOf(s);
      if (!p) continue;
      for (let i = 0; i <= 40; i++) {
        const b = binaryAt(s, p, i / 40);
        expect(b.split).toBeLessThanOrEqual(Math.min(BINARY.maxSplit, p.weight * (1 + BINARY.climax)) + 1e-9);
        expect(sectionAt(s, i / 40)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("has no plan for a track the analysis reads as a single centre", () => {
    const solar = idOf("darin-wilson-impromptu");
    expect(binaryPlanOf(scoreOf(solar, 3))).toBeNull();
  });
});

describe("the binary geometry", () => {
  const r0 = 0.88;

  it("is the original ring before the split", () => {
    const g = binaryGeometry(SINGLE, r0);
    expect(g.length).toBeCloseTo(2 * Math.PI * r0, 2);
    for (let i = 0; i < 64; i++) {
      const p = curveAt(g, i / 64);
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(r0, 3);
      expect(p.nx * p.x + p.ny * p.y).toBeGreaterThan(0);
      expect(p.k).toBeCloseTo(1, 5);
    }
  });

  it("starts where the ring starts and runs the same way", () => {
    const g = binaryGeometry({ split: 0.001, lead: 0.5 }, r0);
    const a = curveAt(g, 0);
    const b = curveAt(g, 0.01);
    expect(a.x).toBeGreaterThan(0.8 * r0);
    expect(b.y).toBeGreaterThan(a.y);
  });

  it("gives each mass a loop whose area follows its mass", () => {
    for (const lead of [0.32, 0.5, 0.68]) {
      const shape = { split: 1, lead };
      const [qa, qb] = massesOf(shape);
      expect(qa + qb).toBeCloseTo(1, 9);
      const g = binaryGeometry(shape, r0);
      expect(g.radii[0] / g.radii[1]).toBeCloseTo(Math.sqrt(qa / qb), 6);
      expect(qa * g.first[0] + qb * g.second[0]).toBeCloseTo(0, 9);
    }
    expect(massesOf({ split: 1, lead: 0.32 })[1]).toBeGreaterThan(0.5);
    expect(massesOf({ split: 1, lead: 0.68 })[1]).toBeLessThan(0.5);
  });

  it("keeps the band outside each loop and thins it only where it crosses", () => {
    const g = binaryGeometry({ split: 0.9, lead: 0.5 }, r0);
    for (let i = 0; i < 400; i++) {
      const p = curveAt(g, i / 400);
      if (p.k < 0.95 * Math.min(1, Math.sqrt(g.radii[1] / r0))) continue;
      const near = [g.first, g.second].reduce((best, c) =>
        Math.hypot(p.x - c[0], p.y - c[1]) < Math.hypot(p.x - best[0], p.y - best[1]) ? c : best,
      );
      expect(p.nx * (p.x - near[0]) + p.ny * (p.y - near[1])).toBeGreaterThan(0);
    }
  });

  it("reshapes the ring gradually and only lets its matter flow along it", () => {
    let along = 0;
    let across = 0;
    for (let s = 0.05; s < 1; s += 0.05) {
      const a = binaryGeometry({ split: s, lead: 0.5 }, r0);
      const b = binaryGeometry({ split: s + 0.01, lead: 0.5 }, r0);
      for (let i = 0; i < 100; i++) {
        const u = i / 100;
        if (u < Math.max(a.share, b.share) + 0.02) continue;
        const p = curveAt(a, u);
        const q = curveAt(b, u);
        along = Math.max(along, Math.abs((q.x - p.x) * -p.ny + (q.y - p.y) * p.nx));
        across = Math.max(across, Math.abs((q.x - p.x) * p.nx + (q.y - p.y) * p.ny));
      }
    }
    expect(across).toBeLessThan(0.03);
    expect(along).toBeLessThan(0.1);
  });
});

describe("the binary axis", () => {
  it("rises away from the record's own satellites", () => {
    const half = BINARY.jitter / 2;
    for (const a of ALBUMS) {
      const sats = morphologyOf(a.signature, a.tracks.length).satellites;
      for (const j of [0, 0.5, 0.99]) {
        const axis = axisOf(j, sats);
        expect(axis).toBeGreaterThanOrEqual(BINARY.axis[0] - half);
        expect(axis).toBeLessThanOrEqual(BINARY.axis[1] + half);
      }
    }
    const sat = { angle: -1.2, dist: 1.34, size: 0.2, weight: 1 };
    expect(gap(axisOf(0.5, [sat]), sat.angle)).toBeGreaterThan(0.8);
  });
});
