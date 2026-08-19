import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bindInput, type InputActions } from "../engine/input";
import { gravador, janelaFalsa, type JanelaFalsa } from "./fakes";

const W = 1000;
const H = 800;

let janela: JanelaFalsa;
let rec: ReturnType<typeof gravador>;
let desligar: () => void;
let daUi = false;

function ligar(opcoes: Parameters<typeof janelaFalsa>[0] = {}) {
  janela = janelaFalsa({ innerWidth: W, innerHeight: H, ...opcoes });
  rec = gravador();
  desligar = bindInput(rec.acoes as unknown as InputActions, {
    isUiTarget: () => daUi,
  });
}

const mover = (x: number, y: number) => janela.dispatch("pointermove", { clientX: x, clientY: y });
const descer = (x: number, y: number, pointerType = "mouse") =>
  janela.dispatch("pointerdown", { clientX: x, clientY: y, pointerType });
const subir = (x: number, y: number) => janela.dispatch("pointerup", { clientX: x, clientY: y });

beforeEach(() => {
  daUi = false;
  ligar();
});

afterEach(() => {
  desligar();
  janela.restaurar();
});

describe("ciclo de vida das escutas", () => {
  it("registra todas as escutas de uma vez", () => {
    expect(janela.registrados()).toBe(8);
  });

  it("desliga tudo o que ligou", () => {
    desligar();
    expect(janela.registrados()).toBe(0);
  });

  it("desligar duas vezes não quebra", () => {
    desligar();
    expect(() => desligar()).not.toThrow();
  });
});

describe("cursor", () => {
  it("normaliza a posição pela janela", () => {
    mover(500, 400);
    expect(rec.ultima("pointTo")?.args).toEqual([0.5, 0.5]);
  });

  it("segue o cursor mesmo sobre a camada de instrumentos", () => {
    daUi = true;
    mover(250, 200);
    expect(rec.ultima("pointTo")?.args).toEqual([0.25, 0.25]);
  });

  it("um toque nasce onde o dedo encostou, sem trajeto", () => {
    descer(500, 400, "touch");
    expect(rec.ultima("teleportTo")?.args).toEqual([0.5, 0.5]);
  });

  it("o mouse não teleporta: ele chega andando", () => {
    descer(500, 400, "mouse");
    expect(rec.contar("teleportTo")).toBe(0);
  });
});

describe("arraste", () => {
  it("não arrasta sem o ponteiro pressionado", () => {
    mover(500, 400);
    mover(300, 400);
    expect(rec.contar("panBy")).toBe(0);
  });

  it("informa o passo, o total e a largura da janela", () => {
    descer(800, 400);
    mover(700, 400);
    expect(rec.ultima("panBy")?.args).toEqual([-100, -100, W]);
    mover(650, 400);
    expect(rec.ultima("panBy")?.args).toEqual([-50, -150, W]);
  });

  it("abre o arraste antes de qualquer passo", () => {
    descer(800, 400);
    expect(rec.nomesChamados()).toContain("beginPan");
    expect(rec.contar("panBy")).toBe(0);
  });

  it("um toque parado é toque, não arraste", () => {
    descer(500, 400);
    mover(503, 400);
    subir(503, 400);
    expect(rec.ultima("endPan")?.args).toEqual([true]);
  });

  it("passar do limiar vira arraste", () => {
    descer(500, 400);
    mover(492, 400);
    subir(492, 400);
    expect(rec.ultima("endPan")?.args).toEqual([false]);
  });

  it("vai e volta ainda é arraste: a distância é acumulada em módulo", () => {
    descer(500, 400);
    mover(495, 400);
    mover(500, 400);
    subir(500, 400);
    expect(rec.ultima("endPan")?.args).toEqual([false]);
  });

  it("pointercancel encerra como pointerup", () => {
    descer(500, 400);
    janela.dispatch("pointercancel", { clientX: 500, clientY: 400 });
    expect(rec.ultima("endPan")?.args).toEqual([true]);
  });

  it("soltar sem ter pressionado não encerra nada", () => {
    subir(500, 400);
    expect(rec.contar("endPan")).toBe(0);
  });

  it("um segundo soltar não encerra de novo", () => {
    descer(500, 400);
    subir(500, 400);
    rec.limpar();
    subir(500, 400);
    expect(rec.contar("endPan")).toBe(0);
  });
});

