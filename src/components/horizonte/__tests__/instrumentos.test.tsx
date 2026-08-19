import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import Instruments, { isInstrumentsTarget } from "../Instruments";
import { ALBUMS } from "../content";
import type { FrameOut } from "../engine/frame";
import type { FieldEngine } from "../engine/FieldEngine";
import { timecode } from "../format";
import { COLOR, rgba } from "../tokens";
import type { Snapshot } from "../types";

const BASE: Snapshot = {
  scale: "campo",
  mode: "parado",
  alb: 0,
  navAlb: 0,
  sel: 0,
  trk: 0,
  playAlb: -1,
  hoverTrk: -1,
  hoverAlb: -1,
  idle: false,
  variant: "desktop",
  announce: "",
};

function motorFalso(inicial: Partial<Snapshot> = {}) {
  let snap: Snapshot = { ...BASE, ...inicial };
  const inscritos = new Set<() => void>();
  let sink: ((f: FrameOut) => void) | null = null;
  const chamadas: { nome: string; args: unknown[] }[] = [];

  const registrar =
    (nome: string) =>
    (...args: unknown[]) => {
      chamadas.push({ nome, args });
    };

  const motor = {
    subscribe: (fn: () => void) => {
      inscritos.add(fn);
      return () => inscritos.delete(fn);
    },
    getSnapshot: () => snap,
    onFrame: (fn: (f: FrameOut) => void) => {
      sink = fn;
      return () => {
        sink = null;
      };
    },
    markIntent: registrar("markIntent"),
    goScale: registrar("goScale"),
    enterAlbum: registrar("enterAlbum"),
    playTrack: registrar("playTrack"),
    setRailAlb: registrar("setRailAlb"),
    setRailTrk: registrar("setRailTrk"),
    skip: registrar("skip"),
    transport: registrar("transport"),
    back: registrar("back"),
    seekFraction: registrar("seekFraction"),
  };

  return {
    motor: motor as unknown as FieldEngine,
    chamadas,
    ultima: (nome: string) => [...chamadas].reverse().find((c) => c.nome === nome),
    atualizar(parcial: Partial<Snapshot>) {
      snap = { ...snap, ...parcial };
      for (const fn of inscritos) fn();
    },
    quadro(f: FrameOut) {
      sink?.(f);
    },
    temQuadro: () => sink !== null,
  };
}

