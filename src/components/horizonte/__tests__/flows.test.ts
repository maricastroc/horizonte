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
      resize: (w: number, h: number) => ({ dw: w, dh: h }),
      dispose: () => {},
    }),
  };
});

import { ALBUMS } from "../content";
import { FieldEngine } from "../engine/FieldEngine";
import { SEQ } from "../tokens";
import { engineHarness, type EngineHarness, type FakeAudio } from "./fakes";

const FONTS = { archivo: "A", bodoni: "B", mono: "M" };

let env: EngineHarness;
let engine: FieldEngine;

function world(options: Parameters<typeof engineHarness>[0] = {}) {
  env = engineHarness(options);
  const display = (globalThis as { document: { createElement(t: string): unknown } }).document
    .createElement("canvas") as HTMLCanvasElement;
  engine = new FieldEngine(display, FONTS, { isUiTarget: () => false });
  engine.start();
  return engine;
}

const run = (seconds: number) => {
  for (let i = 0; i < Math.ceil((seconds * 1000) / 16); i++) env.advance(16);
};

const player = () =>
  (engine as unknown as { bus: { current: { el: FakeAudio } | null } }).bus.current;

const currentSource = () => (player() as unknown as { el: FakeAudio } | null)?.el.src ?? "";

afterEach(() => {
  engine.stop();
  env.restore();
});

describe("fluxo: da coleção até a faixa soando", () => {
  it("percorre coleção, álbum e reprodução", () => {
    world();
    expect(engine.getSnapshot().scale).toBe("collection");

    engine.enterAlbum(2);
    env.advance();
    expect(engine.getSnapshot().scale).toBe("album");
    expect(engine.getSnapshot().alb).toBe(2);

    engine.playTrack(2, 1);
    expect(engine.st.mode).toBe("collapse");
    expect(currentSource()).toBe(ALBUMS[2].tracks[1].source.kind === "local" ? ALBUMS[2].tracks[1].source.src : "");

    run(3);
    const snap = engine.getSnapshot();
    expect(snap.scale).toBe("track");
    expect(snap.mode).toBe("playing");
    expect(snap.playAlb).toBe(2);
    expect(snap.trk).toBe(1);
    expect(engine.bus.playing).toBe(true);
    expect(snap.announce).toContain(ALBUMS[2].tracks[1].title);
  });

  it("o áudio sai do rest e ganha energia quando toca", () => {
    world();
    run(1);
    const stopped = engine.st.energy;

    engine.playTrack(0, 0);
    run(4);
    expect(engine.st.play).toBeGreaterThan(0.5);
    expect(engine.st.energy).not.toBe(stopped);
  });
});

describe("fluxo: emenda entre faixas", () => {
  it("o fim natural emenda na próxima e troca o arquivo, sem cerimônia", () => {
    world();
    engine.playTrack(0, 0);
    run(3);
    const before = currentSource();

    (player() as unknown as { el: FakeAudio }).el.emit("ended");
    expect(engine.st.mode).toBe("playing");
    expect(engine.st.trk).toBe(1);
    expect(currentSource()).not.toBe(before);

    run(3);
    expect(engine.st.mode).toBe("playing");
    expect(engine.st.mix).toBe(0);
    expect(engine.st.waveR).toBe(-1);
  });

  it("depois da última faixa, volta para a primeira", () => {
    world();
    const last = ALBUMS[0].tracks.length - 1;
    engine.playTrack(0, last);
    run(3);

    (player() as unknown as { el: FakeAudio }).el.emit("ended");
    run(3);
    expect(engine.st.trk).toBe(0);
  });

  it("pular durante a reprodução troca o arquivo uma vez só", () => {
    world();
    engine.playTrack(0, 0);
    run(3);
    const before = currentSource();

    engine.skip(1);
    run(3);
    expect(currentSource()).not.toBe(before);
    expect(engine.st.trk).toBe(1);
    expect(engine.bus.playing).toBe(true);
  });
});

