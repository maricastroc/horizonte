import { describe, expect, it } from "vitest";
import { ALBUMS } from "../content";
import { morphologyOf, satRadiusOf } from "../morphology";
import {
  albumRelationsOf,
  bodiesAt,
  companionsAt,
  pulledSatellites,
  relationsAt,
} from "../relations";
import { albumDensityOf, climaxAt, scoreOf, sectionAt } from "../score";
import { RELATIONS, SCORE } from "../tokens";

const idOf = (id: string) => ALBUMS.findIndex((a) => a.id === id);
const everyTrack = () => ALBUMS.flatMap((a, ai) => a.tracks.map((_, k) => ({ ai, k })));

describe("the score of a track", () => {
  it("is a pure function of the measurements", () => {
    const a = scoreOf(idOf("darin-wilson-impromptu"), 3);
    expect(scoreOf(idOf("darin-wilson-impromptu"), 3)).toBe(a);
    expect(a.returns).toBe(true);
  });

  it("tracks at most a few materials, ordered by first appearance", () => {
    for (const { ai, k } of everyTrack()) {
      const s = scoreOf(ai, k);
      expect(s.materials.length).toBeLessThanOrEqual(SCORE.maxMaterials);
      for (let i = 1; i < s.materials.length; i++) {
        expect(s.materials[i].first).toBeGreaterThanOrEqual(s.materials[i - 1].first);
      }
      for (const m of s.materials) expect(m.share).toBeGreaterThanOrEqual(SCORE.minShare);
    }
  });

  it("a climax is a real peak, not the loudest of a flat track", () => {
    for (const { ai, k } of everyTrack()) {
      const s = scoreOf(ai, k);
      if (s.climax < 0) continue;
      const peak = s.sections[s.climax];
      expect(peak.level).toBeGreaterThan(SCORE.silence);
      expect(peak.end - peak.at).toBeGreaterThanOrEqual(SCORE.climaxSpan);
      expect(peak.end - peak.at).toBeLessThanOrEqual(SCORE.climaxMaxSpan);
      expect(climaxAt(s, (peak.at + peak.end) / 2)).toBeGreaterThan(0.5);
    }
  });
});

describe("relations keep the composition present", () => {
  it("the ring never shrinks below its presence floor and the lean stays in range", () => {
    for (const { ai, k } of everyTrack()) {
      const s = scoreOf(ai, k);
      for (let i = 0; i <= 12; i++) {
        const r = relationsAt(s, i / 12);
        expect(r.reach).toBeGreaterThanOrEqual(RELATIONS.reachRange[0]);
        expect(r.reach).toBeLessThanOrEqual(RELATIONS.reachRange[1]);
        expect(r.lean).toBeGreaterThanOrEqual(RELATIONS.leanRange[0]);
        expect(r.lean).toBeLessThanOrEqual(RELATIONS.leanRange[1]);
      }
    }
  });

  it("a dense record sits closer to its name than a sparse one", () => {
    const dense = idOf("madison-kenny-all-systems-go");
    const sparse = idOf("tristan-lohengrin-le-manoir");
    const a = albumRelationsOf(albumDensityOf(dense), ALBUMS[dense].signature.loudness);
    const b = albumRelationsOf(albumDensityOf(sparse), ALBUMS[sparse].signature.loudness);
    expect(a.lean).toBeLessThan(b.lean);
    expect(a.reach).toBeGreaterThan(b.reach);
  });

  it("the climax opens the ring wider than the moments around it", () => {
    const hit = everyTrack()
      .map(({ ai, k }) => scoreOf(ai, k))
      .find((s) => s.climax >= 0 && s.sections[s.climax].end - s.sections[s.climax].at > 0.1)!;
    const peak = hit.sections[hit.climax];
    const inside = relationsAt(hit, (peak.at + peak.end) / 2).reach;
    const before = relationsAt(hit, Math.max(0, peak.at - 0.05)).reach;
    expect(inside).toBeGreaterThan(before);
  });
});

