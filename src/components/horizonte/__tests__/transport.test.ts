import { describe, expect, it } from "vitest";
import * as T from "../engine/transport";
import type { AudioEffect, Catalog } from "../engine/transport";
import { initialState } from "../state";
import type { FieldState } from "../types";

const TRACKS = [2, 3, 4];

const catalog: Catalog = {
  size: TRACKS.length,
  trackCount: (alb) => TRACKS[alb],
  trackDuration: (alb, trk) => 100 + alb * 10 + trk,
  hasTrack: (alb, trk) => alb >= 0 && alb < TRACKS.length && trk >= 0 && trk < TRACKS[alb],
};

const state = (over: Partial<FieldState> = {}): FieldState => ({ ...initialState(), ...over });

const playing = (over: Partial<FieldState> = {}) =>
  state({ scale: "track", mode: "playing", playAlb: 1, alb: 1, trk: 1, sel: 1, ...over });

const kinds = (effects: AudioEffect[]) => effects.map((e) => e.kind);

describe("enterAlbum", () => {
  it("leva a scale do álbum e alinha a navegação", () => {
    const s = state();
    expect(T.enterAlbum(s, catalog, 2)).toEqual([]);
    expect(s).toMatchObject({ alb: 2, navT: 2, scale: "album", zoomT: 1 });
  });

  it("arredonda e satura dentro do acervo", () => {
    const s = state();
    T.enterAlbum(s, catalog, 9);
    expect(s.alb).toBe(2);
    T.enterAlbum(s, catalog, -4);
    expect(s.alb).toBe(0);
    T.enterAlbum(s, catalog, 1.6);
    expect(s.alb).toBe(2);
  });

  it("entrar no álbum que toca seleciona a faixa em curso", () => {
    const s = state({ playAlb: 1, trk: 2 });
    T.enterAlbum(s, catalog, 1);
    expect(s.sel).toBe(2);
  });

  it("entrar em outro álbum começa da primeira faixa", () => {
    const s = state({ playAlb: 1, trk: 2 });
    T.enterAlbum(s, catalog, 0);
    expect(s.sel).toBe(0);
  });
});

describe("playTrack", () => {
  it("colapsa para a faixa e pede o carregamento", () => {
    const s = state({ alb: 2 });
    const effects = T.playTrack(s, catalog, 2, 3);
    expect(effects).toEqual([{ kind: "load", alb: 2, trk: 3 }]);
    expect(s).toMatchObject({
      playAlb: 2, alb: 2, trk: 3, sel: 3, scale: "track", mode: "collapse", pos: 0, seqT: 0,
    });
    expect(s.dur).toBe(catalog.trackDuration(2, 3));
  });

  it("pedir a faixa que já toca alterna o transporte", () => {
    const s = playing();
    expect(kinds(T.playTrack(s, catalog, 1, 1))).toEqual(["pause"]);
    expect(s.mode).toBe("paused");
  });

  it("outra faixa com o disco engajado funde em vez de recomeçar", () => {
    const s = playing();
    expect(T.playTrack(s, catalog, 1, 2)).toEqual([]);
    expect(s).toMatchObject({ mode: "fusion", fuseAlb: 1, fuseB: 2 });
    expect(s.trk).toBe(1);
  });

  it("fora da scale de faixa, sempre recomeça", () => {
    const s = state({ scale: "album", mode: "playing", playAlb: 1, alb: 1, trk: 1 });
    expect(kinds(T.playTrack(s, catalog, 1, 2))).toEqual(["load"]);
    expect(s.mode).toBe("collapse");
  });
});

describe("transport", () => {
  it("sem faixa carregada, toca a seleção", () => {
    const s = state({ scale: "album", alb: 2, sel: 3 });
    expect(kinds(T.transport(s, catalog))).toEqual(["load"]);
    expect(s).toMatchObject({ playAlb: 2, trk: 3 });
  });

  it("tocando vira pausa", () => {
    const s = playing();
    expect(kinds(T.transport(s, catalog))).toEqual(["pause"]);
    expect(s.mode).toBe("paused");
  });

  it("o colapso também pode ser interrompido", () => {
    const s = playing({ mode: "collapse" });
    expect(kinds(T.transport(s, catalog))).toEqual(["pause"]);
    expect(s.mode).toBe("paused");
  });

  it("pausado volta a tocar", () => {
    const s = playing({ mode: "paused" });
    expect(kinds(T.transport(s, catalog))).toEqual(["play"]);
    expect(s.mode).toBe("playing");
  });

  it("durante a fusão o transporte não responde", () => {
    const s = playing({ mode: "fusion" });
    expect(T.transport(s, catalog)).toEqual([]);
    expect(s.mode).toBe("fusion");
  });
});

