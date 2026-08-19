import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bindInput, type InputActions } from "../engine/input";
import { recorder, fakeWindow, type FakeWindow } from "./fakes";

const W = 1000;
const H = 800;

let win: FakeWindow;
let rec: ReturnType<typeof recorder>;
let off: () => void;
let fromUi = false;

function on(options: Parameters<typeof fakeWindow>[0] = {}) {
  win = fakeWindow({ innerWidth: W, innerHeight: H, ...options });
  rec = recorder();
  off = bindInput(rec.actions as unknown as InputActions, {
    isUiTarget: () => fromUi,
  });
}

const move = (x: number, y: number) => win.dispatch("pointermove", { clientX: x, clientY: y });
const down = (x: number, y: number, pointerType = "mouse") =>
  win.dispatch("pointerdown", { clientX: x, clientY: y, pointerType });
const up = (x: number, y: number) => win.dispatch("pointerup", { clientX: x, clientY: y });

beforeEach(() => {
  fromUi = false;
  on();
});

afterEach(() => {
  off();
  win.restore();
});

describe("ciclo de vida das escutas", () => {
  it("registra todas as escutas de uma vez", () => {
    expect(win.registered()).toBe(8);
  });

  it("desliga tudo o que ligou", () => {
    off();
    expect(win.registered()).toBe(0);
  });

  it("desligar duas vezes não quebra", () => {
    off();
    expect(() => off()).not.toThrow();
  });
});

describe("cursor", () => {
  it("normaliza a posição pela janela", () => {
    move(500, 400);
    expect(rec.last("pointTo")?.args).toEqual([0.5, 0.5]);
  });

  it("segue o cursor mesmo sobre a camada de instruments", () => {
    fromUi = true;
    move(250, 200);
    expect(rec.last("pointTo")?.args).toEqual([0.25, 0.25]);
  });

  it("um toque nasce onde o dedo encostou, sem trajeto", () => {
    down(500, 400, "touch");
    expect(rec.last("teleportTo")?.args).toEqual([0.5, 0.5]);
  });

  it("o mouse não teleporta: ele chega andando", () => {
    down(500, 400, "mouse");
    expect(rec.count("teleportTo")).toBe(0);
  });
});

describe("arraste", () => {
  it("não arrasta sem o ponteiro pressionado", () => {
    move(500, 400);
    move(300, 400);
    expect(rec.count("panBy")).toBe(0);
  });

  it("informa o passo, o total e a largura da janela", () => {
    down(800, 400);
    move(700, 400);
    expect(rec.last("panBy")?.args).toEqual([-100, -100, W]);
    move(650, 400);
    expect(rec.last("panBy")?.args).toEqual([-50, -150, W]);
  });

  it("abre o arraste antes de qualquer passo", () => {
    down(800, 400);
    expect(rec.calledNames()).toContain("beginPan");
    expect(rec.count("panBy")).toBe(0);
  });

  it("um toque parado é toque, não arraste", () => {
    down(500, 400);
    move(503, 400);
    up(503, 400);
    expect(rec.last("endPan")?.args).toEqual([true]);
  });

  it("passar do limiar vira arraste", () => {
    down(500, 400);
    move(492, 400);
    up(492, 400);
    expect(rec.last("endPan")?.args).toEqual([false]);
  });

  it("vai e volta ainda é arraste: a distância é acumulada em módulo", () => {
    down(500, 400);
    move(495, 400);
    move(500, 400);
    up(500, 400);
    expect(rec.last("endPan")?.args).toEqual([false]);
  });

  it("pointercancel encerra como pointerup", () => {
    down(500, 400);
    win.dispatch("pointercancel", { clientX: 500, clientY: 400 });
    expect(rec.last("endPan")?.args).toEqual([true]);
  });

  it("soltar sem ter pressionado não encerra nada", () => {
    up(500, 400);
    expect(rec.count("endPan")).toBe(0);
  });

  it("um segundo soltar não encerra de novo", () => {
    down(500, 400);
    up(500, 400);
    rec.clear();
    up(500, 400);
    expect(rec.count("endPan")).toBe(0);
  });
});

