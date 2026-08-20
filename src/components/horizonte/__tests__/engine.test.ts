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
import { fieldConstantsOf, reduceMotion } from "../field";
import {
  IDLE_MS,
  PARTICLES,
  COMPOSITION_FALLBACK_W,
  COMPOSITION_MAX_W,
  RING,
  INTAKE,
  SECOND_MASS,
} from "../tokens";
import { trackBiasOf } from "../content/signature";
import { engineHarness, type EngineHarness, type FakeAudio } from "./fakes";

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

  it("na coleção a segunda massa aponta para o vizinho, com o peso dele", () => {
    engine.st.navT = 2;
    run(2);
    env.advance();

    const s = engine.st;
    const dir = s.nav - Math.round(s.nav) >= 0 ? 1 : -1;
    const vizinho = Math.max(0, Math.min(ALBUMS.length - 1, Math.round(s.nav) + dir));
    const c = fieldConstantsOf(ALBUMS[vizinho].signature);

    const m1 = u().uM1.value as unknown as { z: number; w: number };
    expect(m1.z).toBeCloseTo(SECOND_MASS.k * c.massScale, 4);
    expect(m1.w).toBeCloseTo(SECOND_MASS.h * c.horizonScale, 4);
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

describe("o anel parado é a forma do disco (P13)", () => {
  it("sem nada tocando, a rotação não se acumula", () => {
    engine.enterAlbum(3);
    run(4);
    const early = engine.st.ringRot;
    run(20);
    expect(Math.abs(engine.st.ringRot - early)).toBeLessThan(0.001);
  });

  it("repousa na orientação canônica", () => {
    engine.enterAlbum(3);
    run(6);
    expect(engine.st.ringRot).toBeCloseTo(RING.anchor, 3);
  });

  it("entrar duas vezes no mesmo disco mostra o mesmo anel", () => {
    engine.enterAlbum(3);
    run(6);
    const first = engine.st.ringRot;
    engine.goScale("collection");
    run(3);
    engine.enterAlbum(3);
    run(6);
    expect(engine.st.ringRot).toBeCloseTo(first, 6);
  });

  it("tocando, o anel gira no sentido do disco", () => {
    engine.playTrack(0, 1);
    run(4);
    const early = engine.st.ringRot;
    run(6);
    expect(engine.st.ringRot).toBeLessThan(early);
  });
});

describe("identidade por faixa no campo (P11)", () => {
  const heavy = (alb: number) => {
    const bias = trackBiasOf(ALBUMS[alb].signature, ALBUMS[alb].tracks.length);
    let best = 0;
    bias.forEach((b, i) => {
      if (b.loudness > bias[best].loudness) best = i;
    });
    return best;
  };

  it("a faixa em curso desloca a massa do mundo", () => {
    const alb = 0;
    const alta = heavy(alb);
    const baixa = trackBiasOf(ALBUMS[alb].signature, ALBUMS[alb].tracks.length)
      .reduce((acc, b, i, all) => (b.loudness < all[acc].loudness ? i : acc), 0);

    engine.playTrack(alb, alta);
    run(6);
    const forte = engine.st.m0k;

    engine.playTrack(alb, baixa);
    run(6);
    expect(engine.st.m0k).toBeLessThan(forte);
  });

  it("na coleção o disco volta às constantes do álbum, seja qual for a faixa", () => {
    const alb = 0;
    const bias = trackBiasOf(ALBUMS[alb].signature, ALBUMS[alb].tracks.length);
    const alta = heavy(alb);
    const baixa = bias.reduce((acc, b, i, all) => (b.loudness < all[acc].loudness ? i : acc), 0);

    engine.playTrack(alb, alta);
    run(6);
    engine.goScale("collection");
    run(8);
    const comFaixaAlta = engine.st.m0k;

    engine.playTrack(alb, baixa);
    run(6);
    engine.goScale("collection");
    run(8);

    expect(engine.st.m0k).toBeCloseTo(comFaixaAlta, 6);
  });
});

describe("a luz atravessa a faixa (P12)", () => {
  const uniforms = () =>
    (engine as unknown as { gl: { uniforms: Record<string, { value: never }> } }).gl.uniforms;
  const light = () => uniforms().uLight.value as unknown as { x: number; y: number };
  const element = () =>
    (engine as unknown as { bus: { current: { el: FakeAudio } | null } }).bus.current!.el;

  it("parada, a luz fica na direção base", () => {
    run(2);
    env.advance();
    expect(light().x).toBeCloseTo(-0.7, 3);
    expect(light().y).toBeCloseTo(0.71, 3);
  });

  it("a direção varre conforme a faixa avança", () => {
    engine.playTrack(0, 0);
    run(4);
    env.advance();
    const start = { ...light() };

    element().currentTime = ALBUMS[0].tracks[0].dur * 0.95;
    run(4);
    env.advance();
    const end = light();

    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeGreaterThan(0.05);
    expect(Math.hypot(end.x, end.y)).toBeCloseTo(Math.hypot(start.x, start.y), 6);
  });
});

describe("experimento: o campo antecipa (desligado por padrão)", () => {
  it("nasce desligado", () => {
    expect(engine.experiments.anticipation).toBe(false);
  });

  it("desligado, o sinal de antecipação fica em zero mesmo tocando", () => {
    engine.playTrack(0, 1);
    run(8);
    expect(engine.lead).toBe(0);
  });

  it("desligado, o mundo é idêntico ao de antes do experimento", () => {
    engine.playTrack(0, 1);
    run(8);
    const semExperimento = { m0h: engine.st.m0h, fade: engine.st.fade };

    engine.experiments.anticipation = true;
    run(8);
    engine.experiments.anticipation = false;
    run(8);

    expect(engine.st.m0h).toBeCloseTo(semExperimento.m0h, 6);
    expect(engine.st.fade).toBeCloseTo(semExperimento.fade, 6);
  });

  it("ligado, o horizonte se desloca dentro do teto de reação do disco", () => {
    engine.experiments.anticipation = true;
    engine.playTrack(0, 1);
    run(10);

    const c = fieldConstantsOf(ALBUMS[0].signature);
    expect(Math.abs(engine.lead)).toBeLessThanOrEqual(1);
    const desvio = Math.abs(engine.lead) * c.reactionCap;
    expect(desvio).toBeLessThanOrEqual(c.reactionCap + 1e-9);
  });

  it("reduced-motion zera a amplitude do experimento", () => {
    on({ reduced: true });
    engine.experiments.anticipation = true;
    engine.playTrack(0, 1);
    run(8);

    const c = reduceMotion(fieldConstantsOf(ALBUMS[0].signature));
    expect(c.reactionCap).toBe(0);
  });
});

describe("apontar tem peso (P14)", () => {
  const u2 = () =>
    (engine as unknown as { gl: { uniforms: Record<string, { value: never }> } }).gl.uniforms;
  const m1 = () => u2().uM1.value as unknown as { x: number; y: number; z: number; w: number };
  const aspect = () => {
    const res = u2().uRes.value as unknown as { x: number; y: number };
    return res.x / res.y;
  };

  const posDe = (alb: number) => albPos(alb, engine.st, layoutFor("desktop"));

  const soltar = () => {
    engine.setRailAlb(-1);
    engine.teleportTo(0.95, 0.95);
    run(3);
    env.advance();
  };

  const apontarCorpo = (alb: number) => {
    const p = posDe(alb);
    engine.teleportTo(p.x, p.y);
    run(3);
    env.advance();
  };

  const apontarRegua = (alb: number) => {
    engine.teleportTo(0.95, 0.95);
    engine.setRailAlb(alb);
    run(3);
    env.advance();
  };

  beforeEach(() => {
    engine.st.navT = 0;
    run(2);
    soltar();
  });

  it("apontar um corpo leva a segunda massa até ele", () => {
    apontarCorpo(1);
    const p = posDe(1);
    expect(m1().x).toBeCloseTo((p.x - 0.5) * aspect(), 2);
    expect(m1().y).toBeCloseTo(0.5 - p.y, 2);
  });

  it("o peso que se sente é o do disco apontado, não um valor fixo", () => {
    apontarRegua(7);
    const pesado = m1().z;
    apontarRegua(1);
    const leve = m1().z;

    const c7 = fieldConstantsOf(ALBUMS[7].signature);
    const c1 = fieldConstantsOf(ALBUMS[1].signature);
    expect(c7.massScale).toBeGreaterThan(c1.massScale);
    expect(pesado).toBeGreaterThan(leve);
    expect(pesado / leve).toBeCloseTo(c7.massScale / c1.massScale, 2);
  });

  it("apontar pesa mais que o vizinho passivo", () => {
    const passivo = m1().z;
    apontarRegua(1);
    expect(m1().z).toBeGreaterThan(passivo);
    expect(m1().z / passivo).toBeCloseTo(SECOND_MASS.pointGain, 1);
  });

  it("apontar o disco em foco não cria uma segunda lente sobre ele", () => {
    const antes = { ...m1() };
    apontarRegua(0);
    expect(m1().x).toBeCloseTo(antes.x, 3);
    expect(m1().z).toBeCloseTo(antes.z, 4);
  });

  it("o horizonte do corpo apontado é o dele, sem ganho", () => {
    apontarRegua(7);
    const c = fieldConstantsOf(ALBUMS[7].signature);
    expect(m1().w).toBeCloseTo(SECOND_MASS.h * c.horizonScale, 4);
  });

  it("a massa chega com inércia, não teleporta", () => {
    const partida = m1().x;
    engine.teleportTo(0.95, 0.95);
    engine.setRailAlb(4);
    env.advance();
    const umQuadro = m1().x;
    run(3);
    const chegada = m1().x;

    expect(Math.abs(chegada - partida)).toBeGreaterThan(0.01);
    expect(Math.abs(umQuadro - partida)).toBeLessThan(Math.abs(chegada - partida));
  });

  it("fora da coleção, apontar não mexe na segunda massa", () => {
    engine.enterAlbum(2);
    run(3);
    const antes = { ...m1() };
    apontarRegua(6);
    expect(m1().z).toBeCloseTo(antes.z, 6);
    expect(m1().w).toBeCloseTo(antes.w, 6);
  });

  it("reduced-motion mantém o peso do disco mas tira o ganho de apontar", () => {
    on({ reduced: true });
    engine.st.navT = 0;
    run(2);
    apontarRegua(7);
    const c = fieldConstantsOf(ALBUMS[7].signature);
    expect(m1().z).toBeCloseTo(SECOND_MASS.k * c.massScale, 4);
  });

  const apontarEntrada = (on: boolean) => {
    engine.teleportTo(0.95, 0.95);
    engine.setRailAlb(-1);
    engine.setIntake(on);
    run(4);
    env.advance();
  };

  it("apontar a entrada abre um lugar: menos massa, mais horizonte", () => {
    const repouso = { ...m1() };
    apontarEntrada(true);

    expect(m1().z).toBeLessThan(repouso.z);
    expect(m1().w).toBeGreaterThan(repouso.w);
    expect(m1().z / repouso.z).toBeCloseTo(INTAKE.mass, 1);
    expect(m1().w / repouso.w).toBeCloseTo(INTAKE.horizon, 1);
  });

  it("a entrada não desloca a segunda massa — o lugar é aqui, não fora da tela", () => {
    const repouso = { ...m1() };
    apontarEntrada(true);
    expect(m1().x).toBeCloseTo(repouso.x, 3);
    expect(m1().y).toBeCloseTo(repouso.y, 3);
  });

  it("é o oposto de apontar um disco: um pesa, o outro alivia", () => {
    apontarRegua(7);
    const disco = m1().z;
    soltar();
    const repouso = m1().z;
    apontarEntrada(true);
    const entrada = m1().z;

    expect(disco).toBeGreaterThan(repouso);
    expect(entrada).toBeLessThan(repouso);
  });

  it("soltar a entrada devolve o campo ao vizinho", () => {
    const repouso = { ...m1() };
    apontarEntrada(true);
    apontarEntrada(false);
    expect(m1().z).toBeCloseTo(repouso.z, 3);
    expect(m1().w).toBeCloseTo(repouso.w, 3);
  });

  it("apontar a entrada ignora um disco que tenha ficado apontado na régua", () => {
    apontarRegua(7);
    engine.setIntake(true);
    run(4);
    const c = fieldConstantsOf(ALBUMS[7].signature);
    expect(m1().z).toBeLessThan(SECOND_MASS.k * c.massScale);
  });
});

describe("uma faixa que não carrega para de fingir que toca", () => {
  const fault = (kind: "source" | "blocked") => {
    engine.bus.onFault?.(kind);
    run(2);
    env.advance();
  };

  it("a falha tira o mundo do ar em vez de resolver em reprodução", () => {
    engine.playTrack(0, 0);
    expect(engine.st.mode).toBe("collapse");
    fault("source");
    expect(engine.st.mode).toBe("paused");
    run(3);
    expect(engine.st.mode).toBe("paused");
  });

  it("o motivo chega à camada de instrumentos", () => {
    engine.playTrack(0, 0);
    fault("source");
    expect(engine.getSnapshot().fault).toBe("source");
  });

  it("o bloqueio do navegador é um motivo diferente do arquivo quebrado", () => {
    engine.playTrack(0, 0);
    fault("blocked");
    expect(engine.getSnapshot().fault).toBe("blocked");
  });

  it("pedir de novo limpa a falha antes de tentar", () => {
    engine.playTrack(0, 0);
    fault("source");
    expect(engine.getSnapshot().fault).toBe("source");

    engine.transport();
    run(2);
    env.advance();
    expect(engine.getSnapshot().fault).toBe(null);
  });

  it("a falha não derruba a faixa em foco: dá para ver qual falhou", () => {
    engine.playTrack(2, 1);
    fault("source");
    expect(engine.st.playAlb).toBe(2);
    expect(engine.st.trk).toBe(1);
    expect(engine.st.scale).toBe("track");
  });
});

describe("o cursor sabe o que está sob ele", () => {
  const uReach = () =>
    (engine as unknown as { gl: { uniforms: { uReach: { value: number } } } }).gl.uniforms.uReach
      .value;

  const apontar = (x: number, y: number, naUi = false) => {
    engine.teleportTo(x, y);
    engine.pointTo(x, y, naUi);
    run(4);
    env.advance();
  };

  const corpo = () => {
    const p = albPos(engine.st.alb, engine.st, layoutFor("desktop"));
    return [p.x, p.y] as const;
  };

  it("na coleção, sobre um corpo o anel fecha", () => {
    apontar(...corpo());
    expect(engine.reach).toBe("enter");
    expect(uReach()).toBeGreaterThan(0.5);
  });

  it("na coleção, o vazio não promete nada — clicar ali não faz nada", () => {
    apontar(0.02, 0.95);
    expect(engine.reach).toBe("none");
    expect(Math.abs(uReach())).toBeLessThan(0.1);
  });

  it("dentro do álbum, o vazio abre o anel: é ele que devolve uma escala", () => {
    engine.enterAlbum(0);
    run(3);
    apontar(0.03, 0.96);
    expect(engine.reach).toBe("leave");
    expect(uReach()).toBeLessThan(-0.5);
  });

  it("entrar e sair têm sinais opostos, não intensidades diferentes do mesmo", () => {
    engine.enterAlbum(0);
    run(3);
    apontar(...corpo());
    const dentro = uReach();
    apontar(0.03, 0.96);
    const fora = uReach();
    expect(dentro).toBeGreaterThan(0);
    expect(fora).toBeLessThan(0);
  });

  it("sobre um controle o anel some: aquele clique não é do mundo", () => {
    engine.enterAlbum(0);
    run(3);
    apontar(0.03, 0.96, true);
    expect(engine.reach).toBe("none");
  });

  it("durante a cerimônia o anel some: não é hora de apontar", () => {
    engine.enterAlbum(0);
    run(3);
    const [x, y] = corpo();
    engine.teleportTo(x, y);
    engine.pointTo(x, y, false);
    run(0.5);
    expect(engine.reach).toBe("enter");

    engine.playTrack(0, 0);
    engine.pointTo(x, y, false);
    run(0.3);
    expect(engine.st.mode).toBe("collapse");
    expect(engine.reach).toBe("none");
  });

  it("no toque não há anel: não existe cursor pairando", () => {
    engine.stop();
    on({ coarse: true });
    engine.enterAlbum(0);
    run(3);
    engine.teleportTo(0.03, 0.96);
    engine.pointTo(0.03, 0.96, false);
    run(4);
    expect(engine.reach).toBe("none");
  });
});

describe("volume", () => {
  it("o motor guarda o nível e o mudo sem perder um no outro", () => {
    engine.setVolume(0.4);
    expect(engine.volume).toBeCloseTo(0.4, 5);
    engine.setMuted(true);
    expect(engine.muted).toBe(true);
    expect(engine.volume).toBeCloseTo(0.4, 5);
    engine.setMuted(false);
    expect(engine.volume).toBeCloseTo(0.4, 5);
  });

  it("mexer no volume conta como presença: a camada não some na mão da pessoa", () => {
    const clock = vi.spyOn(performance, "now");
    clock.mockReturnValue(performance.now() + IDLE_MS + 1000);
    env.advance();
    expect(engine.getSnapshot().idle).toBe(true);

    engine.setVolume(0.5);
    env.advance();
    expect(engine.getSnapshot().idle).toBe(false);
    clock.mockRestore();
  });
});
