import { describe, expect, it } from "vitest";
import { timecode } from "../format";
import { clamp, lerp } from "../math";
import { initialState, isEngaged, progressOf } from "../state";
import type { Mode } from "../types";

describe("clamp", () => {
  it("devolve o valor quando está dentro", () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it("satura nas pontas", () => {
    expect(clamp(-3, 0, 1)).toBe(0);
    expect(clamp(9, 0, 1)).toBe(1);
    expect(clamp(0, 0, 1)).toBe(0);
    expect(clamp(1, 0, 1)).toBe(1);
  });

  it("funciona com limites negativos", () => {
    expect(clamp(-0.4, -0.5, 0.5)).toBe(-0.4);
    expect(clamp(-9, -0.5, 0.5)).toBe(-0.5);
  });
});

describe("lerp", () => {
  it("ancora nos extremos", () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it("interpola no meio", () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it("satura em vez de extrapolar", () => {
    expect(lerp(10, 20, -4)).toBe(10);
    expect(lerp(10, 20, 4)).toBe(20);
  });

  it("aceita ranges invertidos", () => {
    expect(lerp(6.2, 4.3, 1)).toBeCloseTo(4.3, 10);
  });
});

describe("timecode", () => {
  it("formata minutos e segundos com dois dígitos", () => {
    expect(timecode(0)).toBe("00:00");
    expect(timecode(9)).toBe("00:09");
    expect(timecode(75)).toBe("01:15");
    expect(timecode(600)).toBe("10:00");
  });

  it("trunca frações em vez de arredondar", () => {
    expect(timecode(59.99)).toBe("00:59");
  });

  it("passa de uma hora sem quebrar o formato", () => {
    expect(timecode(3671)).toBe("61:11");
  });

  it("lê negativo como zero", () => {
    expect(timecode(-5)).toBe("00:00");
    expect(timecode(-0.2)).toBe("00:00");
  });
});

describe("progressOf", () => {
  it("é zero sem duração conhecida", () => {
    expect(progressOf({ pos: 30, dur: 0 })).toBe(0);
  });

  it("é a fração percorrida", () => {
    expect(progressOf({ pos: 30, dur: 120 })).toBe(0.25);
  });

  it("satura em 1 se a posição passar da duração", () => {
    expect(progressOf({ pos: 200, dur: 120 })).toBe(1);
  });
});

describe("isEngaged", () => {
  it("é verdadeiro com faixa carregada sob o transporte", () => {
    expect(isEngaged("playing")).toBe(true);
    expect(isEngaged("paused")).toBe(true);
  });

  it("é falso nos modos sem faixa estabelecida", () => {
    const others: Mode[] = ["stopped", "collapse", "fusion"];
    for (const m of others) expect(isEngaged(m)).toBe(false);
  });
});

describe("initialState", () => {
  it("abre na coleção, sem nada tocando", () => {
    const s = initialState();
    expect(s.scale).toBe("collection");
    expect(s.mode).toBe("stopped");
    expect(s.playAlb).toBe(-1);
    expect(s.hover).toBe(-1);
    expect(s.hoverBody).toBe(-1);
    expect(s.waveR).toBe(-1);
  });

  it("devolve um estado novo a cada chamada", () => {
    const a = initialState();
    const b = initialState();
    expect(a).not.toBe(b);
    a.alb = 7;
    expect(b.alb).toBe(0);
  });

  it("não tem campo indefinido ou NaN", () => {
    const s = initialState() as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(s)) {
      expect(v, k).toBeDefined();
      if (typeof v === "number") expect(Number.isNaN(v), k).toBe(false);
    }
  });
});
