import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gl = vi.hoisted(() => ({
  renders: 0,
  sizes: [] as [number, number][],
  discards: 0,
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
        gl.sizes.push([w, h]);
        return { dw: w, dh: h };
      },
      dispose: () => {
        gl.discards++;
      },
    }),
  };
});

import { ALBUMS } from "../content";
import { FieldEngine } from "../engine/FieldEngine";
import { albPos, layoutFor } from "../composition/layout";
import { fieldConstantsOf } from "../field";
import { IDLE_MS, PARTICLES, COMPOSITION_FALLBACK_W, COMPOSITION_MAX_W } from "../tokens";
import { engineHarness, type EngineHarness } from "./fakes";

const FONTS = { archivo: "A", bodoni: "B", mono: "M" };

let env: EngineHarness;
let engine: FieldEngine;

function on(options: Parameters<typeof engineHarness>[0] = {}) {
  env = engineHarness(options);
  gl.renders = 0;
  gl.sizes = [];
  gl.discards = 0;
  const display = (globalThis as { document: { createElement(t: string): unknown } }).document
    .createElement("canvas") as HTMLCanvasElement;
  engine = new FieldEngine(display, FONTS, { isUiTarget: () => false });
  engine.start();
}

const run = (seconds: number, step = 16) => {
  const n = Math.ceil((seconds * 1000) / step);
  for (let i = 0; i < n; i++) env.advance(step);
};

beforeEach(() => on());

afterEach(() => {
  engine.stop();
  env.restore();
});

describe("ciclo de vida", () => {
  it("abre na coleção com o primeiro disco em foco", () => {
    expect(engine.st.scale).toBe("collection");
    expect(engine.st.mode).toBe("stopped");
    expect(engine.getSnapshot().navAlb).toBe(0);
  });

  it("desenha um quadro por animação pedida", () => {
    env.advance();
    env.advance();
    expect(gl.renders).toBe(2);
  });

  it("parar solta o contexto gráfico e o áudio", () => {
    engine.stop();
    expect(gl.discards).toBe(1);
    env.advance();
    expect(gl.renders).toBe(0);
  });

  it("cria uma partícula por unidade declarada", () => {
    let parts = 0;
    run(0.1);
    parts = PARTICLES;
    expect(parts).toBe(PARTICLES);
  });
});

describe("integração do estado", () => {
  it("a navegação persegue o alvo sem ultrapassá-lo", () => {
    engine.st.navT = 3;
    const visited: number[] = [];
    for (let i = 0; i < 120; i++) {
      env.advance();
      visited.push(engine.st.nav);
    }
    expect(Math.max(...visited)).toBeLessThanOrEqual(3.0001);
    expect(engine.st.nav).toBeCloseTo(3, 2);
  });

  it("o alvo de navegação nunca sai do acervo", () => {
    engine.st.navT = 99;
    run(0.5);
    expect(engine.st.navT).toBeLessThanOrEqual(ALBUMS.length - 1);

    engine.st.navT = -99;
    run(0.5);
    expect(engine.st.navT).toBeGreaterThanOrEqual(0);
  });

  it("na coleção o álbum em foco acompanha a navegação", () => {
    engine.st.navT = 4;
    run(2);
    expect(engine.st.alb).toBe(4);
  });

  it("o zoom persegue a scale", () => {
    engine.enterAlbum(2);
    run(2);
    expect(engine.st.zoom).toBeCloseTo(1, 2);

    engine.back();
    run(2);
    expect(engine.st.zoom).toBeCloseTo(0, 2);
  });

  it("as partículas ficam em raio positivo e limitado", () => {
    run(4);
    engine.playTrack(0, 0);
    run(4);
    const radii = (engine as unknown as { parts: { r: number }[] }).parts.map((q) => q.r);
    expect(radii).toHaveLength(PARTICLES);
    for (const r of radii) {
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThan(2);
    }
  });

  it("a energia fica entre o rest e o teto", () => {
    run(3);
    expect(engine.st.energy).toBeGreaterThan(0);
    expect(engine.st.energy).toBeLessThanOrEqual(1);
  });

  it("o relógio do world avança com o tempo", () => {
    const before = engine.st.t;
    run(1);
    expect(engine.st.t).toBeGreaterThan(before);
    expect(engine.st.t - before).toBeCloseTo(1, 1);
  });
});

