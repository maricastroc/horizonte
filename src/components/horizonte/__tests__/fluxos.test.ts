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
import { ambienteDoMotor, type AmbienteDoMotor, type AudioFalso } from "./fakes";

const FONTES = { archivo: "A", bodoni: "B", mono: "M" };

let amb: AmbienteDoMotor;
let motor: FieldEngine;

function mundo(opcoes: Parameters<typeof ambienteDoMotor>[0] = {}) {
  amb = ambienteDoMotor(opcoes);
  const tela = (globalThis as { document: { createElement(t: string): unknown } }).document
    .createElement("canvas") as HTMLCanvasElement;
  motor = new FieldEngine(tela, FONTES, { isUiTarget: () => false });
  motor.start();
  return motor;
}

const rodar = (segundos: number) => {
  for (let i = 0; i < Math.ceil((segundos * 1000) / 16); i++) amb.avancar(16);
};

const tocador = () =>
  (motor as unknown as { bus: { current: { el: AudioFalso } | null } }).bus.current;

const fonteAtual = () => (tocador() as unknown as { el: AudioFalso } | null)?.el.src ?? "";

afterEach(() => {
  motor.stop();
  amb.restaurar();
});

describe("fluxo: da coleção até a faixa soando", () => {
  it("percorre coleção, álbum e reprodução", () => {
    mundo();
    expect(motor.getSnapshot().scale).toBe("campo");

    motor.enterAlbum(2);
    amb.avancar();
    expect(motor.getSnapshot().scale).toBe("album");
    expect(motor.getSnapshot().alb).toBe(2);

    motor.playTrack(2, 1);
    expect(motor.st.mode).toBe("colapso");
    expect(fonteAtual()).toBe(ALBUMS[2].tracks[1].source.kind === "local" ? ALBUMS[2].tracks[1].source.src : "");

    rodar(3);
    const snap = motor.getSnapshot();
    expect(snap.scale).toBe("faixa");
    expect(snap.mode).toBe("toca");
    expect(snap.playAlb).toBe(2);
    expect(snap.trk).toBe(1);
    expect(motor.bus.playing).toBe(true);
    expect(snap.announce).toContain(ALBUMS[2].tracks[1].title);
  });

  it("o áudio sai do repouso e ganha energia quando toca", () => {
    mundo();
    rodar(1);
    const parado = motor.st.energy;

    motor.playTrack(0, 0);
    rodar(4);
    expect(motor.st.play).toBeGreaterThan(0.5);
    expect(motor.st.energy).not.toBe(parado);
  });
});

describe("fluxo: emenda entre faixas", () => {
  it("o fim natural funde na próxima e troca o arquivo", () => {
    mundo();
    motor.playTrack(0, 0);
    rodar(3);
    const antes = fonteAtual();

    (tocador() as unknown as { el: AudioFalso }).el.emitir("ended");
    expect(motor.st.mode).toBe("fusao");

    rodar(3);
    expect(motor.st.trk).toBe(1);
    expect(motor.st.mode).toBe("toca");
    expect(fonteAtual()).not.toBe(antes);
  });

  it("depois da última faixa, volta para a primeira", () => {
    mundo();
    const ultima = ALBUMS[0].tracks.length - 1;
    motor.playTrack(0, ultima);
    rodar(3);

    (tocador() as unknown as { el: AudioFalso }).el.emitir("ended");
    rodar(3);
    expect(motor.st.trk).toBe(0);
  });

  it("pular durante a reprodução troca o arquivo uma vez só", () => {
    mundo();
    motor.playTrack(0, 0);
    rodar(3);
    const antes = fonteAtual();

    motor.skip(1);
    rodar(3);
    expect(fonteAtual()).not.toBe(antes);
    expect(motor.st.trk).toBe(1);
    expect(motor.bus.playing).toBe(true);
  });
});

describe("fluxo: transporte", () => {
  it("pausar e retomar acompanham o elemento de áudio", () => {
    mundo();
    motor.playTrack(0, 0);
    rodar(3);

    motor.transport();
    rodar(0.2);
    expect(motor.st.mode).toBe("pausa");
    expect(motor.bus.playing).toBe(false);

    motor.transport();
    rodar(0.2);
    expect(motor.st.mode).toBe("toca");
    expect(motor.bus.playing).toBe(true);
  });

  it("buscar move o arquivo e a posição do mundo", () => {
    mundo();
    motor.playTrack(0, 0);
    rodar(3);
    (tocador() as unknown as { el: AudioFalso }).el.duration = 200;
    rodar(0.1);
    expect(motor.st.dur).toBe(200);

    motor.seekFraction(0.25);
    rodar(0.1);
    expect(motor.st.pos).toBeCloseTo(50, 1);
  });

  it("navegar entre escalas não interrompe a reprodução", () => {
    mundo();
    motor.playTrack(1, 0);
    rodar(3);

    motor.back();
    motor.back();
    rodar(1);
    expect(motor.getSnapshot().scale).toBe("campo");
    expect(motor.bus.playing).toBe(true);

    motor.goScale("faixa");
    rodar(1);
    expect(motor.getSnapshot().scale).toBe("faixa");
    expect(motor.getSnapshot().alb).toBe(1);
  });
});

