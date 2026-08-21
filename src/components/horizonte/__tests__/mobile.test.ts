import { describe, expect, it } from "vitest";
import { drawBack, makeParticles } from "../composition/back";
import { loadCovers } from "../composition/cover";
import { drawFront } from "../composition/front";
import { bandsOf, extentOf, stageBox } from "../composition/bands";
import { bodyGeom, layoutFor, lockup } from "../composition/layout";
import { RingBakery } from "../composition/ring";
import { ALBUMS } from "../content";
import { fieldConstantsOf } from "../field";
import { morphologyOf } from "../morphology";
import { BAND, DPR_MAX } from "../tokens";
import type { FieldState } from "../types";
import { baseState } from "./fixtures";
import { engineHarness, paintContext } from "./fakes";

const MOBILE = layoutFor("mobile");
const DESKTOP = layoutFor("desktop");

const VIEWPORTS = [
  { label: "320×568", w: 320, h: 568 },
  { label: "375×667", w: 375, h: 667 },
  { label: "390×844", w: 390, h: 844 },
  { label: "430×932", w: 430, h: 932 },
];

const LANDSCAPE = [
  { label: "844×390", w: 844, h: 390 },
  { label: "932×430", w: 932, h: 430 },
];

const CANVASES = VIEWPORTS.flatMap((v) => [
  { ...v, label: `${v.label} @1x` },
  { ...v, label: `${v.label} @${DPR_MAX}x`, w: v.w * DPR_MAX, h: v.h * DPR_MAX },
]);

const morphOf = (alb: number) => morphologyOf(ALBUMS[alb].signature, ALBUMS[alb].tracks.length);

const album = (alb: number, over: Partial<FieldState> = {}): FieldState =>
  baseState({ scale: "album", alb, nav: alb, zoom: 1, play: 0, ...over });

const SCENES = [
  { label: "collection", zoom: 0 },
  { label: "album", zoom: 1 },
];

describe("regions of the mobile composition", () => {
  it("the bands follow one another without overlapping, on every target screen", () => {
    for (const v of CANVASES) {
      for (const scene of SCENES) {
        const b = bandsOf(v.w, v.h, scene.zoom);
        const where = `${v.label} · ${scene.label}`;
        expect(b.top, where).toBeGreaterThan(0);
        expect(b.stage, where).toBeGreaterThan(b.top);
        expect(b.identity, where).toBeGreaterThanOrEqual(b.stage);
        expect(b.list, where).toBeGreaterThanOrEqual(b.identity);
        expect(b.list, where).toBeLessThan(1);
      }
    }
  });

  it("opening, stage and transport are never too small to touch", () => {
    for (const v of CANVASES) {
      const px = v.h / (v.label.includes("@1x") ? 1 : DPR_MAX);
      const b = bandsOf(v.w, v.h, 1);
      expect(b.top * px, `abertura ${v.label}`).toBeGreaterThanOrEqual(72);
      expect((b.stage - b.top) * px, `palco ${v.label}`).toBeGreaterThanOrEqual(110);
      expect((1 - b.list) * px, `transporte ${v.label}`).toBeGreaterThanOrEqual(114);
    }
  });

  it("in the album a usable list remains, even on the shortest screen", () => {
    for (const v of CANVASES) {
      const px = v.h / (v.label.includes("@1x") ? 1 : DPR_MAX);
      const b = bandsOf(v.w, v.h, 1);
      expect((b.list - b.identity) * px, `list ${v.label}`).toBeGreaterThanOrEqual(2 * 48);
    }
  });

  it("in the collection the stage takes the field, in the album it yields space to the list", () => {
    for (const v of CANVASES) {
      const field = bandsOf(v.w, v.h, 0);
      const record = bandsOf(v.w, v.h, 1);
      expect(field.stage, v.label).toBeGreaterThan(record.stage);
      expect(field.list - field.identity, v.label).toBeLessThan(record.list - record.identity);
    }
  });

  it("in phone landscape the composition shrinks, but nothing is cut", () => {
    for (const v of LANDSCAPE) {
      const b = bandsOf(v.w, v.h, 1);
      expect(b.stage, v.label).toBeGreaterThan(b.top);
      expect(b.list, v.label).toBeGreaterThanOrEqual(b.identity);
      expect(b.top * v.h, `abertura ${v.label}`).toBeGreaterThanOrEqual(62);
      expect((1 - b.list) * v.h, `transporte ${v.label}`).toBeGreaterThanOrEqual(124);
      expect((b.list - b.identity) * v.h, `list ${v.label}`).toBeGreaterThanOrEqual(48);
    }
  });

  it("desktop and tablet get no bands: the composition is mobile-only", () => {
    expect(MOBILE.staged).toBe(true);
    expect(DESKTOP.staged).toBe(false);
    expect(layoutFor("tablet").staged).toBe(false);
  });
});

