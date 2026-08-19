import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gl = vi.hoisted(() => ({
  renders: 0,
  tamanhos: [] as [number, number][],
  descartes: 0,
}));

vi.mock("../fieldMaterial", async (importarReal) => {
  const real = await importarReal<typeof import("../fieldMaterial")>();
  return {
    ...real,
    createFieldGL: () => ({
      uniforms: real.createFieldUniforms(),
      render: () => {
        gl.renders++;
      },
      resize: (w: number, h: number) => {
        gl.tamanhos.push([w, h]);
        return { dw: w, dh: h };
      },
      dispose: () => {
        gl.descartes++;
      },
    }),
  };
});

import { ALBUMS } from "../content";
import { FieldEngine } from "../engine/FieldEngine";
import { albPos, layoutFor } from "../composition/layout";
import { fieldConstantsOf } from "../field";
import { IDLE_MS, PARTICLES, COMPOSITION_FALLBACK_W, COMPOSITION_MAX_W } from "../tokens";
import { ambienteDoMotor, type AmbienteDoMotor } from "./fakes";

const FONTES = { archivo: "A", bodoni: "B", mono: "M" };

let amb: AmbienteDoMotor;
let motor: FieldEngine;

function ligar(opcoes: Parameters<typeof ambienteDoMotor>[0] = {}) {
  amb = ambienteDoMotor(opcoes);
  gl.renders = 0;
  gl.tamanhos = [];
  gl.descartes = 0;
  const tela = (globalThis as { document: { createElement(t: string): unknown } }).document
    .createElement("canvas") as HTMLCanvasElement;
  motor = new FieldEngine(tela, FONTES, { isUiTarget: () => false });
  motor.start();
}

const rodar = (segundos: number, passo = 16) => {
  const n = Math.ceil((segundos * 1000) / passo);
  for (let i = 0; i < n; i++) amb.avancar(passo);
};

beforeEach(() => ligar());

afterEach(() => {
  motor.stop();
  amb.restaurar();
});

describe("ciclo de vida", () => {
  it("abre na coleção com o primeiro disco em foco", () => {
    expect(motor.st.scale).toBe("campo");
    expect(motor.st.mode).toBe("parado");
    expect(motor.getSnapshot().navAlb).toBe(0);
  });

  it("desenha um quadro por animação pedida", () => {
    amb.avancar();
    amb.avancar();
    expect(gl.renders).toBe(2);
  });

  it("parar solta o contexto gráfico e o áudio", () => {
    motor.stop();
    expect(gl.descartes).toBe(1);
    amb.avancar();
    expect(gl.renders).toBe(0);
  });

  it("cria uma partícula por unidade declarada", () => {
    let parts = 0;
    rodar(0.1);
    parts = PARTICLES;
    expect(parts).toBe(PARTICLES);
  });
});

describe("integração do estado", () => {
  it("a navegação persegue o alvo sem ultrapassá-lo", () => {
    motor.st.navT = 3;
    const visitados: number[] = [];
    for (let i = 0; i < 120; i++) {
      amb.avancar();
      visitados.push(motor.st.nav);
    }
    expect(Math.max(...visitados)).toBeLessThanOrEqual(3.0001);
    expect(motor.st.nav).toBeCloseTo(3, 2);
  });

  it("o alvo de navegação nunca sai do acervo", () => {
    motor.st.navT = 99;
    rodar(0.5);
    expect(motor.st.navT).toBeLessThanOrEqual(ALBUMS.length - 1);

    motor.st.navT = -99;
    rodar(0.5);
    expect(motor.st.navT).toBeGreaterThanOrEqual(0);
  });

  it("na coleção o álbum em foco acompanha a navegação", () => {
    motor.st.navT = 4;
    rodar(2);
    expect(motor.st.alb).toBe(4);
  });

  it("o zoom persegue a escala", () => {
    motor.enterAlbum(2);
    rodar(2);
    expect(motor.st.zoom).toBeCloseTo(1, 2);

    motor.back();
    rodar(2);
    expect(motor.st.zoom).toBeCloseTo(0, 2);
  });

  it("as partículas ficam em raio positivo e limitado", () => {
    rodar(4);
    motor.playTrack(0, 0);
    rodar(4);
    const raios = (motor as unknown as { parts: { r: number }[] }).parts.map((q) => q.r);
    expect(raios).toHaveLength(PARTICLES);
    for (const r of raios) {
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThan(2);
    }
  });

  it("a energia fica entre o repouso e o teto", () => {
    rodar(3);
    expect(motor.st.energy).toBeGreaterThan(0);
    expect(motor.st.energy).toBeLessThanOrEqual(1);
  });

  it("o relógio do mundo avança com o tempo", () => {
    const antes = motor.st.t;
    rodar(1);
    expect(motor.st.t).toBeGreaterThan(antes);
    expect(motor.st.t - antes).toBeCloseTo(1, 1);
  });
});

