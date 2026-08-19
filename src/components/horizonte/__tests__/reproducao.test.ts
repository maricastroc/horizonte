import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AudioBus } from "../audio/bus";
import { LocalPlayback } from "../audio/playback";
import { NEUTRAL_SIGNATURE } from "../content/signature";
import type { Track } from "../content/types";
import { ambienteDeAudio } from "./fakes";

let amb: ReturnType<typeof ambienteDeAudio>;

const faixa = (id: string, src: string, dur = 100): Track => ({
  id,
  title: id,
  dur,
  source: { kind: "local", src, mime: "audio/mp4" },
});

beforeEach(() => {
  amb = ambienteDeAudio();
});

afterEach(() => {
  amb.restaurar();
});

describe("LocalPlayback", () => {
  it("prepara o elemento para tocar sem espera", () => {
    new LocalPlayback();
    expect(amb.criados[0].preload).toBe("auto");
  });

  it("carrega a faixa e volta ao início", () => {
    const p = new LocalPlayback();
    const el = amb.criados[0];
    el.currentTime = 42;
    p.load({ kind: "local", src: "/music/a/01.m4a" });

    expect(el.src).toBe("/music/a/01.m4a");
    expect(el.currentTime).toBe(0);
  });

  it("recarregar a mesma faixa não a rebobina", () => {
    const p = new LocalPlayback();
    const el = amb.criados[0];
    p.load({ kind: "local", src: "/music/a/01.m4a" });
    el.currentTime = 42;
    p.load({ kind: "local", src: "/music/a/01.m4a" });

    expect(el.currentTime).toBe(42);
  });

  it("ignora fontes que não são locais", () => {
    const p = new LocalPlayback();
    p.load({ kind: "spotify", uri: "spotify:track:x" });
    expect(amb.criados[0].src).toBe("");
  });

  it("só pede CORS quando a mídia é remota", () => {
    const p = new LocalPlayback();
    const el = amb.criados[0];
    p.load({ kind: "local", src: "/music/a/01.m4a" });
    expect(el.crossOrigin).toBe(null);

    p.load({ kind: "local", src: "https://cdn.exemplo/a/02.m4a" });
    expect(el.crossOrigin).toBe("anonymous");
  });

  it("tocar e pausar acompanham o elemento", async () => {
    const p = new LocalPlayback();
    const el = amb.criados[0];
    await p.play();
    expect(p.playing).toBe(true);
    expect(el.paused).toBe(false);

    p.pause();
    expect(p.playing).toBe(false);
    expect(el.paused).toBe(true);
  });

  it("reprodução bloqueada pelo navegador não fica presa em tocando", async () => {
    const p = new LocalPlayback();
    amb.criados[0].falharAoTocar = true;
    await p.play();
    expect(p.playing).toBe(false);
  });

  it("posição e duração ignoram valores não finitos", () => {
    const p = new LocalPlayback();
    const el = amb.criados[0];
    expect(p.duration).toBe(0);

    el.currentTime = NaN;
    expect(p.position).toBe(0);

    el.duration = Infinity;
    expect(p.duration).toBe(0);

    el.duration = 180;
    el.currentTime = 12;
    expect(p.duration).toBe(180);
    expect(p.position).toBe(12);
  });

  it("buscar sem duração conhecida não mexe no elemento", () => {
    const p = new LocalPlayback();
    const el = amb.criados[0];
    el.currentTime = 5;
    p.seek(90);
    expect(el.currentTime).toBe(5);
  });

  it("buscar respeita os limites da faixa", () => {
    const p = new LocalPlayback();
    const el = amb.criados[0];
    el.duration = 180;

    p.seek(-10);
    expect(el.currentTime).toBe(0);

    p.seek(90);
    expect(el.currentTime).toBe(90);

    p.seek(9999);
    expect(el.currentTime).toBeCloseTo(179.95, 5);
  });

  it("avisa quando a faixa termina", () => {
    const p = new LocalPlayback();
    let fim = 0;
    p.onEnded = () => fim++;
    amb.criados[0].emitir("ended");
    expect(fim).toBe(1);
  });

  it("descartar solta o elemento", () => {
    const p = new LocalPlayback();
    const el = amb.criados[0];
    p.load({ kind: "local", src: "/music/a/01.m4a" });
    p.dispose();

    expect(el.paused).toBe(true);
    expect(el.src).toBe("");
    expect(el.carregou).toBe(1);
  });
});