describe("the world fits the stage — no morphology invades the interface", () => {
  it("body, corona and satellites of every album stay inside the stage", () => {
    for (const v of CANVASES) {
      for (const scene of SCENES) {
        const box = stageBox(v.w, v.h, bandsOf(v.w, v.h, scene.zoom));
        for (let alb = 0; alb < ALBUMS.length; alb++) {
          const m = morphOf(alb);
          const g = bodyGeom(v.w, v.h, album(alb, { zoom: scene.zoom }), MOBILE, m);
          const e = extentOf(m);
          const where = `${ALBUMS[alb].id} · ${v.label} · ${scene.label}`;

          expect(g.cy + e.y1 * m.flatten * g.R, where).toBeLessThanOrEqual(box.cy + box.halfH + 0.5);
          expect(g.cy + e.y0 * m.flatten * g.R, where).toBeGreaterThanOrEqual(box.cy - box.halfH - 0.5);
          if (scene.zoom < 1) continue;
          expect(g.cx + e.x1 * g.R, where).toBeLessThanOrEqual(box.cx + box.halfW + 0.5);
          expect(g.cx + e.x0 * g.R, where).toBeGreaterThanOrEqual(box.cx - box.halfW - 0.5);
        }
      }
    }
  });

  it("the stage ends before the identity, so nothing of the world lands on the list", () => {
    for (const v of CANVASES) {
      const b = bandsOf(v.w, v.h, 1);
      const box = stageBox(v.w, v.h, b);
      expect(box.cy + box.halfH, v.label).toBeLessThanOrEqual(b.stage * v.h + 0.5);
    }
  });

  it("mobile draws no radial track label — the list is what names", () => {
    expect(MOBILE.ringLabels).toBe("none");
    expect(DESKTOP.ringLabels).toBe("all");
  });
});

describe("the morphology stays different across records", () => {
  const fills = (w: number, h: number) => {
    const box = stageBox(w, h, bandsOf(w, h, 1));
    return ALBUMS.map((_, alb) => {
      const m = morphOf(alb);
      const g = bodyGeom(w, h, album(alb), MOBILE, m);
      const e = extentOf(m);
      return {
        id: ALBUMS[alb].id,
        R: g.R,
        area:
          ((e.x1 - e.x0) * g.R * (e.y1 - e.y0) * m.flatten * g.R) / (4 * box.halfW * box.halfH),
      };
    });
  };

  it("the stage does not flatten the bodies: the radius still spans a wide range", () => {
    for (const v of VIEWPORTS) {
      const rs = fills(v.w, v.h).map((f) => f.R);
      expect(Math.max(...rs) / Math.min(...rs), v.label).toBeGreaterThan(1.35);
    }
  });

  it("nor does it flatten their occupancy: a compact record does not fill the stage like a vast one", () => {
    for (const v of VIEWPORTS) {
      const areas = fills(v.w, v.h).map((f) => f.area);
      expect(Math.max(...areas) / Math.min(...areas), v.label).toBeGreaterThan(2);
    }
  });

  it("any two records still have distinct radii", () => {
    const rs = fills(390, 844).map((f) => Math.round(f.R * 100) / 100);
    expect(new Set(rs).size).toBe(ALBUMS.length);
  });

  it("the stage crop only shrinks: no body grows to fill the frame", () => {
    for (const v of VIEWPORTS) {
      for (let alb = 0; alb < ALBUMS.length; alb++) {
        const m = morphOf(alb);
        const g = bodyGeom(v.w, v.h, album(alb), MOBILE, m);
        const natural =
          Math.min(v.w, v.h) * (0.42 - 0.115) * MOBILE.ringScale * m.circuit;
        expect(g.R, `${ALBUMS[alb].id} · ${v.label}`).toBeLessThanOrEqual(natural + 1e-6);
      }
    }
  });
});

