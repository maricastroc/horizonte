import { describe, expect, it } from "vitest";
import * as T from "../engine/transport";
import type { AudioEffect, Catalog } from "../engine/transport";
import { initialState } from "../state";
import type { FieldState } from "../types";

const FAIXAS = [2, 3, 4];

const acervo: Catalog = {
  size: FAIXAS.length,
  trackCount: (alb) => FAIXAS[alb],
  trackDuration: (alb, trk) => 100 + alb * 10 + trk,
  hasTrack: (alb, trk) => alb >= 0 && alb < FAIXAS.length && trk >= 0 && trk < FAIXAS[alb],
};

const estado = (over: Partial<FieldState> = {}): FieldState => ({ ...initialState(), ...over });

const tocando = (over: Partial<FieldState> = {}) =>
  estado({ scale: "faixa", mode: "toca", playAlb: 1, alb: 1, trk: 1, sel: 1, ...over });

const tipos = (efeitos: AudioEffect[]) => efeitos.map((e) => e.kind);

describe("enterAlbum", () => {
  it("leva a escala do álbum e alinha a navegação", () => {
    const s = estado();
    expect(T.enterAlbum(s, acervo, 2)).toEqual([]);
    expect(s).toMatchObject({ alb: 2, navT: 2, scale: "album", zoomT: 1 });
  });

  it("arredonda e satura dentro do acervo", () => {
    const s = estado();
    T.enterAlbum(s, acervo, 9);
    expect(s.alb).toBe(2);
    T.enterAlbum(s, acervo, -4);
    expect(s.alb).toBe(0);
    T.enterAlbum(s, acervo, 1.6);
    expect(s.alb).toBe(2);
  });

  it("entrar no álbum que toca seleciona a faixa em curso", () => {
    const s = estado({ playAlb: 1, trk: 2 });
    T.enterAlbum(s, acervo, 1);
    expect(s.sel).toBe(2);
  });

  it("entrar em outro álbum começa da primeira faixa", () => {
    const s = estado({ playAlb: 1, trk: 2 });
    T.enterAlbum(s, acervo, 0);
    expect(s.sel).toBe(0);
  });
});

describe("playTrack", () => {
  it("colapsa para a faixa e pede o carregamento", () => {
    const s = estado({ alb: 2 });
    const efeitos = T.playTrack(s, acervo, 2, 3);
    expect(efeitos).toEqual([{ kind: "load", alb: 2, trk: 3 }]);
    expect(s).toMatchObject({
      playAlb: 2, alb: 2, trk: 3, sel: 3, scale: "faixa", mode: "colapso", pos: 0, seqT: 0,
    });
    expect(s.dur).toBe(acervo.trackDuration(2, 3));
  });

  it("pedir a faixa que já toca alterna o transporte", () => {
    const s = tocando();
    expect(tipos(T.playTrack(s, acervo, 1, 1))).toEqual(["pause"]);
    expect(s.mode).toBe("pausa");
  });

  it("outra faixa com o disco engajado funde em vez de recomeçar", () => {
    const s = tocando();
    expect(T.playTrack(s, acervo, 1, 2)).toEqual([]);
    expect(s).toMatchObject({ mode: "fusao", fuseAlb: 1, fuseB: 2 });
    expect(s.trk).toBe(1);
  });

  it("fora da escala de faixa, sempre recomeça", () => {
    const s = estado({ scale: "album", mode: "toca", playAlb: 1, alb: 1, trk: 1 });
    expect(tipos(T.playTrack(s, acervo, 1, 2))).toEqual(["load"]);
    expect(s.mode).toBe("colapso");
  });
});

describe("transport", () => {
  it("sem faixa carregada, toca a seleção", () => {
    const s = estado({ scale: "album", alb: 2, sel: 3 });
    expect(tipos(T.transport(s, acervo))).toEqual(["load"]);
    expect(s).toMatchObject({ playAlb: 2, trk: 3 });
  });

  it("tocando vira pausa", () => {
    const s = tocando();
    expect(tipos(T.transport(s, acervo))).toEqual(["pause"]);
    expect(s.mode).toBe("pausa");
  });

  it("o colapso também pode ser interrompido", () => {
    const s = tocando({ mode: "colapso" });
    expect(tipos(T.transport(s, acervo))).toEqual(["pause"]);
    expect(s.mode).toBe("pausa");
  });

  it("pausado volta a tocar", () => {
    const s = tocando({ mode: "pausa" });
    expect(tipos(T.transport(s, acervo))).toEqual(["play"]);
    expect(s.mode).toBe("toca");
  });

  it("durante a fusão o transporte não responde", () => {
    const s = tocando({ mode: "fusao" });
    expect(T.transport(s, acervo)).toEqual([]);
    expect(s.mode).toBe("fusao");
  });
});

