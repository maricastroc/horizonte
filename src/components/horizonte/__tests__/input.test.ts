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

describe("listener lifecycle", () => {
  it("registers every listener at once", () => {
    expect(win.registered()).toBe(8);
  });

  it("detaches everything it attached", () => {
    off();
    expect(win.registered()).toBe(0);
  });

  it("detaching twice does not break", () => {
    off();
    expect(() => off()).not.toThrow();
  });
});

describe("cursor", () => {
  it("normalizes the position by the window", () => {
    move(500, 400);
    expect(rec.last("pointTo")?.args).toEqual([0.5, 0.5, false]);
  });

  it("follows the cursor even over the instruments layer", () => {
    fromUi = true;
    move(250, 200);
    expect(rec.last("pointTo")?.args).toEqual([0.25, 0.25, true]);
  });

  it("tells the world when the pointer is over a control", () => {
    move(500, 400);
    expect(rec.last("pointTo")?.args[2]).toBe(false);
    fromUi = true;
    move(500, 400);
    expect(rec.last("pointTo")?.args[2]).toBe(true);
  });

  it("a tap is born where the finger landed, with no path", () => {
    down(500, 400, "touch");
    expect(rec.last("teleportTo")?.args).toEqual([0.5, 0.5]);
  });

  it("the mouse does not teleport: it arrives walking", () => {
    down(500, 400, "mouse");
    expect(rec.count("teleportTo")).toBe(0);
  });
});

describe("arraste", () => {
  it("does not drag without the pointer held down", () => {
    move(500, 400);
    move(300, 400);
    expect(rec.count("panBy")).toBe(0);
  });

  it("reports the step, the total and the window width", () => {
    down(800, 400);
    move(700, 400);
    expect(rec.last("panBy")?.args).toEqual([-100, -100, W]);
    move(650, 400);
    expect(rec.last("panBy")?.args).toEqual([-50, -150, W]);
  });

  it("opens the drag before any step", () => {
    down(800, 400);
    expect(rec.calledNames()).toContain("beginPan");
    expect(rec.count("panBy")).toBe(0);
  });

  it("a still touch is a tap, not a drag", () => {
    down(500, 400);
    move(503, 400);
    up(503, 400);
    expect(rec.last("endPan")?.args).toEqual([true]);
  });

  it("crossing the threshold becomes a drag", () => {
    down(500, 400);
    move(492, 400);
    up(492, 400);
    expect(rec.last("endPan")?.args).toEqual([false]);
  });

  it("there and back is still a drag: distance accumulates in magnitude", () => {
    down(500, 400);
    move(495, 400);
    move(500, 400);
    up(500, 400);
    expect(rec.last("endPan")?.args).toEqual([false]);
  });

  it("pointercancel ends like pointerup", () => {
    down(500, 400);
    win.dispatch("pointercancel", { clientX: 500, clientY: 400 });
    expect(rec.last("endPan")?.args).toEqual([true]);
  });

  it("a release without a press ends nothing", () => {
    up(500, 400);
    expect(rec.count("endPan")).toBe(0);
  });

  it("a second release does not end it again", () => {
    down(500, 400);
    up(500, 400);
    rec.clear();
    up(500, 400);
    expect(rec.count("endPan")).toBe(0);
  });
});

describe("instruments layer", () => {
  it("does not start a drag from a control", () => {
    fromUi = true;
    down(800, 400);
    move(600, 400);
    expect(rec.count("beginPan")).toBe(0);
    expect(rec.count("panBy")).toBe(0);
  });

  it("releasing over a control abandons the drag without ending it", () => {
    down(800, 400);
    move(600, 400);
    fromUi = true;
    up(600, 400);
    expect(rec.count("endPan")).toBe(0);
  });

  it("ignores the wheel over a control, without blocking its own scroll", () => {
    fromUi = true;
    let blocked = false;
    win.dispatch("wheel", { deltaY: 100, deltaX: 0, preventDefault: () => (blocked = true) });
    expect(rec.count("wheelBy")).toBe(0);
    expect(blocked).toBe(false);
  });
});

describe("roda", () => {
  it("forwards both axes and blocks the page scroll", () => {
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

  it("Space and Enter trigger the primary action", () => {
    key({ code: "Space" });
    key({ key: "Enter" });
    expect(rec.count("primary")).toBe(2);
  });

  it("Escape steps back one scale", () => {
    key({ key: "Escape" });
    expect(rec.count("back")).toBe(1);
  });

  it("Escape goes back even with focus inside the instruments", () => {
    fromUi = true;
    key({ key: "Escape" });
    expect(rec.count("back")).toBe(1);
  });

  it("the arrows move focus one step", () => {
    key({ key: "ArrowRight" });
    key({ key: "ArrowDown" });
    expect(rec.calls.filter((c) => c.label === "stepFocus").map((c) => c.args)).toEqual([[1], [1]]);
    rec.clear();
    key({ key: "ArrowLeft" });
    key({ key: "ArrowUp" });
    expect(rec.calls.filter((c) => c.label === "stepFocus").map((c) => c.args)).toEqual([[-1], [-1]]);
  });

  it("leaves arrows and Space to the control when focus is on it", () => {
    fromUi = true;
    key({ key: "ArrowRight" });
    key({ code: "Space" });
    expect(rec.count("stepFocus")).toBe(0);
    expect(rec.count("primary")).toBe(0);
  });

  it("does not hijack keys that are not the world's", () => {
    const blocked = key({ key: "Tab" });
    expect(blocked()).toBe(false);
    expect(rec.calledNames().filter((n) => n !== "markIntent")).toEqual([]);
  });
});

describe("intent and ambience", () => {
  it("any gesture counts as user presence", () => {
    move(1, 1);
    expect(rec.count("markIntent")).toBe(1);
    down(1, 1);
    expect(rec.count("markIntent")).toBe(2);
    win.dispatch("wheel", { deltaY: 1, deltaX: 0 });
    expect(rec.count("markIntent")).toBe(3);
    win.dispatch("keydown", { key: "Tab", code: "Tab" });
    expect(rec.count("markIntent")).toBe(4);
  });

  it("marks presence even for an event born on a control", () => {
    fromUi = true;
    down(1, 1);
    expect(rec.count("markIntent")).toBe(1);
  });

  it("forwards the window resize", () => {
    win.dispatch("resize");
    expect(rec.count("resize")).toBe(1);
  });

  it("follows the reduced-motion preference in both directions", () => {
    win.setMotion(true);
    expect(rec.last("setReducedMotion")?.args).toEqual([true]);
    win.setMotion(false);
    expect(rec.last("setReducedMotion")?.args).toEqual([false]);
  });
});