describe("sequência de colapso", () => {
  it("tocar entra em colapso e resolve em reprodução", () => {
    motor.playTrack(0, 0);
    expect(motor.st.mode).toBe("colapso");

    rodar(3);
    expect(motor.st.mode).toBe("toca");
    expect(motor.st.scale).toBe("faixa");
  });

  it("o colapso passa por um vale escuro antes de reacender", () => {
    motor.playTrack(0, 0);
    const fades: number[] = [];
    for (let i = 0; i < 160; i++) {
      amb.avancar();
      fades.push(motor.st.fade);
    }
    expect(Math.min(...fades)).toBeLessThan(0.2);
    expect(motor.st.fade).toBeGreaterThan(0.8);
  });

  it("o jato só aparece na saída do colapso", () => {
    motor.playTrack(0, 0);
    rodar(0.5);
    const noVale = motor.st.jet;
    rodar(1.6);
    expect(motor.st.jet).toBeGreaterThan(noVale);
  });
});

describe("sequência de fusão", () => {
  it("pular durante a reprodução funde e promove a faixa alvo", () => {
    motor.playTrack(0, 0);
    rodar(3);
    motor.skip(1);
    expect(motor.st.mode).toBe("fusao");

    rodar(3);
    expect(motor.st.mode).toBe("toca");
    expect(motor.st.trk).toBe(1);
    expect(motor.st.playAlb).toBe(0);
  });

  it("a mistura sobe de zero a um ao longo da fusão", () => {
    motor.playTrack(0, 0);
    rodar(3);
    motor.skip(1);

    const mixes: number[] = [];
    for (let i = 0; i < 100; i++) {
      amb.avancar();
      mixes.push(motor.st.mix);
    }
    expect(Math.max(...mixes)).toBeGreaterThan(0.9);
    expect(motor.st.mix).toBe(0);
  });

  it("a onda de choque dispara e se apaga", () => {
    motor.playTrack(0, 0);
    rodar(3);
    motor.skip(1);

    let disparou = false;
    for (let i = 0; i < 120; i++) {
      amb.avancar();
      if (motor.st.waveR > 0) disparou = true;
    }
    expect(disparou).toBe(true);
    expect(motor.st.waveR).toBe(-1);
  });

  it("a faixa nova é entregue ao áudio uma vez só", () => {
    motor.playTrack(0, 0);
    rodar(3);
    motor.skip(1);
    rodar(0.9);
    expect(motor.st.fuseLoaded).toBe(true);
    rodar(2);
    expect(motor.st.trk).toBe(1);
  });
});

describe("instantâneo para o React", () => {
  it("mantém a identidade enquanto nada discreto muda", () => {
    rodar(0.5);
    const a = motor.getSnapshot();
    rodar(0.5);
    expect(motor.getSnapshot()).toBe(a);
  });

  it("troca de identidade quando a escala muda", () => {
    const a = motor.getSnapshot();
    motor.enterAlbum(1);
    amb.avancar();
    expect(motor.getSnapshot()).not.toBe(a);
    expect(motor.getSnapshot().scale).toBe("album");
  });

  it("avisa os inscritos só nas mudanças discretas", () => {
    rodar(0.5);
    let avisos = 0;
    const cancelar = motor.subscribe(() => avisos++);
    rodar(0.5);
    expect(avisos).toBe(0);

    motor.enterAlbum(2);
    amb.avancar();
    expect(avisos).toBe(1);

    cancelar();
    motor.enterAlbum(3);
    amb.avancar();
    expect(avisos).toBe(1);
  });

  it("anuncia a faixa em curso para leitores de tela", () => {
    motor.playTrack(1, 2);
    amb.avancar();
    const anuncio = motor.getSnapshot().announce;
    expect(anuncio).toContain("03");
    expect(anuncio).toContain(ALBUMS[1].tracks[2].title);
    expect(anuncio).toContain(ALBUMS[1].artist);
  });

  it("anuncia a coleção quando nada toca", () => {
    expect(motor.getSnapshot().announce).toContain(String(ALBUMS.length));
  });

  it("o repouso liga depois do silêncio e desliga ao primeiro gesto", () => {
    const relogio = vi.spyOn(performance, "now");
    relogio.mockReturnValue(performance.now() + IDLE_MS + 1000);
    amb.avancar();
    expect(motor.getSnapshot().idle).toBe(true);

    motor.markIntent();
    amb.avancar();
    expect(motor.getSnapshot().idle).toBe(false);
    relogio.mockRestore();
  });
});