describe("camada de instruments", () => {
  it("não começa arraste a partir de um controle", () => {
    fromUi = true;
    down(800, 400);
    move(600, 400);
    expect(rec.count("beginPan")).toBe(0);
    expect(rec.count("panBy")).toBe(0);
  });

  it("soltar sobre um controle abandona o arraste sem encerrá-lo", () => {
    down(800, 400);
    move(600, 400);
    fromUi = true;
    up(600, 400);
    expect(rec.count("endPan")).toBe(0);
  });

  it("ignora a roda sobre um controle, sem bloquear a rolagem dele", () => {
    fromUi = true;
    let blocked = false;
    win.dispatch("wheel", { deltaY: 100, deltaX: 0, preventDefault: () => (blocked = true) });
    expect(rec.count("wheelBy")).toBe(0);
    expect(blocked).toBe(false);
  });
});

describe("roda", () => {
  it("repassa os dois eixos e bloqueia a rolagem da página", () => {
    let blocked = false;
    win.dispatch("wheel", { deltaY: 120, deltaX: -30, preventDefault: () => (blocked = true) });
    expect(rec.last("wheelBy")?.args).toEqual([120, -30]);
    expect(blocked).toBe(true);
  });
});

describe("teclado", () => {
  const key = (init: Record<string, unknown>) => {
    let blocked = false;
    win.dispatch("keydown", { key: "", code: "", preventDefault: () => (blocked = true), ...init });
    return () => blocked;
  };

  it("Espaço e Enter acionam a ação principal", () => {
    key({ code: "Space" });
    key({ key: "Enter" });
    expect(rec.count("primary")).toBe(2);
  });

  it("Escape volta uma scale", () => {
    key({ key: "Escape" });
    expect(rec.count("back")).toBe(1);
  });

  it("Escape volta mesmo com o foco dentro dos instruments", () => {
    fromUi = true;
    key({ key: "Escape" });
    expect(rec.count("back")).toBe(1);
  });

  it("as setas movem o foco um passo", () => {
    key({ key: "ArrowRight" });
    key({ key: "ArrowDown" });
    expect(rec.calls.filter((c) => c.label === "stepFocus").map((c) => c.args)).toEqual([[1], [1]]);
    rec.clear();
    key({ key: "ArrowLeft" });
    key({ key: "ArrowUp" });
    expect(rec.calls.filter((c) => c.label === "stepFocus").map((c) => c.args)).toEqual([[-1], [-1]]);
  });

  it("deixa as setas e o Espaço para o controle quando o foco está nele", () => {
    fromUi = true;
    key({ key: "ArrowRight" });
    key({ code: "Space" });
    expect(rec.count("stepFocus")).toBe(0);
    expect(rec.count("primary")).toBe(0);
  });

  it("não sequestra teclas que não são do world", () => {
    const blocked = key({ key: "Tab" });
    expect(blocked()).toBe(false);
    expect(rec.calledNames().filter((n) => n !== "markIntent")).toEqual([]);
  });
});

describe("intenção e ambiente", () => {
  it("qualquer gesto conta como presença do usuário", () => {
    move(1, 1);
    expect(rec.count("markIntent")).toBe(1);
    down(1, 1);
    expect(rec.count("markIntent")).toBe(2);
    win.dispatch("wheel", { deltaY: 1, deltaX: 0 });
    expect(rec.count("markIntent")).toBe(3);
    win.dispatch("keydown", { key: "Tab", code: "Tab" });
    expect(rec.count("markIntent")).toBe(4);
  });

  it("marca presença mesmo em evento que nasce num controle", () => {
    fromUi = true;
    down(1, 1);
    expect(rec.count("markIntent")).toBe(1);
  });

  it("repassa o redimensionamento da janela", () => {
    win.dispatch("resize");
    expect(rec.count("resize")).toBe(1);
  });

  it("acompanha a preferência de movimento reduced nos dois sentidos", () => {
    win.setMotion(true);
    expect(rec.last("setReducedMotion")?.args).toEqual([true]);
    win.setMotion(false);
    expect(rec.last("setReducedMotion")?.args).toEqual([false]);
  });
});