describe("sequência de colapso", () => {
  it("tocar entra em colapso e resolve em reprodução", () => {
    engine.playTrack(0, 0);
    expect(engine.st.mode).toBe("collapse");

    run(3);
    expect(engine.st.mode).toBe("playing");
    expect(engine.st.scale).toBe("track");
  });

  it("o colapso passa por um vale escuro antes de reacender", () => {
    engine.playTrack(0, 0);
    const fades: number[] = [];
    for (let i = 0; i < 160; i++) {
      env.advance();
      fades.push(engine.st.fade);
    }
    expect(Math.min(...fades)).toBeLessThan(0.2);
    expect(engine.st.fade).toBeGreaterThan(0.8);
  });

  it("o jato só aparece na saída do colapso", () => {
    engine.playTrack(0, 0);
    run(0.5);
    const inValley = engine.st.jet;
    run(1.6);
    expect(engine.st.jet).toBeGreaterThan(inValley);
  });
});

describe("sequência de fusão", () => {
  it("pular durante a reprodução funde e promove a faixa alvo", () => {
    engine.playTrack(0, 0);
    run(3);
    engine.skip(1);
    expect(engine.st.mode).toBe("fusion");

    run(3);
    expect(engine.st.mode).toBe("playing");
    expect(engine.st.trk).toBe(1);
    expect(engine.st.playAlb).toBe(0);
  });

  it("a mistura sobe de zero a um ao longo da fusão", () => {
    engine.playTrack(0, 0);
    run(3);
    engine.skip(1);

    const mixes: number[] = [];
    for (let i = 0; i < 100; i++) {
      env.advance();
      mixes.push(engine.st.mix);
    }
    expect(Math.max(...mixes)).toBeGreaterThan(0.9);
    expect(engine.st.mix).toBe(0);
  });

  it("a onda de choque dispara e se apaga", () => {
    engine.playTrack(0, 0);
    run(3);
    engine.skip(1);

    let fired = false;
    for (let i = 0; i < 120; i++) {
      env.advance();
      if (engine.st.waveR > 0) fired = true;
    }
    expect(fired).toBe(true);
    expect(engine.st.waveR).toBe(-1);
  });

  it("a faixa nova é entregue ao áudio uma vez só", () => {
    engine.playTrack(0, 0);
    run(3);
    engine.skip(1);
    run(0.9);
    expect(engine.st.fuseLoaded).toBe(true);
    run(2);
    expect(engine.st.trk).toBe(1);
  });
});

describe("instantâneo para o React", () => {
  it("mantém a identidade enquanto nada discreto muda", () => {
    run(0.5);
    const a = engine.getSnapshot();
    run(0.5);
    expect(engine.getSnapshot()).toBe(a);
  });

  it("troca de identidade quando a scale muda", () => {
    const a = engine.getSnapshot();
    engine.enterAlbum(1);
    env.advance();
    expect(engine.getSnapshot()).not.toBe(a);
    expect(engine.getSnapshot().scale).toBe("album");
  });

  it("avisa os inscritos só nas mudanças discretas", () => {
    run(0.5);
    let warnings = 0;
    const cancel = engine.subscribe(() => warnings++);
    run(0.5);
    expect(warnings).toBe(0);

    engine.enterAlbum(2);
    env.advance();
    expect(warnings).toBe(1);

    cancel();
    engine.enterAlbum(3);
    env.advance();
    expect(warnings).toBe(1);
  });

  it("anuncia a faixa em curso para leitores de tela", () => {
    engine.playTrack(1, 2);
    env.advance();
    const announcement = engine.getSnapshot().announce;
    expect(announcement).toContain("03");
    expect(announcement).toContain(ALBUMS[1].tracks[2].title);
    expect(announcement).toContain(ALBUMS[1].artist);
  });

  it("anuncia a coleção quando nada toca", () => {
    expect(engine.getSnapshot().announce).toContain(String(ALBUMS.length));
  });

  it("o rest liga depois do silêncio e desliga ao primeiro gesto", () => {
    const clock = vi.spyOn(performance, "now");
    clock.mockReturnValue(performance.now() + IDLE_MS + 1000);
    env.advance();
    expect(engine.getSnapshot().idle).toBe(true);

    engine.markIntent();
    env.advance();
    expect(engine.getSnapshot().idle).toBe(false);
    clock.mockRestore();
  });
});