describe("AudioBus", () => {
  it("não monta o grafo de áudio antes do primeiro play", () => {
    const bus = new AudioBus();
    bus.load(faixa("a", "/music/a/01.m4a"));
    expect(amb.conexoes).toHaveLength(0);
  });

  it("liga o elemento ao analisador ao tocar", async () => {
    const bus = new AudioBus();
    bus.load(faixa("a", "/music/a/01.m4a"));
    await bus.play();

    expect(amb.conexoes).toHaveLength(1);
    expect(bus.playing).toBe(true);
  });

  it("reaproveita o mesmo tocador entre faixas do mesmo tipo", async () => {
    const bus = new AudioBus();
    bus.load(faixa("a", "/music/a/01.m4a"));
    bus.load(faixa("b", "/music/a/02.m4a"));

    expect(amb.criados).toHaveLength(1);
    expect(amb.criados[0].src).toBe("/music/a/02.m4a");
  });

  it("ignora uma fonte sem tocador disponível", () => {
    const bus = new AudioBus();
    bus.load({ id: "s", title: "s", dur: 10, source: { kind: "spotify", uri: "spotify:track:x" } });
    expect(amb.criados).toHaveLength(0);
    expect(bus.playing).toBe(false);
  });

  it("repassa o fim da faixa", async () => {
    const bus = new AudioBus();
    let fim = 0;
    bus.onEnded = () => fim++;
    bus.load(faixa("a", "/music/a/01.m4a"));
    await bus.play();
    amb.criados[0].emitir("ended");

    expect(fim).toBe(1);
  });

  it("a assinatura escolhida antes do grafo é aplicada quando ele nasce", async () => {
    const bus = new AudioBus();
    bus.setSignature(NEUTRAL_SIGNATURE);
    bus.load(faixa("a", "/music/a/01.m4a"));
    await bus.play();

    expect(() => bus.update(0.05)).not.toThrow();
  });

  it("o estado visual acompanha posição e duração do elemento", async () => {
    const bus = new AudioBus();
    bus.load(faixa("a", "/music/a/01.m4a"));
    await bus.play();
    amb.criados[0].duration = 200;
    amb.criados[0].currentTime = 50;

    const s = bus.update(0.05);
    expect(s.position).toBe(50);
    expect(s.duration).toBe(200);
    expect(s.playing).toBe(true);
  });

  it("devolve sempre o mesmo objeto de estado", () => {
    const bus = new AudioBus();
    expect(bus.update(0.05)).toBe(bus.update(0.05));
  });

  it("sem grafo, o estado ainda é legível e zerado", () => {
    const bus = new AudioBus();
    const s = bus.update(0.05);
    expect(s.position).toBe(0);
    expect(s.duration).toBe(0);
    expect(s.playing).toBe(false);
    expect(s.energy).toBe(0);
  });

  it("descartar fecha o contexto e solta os tocadores", async () => {
    const bus = new AudioBus();
    bus.load(faixa("a", "/music/a/01.m4a"));
    await bus.play();
    bus.dispose();

    expect(amb.contextosFechados()).toBe(1);
    expect(amb.criados[0].paused).toBe(true);
    expect(bus.playing).toBe(false);
  });

  it("buscar sem faixa carregada não quebra", () => {
    const bus = new AudioBus();
    expect(() => bus.seek(30)).not.toThrow();
    expect(bus.position).toBe(0);
  });
});
