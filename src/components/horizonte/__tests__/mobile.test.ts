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
  { label: "coleção", zoom: 0 },
  { label: "álbum", zoom: 1 },
];

describe("regiões da composição mobile", () => {
  it("as bandas se sucedem sem se sobrepor, em toda tela alvo", () => {
    for (const v of CANVASES) {
      for (const scene of SCENES) {
        const b = bandsOf(v.w, v.h, scene.zoom);
        const onde = `${v.label} · ${scene.label}`;
        expect(b.top, onde).toBeGreaterThan(0);
        expect(b.stage, onde).toBeGreaterThan(b.top);
        expect(b.identity, onde).toBeGreaterThanOrEqual(b.stage);
        expect(b.list, onde).toBeGreaterThanOrEqual(b.identity);
        expect(b.list, onde).toBeLessThan(1);
      }
    }
  });

  it("abertura, palco e transporte nunca ficam pequenos demais para o toque", () => {
    for (const v of CANVASES) {
      const px = v.h / (v.label.includes("@1x") ? 1 : DPR_MAX);
      const b = bandsOf(v.w, v.h, 1);
      expect(b.top * px, `abertura ${v.label}`).toBeGreaterThanOrEqual(72);
      expect((b.stage - b.top) * px, `palco ${v.label}`).toBeGreaterThanOrEqual(110);
      expect((1 - b.list) * px, `transporte ${v.label}`).toBeGreaterThanOrEqual(114);
    }
  });

  it("no álbum sobra lista utilizável, mesmo na tela mais curta", () => {
    for (const v of CANVASES) {
      const px = v.h / (v.label.includes("@1x") ? 1 : DPR_MAX);
      const b = bandsOf(v.w, v.h, 1);
      expect((b.list - b.identity) * px, `lista ${v.label}`).toBeGreaterThanOrEqual(2 * 48);
    }
  });

  it("na coleção o palco toma o campo, no álbum ele cede espaço à lista", () => {
    for (const v of CANVASES) {
      const campo = bandsOf(v.w, v.h, 0);
      const disco = bandsOf(v.w, v.h, 1);
      expect(campo.stage, v.label).toBeGreaterThan(disco.stage);
      expect(campo.list - campo.identity, v.label).toBeLessThan(disco.list - disco.identity);
    }
  });

  it("na paisagem do telefone a composição encolhe, mas nada é cortado", () => {
    for (const v of LANDSCAPE) {
      const b = bandsOf(v.w, v.h, 1);
      expect(b.stage, v.label).toBeGreaterThan(b.top);
      expect(b.list, v.label).toBeGreaterThanOrEqual(b.identity);
      expect(b.top * v.h, `abertura ${v.label}`).toBeGreaterThanOrEqual(62);
      expect((1 - b.list) * v.h, `transporte ${v.label}`).toBeGreaterThanOrEqual(124);
      expect((b.list - b.identity) * v.h, `lista ${v.label}`).toBeGreaterThanOrEqual(48);
    }
  });

  it("desktop e tablet não ganham bandas: a composição é só do mobile", () => {
    expect(MOBILE.staged).toBe(true);
    expect(DESKTOP.staged).toBe(false);
    expect(layoutFor("tablet").staged).toBe(false);
  });
});

describe("o mundo cabe no palco — nenhuma morfologia invade a interface", () => {
  it("corpo, coroa e satélites de todo álbum ficam dentro do palco", () => {
    for (const v of CANVASES) {
      for (const scene of SCENES) {
        const box = stageBox(v.w, v.h, bandsOf(v.w, v.h, scene.zoom));
        for (let alb = 0; alb < ALBUMS.length; alb++) {
          const m = morphOf(alb);
          const g = bodyGeom(v.w, v.h, album(alb, { zoom: scene.zoom }), MOBILE, m);
          const e = extentOf(m);
          const onde = `${ALBUMS[alb].id} · ${v.label} · ${scene.label}`;

          expect(g.cy + e.y1 * m.flatten * g.R, onde).toBeLessThanOrEqual(box.cy + box.halfH + 0.5);
          expect(g.cy + e.y0 * m.flatten * g.R, onde).toBeGreaterThanOrEqual(box.cy - box.halfH - 0.5);
          if (scene.zoom < 1) continue;
          expect(g.cx + e.x1 * g.R, onde).toBeLessThanOrEqual(box.cx + box.halfW + 0.5);
          expect(g.cx + e.x0 * g.R, onde).toBeGreaterThanOrEqual(box.cx - box.halfW - 0.5);
        }
      }
    }
  });

  it("o palco termina antes da identidade, então nada do mundo pousa sobre a lista", () => {
    for (const v of CANVASES) {
      const b = bandsOf(v.w, v.h, 1);
      const box = stageBox(v.w, v.h, b);
      expect(box.cy + box.halfH, v.label).toBeLessThanOrEqual(b.stage * v.h + 0.5);
    }
  });

  it("o mobile não desenha rótulo radial de faixa — a lista é quem nomeia", () => {
    expect(MOBILE.ringLabels).toBe("nenhum");
    expect(DESKTOP.ringLabels).toBe("todos");
  });
});

