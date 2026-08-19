import { describe, expect, it } from "vitest";
import { GEO, RING, RING_UNIT } from "../tokens";
import {
  albPos,
  hitTest,
  layoutFor,
  lockup,
  ringBufferScale,
  ringR,
  ringRotationTarget,
  sectorAt,
  variantFor,
} from "../composition/layout";
import { baseState } from "./fixtures";

const W = 1000;
const H = 1000;
const DESKTOP = layoutFor("desktop");
const UNIFORM = [0, 0.25, 0.5, 0.75, 1];

describe("variantFor", () => {
  it("troca de world nos breakpoints declarados", () => {
    expect(variantFor(767)).toBe("mobile");
    expect(variantFor(768)).toBe("tablet");
    expect(variantFor(1199)).toBe("tablet");
    expect(variantFor(1200)).toBe("desktop");
  });

  it("layoutFor devolve o layout do próprio variante", () => {
    for (const v of ["mobile", "tablet", "desktop"] as const) {
      expect(layoutFor(v).variant).toBe(v);
    }
  });

  it("no mobile os bodies entram em fila, um por tela", () => {
    expect(layoutFor("mobile").spreadX).toBeGreaterThan(1);
    expect(layoutFor("mobile").ringLabels).toBe("selecionado");
  });

  it("tela baixa usa a composição compacta, por mais larga que seja", () => {
    expect(variantFor(844, 390)).toBe("mobile");
    expect(variantFor(1400, 480)).toBe("mobile");
  });

  it("acima do piso de altura, a largura volta a decidir", () => {
    expect(variantFor(844, 520)).toBe("tablet");
    expect(variantFor(1400, 520)).toBe("desktop");
    expect(variantFor(700, 900)).toBe("mobile");
  });

  it("sem altura informada, nada muda", () => {
    expect(variantFor(768)).toBe("tablet");
    expect(variantFor(1200)).toBe("desktop");
  });
});

describe("albPos", () => {
  it("o corpo em foco pousa na âncora de campo", () => {
    const p = albPos(0, baseState({ nav: 0, zoom: 0 }), DESKTOP);
    expect(p.x).toBeCloseTo(GEO.anchorCollection.x, 10);
    expect(p.y).toBeCloseTo(GEO.anchorCollection.y, 10);
    expect(p.depth).toBe(1);
    expect(p.d).toBe(0);
  });

  it("o zoom leva o foco da âncora de campo à âncora de álbum", () => {
    const p = albPos(0, baseState({ nav: 0, zoom: 1 }), DESKTOP);
    expect(p.x).toBeCloseTo(GEO.anchorAlbum.x, 10);
    expect(p.y).toBeCloseTo(GEO.anchorAlbum.y, 10);
  });

  it("a profundidade cai com a distância ao foco", () => {
    const s = baseState({ nav: 0 });
    const d0 = albPos(0, s, DESKTOP).depth;
    const d1 = albPos(1, s, DESKTOP).depth;
    const d2 = albPos(2, s, DESKTOP).depth;
    expect(d0).toBeGreaterThan(d1);
    expect(d1).toBeGreaterThan(d2);
    expect(d2).toBeGreaterThan(0);
  });

  it("é simétrica em torno do foco", () => {
    const s = baseState({ nav: 2 });
    expect(albPos(1, s, DESKTOP).depth).toBeCloseTo(albPos(3, s, DESKTOP).depth, 10);
  });

  it("o zoom recolhe os vizinhos em direção ao foco", () => {
    const isOpen = albPos(1, baseState({ nav: 0, zoom: 0 }), DESKTOP);
    const closed = albPos(1, baseState({ nav: 0, zoom: 1 }), DESKTOP);
    expect(closed.x - GEO.anchorAlbum.x).toBeLessThan(isOpen.x - GEO.anchorCollection.x);
  });
});