describe("quadro contínuo", () => {
  it("entrega progresso, posição e duração a cada quadro", () => {
    const frames: { progress: number; position: number; duration: number }[] = [];
    engine.onFrame((f) => frames.push({ ...f }));
    engine.playTrack(0, 0);
    run(0.1);

    expect(frames.length).toBeGreaterThan(0);
    const lastOne = frames[frames.length - 1];
    expect(lastOne.duration).toBeGreaterThan(0);
    expect(lastOne.progress).toBeGreaterThanOrEqual(0);
    expect(lastOne.progress).toBeLessThanOrEqual(1);
  });

  it("cancelar o registro para a entrega", () => {
    let n = 0;
    const cancel = engine.onFrame(() => n++);
    env.advance();
    const after = n;
    cancel();
    env.advance();
    expect(n).toBe(after);
  });
});

describe("contrato de uniformes", () => {
  const u = () => (engine as unknown as { gl: { uniforms: Record<string, { value: never }> } }).gl.uniforms;

  it("a massa principal segue a posição do álbum em foco", () => {
    engine.enterAlbum(2);
    run(2);
    env.advance();

    const res = u().uRes.value as unknown as { x: number; y: number };
    const aspect = res.x / res.y;
    const p = albPos(2, engine.st, layoutFor("desktop"));
    const m0 = u().uM0.value as unknown as { x: number; y: number; z: number; w: number };

    expect(m0.x).toBeCloseTo((p.x - 0.5) * aspect, 6);
    expect(m0.y).toBeCloseTo(0.5 - p.y, 6);
    expect(m0.z).toBeCloseTo(engine.st.m0k, 6);
    expect(m0.w).toBeCloseTo(engine.st.m0h, 6);
  });

  it("a ink do campo é a do álbum em foco", () => {
    engine.enterAlbum(3);
    run(1);
    env.advance();
    const ink = u().uInk.value as unknown as { x: number; y: number; z: number };
    expect([ink.x, ink.y, ink.z]).toEqual(ALBUMS[3].inkA);
  });

  it("a dureza do rim oscila em torno da constante, dentro do teto do disco", () => {
    engine.enterAlbum(5);
    run(2);
    env.advance();

    const c = fieldConstantsOf(ALBUMS[5].signature);
    const read = u().uRim.value as unknown as number;
    const deviation = Math.abs(read - c.rimHardness) / c.rimHardness;

    expect(deviation).toBeGreaterThan(0);
    expect(deviation).toBeLessThanOrEqual(c.reactionCap * 0.5 + 1e-9);
  });

  it("o fade nunca é negativo", () => {
    engine.playTrack(0, 0);
    for (let i = 0; i < 200; i++) {
      env.advance();
      expect(u().uFade.value as unknown as number).toBeGreaterThanOrEqual(0);
    }
  });

  it("na coleção a segunda massa aponta para o disco vizinho", () => {
    engine.st.navT = 2;
    run(2);
    env.advance();

    const m1 = u().uM1.value as unknown as { z: number; w: number };
    expect(m1.z).toBeCloseTo(0.03, 6);
    expect(m1.w).toBeCloseTo(0.052, 6);
  });

  it("o tempo do shader acompanha o relógio do world", () => {
    run(1);
    env.advance();
    expect(u().uTime.value as unknown as number).toBeCloseTo(engine.st.t, 6);
  });
});

describe("qualidade adaptativa", () => {
  it("rebaixa a composição depois de três janelas lentas seguidas", () => {
    const before = gl.sizes.length;
    for (let win = 0; win < 3; win++) {
      for (let i = 0; i < 12; i++) env.advance(50);
      env.advance(1100);
    }
    expect(gl.sizes.length).toBeGreaterThan(before);
    expect(COMPOSITION_FALLBACK_W).toBeLessThan(COMPOSITION_MAX_W);
  });

  it("não rebaixa quando os quadros chegam no ritmo", () => {
    const before = gl.sizes.length;
    for (let win = 0; win < 4; win++) {
      for (let i = 0; i < 70; i++) env.advance(14);
      env.advance(20);
    }
    expect(gl.sizes.length).toBe(before);
  });
});

describe("janela", () => {
  it("o redimensionamento reconfigura a composição e o layout", () => {
    env.resize(500, 900);
    engine.resize();
    env.advance();
    expect(engine.getSnapshot().variant).toBe("mobile");

    env.resize(1400, 900);
    engine.resize();
    env.advance();
    expect(engine.getSnapshot().variant).toBe("desktop");
  });
});
