import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AudioBus } from "../audio/bus";
import { LocalPlayback } from "../audio/playback";
import { NEUTRAL_SIGNATURE } from "../content/signature";
import type { AudioSource, Track } from "../content/types";
import { audioEnv } from "./fakes";

const desconhecida = { kind: "stream", uri: "x" } as unknown as AudioSource;

let env: ReturnType<typeof audioEnv>;

const track = (id: string, src: string, dur = 100): Track => ({
  id,
  title: id,
  dur,
  source: { kind: "local", src, mime: "audio/mp4" },
});

beforeEach(() => {
  env = audioEnv();
});

afterEach(() => {
  env.restore();
});

describe("LocalPlayback", () => {
  it("prepara o elemento para tocar sem espera", () => {
    new LocalPlayback();
    expect(env.created[0].preload).toBe("auto");
  });

  it("carrega a faixa e volta ao início", () => {
    const p = new LocalPlayback();
    const el = env.created[0];
    el.currentTime = 42;
    p.load({ kind: "local", src: "/music/a/01.m4a" });

    expect(el.src).toBe("/music/a/01.m4a");
    expect(el.currentTime).toBe(0);
  });

  it("recarregar a mesma faixa não a rebobina", () => {
    const p = new LocalPlayback();
    const el = env.created[0];
    p.load({ kind: "local", src: "/music/a/01.m4a" });
    el.currentTime = 42;
    p.load({ kind: "local", src: "/music/a/01.m4a" });

    expect(el.currentTime).toBe(42);
  });

  it("ignora fontes que não são locais", () => {
    const p = new LocalPlayback();
    p.load(desconhecida);
    expect(env.created[0].src).toBe("");
  });

  it("só pede CORS quando a mídia é remota", () => {
    const p = new LocalPlayback();
    const el = env.created[0];
    p.load({ kind: "local", src: "/music/a/01.m4a" });
    expect(el.crossOrigin).toBe(null);

    p.load({ kind: "local", src: "https://cdn.exemplo/a/02.m4a" });
    expect(el.crossOrigin).toBe("anonymous");
  });

  it("tocar e pausar acompanham o elemento", async () => {
    const p = new LocalPlayback();
    const el = env.created[0];
    await p.play();
    expect(p.playing).toBe(true);
    expect(el.paused).toBe(false);

    p.pause();
    expect(p.playing).toBe(false);
    expect(el.paused).toBe(true);
  });

  it("reprodução bloqueada pelo navegador não fica presa em tocando", async () => {
    const p = new LocalPlayback();
    env.created[0].failOnPlay = true;
    await p.play();
    expect(p.playing).toBe(false);
  });

  it("posição e duração ignoram valores não finitos", () => {
    const p = new LocalPlayback();
    const el = env.created[0];
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
    const el = env.created[0];
    el.currentTime = 5;
    p.seek(90);
    expect(el.currentTime).toBe(5);
  });

  it("buscar respeita os limites da faixa", () => {
    const p = new LocalPlayback();
    const el = env.created[0];
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
    let end = 0;
    p.onEnded = () => end++;
    env.created[0].emit("ended");
    expect(end).toBe(1);
  });

  it("descartar solta o elemento", () => {
    const p = new LocalPlayback();
    const el = env.created[0];
    p.load({ kind: "local", src: "/music/a/01.m4a" });
    p.dispose();

    expect(el.paused).toBe(true);
    expect(el.src).toBe("");
    expect(el.loaded).toBe(1);
  });
});