describe("ringR e lockup", () => {
  it("o ring encolhe ao entrar no álbum e cresce ao tocar", () => {
    const field = ringR(W, H, baseState({ zoom: 0, play: 0 }), DESKTOP);
    const album = ringR(W, H, baseState({ zoom: 1, play: 0 }), DESKTOP);
    const playing = ringR(W, H, baseState({ zoom: 1, play: 1 }), DESKTOP);
    expect(album).toBeLessThan(field);
    expect(playing).toBeGreaterThan(album);
  });

  it("o ring se ajusta à menor dimensão da tela", () => {
    const s = baseState();
    expect(ringR(400, 1000, s, DESKTOP)).toBeCloseTo(ringR(1000, 400, s, DESKTOP), 10);
  });

  it("cada variante scale o ring pelo próprio fator", () => {
    const s = baseState();
    expect(ringR(W, H, s, layoutFor("mobile"))).toBeCloseTo(
      ringR(W, H, s, DESKTOP) * layoutFor("mobile").ringScale,
      10,
    );
  });

  it("ringBufferScale converte o raio na scale do buffer horneado", () => {
    expect(ringBufferScale(RING_UNIT)).toBeCloseTo(1, 10);
    expect(ringBufferScale(RING_UNIT * 3)).toBeCloseTo(3, 10);
  });

  it("o lockup cede espaço conforme a faixa toma a tela", () => {
    const stopped = lockup(W, H, baseState({ play: 0, zoom: 0 }));
    const playing = lockup(W, H, baseState({ play: 1, zoom: 0 }));
    const inside = lockup(W, H, baseState({ play: 0, zoom: 1 }));

    expect(playing.size).toBeLessThan(stopped.size);
    expect(inside.size).toBeLessThan(stopped.size);
    expect(stopped.ty).toBeGreaterThan(stopped.ay);
    expect(stopped.my).toBeGreaterThan(stopped.ty);
    expect(stopped.tsize).toBeLessThan(stopped.size);
  });
});

describe("sectorAt", () => {
  it("mapeia a volta inteira nos setores uniformes", () => {
    expect(sectorAt(UNIFORM, 0)).toBe(0);
    expect(sectorAt(UNIFORM, 0.24)).toBe(0);
    expect(sectorAt(UNIFORM, 0.26)).toBe(1);
    expect(sectorAt(UNIFORM, 0.99)).toBe(3);
  });

  it("respeita setores desiguais", () => {
    const bounds = [0, 0.1, 0.9, 1];
    expect(sectorAt(bounds, 0.05)).toBe(0);
    expect(sectorAt(bounds, 0.5)).toBe(1);
    expect(sectorAt(bounds, 0.95)).toBe(2);
  });

  it("satura no último setor em vez de sair da lista", () => {
    expect(sectorAt(UNIFORM, 1)).toBe(3);
    expect(sectorAt(UNIFORM, 4)).toBe(3);
  });
});

describe("hitTest — scale campo", () => {
  const s = baseState({ scale: "collection", nav: 0, zoom: 0 });
  const hit = (x: number, y: number) =>
    hitTest(x, y, W, H, s, DESKTOP, () => UNIFORM, 3, GEO.flatten);

  it("aponta o corpo sob o cursor", () => {
    const p = albPos(0, s, DESKTOP);
    expect(hit(p.x, p.y)).toEqual({ kind: "body", i: 0 });
  });

  it("aponta o vizinho quando o cursor viaja até ele", () => {
    const p = albPos(1, s, DESKTOP);
    expect(hit(p.x, p.y)).toEqual({ kind: "body", i: 1 });
  });

  it("devolve vazio no espaço entre os bodies", () => {
    expect(hit(0.04, 0.95)).toEqual({ kind: "empty", i: -1 });
  });
});

