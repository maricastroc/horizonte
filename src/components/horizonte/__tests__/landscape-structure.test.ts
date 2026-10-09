import { describe, expect, it } from "vitest";
import { ALBUMS } from "../content";
import { landscapeOf, momentAt, morphologyOfState, type Landscape } from "../landscape";
import { morphologyOf } from "../morphology";
import { glanceOf, shapeSimilarity, type Glance } from "../perception/structure";
import { TIMELINE_TRACKS } from "./samples";

const LANDSCAPE_GUARD = {
  contrastingMean: 0.8,
  sameRecord: 0.92,
  evolves: 0.85,
  steady: 0.95,
  steadyShare: 0.85,
  recall: 0.98,
  coherence: 0.35,
} as const;

interface Subject {
  id: string;
  L: Landscape;
  identity: Glance;
  sections: Glance[];
}

const subjects: Subject[] = TIMELINE_TRACKS.map(([id, track]) => {
  const L = landscapeOf(
    ALBUMS.findIndex((a) => a.id === id),
    track,
  );
  return {
    id: `${id}/${track}`,
    L,
    identity: glanceOf(morphologyOfState(L, L.identity)),
    sections: L.sections.map((s) => glanceOf(morphologyOfState(L, momentAt(L, (s.at + s.end) / 2).state))),
  };
});

const find = (id: string) => subjects.find((s) => s.id === id)!;

const musical = (a: Landscape, b: Landscape) => {
  const keys = ["level", "articulation", "motion", "recurrence"] as const;
  let sum = 0;
  for (const k of keys) sum += (a.form[k] - b.form[k]) ** 2;
  sum += ((a.form.trajectory - b.form.trajectory) / 2) ** 2;
  return Math.sqrt(sum / 5);
};

function correlation(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

describe("the landscape: structure of each track and its evolution", () => {
  const pairs: { a: string; b: string; score: number; musical: number }[] = [];
  for (let i = 0; i < subjects.length; i++) {
    for (let j = i + 1; j < subjects.length; j++) {
      pairs.push({
        a: subjects[i].id,
        b: subjects[j].id,
        score: shapeSimilarity(subjects[i].identity, subjects[j].identity),
        musical: musical(subjects[i].L, subjects[j].L),
      });
    }
  }
  const evolution = subjects.map((s) => ({
    id: s.id,
    low: Math.min(...s.sections.map((g) => shapeSimilarity(s.identity, g))),
  }));

  it("publishes the measurement", () => {
    const mean = pairs.reduce((t, p) => t + p.score, 0) / pairs.length;
    process.stdout.write(
      [
        "\n── landscape structure (sampled contrasting tracks)",
        `   identity, mean across tracks   ${mean.toFixed(3)}`,
        `   follows the music              ${correlation(
          pairs.map((p) => p.musical),
          pairs.map((p) => 1 - p.score),
        ).toFixed(3)}`,
        ...evolution.map((e) => `   ${e.id.slice(0, 34).padEnd(36)} lowest state ${e.low.toFixed(3)}`),
        "",
      ].join("\n"),
    );
    expect(pairs.length).toBeGreaterThan(10);
  });

  it("contrasting tracks build structurally different landscapes", () => {
    const mean = pairs.reduce((t, p) => t + p.score, 0) / pairs.length;
    expect(mean).toBeLessThanOrEqual(LANDSCAPE_GUARD.contrastingMean);
  });

  it("two tracks of the same record are no longer the same shape", () => {
    const manoir = shapeSimilarity(
      find("tristan-lohengrin-le-manoir/5").identity,
      find("tristan-lohengrin-le-manoir/8").identity,
    );
    const impromptu = shapeSimilarity(
      find("darin-wilson-impromptu/0").identity,
      find("darin-wilson-impromptu/3").identity,
    );
    expect(manoir).toBeLessThan(LANDSCAPE_GUARD.sameRecord);
    expect(impromptu).toBeLessThan(LANDSCAPE_GUARD.sameRecord);
    const map = morphologyOf(ALBUMS.find((a) => a.id === "tristan-lohengrin-le-manoir")!.signature, 11);
    expect(shapeSimilarity(glanceOf(map), glanceOf(map))).toBeGreaterThan(0.999);
  });

  it("visual distance between tracks follows musical distance", () => {
    const r = correlation(
      pairs.map((p) => p.musical),
      pairs.map((p) => 1 - p.score),
    );
    expect(r).toBeGreaterThanOrEqual(LANDSCAPE_GUARD.coherence);
  });

  it("a track with contrasting sections passes through distinct states", () => {
    const solar = evolution.find((e) => e.id === "darin-wilson-impromptu/3")!;
    expect(solar.low).toBeLessThanOrEqual(LANDSCAPE_GUARD.evolves);
  });

  it("a steady track holds its form for almost all of its duration", () => {
    const steady = find("madison-kenny-all-systems-go/3");
    let held = 0;
    steady.L.sections.forEach((sec, k) => {
      if (shapeSimilarity(steady.identity, steady.sections[k]) >= LANDSCAPE_GUARD.steady) held += sec.end - sec.at;
    });
    expect(held).toBeGreaterThanOrEqual(LANDSCAPE_GUARD.steadyShare);
  });

  it("a returning section is recognisable as its first occurrence", () => {
    const solar = find("darin-wilson-impromptu/3");
    const returns: number[] = [];
    const others: number[] = [];
    solar.L.sections.forEach((s, k) => {
      if (s.recall < 0) return;
      returns.push(shapeSimilarity(solar.sections[s.recall], solar.sections[k]));
      solar.L.sections.forEach((o, j) => {
        if (o.cluster !== s.cluster) others.push(shapeSimilarity(solar.sections[s.recall], solar.sections[j]));
      });
    });
    expect(returns.length).toBeGreaterThan(0);
    for (const r of returns) expect(r).toBeGreaterThanOrEqual(LANDSCAPE_GUARD.recall);
    expect(Math.min(...returns)).toBeGreaterThan(others.reduce((a, b) => a + b, 0) / others.length);
  });
});