describe("a morfologia continua diferente entre discos", () => {
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

  it("o palco não nivela os corpos: o raio continua percorrendo um intervalo largo", () => {
    for (const v of VIEWPORTS) {
      const rs = fills(v.w, v.h).map((f) => f.R);
      expect(Math.max(...rs) / Math.min(...rs), v.label).toBeGreaterThan(1.35);
    }
  });

  it("nem os nivela em ocupação: um disco compacto não enche o palco como um extenso", () => {
    for (const v of VIEWPORTS) {
      const areas = fills(v.w, v.h).map((f) => f.area);
      expect(Math.max(...areas) / Math.min(...areas), v.label).toBeGreaterThan(2);
    }
  });

  it("dois discos quaisquer continuam com raios distintos", () => {
    const rs = fills(390, 844).map((f) => Math.round(f.R * 100) / 100);
    expect(new Set(rs).size).toBe(ALBUMS.length);
  });

  it("o corte do palco só encolhe: nenhum corpo cresce para preencher a moldura", () => {
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

describe("identidade do álbum no mobile", () => {
  it("o bloco de identidade cabe na própria banda, em toda tela alvo", () => {
    for (const v of CANVASES) {
      for (const scene of SCENES) {
        const s = album(0, { zoom: scene.zoom });
        const lk = lockup(v.w, v.h, s, MOBILE);
        const b = bandsOf(v.w, v.h, scene.zoom);
        const onde = `${v.label} · ${scene.label}`;
        expect(lk.ay, onde).toBeGreaterThanOrEqual(b.stage * v.h);
        expect(lk.my + lk.msize * 0.35, onde).toBeLessThanOrEqual(b.identity * v.h + 0.5);
        expect(lk.ty, onde).toBeGreaterThan(lk.ay);
        expect(lk.my, onde).toBeGreaterThan(lk.ty);
      }
    }
  });

  it("a margem do texto no canvas é a mesma calha da interface", () => {
    for (const v of CANVASES) {
      const lk = lockup(v.w, v.h, album(0), MOBILE);
      expect(lk.margin / v.w, v.label).toBeCloseTo(BAND.gutter, 10);
      expect(lk.marginTitle / v.w, v.label).toBeCloseTo(BAND.gutter, 10);
      expect(lk.marginMeta / v.w, v.label).toBeCloseTo(BAND.gutter, 10);
    }
  });

  it("a linha de metadados nunca cai abaixo do legível", () => {
    for (const v of CANVASES) {
      const dpr = v.label.includes("@1x") ? 1 : DPR_MAX;
      const lk = lockup(v.w, v.h, album(0), MOBILE);
      expect(lk.msize / dpr, v.label).toBeGreaterThanOrEqual(9.5);
      expect(lk.metaAlpha).toBeGreaterThan(0.85);
    }
  });

  it("no mobile o nome tem teto de escala; no desktop ele é livre", () => {
    const alto = lockup(390, 2000, album(0), MOBILE);
    expect(alto.size).toBeLessThan(390 * 0.105);
    expect(lockup(1440, 900, album(0), DESKTOP).size).toBeCloseTo(1440 * 0.115 - 1440 * 0.018, 6);
  });
});

describe("nenhum texto do canvas sai da viewport", () => {
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
  const familia = (sources: string[], fam: string) =>
    sources.filter((f) => f.trim().endsWith(fam)).map(sizeOf);

  it("um nome largo demais encolhe até caber na calha", () => {
    for (const v of VIEWPORTS) {
      const s = album(0);
      const nominal = lockup(v.w, v.h, s, MOBILE);
      const largo = paint(nominal.size * 40, v.w, v.h, s);
      const nomes = familia(largo.back.sources, "A");
      expect(nomes.length, `back ${v.label}`).toBeGreaterThan(1);
      expect(nomes[nomes.length - 1], `back ${v.label}`).toBeLessThan(nominal.size);
    }
  });

  it("o título e os metadados da frente também encolhem — antes não encolhiam", () => {
    for (const v of VIEWPORTS) {
      const s = album(0);
      const lk = lockup(v.w, v.h, s, MOBILE);
      const largo = paint(lk.tsize * 40, v.w, v.h, s);
      const titulo = largo.front.sources.filter((f) => f.includes("italic")).map(sizeOf);
      expect(titulo.length, v.label).toBeGreaterThan(0);
      expect(Math.min(...titulo), `título ${v.label}`).toBeLessThan(lk.tsize);
    }
  });

  it("o encolhimento tem piso: a identidade não vira nota de rodapé", () => {
    const s = album(0);
    const lk = lockup(390, 844, s, MOBILE);
    const largo = paint(lk.size * 400, 390, 844, s);
    const nomes = familia(largo.back.sources, "A");
    expect(nomes[nomes.length - 1]).toBeGreaterThanOrEqual(lk.size * lk.floor - 1e-6);
  });
});
