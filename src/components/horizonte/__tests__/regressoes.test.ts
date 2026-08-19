import { afterEach, describe, expect, it, vi } from "vitest";

const gl = vi.hoisted(() => ({ renders: 0 }));

vi.mock("../fieldMaterial", async (importarReal) => {
  const real = await importarReal<typeof import("../fieldMaterial")>();
  return {
    ...real,
    createFieldGL: () => ({
      uniforms: real.createFieldUniforms(),
      render: () => {
        gl.renders++;
      },
      resize: (w: number, h: number) => ({ dw: Math.max(2, w), dh: Math.max(2, h) }),
      dispose: () => {},
    }),
  };
});

import { ALBUMS } from "../content";
import { boundsOf } from "../content/signature";
import { FieldEngine } from "../engine/FieldEngine";
import * as T from "../engine/transport";
import type { Catalog } from "../engine/transport";
import { hitTest, layoutFor, sectorAt } from "../composition/layout";
import { initialState } from "../state";
import { ambienteDoMotor, type AmbienteDoMotor, type AudioFalso } from "./fakes";

const FONTES = { archivo: "A", bodoni: "B", mono: "M" };

let amb: AmbienteDoMotor | null = null;
let motor: FieldEngine | null = null;

const m = () => motor as FieldEngine;
const a = () => amb as AmbienteDoMotor;

function mundo(opcoes: Parameters<typeof ambienteDoMotor>[0] = {}) {
  amb = ambienteDoMotor(opcoes);
  const tela = (globalThis as { document: { createElement(t: string): unknown } }).document
    .createElement("canvas") as HTMLCanvasElement;
  motor = new FieldEngine(tela, FONTES, { isUiTarget: () => false });
  motor.start();
}

afterEach(() => {
  if (!amb) return;
  motor?.stop();
  amb.restaurar();
  amb = null;
  motor = null;
});

describe("aba estrangulada não pula fases da sequência", () => {
  const fonte = () =>
    (m() as unknown as { bus: { current: { el: AudioFalso } } }).bus.current.el.src;

  it("o passo de integração é limitado, por longo que seja o intervalo real", () => {
    mundo();
    m().playTrack(0, 0);
    const antes = m().st.seqT;
    a().avancar(60_000);
    expect(m().st.seqT - antes).toBeLessThanOrEqual(0.05 + 1e-9);
  });

  it("a fusão troca o arquivo mesmo com quadros de cinco segundos", () => {
    mundo();
    m().playTrack(0, 0);
    for (let i = 0; i < 80; i++) a().avancar(16);

    const antes = fonte();
    m().skip(1);
    for (let i = 0; i < 60; i++) a().avancar(5000);

    expect(m().st.mode).toBe("toca");
    expect(m().st.fuseLoaded).toBe(true);
    expect(fonte()).not.toBe(antes);
  });

  it("o colapso também chega ao fim, só que em câmera lenta", () => {
    mundo();
    m().playTrack(0, 0);
    for (let i = 0; i < 60; i++) a().avancar(5000);
    expect(m().st.mode).toBe("toca");
  });
});

describe("discos de uma faixa só", () => {
  const umaFaixa: Catalog = {
    size: 1,
    trackCount: () => 1,
    trackDuration: () => 60,
    hasTrack: (alb, trk) => alb === 0 && trk === 0,
  };

  it("pular circula sobre a própria faixa sem estourar", () => {
    const s = { ...initialState(), scale: "faixa" as const, mode: "toca" as const, playAlb: 0, trk: 0 };
    T.skip(s, umaFaixa, 1);
    expect(s.fuseB).toBe(0);
    expect(s.mode).toBe("fusao");
  });

  it("mover a seleção não sai do disco", () => {
    const s = { ...initialState(), scale: "album" as const };
    T.stepSel(s, umaFaixa, 1);
    expect(s.sel).toBe(0);
    T.stepSel(s, umaFaixa, -1);
    expect(s.sel).toBe(0);
  });

  it("o anel de uma faixa é a volta inteira", () => {
    const bounds = [0, 1];
    expect(sectorAt(bounds, 0)).toBe(0);
    expect(sectorAt(bounds, 0.999)).toBe(0);
    expect(sectorAt(bounds, 1)).toBe(0);
  });
});

describe("janela degenerada", () => {
  it("uma tela minúscula não produz medidas inválidas", () => {
    mundo({ innerWidth: 1, innerHeight: 1 });
    for (let i = 0; i < 30; i++) a().avancar(16);

    for (const [k, v] of Object.entries(m().st)) {
      if (typeof v === "number") expect(Number.isFinite(v), k).toBe(true);
    }
  });

  it("o hit-test sobrevive a dimensões degeneradas", () => {
    const s = { ...initialState(), scale: "album" as const };
    const h = hitTest(0.5, 0.5, 2, 2, s, layoutFor("desktop"), () => [0, 1], 1, 0.62);
    expect(["corpo", "faixa", "vazio"]).toContain(h.kind);
  });
});

describe("invariantes de estado", () => {
  it("nenhum campo numérico vira NaN durante uma sessão longa", () => {
    mundo();
    m().enterAlbum(3);
    for (let i = 0; i < 40; i++) a().avancar(16);
    m().playTrack(3, 1);
    for (let i = 0; i < 200; i++) a().avancar(16);
    m().skip(1);
    for (let i = 0; i < 200; i++) a().avancar(16);
    m().transport();
    for (let i = 0; i < 60; i++) a().avancar(16);
    m().back();
    m().back();
    for (let i = 0; i < 120; i++) a().avancar(16);

    for (const [k, v] of Object.entries(m().st)) {
      if (typeof v === "number") {
        expect(Number.isNaN(v), k).toBe(false);
        expect(Number.isFinite(v), k).toBe(true);
      }
    }
  });

  it("o índice do álbum nunca escapa do acervo", () => {
    mundo();
    for (const alvo of [-50, 0, 4, 99, 2]) {
      m().st.navT = alvo;
      for (let i = 0; i < 60; i++) a().avancar(16);
      expect(m().st.alb).toBeGreaterThanOrEqual(0);
      expect(m().st.alb).toBeLessThan(ALBUMS.length);
    }
  });

  it("a seleção nunca aponta para fora do disco aberto", () => {
    mundo();
    for (let i = 0; i < ALBUMS.length; i++) {
      m().enterAlbum(i);
      a().avancar(16);
      for (let k = 0; k < 30; k++) m().stepSel(1);
      expect(m().st.sel).toBeGreaterThanOrEqual(0);
      expect(m().st.sel).toBeLessThan(ALBUMS[i].tracks.length);
    }
  });
});

describe("assinatura sensorial nas bordas", () => {
  it("as fronteiras do anel somam a volta em todo o acervo", () => {
    for (const a of ALBUMS) {
      const b = boundsOf(a.signature, a.tracks.length);
      expect(b[0]).toBe(0);
      expect(b[b.length - 1]).toBeCloseTo(1, 9);
    }
  });

  it("um disco saturado no brilho continua dentro dos limites de pintura", () => {
    const saturado = ALBUMS.find((a) => a.signature.brightness === 1);
    expect(saturado).toBeDefined();
    mundo();
    const i = ALBUMS.indexOf(saturado!);
    m().enterAlbum(i);
    for (let k = 0; k < 60; k++) a().avancar(16);

    const C = (m() as unknown as { C: { flatten: number; rimHardness: number } }).C;
    expect(C.flatten).toBeGreaterThan(0.55);
    expect(C.flatten).toBeLessThanOrEqual(0.68);
    expect(C.rimHardness).toBeLessThanOrEqual(5);
  });
});
