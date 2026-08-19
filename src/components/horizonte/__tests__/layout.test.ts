import { describe, expect, it } from "vitest";
import { GEO, RING_UNIT } from "../tokens";
import {
  albPos,
  hitTest,
  layoutFor,
  lockup,
  ringBufferScale,
  ringR,
  sectorAt,
  variantFor,
} from "../composition/layout";
import { baseState } from "./fixtures";

const W = 1000;
const H = 1000;
const DESKTOP = layoutFor("desktop");
const UNIFORME = [0, 0.25, 0.5, 0.75, 1];

describe("variantFor", () => {
  it("troca de mundo nos breakpoints declarados", () => {
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

  it("no mobile os corpos entram em fila, um por tela", () => {
    expect(layoutFor("mobile").spreadX).toBeGreaterThan(1);
    expect(layoutFor("mobile").ringLabels).toBe("selecionado");
  });
});

describe("albPos", () => {
  it("o corpo em foco pousa na âncora de campo", () => {
    const p = albPos(0, baseState({ nav: 0, zoom: 0 }), DESKTOP);
    expect(p.x).toBeCloseTo(GEO.anchorCampo.x, 10);
    expect(p.y).toBeCloseTo(GEO.anchorCampo.y, 10);
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
    const aberto = albPos(1, baseState({ nav: 0, zoom: 0 }), DESKTOP);
    const fechado = albPos(1, baseState({ nav: 0, zoom: 1 }), DESKTOP);
    expect(fechado.x - GEO.anchorAlbum.x).toBeLessThan(aberto.x - GEO.anchorCampo.x);
  });
});

describe("ringR e lockup", () => {
  it("o anel encolhe ao entrar no álbum e cresce ao tocar", () => {
    const campo = ringR(W, H, baseState({ zoom: 0, play: 0 }), DESKTOP);
    const album = ringR(W, H, baseState({ zoom: 1, play: 0 }), DESKTOP);
    const tocando = ringR(W, H, baseState({ zoom: 1, play: 1 }), DESKTOP);
    expect(album).toBeLessThan(campo);
    expect(tocando).toBeGreaterThan(album);
  });

  it("o anel se ajusta à menor dimensão da tela", () => {
    const s = baseState();
    expect(ringR(400, 1000, s, DESKTOP)).toBeCloseTo(ringR(1000, 400, s, DESKTOP), 10);
  });

  it("cada variante escala o anel pelo próprio fator", () => {
    const s = baseState();
    expect(ringR(W, H, s, layoutFor("mobile"))).toBeCloseTo(
      ringR(W, H, s, DESKTOP) * layoutFor("mobile").ringScale,
      10,
    );
  });

  it("ringBufferScale converte o raio na escala do buffer horneado", () => {
    expect(ringBufferScale(RING_UNIT)).toBeCloseTo(1, 10);
    expect(ringBufferScale(RING_UNIT * 3)).toBeCloseTo(3, 10);
  });

  it("o lockup cede espaço conforme a faixa toma a tela", () => {
    const parado = lockup(W, H, baseState({ play: 0, zoom: 0 }));
    const tocando = lockup(W, H, baseState({ play: 1, zoom: 0 }));
    const dentro = lockup(W, H, baseState({ play: 0, zoom: 1 }));

    expect(tocando.size).toBeLessThan(parado.size);
    expect(dentro.size).toBeLessThan(parado.size);
    expect(parado.ty).toBeGreaterThan(parado.ay);
    expect(parado.my).toBeGreaterThan(parado.ty);
    expect(parado.tsize).toBeLessThan(parado.size);
  });
});

describe("sectorAt", () => {
  it("mapeia a volta inteira nos setores uniformes", () => {
    expect(sectorAt(UNIFORME, 0)).toBe(0);
    expect(sectorAt(UNIFORME, 0.24)).toBe(0);
    expect(sectorAt(UNIFORME, 0.26)).toBe(1);
    expect(sectorAt(UNIFORME, 0.99)).toBe(3);
  });

  it("respeita setores desiguais", () => {
    const bounds = [0, 0.1, 0.9, 1];
    expect(sectorAt(bounds, 0.05)).toBe(0);
    expect(sectorAt(bounds, 0.5)).toBe(1);
    expect(sectorAt(bounds, 0.95)).toBe(2);
  });

  it("satura no último setor em vez de sair da lista", () => {
    expect(sectorAt(UNIFORME, 1)).toBe(3);
    expect(sectorAt(UNIFORME, 4)).toBe(3);
  });
});

describe("hitTest — escala campo", () => {
  const s = baseState({ scale: "campo", nav: 0, zoom: 0 });
  const hit = (x: number, y: number) =>
    hitTest(x, y, W, H, s, DESKTOP, () => UNIFORME, 3, GEO.flatten);

  it("aponta o corpo sob o cursor", () => {
    const p = albPos(0, s, DESKTOP);
    expect(hit(p.x, p.y)).toEqual({ kind: "corpo", i: 0 });
  });

  it("aponta o vizinho quando o cursor viaja até ele", () => {
    const p = albPos(1, s, DESKTOP);
    expect(hit(p.x, p.y)).toEqual({ kind: "corpo", i: 1 });
  });

  it("devolve vazio no espaço entre os corpos", () => {
    expect(hit(0.04, 0.95)).toEqual({ kind: "vazio", i: -1 });
  });
});

describe("hitTest — escala álbum", () => {
  const s = baseState({ scale: "album", alb: 0, nav: 0, zoom: 1, play: 0 });
  const R = ringR(W, H, s, DESKTOP);
  const centro = albPos(0, s, DESKTOP);
  const flatten = GEO.flatten;

  const apontar = (raio: number, volta = 0, st = s) => {
    const ang = volta * Math.PI * 2;
    const c = albPos(st.alb, st, DESKTOP);
    return hitTest(
      c.x + (Math.cos(ang) * raio) / W,
      c.y + (Math.sin(ang) * raio * flatten) / H,
      W,
      H,
      st,
      DESKTOP,
      () => UNIFORME,
      3,
      flatten,
    );
  };

  it("o núcleo do corpo é alvo de transporte", () => {
    expect(apontar(0)).toEqual({ kind: "corpo", i: 0 });
    expect(apontar(R * 0.5)).toEqual({ kind: "corpo", i: 0 });
  });

  it("há uma zona morta entre o corpo e o anel", () => {
    expect(apontar(R * 0.58)).toEqual({ kind: "vazio", i: -1 });
  });

  it("a banda do anel seleciona a faixa pelo ângulo", () => {
    expect(apontar(R, 0.125)).toEqual({ kind: "faixa", i: 0 });
    expect(apontar(R, 0.375)).toEqual({ kind: "faixa", i: 1 });
    expect(apontar(R, 0.625)).toEqual({ kind: "faixa", i: 2 });
    expect(apontar(R, 0.875)).toEqual({ kind: "faixa", i: 3 });
  });

  it("a banda cobre a espessura inteira do anel", () => {
    expect(apontar(R * 0.7, 0.125)).toEqual({ kind: "faixa", i: 0 });
    expect(apontar(R * 1.3, 0.125)).toEqual({ kind: "faixa", i: 0 });
  });

  it("fora do anel volta a ser vazio", () => {
    expect(apontar(R * 1.5)).toEqual({ kind: "vazio", i: -1 });
  });

  it("a rotação do anel acompanha o setor apontado", () => {
    const girado = baseState({ ...s, ringRot: Math.PI });
    expect(apontar(R, 0.125, s)).toEqual({ kind: "faixa", i: 0 });
    expect(apontar(R, 0.125, girado)).toEqual({ kind: "faixa", i: 2 });
  });

  it("o achatamento do anel entra na conta do alvo (P6)", () => {
    expect(120).toBeLessThan(R * 0.55);
    expect(120 / flatten).toBeGreaterThan(R * 0.62);
    expect(
      hitTest(centro.x, centro.y - 120 / H, W, H, s, DESKTOP, () => UNIFORME, 3, flatten).kind,
    ).toBe("faixa");
  });
});