describe("hitTest — scale álbum", () => {
  const s = baseState({ scale: "album", alb: 0, nav: 0, zoom: 1, play: 0 });
  const R = ringR(W, H, s, DESKTOP);
  const center = albPos(0, s, DESKTOP);
  const flatten = GEO.flatten;

  const point = (radius: number, back = 0, st = s) => {
    const ang = back * Math.PI * 2;
    const c = albPos(st.alb, st, DESKTOP);
    return hitTest(
      c.x + (Math.cos(ang) * radius) / W,
      c.y + (Math.sin(ang) * radius * flatten) / H,
      W,
      H,
      st,
      DESKTOP,
      () => UNIFORM,
      3,
      flatten,
    );
  };

  it("o núcleo do corpo é alvo de transporte", () => {
    expect(point(0)).toEqual({ kind: "body", i: 0 });
    expect(point(R * 0.5)).toEqual({ kind: "body", i: 0 });
  });

  it("há uma zona morta entre o corpo e o ring", () => {
    expect(point(R * 0.58)).toEqual({ kind: "empty", i: -1 });
  });

  it("a banda do ring seleciona a faixa pelo ângulo", () => {
    expect(point(R, 0.125)).toEqual({ kind: "track", i: 0 });
    expect(point(R, 0.375)).toEqual({ kind: "track", i: 1 });
    expect(point(R, 0.625)).toEqual({ kind: "track", i: 2 });
    expect(point(R, 0.875)).toEqual({ kind: "track", i: 3 });
  });

  it("a banda cobre a espessura inteira do ring", () => {
    expect(point(R * 0.7, 0.125)).toEqual({ kind: "track", i: 0 });
    expect(point(R * 1.3, 0.125)).toEqual({ kind: "track", i: 0 });
  });

  it("fora do ring volta a ser vazio", () => {
    expect(point(R * 1.5)).toEqual({ kind: "empty", i: -1 });
  });

  it("a rotação do ring acompanha o setor apontado", () => {
    const rotated = baseState({ ...s, ringRot: Math.PI });
    expect(point(R, 0.125, s)).toEqual({ kind: "track", i: 0 });
    expect(point(R, 0.125, rotated)).toEqual({ kind: "track", i: 2 });
  });

  it("o achatamento do ring entra na conta do alvo (P6)", () => {
    expect(120).toBeLessThan(R * 0.55);
    expect(120 / flatten).toBeGreaterThan(R * 0.62);
    expect(
      hitTest(center.x, center.y - 120 / H, W, H, s, DESKTOP, () => UNIFORM, 3, flatten).kind,
    ).toBe("track");
  });
});

describe("ringRotationTarget — o anel é o relógio do disco (P13)", () => {
  const bounds = [0, 0.25, 0.75, 1];

  it("parado, todo disco mostra a mesma orientação canônica", () => {
    expect(ringRotationTarget(bounds, 0, 0, false)).toBe(RING.anchor);
    expect(ringRotationTarget(bounds, 2, 0.9, false)).toBe(RING.anchor);
  });

  it("tocando, fecha exatamente uma volta ao longo do álbum", () => {
    const inicio = ringRotationTarget(bounds, 0, 0, true);
    const fim = ringRotationTarget(bounds, 2, 1, true);
    expect(inicio - fim).toBeCloseTo(6.2832, 6);
  });

  it("o ponto que toca fica sempre na âncora", () => {
    for (const [trk, p] of [[0, 0], [0, 0.5], [1, 0.3], [2, 0.8]] as const) {
      const rot = ringRotationTarget(bounds, trk, p, true);
      const setor = bounds[trk] + (bounds[trk + 1] - bounds[trk]) * p;
      expect(setor * 6.2832 + rot).toBeCloseTo(RING.anchor, 10);
    }
  });

  it("atravessa a emenda entre faixas sem salto", () => {
    expect(ringRotationTarget(bounds, 0, 1, true)).toBeCloseTo(
      ringRotationTarget(bounds, 1, 0, true),
      10,
    );
  });

  it("é monotônica ao longo do disco", () => {
    let anterior = Infinity;
    for (const [trk, p] of [[0, 0], [0, 0.9], [1, 0.2], [1, 0.9], [2, 0.5]] as const) {
      const rot = ringRotationTarget(bounds, trk, p, true);
      expect(rot).toBeLessThan(anterior);
      anterior = rot;
    }
  });
});