describe("fluxo: transporte", () => {
  it("pausar e retomar acompanham o elemento de áudio", () => {
    world();
    engine.playTrack(0, 0);
    run(3);

    engine.transport();
    run(0.2);
    expect(engine.st.mode).toBe("paused");
    expect(engine.bus.playing).toBe(false);

    engine.transport();
    run(0.2);
    expect(engine.st.mode).toBe("playing");
    expect(engine.bus.playing).toBe(true);
  });

  it("buscar move o arquivo e a posição do world", () => {
    world();
    engine.playTrack(0, 0);
    run(3);
    (player() as unknown as { el: FakeAudio }).el.duration = 200;
    run(0.1);
    expect(engine.st.dur).toBe(200);

    engine.seekFraction(0.25);
    run(0.1);
    expect(engine.st.pos).toBeCloseTo(50, 1);
  });

  it("navegar entre scales não interrompe a reprodução", () => {
    world();
    engine.playTrack(1, 0);
    run(3);

    engine.back();
    engine.back();
    run(1);
    expect(engine.getSnapshot().scale).toBe("collection");
    expect(engine.bus.playing).toBe(true);

    engine.goScale("track");
    run(1);
    expect(engine.getSnapshot().scale).toBe("track");
    expect(engine.getSnapshot().alb).toBe(1);
  });
});

describe("fluxo: gesto chega ao world", () => {
  it("a roda atravessa a coleção", () => {
    world();
    env.fire("wheel", { deltaY: 625, deltaX: 0 });
    run(2);
    expect(engine.st.alb).toBe(1);
  });

  it("a seta avança um disco", () => {
    world();
    env.fire("keydown", { key: "ArrowRight", code: "ArrowRight" });
    run(2);
    expect(engine.st.alb).toBe(1);
  });

  it("um toque no corpo do disco abre o álbum", () => {
    world();
    const x = 0.615 * 1280;
    const y = 0.425 * 800;
    env.fire("pointermove", { clientX: x, clientY: y, pointerType: "mouse" });
    env.fire("pointerdown", { clientX: x, clientY: y, pointerType: "mouse" });
    env.fire("pointerup", { clientX: x + 1, clientY: y, pointerType: "mouse" });
    run(0.1);
    expect(engine.st.scale).toBe("album");
  });

  it("o arraste move a navegação e encaixa ao soltar", () => {
    world();
    env.fire("pointerdown", { clientX: 900, clientY: 400, pointerType: "mouse" });
    env.fire("pointermove", { clientX: 600, clientY: 400, pointerType: "mouse" });
    expect(engine.st.navT).toBeGreaterThan(0);

    env.fire("pointerup", { clientX: 600, clientY: 400, pointerType: "mouse" });
    expect(Number.isInteger(engine.st.navT)).toBe(true);
  });

  it("Escape recua uma scale", () => {
    world();
    engine.enterAlbum(3);
    run(0.5);
    env.fire("keydown", { key: "Escape", code: "Escape" });
    run(0.5);
    expect(engine.st.scale).toBe("collection");
  });

  it("parar o motor desliga as escutas", () => {
    world();
    engine.stop();
    const before = engine.st.navT;
    env.fire("keydown", { key: "ArrowRight", code: "ArrowRight" });
    expect(engine.st.navT).toBe(before);
  });
});

describe("fluxo: movimento reduced", () => {
  it("o colapso resolve na versão curta", () => {
    world({ reduced: true });
    engine.playTrack(0, 0);
    run(SEQ.reduced + 0.2);
    expect(engine.st.mode).toBe("playing");
  });

  it("a fusão também resolve na versão curta e troca o arquivo", () => {
    world({ reduced: true });
    engine.playTrack(0, 0);
    run(1);
    const before = currentSource();

    engine.skip(1);
    run(SEQ.reduced + 0.2);
    expect(engine.st.mode).toBe("playing");
    expect(currentSource()).not.toBe(before);
  });

  it("a preferência ligada em tempo real desliga a perturbação", () => {
    world({ reduced: false });
    run(1);
    env.setMotion(true);
    run(1);
    const c = (engine as unknown as { C: { reactionCap: number } }).C;
    expect(c.reactionCap).toBe(0);
  });
});

describe("fluxo: um disco por vez", () => {
  it("tocar um segundo disco funde e o primeiro sai de cena", () => {
    world();
    engine.playTrack(0, 0);
    run(3);

    engine.playTrack(4, 2);
    run(3);
    expect(engine.st.playAlb).toBe(4);
    expect(engine.st.trk).toBe(2);
    expect(engine.getSnapshot().announce).toContain(ALBUMS[4].artist);
  });

  it("todo disco do acervo pode ser aberto e tocado", () => {
    world();
    for (let i = 0; i < ALBUMS.length; i++) {
      engine.enterAlbum(i);
      run(0.2);
      expect(engine.st.alb).toBe(i);
      expect(engine.st.sel).toBeGreaterThanOrEqual(0);
      expect(engine.st.sel).toBeLessThan(ALBUMS[i].tracks.length);
    }
  });
});