const numeros = (cor: string) => {
  const hex = cor.match(/#([0-9a-f]{6})/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const v = (cor.match(/[\d.]+/g) ?? []).map(Number);
  return v.length === 4 && v[3] === 1 ? v.slice(0, 3) : v;
};

const reguaDeFaixas = () => document.querySelector("nav[aria-label^='Faixas de']") as HTMLElement;

const montar = (inicial: Partial<Snapshot> = {}) => {
  const fake = motorFalso(inicial);
  render(<Instruments engine={fake.motor} />);
  return fake;
};

afterEach(cleanup);

describe("régua de álbuns", () => {
  it("lista o acervo inteiro com artista e catálogo", () => {
    montar();
    const regua = screen.getByRole("navigation", { name: "Álbuns" });
    const itens = within(regua).getAllByRole("button");
    expect(itens).toHaveLength(ALBUMS.length);
    expect(within(regua).getByText(ALBUMS[0].artist)).toBeDefined();
    expect(within(regua).getByText(ALBUMS[0].cat)).toBeDefined();
  });

  it("marca o disco em foco para tecnologia assistiva", () => {
    montar({ navAlb: 3 });
    const regua = screen.getByRole("navigation", { name: "Álbuns" });
    const atuais = within(regua).getAllByRole("button").filter((b) => b.getAttribute("aria-current"));
    expect(atuais).toHaveLength(1);
    expect(atuais[0].textContent).toContain(ALBUMS[3].artist);
  });

  it("na coleção o foco segue a navegação, não o álbum aberto", () => {
    montar({ scale: "campo", navAlb: 2, alb: 5 });
    const regua = screen.getByRole("navigation", { name: "Álbuns" });
    const atual = within(regua).getAllByRole("button").find((b) => b.getAttribute("aria-current"));
    expect(atual?.textContent).toContain(ALBUMS[2].artist);
  });

  it("fora da coleção o foco é o álbum aberto", () => {
    montar({ scale: "album", navAlb: 2, alb: 5 });
    const regua = screen.getByRole("navigation", { name: "Álbuns" });
    const atual = within(regua).getAllByRole("button").find((b) => b.getAttribute("aria-current"));
    expect(atual?.textContent).toContain(ALBUMS[5].artist);
  });

  it("a marca distingue foco, disco tocando e repouso", () => {
    const fake = montar({ scale: "album", alb: 1, playAlb: 4 });
    const regua = screen.getByRole("navigation", { name: "Álbuns" });
    const marcas = within(regua).getAllByRole("button").map((b) => b.querySelector("span[aria-hidden]")!);

    expect(numeros(marcas[1].getAttribute("style") ?? "")).toEqual(numeros(rgba(ALBUMS[1].inkA, 1)));
    expect(numeros(marcas[4].getAttribute("style") ?? "")).toEqual(numeros(rgba(ALBUMS[4].inkA, 0.5)));
    expect(numeros(marcas[7].getAttribute("style") ?? "")).toEqual(numeros(COLOR.inkGhost));
    void fake;
  });

  it("clicar num disco pede a entrada nele", () => {
    const fake = montar();
    const regua = screen.getByRole("navigation", { name: "Álbuns" });
    fireEvent.click(within(regua).getAllByRole("button")[6]);
    expect(fake.ultima("enterAlbum")?.args).toEqual([6]);
  });

  it("apontar e sair do disco liga e desliga o realce no mundo", () => {
    const fake = montar();
    const regua = screen.getByRole("navigation", { name: "Álbuns" });
    const alvo = within(regua).getAllByRole("button")[2];

    fireEvent.pointerEnter(alvo);
    expect(fake.ultima("setRailAlb")?.args).toEqual([2]);
    fireEvent.pointerLeave(alvo);
    expect(fake.ultima("setRailAlb")?.args).toEqual([-1]);
  });

  it("o realce também acompanha o foco por teclado", () => {
    const fake = montar();
    const regua = screen.getByRole("navigation", { name: "Álbuns" });
    fireEvent.focus(within(regua).getAllByRole("button")[3]);
    expect(fake.ultima("setRailAlb")?.args).toEqual([3]);
  });
});

describe("régua de faixas", () => {
  it("fica escondida e fora da ordem de tabulação na coleção", () => {
    montar({ scale: "campo" });
    const regua = reguaDeFaixas();
    expect(regua.getAttribute("aria-hidden")).toBe("true");
    for (const b of regua.querySelectorAll("button")) {
      expect(b.getAttribute("tabindex")).toBe("-1");
    }
  });

  it("aparece e fica navegável no álbum", () => {
    montar({ scale: "album", alb: 2 });
    const regua = reguaDeFaixas();
    expect(regua.getAttribute("aria-label")).toBe(`Faixas de ${ALBUMS[2].title}`);
    expect(regua.getAttribute("aria-hidden")).toBe("false");
    const itens = within(regua).getAllByRole("button");
    expect(itens).toHaveLength(ALBUMS[2].tracks.length);
    expect(itens[0].getAttribute("tabindex")).toBe("0");
  });

  it("mostra número, título e duração de cada faixa", () => {
    montar({ scale: "album", alb: 2 });
    const regua = reguaDeFaixas();
    const primeira = within(regua).getAllByRole("button")[0];
    expect(primeira.textContent).toContain("01");
    expect(primeira.textContent).toContain(ALBUMS[2].tracks[0].title);
    expect(primeira.textContent).toContain(timecode(ALBUMS[2].tracks[0].dur));
  });

  it("a faixa em curso é anunciada como atual", () => {
    montar({ scale: "faixa", alb: 2, playAlb: 2, trk: 3 });
    const regua = reguaDeFaixas();
    const atuais = within(regua).getAllByRole("button").filter((b) => b.getAttribute("aria-current"));
    expect(atuais).toHaveLength(1);
    expect(atuais[0].textContent).toContain(ALBUMS[2].tracks[3].title);
  });

  it("a marca cresce na faixa tocando e na selecionada", () => {
    montar({ scale: "album", alb: 2, playAlb: 2, trk: 1, sel: 3 });
    const regua = reguaDeFaixas();
    const marcas = within(regua).getAllByRole("button").map((b) => b.querySelector("span[aria-hidden]")!);

    expect(marcas[1].className).toContain("w-[7px]");
    expect(marcas[3].className).toContain("w-[7px]");
    expect(marcas[0].className).toContain("w-[5px]");
  });

  it("a faixa tocando usa a tinta do disco e a selecionada a tinta de texto", () => {
    montar({ scale: "album", alb: 2, playAlb: 2, trk: 1, sel: 3 });
    const regua = reguaDeFaixas();
    const marcas = within(regua).getAllByRole("button").map((b) => b.querySelector("span[aria-hidden]")!);

    expect(numeros(marcas[1].getAttribute("style") ?? "")).toEqual(numeros(rgba(ALBUMS[2].inkA, 1)));
    expect(numeros(marcas[3].getAttribute("style") ?? "")).toEqual(numeros(COLOR.inkText));
  });

  it("clicar numa faixa pede a reprodução dela no disco aberto", () => {
    const fake = montar({ scale: "album", alb: 2 });
    const regua = reguaDeFaixas();
    fireEvent.click(within(regua).getAllByRole("button")[2]);
    expect(fake.ultima("playTrack")?.args).toEqual([2, 2]);
  });
});

describe("transporte", () => {
  it("convida a tocar quando nada foi carregado", () => {
    montar();
    expect(screen.getByRole("button", { name: /Tocar/ })).toBeDefined();
  });

  it("oferece retomar quando há faixa pausada", () => {
    montar({ scale: "faixa", playAlb: 0, mode: "pausa" });
    expect(screen.getByRole("button", { name: /Retomar/ })).toBeDefined();
  });

  it("oferece pausar durante a reprodução e marca o estado", () => {
    montar({ scale: "faixa", playAlb: 0, mode: "toca" });
    const botao = screen.getByRole("button", { name: /Pausar/ });
    expect(botao.getAttribute("aria-pressed")).toBe("true");
  });

  it("os três controles chamam o motor", () => {
    const fake = montar({ scale: "faixa", playAlb: 0, mode: "toca" });
    fireEvent.click(screen.getByRole("button", { name: /Anterior/ }));
    expect(fake.ultima("skip")?.args).toEqual([-1]);

    fireEvent.click(screen.getByRole("button", { name: /Próxima/ }));
    expect(fake.ultima("skip")?.args).toEqual([1]);

    fireEvent.click(screen.getByRole("button", { name: /Pausar/ }));
    expect(fake.ultima("transport")).toBeDefined();
  });

  it("clicar na barra busca a fração correspondente", () => {
    const fake = montar({ scale: "faixa", playAlb: 0, mode: "toca" });
    const barra = screen.getByRole("progressbar", { name: "Progresso da faixa" });
    barra.getBoundingClientRect = () => ({ left: 100, width: 400 }) as DOMRect;

    fireEvent.click(barra, { clientX: 300 });
    expect(fake.ultima("seekFraction")?.args).toEqual([0.5]);
  });
});

describe("escalas e retorno", () => {
  it("marca a escala corrente na trilha", () => {
    montar({ scale: "album" });
    const trilha = screen.getByRole("navigation", { name: "Escala" });
    const atual = within(trilha).getAllByRole("button").find((b) => b.getAttribute("aria-current") === "step");
    expect(atual?.textContent).toBe("Álbum");
  });

  it("clicar numa escala pede a mudança", () => {
    const fake = montar({ scale: "album" });
    const trilha = screen.getByRole("navigation", { name: "Escala" });
    fireEvent.click(within(trilha).getByText("Faixa"));
    expect(fake.ultima("goScale")?.args).toEqual(["faixa"]);
  });

  it("voltar fica inerte na coleção", () => {
    montar({ scale: "campo" });
    const voltar = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Voltar"))!;
    expect(voltar.getAttribute("tabindex")).toBe("-1");
    expect(voltar.getAttribute("aria-hidden")).toBe("true");
  });

  it("voltar fica ativo fora da coleção e chama o motor", () => {
    const fake = montar({ scale: "album" });
    const voltar = screen.getByRole("button", { name: /Voltar/ });
    expect(voltar.getAttribute("tabindex")).toBe("0");
    fireEvent.click(voltar);
    expect(fake.ultima("back")).toBeDefined();
  });
});

describe("crédito e anúncio", () => {
  it("credita a licença do disco em foco", () => {
    montar({ alb: 3 });
    const link = screen.getByRole("link", { name: ALBUMS[3].license.name });
    expect(link.getAttribute("href")).toBe(ALBUMS[3].license.source);
    expect(link.getAttribute("title")).toBe(ALBUMS[3].license.attribution);
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("publica o anúncio do motor numa região viva", () => {
    montar({ announce: "01 · Le Manoir — Tristan Lohengrin" });
    const regiao = document.querySelector("[aria-live='polite']");
    expect(regiao?.textContent).toBe("01 · Le Manoir — Tristan Lohengrin");
  });
});

describe("canal contínuo", () => {
  it("escreve progresso, tempo e leitura assistiva sem novo render", () => {
    const fake = montar({ scale: "faixa", playAlb: 0, mode: "toca" });
    const barra = screen.getByRole("progressbar", { name: "Progresso da faixa" });
    const preenchida = barra.querySelector(":scope > div > div") as HTMLElement;

    fake.quadro({ progress: 0.25, position: 30, duration: 120 });

    expect(preenchida.style.width).toBe("25%");
    expect(screen.getByText("00:30 / 02:00")).toBeDefined();
    expect(barra.getAttribute("aria-valuenow")).toBe("25");
    expect(barra.getAttribute("aria-valuetext")).toBe("00:30 de 02:00");
  });

  it("a leitura assistiva é espaçada, o pixel não", () => {
    const fake = montar({ scale: "faixa", playAlb: 0, mode: "toca" });
    const barra = screen.getByRole("progressbar", { name: "Progresso da faixa" });
    const preenchida = barra.querySelector(":scope > div > div") as HTMLElement;

    fake.quadro({ progress: 0.1, position: 12, duration: 120 });
    fake.quadro({ progress: 0.2, position: 24, duration: 120 });

    expect(preenchida.style.width).toBe("20%");
    expect(barra.getAttribute("aria-valuenow")).toBe("10");
  });

  it("desmontar cancela o registro do quadro", () => {
    const fake = motorFalso();
    const tela = render(<Instruments engine={fake.motor} />);
    expect(fake.temQuadro()).toBe(true);
    tela.unmount();
    expect(fake.temQuadro()).toBe(false);
  });
});

describe("sem motor", () => {
  it("desenha a coleção e não quebra ao clicar", () => {
    render(<Instruments engine={null} />);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
    expect(() => fireEvent.click(screen.getByRole("button", { name: /Tocar/ }))).not.toThrow();
  });
});

describe("reação ao instantâneo", () => {
  it("um aviso do motor repinta a interface", () => {
    const fake = montar({ scale: "campo", alb: 0 });
    expect(screen.queryByText(ALBUMS[4].tracks[0].title)).toBe(null);

    act(() => fake.atualizar({ scale: "album", alb: 4 }));
    expect(screen.getByText(ALBUMS[4].tracks[0].title)).toBeDefined();
  });
});

describe("fronteira com o mundo", () => {
  it("reconhece um alvo nascido na camada de instrumentos", () => {
    montar();
    const botao = screen.getByRole("button", { name: /Tocar/ });
    expect(isInstrumentsTarget({ target: botao } as unknown as Event)).toBe(true);
  });

  it("um alvo de fora do painel não pertence à camada", () => {
    montar();
    const fora = document.createElement("canvas");
    document.body.appendChild(fora);
    expect(isInstrumentsTarget({ target: fora } as unknown as Event)).toBe(false);
  });
});