describe("back", () => {
  it("da faixa volta ao álbum", () => {
    const s = tocando();
    T.back(s);
    expect(s).toMatchObject({ scale: "album", zoomT: 1 });
  });

  it("do álbum volta à coleção e solta o hover", () => {
    const s = estado({ scale: "album", hover: 3 });
    T.back(s);
    expect(s).toMatchObject({ scale: "campo", zoomT: 0, hover: -1 });
  });

  it("na coleção não há para onde voltar", () => {
    const s = estado();
    T.back(s);
    expect(s.scale).toBe("campo");
  });

  it("voltar não interrompe a reprodução", () => {
    const s = tocando();
    T.back(s);
    T.back(s);
    expect(s.mode).toBe("toca");
    expect(s.playAlb).toBe(1);
  });
});

describe("goScale", () => {
  it("a coleção é sempre alcançável", () => {
    const s = tocando({ hover: 2 });
    T.goScale(s, acervo, "campo");
    expect(s).toMatchObject({ scale: "campo", zoomT: 0, hover: -1 });
  });

  it("da coleção, o álbum é o que está sob a navegação", () => {
    const s = estado({ nav: 1.6 });
    T.goScale(s, acervo, "album");
    expect(s).toMatchObject({ scale: "album", alb: 2 });
  });

  it("da faixa, o álbum é só uma mudança de escala", () => {
    const s = tocando();
    T.goScale(s, acervo, "album");
    expect(s).toMatchObject({ scale: "album", zoomT: 1, alb: 1 });
  });

  it("a faixa volta para o disco que está tocando", () => {
    const s = estado({ scale: "campo", playAlb: 2, trk: 1, alb: 0 });
    expect(T.goScale(s, acervo, "faixa")).toEqual([]);
    expect(s).toMatchObject({ scale: "faixa", alb: 2 });
  });

  it("sem nada tocando, a faixa começa a seleção atual", () => {
    const s = estado({ scale: "album", alb: 2, sel: 3 });
    expect(tipos(T.goScale(s, acervo, "faixa"))).toEqual(["load"]);
    expect(s).toMatchObject({ playAlb: 2, trk: 3 });
  });
});

describe("primary", () => {
  it("na coleção, entra no álbum sob a navegação", () => {
    const s = estado({ nav: 2.4 });
    T.primary(s, acervo);
    expect(s).toMatchObject({ scale: "album", alb: 2 });
  });

  it("no álbum, toca a seleção", () => {
    const s = estado({ scale: "album", alb: 2, sel: 1 });
    expect(tipos(T.primary(s, acervo))).toEqual(["load"]);
  });

  it("na faixa, alterna o transporte", () => {
    const s = tocando();
    expect(tipos(T.primary(s, acervo))).toEqual(["pause"]);
  });
});

describe("stepSel", () => {
  it("na coleção não há seleção para mover", () => {
    const s = estado();
    expect(T.stepSel(s, acervo, 1)).toEqual([]);
    expect(s.sel).toBe(0);
  });

  it("circula dentro do álbum nos dois sentidos", () => {
    const s = estado({ scale: "album", alb: 2, sel: 3 });
    T.stepSel(s, acervo, 1);
    expect(s.sel).toBe(0);
    T.stepSel(s, acervo, -1);
    expect(s.sel).toBe(3);
  });

  it("com o disco engajado, mover a seleção funde", () => {
    const s = tocando({ alb: 1, sel: 1 });
    T.stepSel(s, acervo, 1);
    expect(s).toMatchObject({ mode: "fusao", fuseB: 2, fuseAlb: 1 });
  });

  it("no álbum, mover a seleção não mexe no áudio", () => {
    const s = estado({ scale: "album", mode: "toca", playAlb: 1, alb: 1, sel: 0 });
    expect(T.stepSel(s, acervo, 1)).toEqual([]);
    expect(s.mode).toBe("toca");
  });
});