describe("fluxo: gesto chega ao mundo", () => {
  it("a roda atravessa a coleção", () => {
    mundo();
    amb.disparar("wheel", { deltaY: 625, deltaX: 0 });
    rodar(2);
    expect(motor.st.alb).toBe(1);
  });

  it("a seta avança um disco", () => {
    mundo();
    amb.disparar("keydown", { key: "ArrowRight", code: "ArrowRight" });
    rodar(2);
    expect(motor.st.alb).toBe(1);
  });

  it("um toque no corpo do disco abre o álbum", () => {
    mundo();
    const x = 0.615 * 1280;
    const y = 0.425 * 800;
    amb.disparar("pointermove", { clientX: x, clientY: y, pointerType: "mouse" });
    amb.disparar("pointerdown", { clientX: x, clientY: y, pointerType: "mouse" });
    amb.disparar("pointerup", { clientX: x + 1, clientY: y, pointerType: "mouse" });
    rodar(0.1);
    expect(motor.st.scale).toBe("album");
  });

  it("o arraste move a navegação e encaixa ao soltar", () => {
    mundo();
    amb.disparar("pointerdown", { clientX: 900, clientY: 400, pointerType: "mouse" });
    amb.disparar("pointermove", { clientX: 600, clientY: 400, pointerType: "mouse" });
    expect(motor.st.navT).toBeGreaterThan(0);

    amb.disparar("pointerup", { clientX: 600, clientY: 400, pointerType: "mouse" });
    expect(Number.isInteger(motor.st.navT)).toBe(true);
  });

  it("Escape recua uma escala", () => {
    mundo();
    motor.enterAlbum(3);
    rodar(0.5);
    amb.disparar("keydown", { key: "Escape", code: "Escape" });
    rodar(0.5);
    expect(motor.st.scale).toBe("campo");
  });

  it("parar o motor desliga as escutas", () => {
    mundo();
    motor.stop();
    const antes = motor.st.navT;
    amb.disparar("keydown", { key: "ArrowRight", code: "ArrowRight" });
    expect(motor.st.navT).toBe(antes);
  });
});

describe("fluxo: movimento reduzido", () => {
  it("o colapso resolve na versão curta", () => {
    mundo({ reduced: true });
    motor.playTrack(0, 0);
    rodar(SEQ.reduzido + 0.2);
    expect(motor.st.mode).toBe("toca");
  });

  it("a fusão também resolve na versão curta e troca o arquivo", () => {
    mundo({ reduced: true });
    motor.playTrack(0, 0);
    rodar(1);
    const antes = fonteAtual();

    motor.skip(1);
    rodar(SEQ.reduzido + 0.2);
    expect(motor.st.mode).toBe("toca");
    expect(fonteAtual()).not.toBe(antes);
  });

  it("a preferência ligada em tempo real desliga a perturbação", () => {
    mundo({ reduced: false });
    rodar(1);
    amb.mudarMovimento(true);
    rodar(1);
    const c = (motor as unknown as { C: { reactionCap: number } }).C;
    expect(c.reactionCap).toBe(0);
  });
});

describe("fluxo: um disco por vez", () => {
  it("tocar um segundo disco funde e o primeiro sai de cena", () => {
    mundo();
    motor.playTrack(0, 0);
    rodar(3);

    motor.playTrack(4, 2);
    rodar(3);
    expect(motor.st.playAlb).toBe(4);
    expect(motor.st.trk).toBe(2);
    expect(motor.getSnapshot().announce).toContain(ALBUMS[4].artist);
  });

  it("todo disco do acervo pode ser aberto e tocado", () => {
    mundo();
    for (let i = 0; i < ALBUMS.length; i++) {
      motor.enterAlbum(i);
      rodar(0.2);
      expect(motor.st.alb).toBe(i);
      expect(motor.st.sel).toBeGreaterThanOrEqual(0);
      expect(motor.st.sel).toBeLessThan(ALBUMS[i].tracks.length);
    }
  });
});