describe("back", () => {
  it("da faixa volta ao álbum", () => {
    const s = playing();
    T.back(s);
    expect(s).toMatchObject({ scale: "album", zoomT: 1 });
  });

  it("do álbum volta à coleção e solta o hover", () => {
    const s = state({ scale: "album", hover: 3 });
    T.back(s);
    expect(s).toMatchObject({ scale: "collection", zoomT: 0, hover: -1 });
  });

  it("na coleção não há para onde voltar", () => {
    const s = state();
    T.back(s);
    expect(s.scale).toBe("collection");
  });

  it("voltar não interrompe a reprodução", () => {
    const s = playing();
    T.back(s);
    T.back(s);
    expect(s.mode).toBe("playing");
    expect(s.playAlb).toBe(1);
  });
});

describe("goScale", () => {
  it("a coleção é sempre alcançável", () => {
    const s = playing({ hover: 2 });
    T.goScale(s, catalog, "collection");
    expect(s).toMatchObject({ scale: "collection", zoomT: 0, hover: -1 });
  });

  it("da coleção, o álbum é o que está sob a navegação", () => {
    const s = state({ nav: 1.6 });
    T.goScale(s, catalog, "album");
    expect(s).toMatchObject({ scale: "album", alb: 2 });
  });

  it("da faixa, o álbum é só uma mudança de scale", () => {
    const s = playing();
    T.goScale(s, catalog, "album");
    expect(s).toMatchObject({ scale: "album", zoomT: 1, alb: 1 });
  });

  it("a faixa volta para o disco que está tocando", () => {
    const s = state({ scale: "collection", playAlb: 2, trk: 1, alb: 0 });
    expect(T.goScale(s, catalog, "track")).toEqual([]);
    expect(s).toMatchObject({ scale: "track", alb: 2 });
  });

  it("sem nada tocando, a faixa começa a seleção atual", () => {
    const s = state({ scale: "album", alb: 2, sel: 3 });
    expect(kinds(T.goScale(s, catalog, "track"))).toEqual(["load"]);
    expect(s).toMatchObject({ playAlb: 2, trk: 3 });
  });
});

describe("primary", () => {
  it("na coleção, entra no álbum sob a navegação", () => {
    const s = state({ nav: 2.4 });
    T.primary(s, catalog);
    expect(s).toMatchObject({ scale: "album", alb: 2 });
  });

  it("no álbum, toca a seleção", () => {
    const s = state({ scale: "album", alb: 2, sel: 1 });
    expect(kinds(T.primary(s, catalog))).toEqual(["load"]);
  });

  it("na faixa, alterna o transporte", () => {
    const s = playing();
    expect(kinds(T.primary(s, catalog))).toEqual(["pause"]);
  });
});

describe("stepSel", () => {
  it("na coleção não há seleção para mover", () => {
    const s = state();
    expect(T.stepSel(s, catalog, 1)).toEqual([]);
    expect(s.sel).toBe(0);
  });

  it("circula dentro do álbum nos dois sentidos", () => {
    const s = state({ scale: "album", alb: 2, sel: 3 });
    T.stepSel(s, catalog, 1);
    expect(s.sel).toBe(0);
    T.stepSel(s, catalog, -1);
    expect(s.sel).toBe(3);
  });

  it("com o disco engajado, mover a seleção funde", () => {
    const s = playing({ alb: 1, sel: 1 });
    T.stepSel(s, catalog, 1);
    expect(s).toMatchObject({ mode: "fusion", fuseB: 2, fuseAlb: 1 });
  });

  it("no álbum, mover a seleção não mexe no áudio", () => {
    const s = state({ scale: "album", mode: "playing", playAlb: 1, alb: 1, sel: 0 });
    expect(T.stepSel(s, catalog, 1)).toEqual([]);
    expect(s.mode).toBe("playing");
  });
});