describe("the bodies are the track's materials", () => {
  const solarIndex = idOf("darin-wilson-impromptu");
  const solar = scoreOf(solarIndex, 3);
  const base = morphologyOf(ALBUMS[solarIndex].signature, ALBUMS[solarIndex].tracks.length);

  it("no body grows into a rival of the core", () => {
    for (const { ai, k } of everyTrack()) {
      const s = scoreOf(ai, k);
      const m = morphologyOf(ALBUMS[ai].signature, ALBUMS[ai].tracks.length);
      for (const b of bodiesAt(s, 0.5, m)) {
        expect(satRadiusOf(m, b)).toBeLessThanOrEqual(m.coreRatio * RELATIONS.body.cap + 1e-9);
      }
    }
  });

  const dominant = solar.materials.reduce((a, b) => (b.share > a.share ? b : a));
  const secondary = solar.materials.filter((m) => m !== dominant);

  it("the dominant material is the mass itself; only the others become bodies", () => {
    expect(bodiesAt(solar, 0.5, base)).toHaveLength(secondary.length);
  });

  it("a material not yet heard is not there", () => {
    const late = secondary.at(-1)!;
    const bodies = bodiesAt(solar, Math.max(0, late.first - 0.01), base);
    expect(bodies.at(-1)!.weight).toBe(0);
  });

  it("the sounding material comes closest, and a return brings it back to the same place", () => {
    const back = solar.sections.findIndex(
      (s) => s.recall >= 0 && secondary.some((m) => m.cluster === s.cluster),
    );
    expect(back).toBeGreaterThan(0);
    const first = solar.sections[solar.sections[back].recall];
    const sec = solar.sections[back];
    const i = secondary.findIndex((m) => m.cluster === sec.cluster);
    expect(i).toBeGreaterThanOrEqual(0);
    const then = bodiesAt(solar, (first.at + first.end) / 2, base)[i];
    const now = bodiesAt(solar, (sec.at + sec.end) / 2, base)[i];
    expect(now.angle).toBe(then.angle);
    expect(now.dist).toBe(then.dist);
    const others = bodiesAt(solar, (sec.at + sec.end) / 2, base).filter(
      (_, j) => j !== i && _.weight > 0,
    );
    for (const o of others) expect(o.dist).toBeGreaterThan(now.dist);
    expect(sectionAt(solar, (sec.at + sec.end) / 2)).toBe(back);
  });
});

describe("companions keep the record's satellites", () => {
  const gap = (a: number, b: number) =>
    Math.abs(((((a - b + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);

  it("the album's satellites stay whole while the music borrows them", () => {
    for (const { ai, k } of everyTrack()) {
      const s = scoreOf(ai, k);
      const m = morphologyOf(ALBUMS[ai].signature, ALBUMS[ai].tracks.length);
      for (let i = 0; i <= 12; i++) {
        const { pulls } = companionsAt(s, i / 12, m, true);
        const kept = pulledSatellites(m, pulls);
        kept.forEach((sat, j) => {
          expect(sat.weight).toBe(m.satellites[j].weight);
          expect(sat.size).toBe(m.satellites[j].size);
          expect(sat.angle).toBe(m.satellites[j].angle);
          expect(sat.dist).toBeLessThanOrEqual(m.satellites[j].dist + 1e-9);
        });
      }
    }
  });

  it("new bodies appear only where the record has no satellite to lend, clear of its own", () => {
    for (const { ai, k } of everyTrack()) {
      const s = scoreOf(ai, k);
      const m = morphologyOf(ALBUMS[ai].signature, ALBUMS[ai].tracks.length);
      const own = m.satellites.filter((sat) => sat.weight > 0.02);
      const { bodies } = companionsAt(s, 0.99, m, true);
      const secondary = Math.max(0, s.materials.length - 1);
      expect(bodies.length).toBe(Math.max(0, secondary - Math.max(0, own.length - 1)));
      for (const b of bodies) {
        for (const sat of own) {
          expect(gap(b.angle, sat.angle)).toBeGreaterThanOrEqual(RELATIONS.home.clear - 1e-9);
        }
      }
    }
  });

  it("the lens is handed to whatever body the sounding material lives in", () => {
    for (const { ai, k } of everyTrack()) {
      const s = scoreOf(ai, k);
      if (!s.curated) continue;
      const m = morphologyOf(ALBUMS[ai].signature, ALBUMS[ai].tracks.length);
      for (const sec of s.sections) {
        const { bodies, pulls, sounding } = companionsAt(s, (sec.at + sec.end) / 2, m, true);
        if (sounding < 0) continue;
        if (sounding < m.satellites.length) expect(pulls[sounding]).toBe(1);
        else expect(bodies[sounding - m.satellites.length].weight).toBe(RELATIONS.body.sounding);
      }
    }
  });
});