describe("album identity on mobile", () => {
  it("the identity block fits its own band, on every target screen", () => {
    for (const v of CANVASES) {
      for (const scene of SCENES) {
        const s = album(0, { zoom: scene.zoom });
        const lk = lockup(v.w, v.h, s, MOBILE);
        const b = bandsOf(v.w, v.h, scene.zoom);
        const where = `${v.label} · ${scene.label}`;
        expect(lk.ay, where).toBeGreaterThanOrEqual(b.stage * v.h);
        expect(lk.my + lk.msize * 0.35, where).toBeLessThanOrEqual(b.identity * v.h + 0.5);
        expect(lk.ty, where).toBeGreaterThan(lk.ay);
        expect(lk.my, where).toBeGreaterThan(lk.ty);
      }
    }
  });

  it("the canvas text margin is the same gutter as the interface", () => {
    for (const v of CANVASES) {
      const lk = lockup(v.w, v.h, album(0), MOBILE);
      expect(lk.margin / v.w, v.label).toBeCloseTo(BAND.gutter, 10);
      expect(lk.marginTitle / v.w, v.label).toBeCloseTo(BAND.gutter, 10);
      expect(lk.marginMeta / v.w, v.label).toBeCloseTo(BAND.gutter, 10);
    }
  });

  it("the metadata line never drops below legible", () => {
    for (const v of CANVASES) {
      const dpr = v.label.includes("@1x") ? 1 : DPR_MAX;
      const lk = lockup(v.w, v.h, album(0), MOBILE);
      expect(lk.msize / dpr, v.label).toBeGreaterThanOrEqual(9.5);
      expect(lk.metaAlpha).toBeGreaterThan(0.85);
    }
  });

  it("on mobile the name has a scale ceiling; on desktop it is free", () => {
    const high = lockup(390, 2000, album(0), MOBILE);
    expect(high.size).toBeLessThan(390 * 0.105);
    expect(lockup(1440, 900, album(0), DESKTOP).size).toBeCloseTo(1440 * 0.115 - 1440 * 0.018, 6);
  });
});

describe("no canvas text leaves the viewport", () => {
  const paint = (textWidth: number, w: number, h: number, s: FieldState) => {
    const env = engineHarness();
    try {
      const covers = loadCovers();
      const back = paintContext(textWidth);
      const front = paintContext(textWidth);
      drawBack(back.ctx, w, h, s, MOBILE, {
        fonts: { archivo: "A", bodoni: "B", mono: "M" },
        covers,
        rings: new RingBakery(covers),
        weights: ALBUMS.map(() => 600),
        parts: makeParticles(),
        C: fieldConstantsOf(ALBUMS[s.alb].signature),
        morph: morphOf(s.alb),
        morphOf,
      });
      drawFront(front.ctx, w, h, s, MOBILE, {
        fonts: { archivo: "A", bodoni: "B", mono: "M" },
        covers,
      });
      return { back, front };
    } finally {
      env.restore();
    }
  };

  const sizeOf = (source: string) => Number(/(\d+(?:\.\d+)?)px/.exec(source)?.[1] ?? 0);
  const family = (sources: string[], fam: string) =>
    sources.filter((f) => f.trim().endsWith(fam)).map(sizeOf);

  it("an over-wide name shrinks until it fits the gutter", () => {
    for (const v of VIEWPORTS) {
      const s = album(0);
      const nominal = lockup(v.w, v.h, s, MOBILE);
      const wide = paint(nominal.size * 40, v.w, v.h, s);
      const names = family(wide.back.sources, "A");
      expect(names.length, `back ${v.label}`).toBeGreaterThan(1);
      expect(names[names.length - 1], `back ${v.label}`).toBeLessThan(nominal.size);
    }
  });

  it("the front title and metadata shrink too — before, they did not", () => {
    for (const v of VIEWPORTS) {
      const s = album(0);
      const lk = lockup(v.w, v.h, s, MOBILE);
      const wide = paint(lk.tsize * 40, v.w, v.h, s);
      const title = wide.front.sources.filter((f) => f.includes("italic")).map(sizeOf);
      expect(title.length, v.label).toBeGreaterThan(0);
      expect(Math.min(...title), `title ${v.label}`).toBeLessThan(lk.tsize);
    }
  });

  it("the shrinking has a floor: the identity does not become a footnote", () => {
    const s = album(0);
    const lk = lockup(390, 844, s, MOBILE);
    const wide = paint(lk.size * 400, 390, 844, s);
    const names = family(wide.back.sources, "A");
    expect(names[names.length - 1]).toBeGreaterThanOrEqual(lk.size * lk.floor - 1e-6);
  });
});