describe("quadro contínuo", () => {
  it("entrega progresso, posição e duração a cada quadro", () => {
    const quadros: { progress: number; position: number; duration: number }[] = [];
    motor.onFrame((f) => quadros.push({ ...f }));
    motor.playTrack(0, 0);
    rodar(0.1);

    expect(quadros.length).toBeGreaterThan(0);
    const ultimo = quadros[quadros.length - 1];
    expect(ultimo.duration).toBeGreaterThan(0);
    expect(ultimo.progress).toBeGreaterThanOrEqual(0);
    expect(ultimo.progress).toBeLessThanOrEqual(1);
  });

  it("cancelar o registro para a entrega", () => {
    let n = 0;
    const cancelar = motor.onFrame(() => n++);
    amb.avancar();
    const depois = n;
    cancelar();
    amb.avancar();
    expect(n).toBe(depois);
  });
});

describe("contrato de uniformes", () => {
  const u = () => (motor as unknown as { gl: { uniforms: Record<string, { value: never }> } }).gl.uniforms;

  it("a massa principal segue a posição do álbum em foco", () => {
    motor.enterAlbum(2);
    rodar(2);
    amb.avancar();

    const res = u().uRes.value as unknown as { x: number; y: number };
    const aspecto = res.x / res.y;
    const p = albPos(2, motor.st, layoutFor("desktop"));
    const m0 = u().uM0.value as unknown as { x: number; y: number; z: number; w: number };

    expect(m0.x).toBeCloseTo((p.x - 0.5) * aspecto, 6);
    expect(m0.y).toBeCloseTo(0.5 - p.y, 6);
    expect(m0.z).toBeCloseTo(motor.st.m0k, 6);
    expect(m0.w).toBeCloseTo(motor.st.m0h, 6);
  });

  it("a tinta do campo é a do álbum em foco", () => {
    motor.enterAlbum(3);
    rodar(1);
    amb.avancar();
    const ink = u().uInk.value as unknown as { x: number; y: number; z: number };
    expect([ink.x, ink.y, ink.z]).toEqual(ALBUMS[3].inkA);
  });

  it("a dureza do rim oscila em torno da constante, dentro do teto do disco", () => {
    motor.enterAlbum(5);
    rodar(2);
    amb.avancar();

    const c = fieldConstantsOf(ALBUMS[5].signature);
    const lido = u().uRim.value as unknown as number;
    const desvio = Math.abs(lido - c.rimHardness) / c.rimHardness;

    expect(desvio).toBeGreaterThan(0);
    expect(desvio).toBeLessThanOrEqual(c.reactionCap * 0.5 + 1e-9);
  });

  it("o fade nunca é negativo", () => {
    motor.playTrack(0, 0);
    for (let i = 0; i < 200; i++) {
      amb.avancar();
      expect(u().uFade.value as unknown as number).toBeGreaterThanOrEqual(0);
    }
  });

  it("na coleção a segunda massa aponta para o disco vizinho", () => {
    motor.st.navT = 2;
    rodar(2);
    amb.avancar();

    const m1 = u().uM1.value as unknown as { z: number; w: number };
    expect(m1.z).toBeCloseTo(0.03, 6);
    expect(m1.w).toBeCloseTo(0.052, 6);
  });

  it("o tempo do shader acompanha o relógio do mundo", () => {
    rodar(1);
    amb.avancar();
    expect(u().uTime.value as unknown as number).toBeCloseTo(motor.st.t, 6);
  });
});

describe("qualidade adaptativa", () => {
  it("rebaixa a composição depois de três janelas lentas seguidas", () => {
    const antes = gl.tamanhos.length;
    for (let janela = 0; janela < 3; janela++) {
      for (let i = 0; i < 12; i++) amb.avancar(50);
      amb.avancar(1100);
    }
    expect(gl.tamanhos.length).toBeGreaterThan(antes);
    expect(COMPOSITION_FALLBACK_W).toBeLessThan(COMPOSITION_MAX_W);
  });

  it("não rebaixa quando os quadros chegam no ritmo", () => {
    const antes = gl.tamanhos.length;
    for (let janela = 0; janela < 4; janela++) {
      for (let i = 0; i < 70; i++) amb.avancar(14);
      amb.avancar(20);
    }
    expect(gl.tamanhos.length).toBe(antes);
  });
});

describe("janela", () => {
  it("o redimensionamento reconfigura a composição e o layout", () => {
    amb.redimensionar(500, 900);
    motor.resize();
    amb.avancar();
    expect(motor.getSnapshot().variant).toBe("mobile");

    amb.redimensionar(1400, 900);
    motor.resize();
    amb.avancar();
    expect(motor.getSnapshot().variant).toBe("desktop");
  });
});