describe("skip", () => {
  it("na coleção sem nada tocando, atravessa os discos", () => {
    const s = estado({ nav: 0.4 });
    T.skip(s, acervo, 1);
    expect(s.navT).toBe(1);
  });

  it("na coleção, para nas bordas do acervo", () => {
    const s = estado({ nav: 0 });
    T.skip(s, acervo, -1);
    expect(s.navT).toBe(0);
    s.nav = 2;
    T.skip(s, acervo, 1);
    expect(s.navT).toBe(2);
  });

  it("com faixa em curso, funde para a próxima", () => {
    const s = tocando({ alb: 1, trk: 1 });
    T.skip(s, acervo, 1);
    expect(s).toMatchObject({ mode: "fusao", fuseAlb: 1, fuseB: 2 });
  });

  it("circula no fim do disco", () => {
    const s = tocando({ alb: 1, trk: 2 });
    T.skip(s, acervo, 1);
    expect(s.fuseB).toBe(0);
  });

  it("anterior na primeira faixa vai para a última", () => {
    const s = tocando({ alb: 1, trk: 0 });
    T.skip(s, acervo, -1);
    expect(s.fuseB).toBe(2);
  });

  it("durante o colapso também funde", () => {
    const s = tocando({ mode: "colapso", alb: 1, trk: 0 });
    T.skip(s, acervo, 1);
    expect(s.mode).toBe("fusao");
  });

  it("folheando o disco que toca, pular ainda troca a faixa", () => {
    const s = estado({ scale: "album", alb: 2, sel: 0, playAlb: 2, mode: "toca" });
    expect(T.skip(s, acervo, 1)).toEqual([]);
    expect(s).toMatchObject({ mode: "fusao", fuseAlb: 2, fuseB: 1 });
  });

  it("folheando outro disco, pular só move a seleção", () => {
    const s = estado({ scale: "album", alb: 0, sel: 0, playAlb: 2, trk: 3, mode: "toca" });
    expect(T.skip(s, acervo, 1)).toEqual([]);
    expect(s).toMatchObject({ sel: 1, mode: "toca", playAlb: 2, trk: 3 });
  });
});

describe("fusão", () => {
  it("uma fusão em curso não é interrompida por outra", () => {
    const s = tocando();
    T.fuseTo(s, 1, 2);
    T.fuseTo(s, 0, 0);
    expect(s).toMatchObject({ fuseAlb: 1, fuseB: 2 });
  });

  it("a fusão nasce com o áudio ainda não trocado", () => {
    const s = tocando();
    T.fuseTo(s, 1, 2);
    expect(s.fuseLoaded).toBe(false);
    expect(s.mix).toBe(0);
  });

  it("a troca de áudio acontece uma vez só", () => {
    const s = tocando();
    T.fuseTo(s, 1, 2);
    expect(T.commitFusion(s, acervo)).toEqual([{ kind: "load", alb: 1, trk: 2 }]);
    expect(T.commitFusion(s, acervo)).toEqual([]);
    expect(T.commitFusion(s, acervo)).toEqual([]);
  });

  it("uma faixa inexistente não gera carregamento", () => {
    const s = tocando();
    T.fuseTo(s, 1, 99);
    expect(T.commitFusion(s, acervo)).toEqual([]);
    expect(s.fuseLoaded).toBe(true);
  });

  it("encerrar promove o alvo a faixa em curso", () => {
    const s = tocando({ alb: 1, trk: 0 });
    T.fuseTo(s, 2, 3);
    T.endFusion(s, acervo, 0);

    expect(s).toMatchObject({
      playAlb: 2, alb: 2, trk: 3, sel: 3, mode: "toca", mix: 0, pos: 0, waveR: -1, scale: "faixa",
    });
    expect(s.dur).toBe(acervo.trackDuration(2, 3));
  });

  it("a duração real do arquivo tem precedência sobre a do catálogo", () => {
    const s = tocando();
    T.fuseTo(s, 2, 3);
    T.endFusion(s, acervo, 321.5);
    expect(s.dur).toBe(321.5);
  });

  it("encerrar no álbum não arrasta a escala para a faixa", () => {
    const s = estado({ scale: "album", mode: "fusao", fuseAlb: 2, fuseB: 1 });
    T.endFusion(s, acervo, 0);
    expect(s.scale).toBe("album");
  });
});

describe("seekFraction", () => {
  it("sem duração conhecida não busca", () => {
    const s = tocando({ dur: 0 });
    expect(T.seekFraction(s, 0.5)).toEqual([]);
  });

  it("converte a fração em segundos", () => {
    const s = tocando({ dur: 200 });
    expect(T.seekFraction(s, 0.25)).toEqual([{ kind: "seek", seconds: 50 }]);
  });

  it("satura a fração nas bordas da faixa", () => {
    const s = tocando({ dur: 200 });
    expect(T.seekFraction(s, -3)).toEqual([{ kind: "seek", seconds: 0 }]);
    expect(T.seekFraction(s, 9)).toEqual([{ kind: "seek", seconds: 200 }]);
  });
});

describe("fim natural da faixa", () => {
  it("emenda na próxima por fusão", () => {
    const s = tocando({ playAlb: 1, trk: 0 });
    T.trackEnded(s, acervo);
    expect(s).toMatchObject({ mode: "fusao", fuseAlb: 1, fuseB: 1 });
  });

  it("volta ao começo do disco depois da última", () => {
    const s = tocando({ playAlb: 1, trk: 2 });
    T.trackEnded(s, acervo);
    expect(s.fuseB).toBe(0);
  });

  it("sem disco em curso, não há emenda", () => {
    const s = estado();
    expect(T.trackEnded(s, acervo)).toEqual([]);
    expect(s.mode).toBe("parado");
  });
});