describe("AudioBus", () => {
  it("não monta o grafo de áudio antes do primeiro play", () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    expect(env.connections).toHaveLength(0);
  });

  it("liga o elemento ao analyser ao tocar", async () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();

    expect(env.connections).toHaveLength(1);
    expect(bus.playing).toBe(true);
  });

  it("reaproveita o mesmo player entre faixas do mesmo tipo", async () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    bus.load(track("b", "/music/a/02.m4a"));

    expect(env.created).toHaveLength(1);
    expect(env.created[0].src).toBe("/music/a/02.m4a");
  });

  it("ignora uma fonte sem player disponível", () => {
    const bus = new AudioBus();
    bus.load({ id: "s", title: "s", dur: 10, source: desconhecida });
    expect(env.created).toHaveLength(0);
    expect(bus.playing).toBe(false);
  });

  it("repassa o fim da faixa", async () => {
    const bus = new AudioBus();
    let end = 0;
    bus.onEnded = () => end++;
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();
    env.created[0].emit("ended");

    expect(end).toBe(1);
  });

  it("a signature escolhida antes do grafo é aplicada quando ele nasce", async () => {
    const bus = new AudioBus();
    bus.setSignature(NEUTRAL_SIGNATURE);
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();

    expect(() => bus.update(0.05)).not.toThrow();
  });

  it("o estado visual acompanha posição e duração do elemento", async () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();
    env.created[0].duration = 200;
    env.created[0].currentTime = 50;

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

  it("descartar fecha o contexto e solta os players", async () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();
    bus.dispose();

    expect(env.closedContexts()).toBe(1);
    expect(env.created[0].paused).toBe(true);
    expect(bus.playing).toBe(false);
  });

  it("buscar sem faixa carregada não quebra", () => {
    const bus = new AudioBus();
    expect(() => bus.seek(30)).not.toThrow();
    expect(bus.position).toBe(0);
  });
});

describe("volume — o ganho fica depois do analisador", () => {
  it("o grafo é elemento → analisador → ganho → saída", async () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();

    const ganho = env.gains[0];
    expect(ganho).toBeDefined();
    expect(env.connections.map((c) => c.destino)).toContain(env.analyser);
    expect(env.analyserOut).toContain(ganho);
    expect(ganho.out).toHaveLength(1);
  });

  it("baixar o volume não mexe no que o analisador enxerga", async () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();
    const antes = env.analyser.fftSize;

    bus.setVolume(0.2);
    expect(env.gains[0].gain.value).toBeCloseTo(0.2, 5);
    expect(env.created[0].volume).toBe(1);
    expect(env.analyser.fftSize).toBe(antes);
  });

  it("o mudo zera o ganho sem esquecer o nível escolhido", async () => {
    const bus = new AudioBus();
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();

    bus.setVolume(0.6);
    bus.setMuted(true);
    expect(env.gains[0].gain.value).toBe(0);
    expect(bus.volume).toBeCloseTo(0.6, 5);
    expect(bus.muted).toBe(true);

    bus.setMuted(false);
    expect(env.gains[0].gain.value).toBeCloseTo(0.6, 5);
  });

  it("o nível escolhido antes do grafo é aplicado quando ele nasce", async () => {
    const bus = new AudioBus();
    bus.setVolume(0.35);
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();
    expect(env.gains[0].gain.value).toBeCloseTo(0.35, 5);
  });
});

describe("falha de reprodução", () => {
  it("um erro no arquivo é anunciado, não engolido", async () => {
    const bus = new AudioBus();
    const faults: string[] = [];
    bus.onFault = (f) => faults.push(f);
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();

    env.created[0].emit("error");
    expect(faults).toEqual(["source"]);
    expect(bus.playing).toBe(false);
  });

  it("a recusa do navegador é distinguida do arquivo quebrado", async () => {
    const bus = new AudioBus();
    const faults: string[] = [];
    bus.onFault = (f) => faults.push(f);
    bus.load(track("a", "/music/a/01.m4a"));

    const el = env.created[0];
    el.play = async () => {
      const e = new Error("no");
      e.name = "NotAllowedError";
      throw e;
    };
    await bus.play();
    expect(faults).toEqual(["blocked"]);
  });

  it("descartar o player não inventa uma falha", async () => {
    const bus = new AudioBus();
    const faults: string[] = [];
    bus.onFault = (f) => faults.push(f);
    bus.load(track("a", "/music/a/01.m4a"));
    await bus.play();

    bus.dispose();
    env.created[0].emit("error");
    expect(faults).toEqual([]);
  });
});