describe("skip", () => {
  it("na coleção sem nada tocando, atravessa os discos", () => {
    const s = state({ nav: 0.4 });
    T.skip(s, catalog, 1);
    expect(s.navT).toBe(1);
  });

  it("na coleção, para nas bordas do acervo", () => {
    const s = state({ nav: 0 });
    T.skip(s, catalog, -1);
    expect(s.navT).toBe(0);
    s.nav = 2;
    T.skip(s, catalog, 1);
    expect(s.navT).toBe(2);
  });

  it("com faixa em curso, funde para a próxima", () => {
    const s = playing({ alb: 1, trk: 1 });
    T.skip(s, catalog, 1);
    expect(s).toMatchObject({ mode: "fusion", fuseAlb: 1, fuseB: 2 });
  });

  it("circula no fim do disco", () => {
    const s = playing({ alb: 1, trk: 2 });
    T.skip(s, catalog, 1);
    expect(s.fuseB).toBe(0);
  });

  it("anterior na primeira faixa vai para a última", () => {
    const s = playing({ alb: 1, trk: 0 });
    T.skip(s, catalog, -1);
    expect(s.fuseB).toBe(2);
  });

  it("durante o colapso também funde", () => {
    const s = playing({ mode: "collapse", alb: 1, trk: 0 });
    T.skip(s, catalog, 1);
    expect(s.mode).toBe("fusion");
  });

  it("folheando o disco que toca, pular ainda troca a faixa", () => {
    const s = state({ scale: "album", alb: 2, sel: 0, playAlb: 2, mode: "playing" });
    expect(T.skip(s, catalog, 1)).toEqual([]);
    expect(s).toMatchObject({ mode: "fusion", fuseAlb: 2, fuseB: 1 });
  });

  it("folheando outro disco, pular só move a seleção", () => {
    const s = state({ scale: "album", alb: 0, sel: 0, playAlb: 2, trk: 3, mode: "playing" });
    expect(T.skip(s, catalog, 1)).toEqual([]);
    expect(s).toMatchObject({ sel: 1, mode: "playing", playAlb: 2, trk: 3 });
  });
});

describe("fusão", () => {
  it("uma fusão em curso não é interrompida por outra", () => {
    const s = playing();
    T.fuseTo(s, 1, 2);
    T.fuseTo(s, 0, 0);
    expect(s).toMatchObject({ fuseAlb: 1, fuseB: 2 });
  });

  it("a fusão nasce com o áudio ainda não trocado", () => {
    const s = playing();
    T.fuseTo(s, 1, 2);
    expect(s.fuseLoaded).toBe(false);
    expect(s.mix).toBe(0);
  });

  it("a troca de áudio acontece uma vez só", () => {
    const s = playing();
    T.fuseTo(s, 1, 2);
    expect(T.commitFusion(s, catalog)).toEqual([{ kind: "load", alb: 1, trk: 2 }]);
    expect(T.commitFusion(s, catalog)).toEqual([]);
    expect(T.commitFusion(s, catalog)).toEqual([]);
  });

  it("uma faixa inexistente não gera carregamento", () => {
    const s = playing();
    T.fuseTo(s, 1, 99);
    expect(T.commitFusion(s, catalog)).toEqual([]);
    expect(s.fuseLoaded).toBe(true);
  });

  it("encerrar promove o alvo a faixa em curso", () => {
    const s = playing({ alb: 1, trk: 0 });
    T.fuseTo(s, 2, 3);
    T.endFusion(s, catalog, 0);

    expect(s).toMatchObject({
      playAlb: 2, alb: 2, trk: 3, sel: 3, mode: "playing", mix: 0, pos: 0, waveR: -1, scale: "track",
    });
    expect(s.dur).toBe(catalog.trackDuration(2, 3));
  });

  it("a duração real do arquivo tem precedência sobre a do catálogo", () => {
    const s = playing();
    T.fuseTo(s, 2, 3);
    T.endFusion(s, catalog, 321.5);
    expect(s.dur).toBe(321.5);
  });

  it("encerrar no álbum não arrasta a scale para a faixa", () => {
    const s = state({ scale: "album", mode: "fusion", fuseAlb: 2, fuseB: 1 });
    T.endFusion(s, catalog, 0);
    expect(s.scale).toBe("album");
  });
});

describe("seekFraction", () => {
  it("sem duração conhecida não busca", () => {
    const s = playing({ dur: 0 });
    expect(T.seekFraction(s, 0.5)).toEqual([]);
  });

  it("converte a fração em segundos", () => {
    const s = playing({ dur: 200 });
    expect(T.seekFraction(s, 0.25)).toEqual([{ kind: "seek", seconds: 50 }]);
  });

  it("satura a fração nas bordas da faixa", () => {
    const s = playing({ dur: 200 });
    expect(T.seekFraction(s, -3)).toEqual([{ kind: "seek", seconds: 0 }]);
    expect(T.seekFraction(s, 9)).toEqual([{ kind: "seek", seconds: 200 }]);
  });
});

describe("fim natural da faixa", () => {
  it("emenda na próxima por fusão", () => {
    const s = playing({ playAlb: 1, trk: 0 });
    T.trackEnded(s, catalog);
    expect(s).toMatchObject({ mode: "fusion", fuseAlb: 1, fuseB: 1 });
  });

  it("volta ao começo do disco depois da última", () => {
    const s = playing({ playAlb: 1, trk: 2 });
    T.trackEnded(s, catalog);
    expect(s.fuseB).toBe(0);
  });

  it("sem disco em curso, não há emenda", () => {
    const s = state();
    expect(T.trackEnded(s, catalog)).toEqual([]);
    expect(s.mode).toBe("stopped");
  });
});