describe("camada de instrumentos", () => {
  it("não começa arraste a partir de um controle", () => {
    daUi = true;
    descer(800, 400);
    mover(600, 400);
    expect(rec.contar("beginPan")).toBe(0);
    expect(rec.contar("panBy")).toBe(0);
  });

  it("soltar sobre um controle abandona o arraste sem encerrá-lo", () => {
    descer(800, 400);
    mover(600, 400);
    daUi = true;
    subir(600, 400);
    expect(rec.contar("endPan")).toBe(0);
  });

  it("ignora a roda sobre um controle, sem bloquear a rolagem dele", () => {
    daUi = true;
    let barrou = false;
    janela.dispatch("wheel", { deltaY: 100, deltaX: 0, preventDefault: () => (barrou = true) });
    expect(rec.contar("wheelBy")).toBe(0);
    expect(barrou).toBe(false);
  });
});

describe("roda", () => {
  it("repassa os dois eixos e bloqueia a rolagem da página", () => {
    let barrou = false;
    janela.dispatch("wheel", { deltaY: 120, deltaX: -30, preventDefault: () => (barrou = true) });
    expect(rec.ultima("wheelBy")?.args).toEqual([120, -30]);
    expect(barrou).toBe(true);
  });
});

describe("teclado", () => {
  const tecla = (init: Record<string, unknown>) => {
    let barrou = false;
    janela.dispatch("keydown", { key: "", code: "", preventDefault: () => (barrou = true), ...init });
    return () => barrou;
  };

  it("Espaço e Enter acionam a ação principal", () => {
    tecla({ code: "Space" });
    tecla({ key: "Enter" });
    expect(rec.contar("primary")).toBe(2);
  });

  it("Escape volta uma escala", () => {
    tecla({ key: "Escape" });
    expect(rec.contar("back")).toBe(1);
  });

  it("Escape volta mesmo com o foco dentro dos instrumentos", () => {
    daUi = true;
    tecla({ key: "Escape" });
    expect(rec.contar("back")).toBe(1);
  });

  it("as setas movem o foco um passo", () => {
    tecla({ key: "ArrowRight" });
    tecla({ key: "ArrowDown" });
    expect(rec.chamadas.filter((c) => c.nome === "stepFocus").map((c) => c.args)).toEqual([[1], [1]]);
    rec.limpar();
    tecla({ key: "ArrowLeft" });
    tecla({ key: "ArrowUp" });
    expect(rec.chamadas.filter((c) => c.nome === "stepFocus").map((c) => c.args)).toEqual([[-1], [-1]]);
  });

  it("deixa as setas e o Espaço para o controle quando o foco está nele", () => {
    daUi = true;
    tecla({ key: "ArrowRight" });
    tecla({ code: "Space" });
    expect(rec.contar("stepFocus")).toBe(0);
    expect(rec.contar("primary")).toBe(0);
  });

  it("não sequestra teclas que não são do mundo", () => {
    const barrou = tecla({ key: "Tab" });
    expect(barrou()).toBe(false);
    expect(rec.nomesChamados().filter((n) => n !== "markIntent")).toEqual([]);
  });
});

describe("intenção e ambiente", () => {
  it("qualquer gesto conta como presença do usuário", () => {
    mover(1, 1);
    expect(rec.contar("markIntent")).toBe(1);
    descer(1, 1);
    expect(rec.contar("markIntent")).toBe(2);
    janela.dispatch("wheel", { deltaY: 1, deltaX: 0 });
    expect(rec.contar("markIntent")).toBe(3);
    janela.dispatch("keydown", { key: "Tab", code: "Tab" });
    expect(rec.contar("markIntent")).toBe(4);
  });

  it("marca presença mesmo em evento que nasce num controle", () => {
    daUi = true;
    descer(1, 1);
    expect(rec.contar("markIntent")).toBe(1);
  });

  it("repassa o redimensionamento da janela", () => {
    janela.dispatch("resize");
    expect(rec.contar("resize")).toBe(1);
  });

  it("acompanha a preferência de movimento reduzido nos dois sentidos", () => {
    janela.mudarMovimento(true);
    expect(rec.ultima("setReducedMotion")?.args).toEqual([true]);
    janela.mudarMovimento(false);
    expect(rec.ultima("setReducedMotion")?.args).toEqual([false]);
  });
});
