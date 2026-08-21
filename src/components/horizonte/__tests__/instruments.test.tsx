import { FULL_BANDS } from "../composition/bands";
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
  scale: "collection",
  bands: FULL_BANDS,
  mode: "stopped",
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
  fault: null,
};

function fakeEngine(initial: Partial<Snapshot> = {}) {
  let snap: Snapshot = { ...BASE, ...initial };
  const subscribers = new Set<() => void>();
  let sink: ((f: FrameOut) => void) | null = null;
  const frame: FrameOut = { progress: 0, position: 0, duration: 0 };
  const calls: { label: string; args: unknown[] }[] = [];

  const register =
    (label: string) =>
    (...args: unknown[]) => {
      calls.push({ label, args });
    };

  const engine = {
    subscribe: (fn: () => void) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    getSnapshot: () => snap,
    onFrame: (fn: (f: FrameOut) => void) => {
      sink = fn;
      return () => {
        sink = null;
      };
    },
    markIntent: register("markIntent"),
    goScale: register("goScale"),
    enterAlbum: register("enterAlbum"),
    playTrack: register("playTrack"),
    setRailAlb: register("setRailAlb"),
    setIntake: register("setIntake"),
    setRailTrk: register("setRailTrk"),
    skip: register("skip"),
    transport: register("transport"),
    back: register("back"),
    seekFraction: register("seekFraction"),
    setVolume: register("setVolume"),
    setMuted: register("setMuted"),
    volume: 1,
    muted: false,
    frameOut: frame,
  };

  return {
    engine: engine as unknown as FieldEngine,
    calls,
    last: (label: string) => [...calls].reverse().find((c) => c.label === label),
    update(partial: Partial<Snapshot>) {
      snap = { ...snap, ...partial };
      for (const fn of subscribers) fn();
    },
    frame(f: FrameOut) {
      Object.assign(frame, f);
      sink?.(f);
    },
    hasFrame: () => sink !== null,
  };
}

const numbers = (color: string) => {
  const hex = color.match(/#([0-9a-f]{6})/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const v = (color.match(/[\d.]+/g) ?? []).map(Number);
  return v.length === 4 && v[3] === 1 ? v.slice(0, 3) : v;
};

const trackRail = () => document.querySelector("nav[aria-label^='Faixas de']") as HTMLElement;

const mount = (initial: Partial<Snapshot> = {}) => {
  const fake = fakeEngine(initial);
  render(<Instruments engine={fake.engine} />);
  return fake;
};

afterEach(cleanup);

describe("régua de álbuns", () => {
  it("lista o acervo inteiro com artista e catálogo", () => {
    mount();
    const rail = screen.getByRole("navigation", { name: "Álbuns" });
    const items = within(rail).getAllByRole("button");
    expect(items).toHaveLength(ALBUMS.length + 1);
    expect(within(rail).getByText(ALBUMS[0].artist)).toBeDefined();
    expect(within(rail).getByText(ALBUMS[0].cat)).toBeDefined();
  });

  it("fecha a régua com a entrada de disco local, sem virar gerenciador de arquivos", () => {
    mount();
    const rail = screen.getByRole("navigation", { name: "Álbuns" });
    const items = within(rail).getAllByRole("button");
    expect(items[items.length - 1].textContent).toContain("Trazer um disco");
    expect(within(rail).queryByText(/upload|arquivo|enviar/i)).toBeNull();
  });
});

describe("entrada para trazer um disco", () => {
  const entrada = () => {
    const rail = screen.getByRole("navigation", { name: "Álbuns" });
    const items = within(rail).getAllByRole("button");
    return items[items.length - 1];
  };

  const linhaDeAlbum = () => {
    const rail = screen.getByRole("navigation", { name: "Álbuns" });
    return within(rail).getAllByRole("button")[1];
  };

  it("é uma ação, não um item do catálogo: fica fora da lista de álbuns", () => {
    mount();
    expect(entrada().closest("ul")).toBeNull();
    expect(linhaDeAlbum().closest("ul")).not.toBeNull();
  });

  it("não usa a coluna de código de catálogo nem finge ser um disco", () => {
    mount();
    expect(entrada().textContent).toBe("Trazer um disco");
    expect(entrada().textContent).not.toMatch(/[HL]—\d/);
    expect(entrada().className).toContain("grid-cols-[1fr_7px]");
    expect(linhaDeAlbum().className).toContain("grid-cols-[1fr_46px_7px]");
  });

  it("lê mais claro que os discos da lista, e não mais claro que o disco em foco", () => {
    mount();
    expect(entrada().className).toContain("text-ink-text-2");
    expect(entrada().className).not.toContain("text-ink-faint");
    expect(linhaDeAlbum().className).not.toContain("text-ink-text-2");
  });

  it("é separada da lista por respiro e régua própria", () => {
    mount();
    expect(entrada().className).toContain("mt-2.5");
    expect(entrada().className).toContain("border-t");
    expect(entrada().className).toContain("border-rule");
  });

  it("tem alvo maior que uma linha de catálogo, e maior ainda no compacto", () => {
    mount();
    expect(entrada().className).toContain("h-[34px]");
    cleanup();
    mount({ variant: "mobile", scale: "collection" });
    fireEvent.click(screen.getByRole("button", { name: "Álbuns" }));
    expect(entrada().className).toContain("min-h-[52px]");
  });

  it("o marcador é um lugar vazio que se preenche ao apontar", () => {
    mount();
    const marca = entrada().querySelector("span[aria-hidden]")!;
    const tokens = marca.className.split(/\s+/);
    expect(tokens).toContain("border-ink-faint");
    expect(tokens).not.toContain("bg-paper");
    expect(tokens).toContain("group-hover:bg-paper");
    expect(tokens).toContain("group-focus-visible:bg-paper");
  });

  it("apontar avisa o campo, e sair devolve", () => {
    const fake = mount();
    fireEvent.pointerEnter(entrada());
    expect(fake.last("setIntake")?.args).toEqual([true]);
    expect(fake.last("setRailAlb")?.args).toEqual([-1]);
    fireEvent.pointerLeave(entrada());
    expect(fake.last("setIntake")?.args).toEqual([false]);
  });

  it("o foco por teclado avisa o campo igual ao ponteiro", () => {
    const fake = mount();
    fireEvent.focus(entrada());
    expect(fake.last("setIntake")?.args).toEqual([true]);
    fireEvent.blur(entrada());
    expect(fake.last("setIntake")?.args).toEqual([false]);
  });

  it("é alcançável por teclado enquanto a régua está aberta", () => {
    mount();
    expect(entrada().getAttribute("tabindex")).toBe("0");
  });

  it("arrastar arquivos acende a entrada e diz o que fazer", () => {
    mount();
    const dt = { types: ["Files"] };
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event("dragenter"), { dataTransfer: dt }),
      );
    });
    expect(entrada().textContent).toBe("Solte para medir");
    expect(entrada().className).toContain("text-ink-text");
    expect(entrada().querySelector("span[aria-hidden]")!.className.split(/\s+/)).toContain(
      "bg-paper",
    );
  });

  it("marca o disco em foco para tecnologia assistiva", () => {
    mount({ navAlb: 3 });
    const rail = screen.getByRole("navigation", { name: "Álbuns" });
    const currents = within(rail).getAllByRole("button").filter((b) => b.getAttribute("aria-current"));
    expect(currents).toHaveLength(1);
    expect(currents[0].textContent).toContain(ALBUMS[3].artist);
  });

  it("na coleção o foco segue a navegação, não o álbum aberto", () => {
    mount({ scale: "collection", navAlb: 2, alb: 5 });
    const rail = screen.getByRole("navigation", { name: "Álbuns" });
    const current = within(rail).getAllByRole("button").find((b) => b.getAttribute("aria-current"));
    expect(current?.textContent).toContain(ALBUMS[2].artist);
  });

  it("fora da coleção o foco é o álbum aberto", () => {
    mount({ scale: "album", navAlb: 2, alb: 5 });
    const rail = screen.getByRole("navigation", { name: "Álbuns" });
    const current = within(rail).getAllByRole("button").find((b) => b.getAttribute("aria-current"));
    expect(current?.textContent).toContain(ALBUMS[5].artist);
  });

  it("a marca distingue foco, disco tocando e rest", () => {
    const fake = mount({ scale: "album", alb: 1, playAlb: 4 });
    const rail = screen.getByRole("navigation", { name: "Álbuns" });
    const marks = within(rail).getAllByRole("button").map((b) => b.querySelector("span[aria-hidden]")!);

    expect(numbers(marks[1].getAttribute("style") ?? "")).toEqual(numbers(rgba(ALBUMS[1].inkA, 1)));
    expect(numbers(marks[4].getAttribute("style") ?? "")).toEqual(numbers(rgba(ALBUMS[4].inkA, 0.5)));
    expect(numbers(marks[7].getAttribute("style") ?? "")).toEqual(numbers(COLOR.inkGhost));
    void fake;
  });

  it("clicar num disco pede a entrada nele", () => {
    const fake = mount();
    const rail = screen.getByRole("navigation", { name: "Álbuns" });
    fireEvent.click(within(rail).getAllByRole("button")[6]);
    expect(fake.last("enterAlbum")?.args).toEqual([6]);
  });

  it("apontar e sair do disco liga e desliga o realce no world", () => {
    const fake = mount();
    const rail = screen.getByRole("navigation", { name: "Álbuns" });
    const target = within(rail).getAllByRole("button")[2];

    fireEvent.pointerEnter(target);
    expect(fake.last("setRailAlb")?.args).toEqual([2]);
    fireEvent.pointerLeave(target);
    expect(fake.last("setRailAlb")?.args).toEqual([-1]);
  });

  it("o realce também acompanha o foco por teclado", () => {
    const fake = mount();
    const rail = screen.getByRole("navigation", { name: "Álbuns" });
    fireEvent.focus(within(rail).getAllByRole("button")[3]);
    expect(fake.last("setRailAlb")?.args).toEqual([3]);
  });
});

describe("régua de faixas", () => {
  it("fica escondida e fora da ordem de tabulação na coleção", () => {
    mount({ scale: "collection" });
    const rail = trackRail();
    expect(rail.getAttribute("aria-hidden")).toBe("true");
    for (const b of rail.querySelectorAll("button")) {
      expect(b.getAttribute("tabindex")).toBe("-1");
    }
  });

  it("aparece e fica navegável no álbum", () => {
    mount({ scale: "album", alb: 2 });
    const rail = trackRail();
    expect(rail.getAttribute("aria-label")).toBe(`Faixas de ${ALBUMS[2].title}`);
    expect(rail.getAttribute("aria-hidden")).toBe("false");
    const items = within(rail).getAllByRole("button");
    expect(items).toHaveLength(ALBUMS[2].tracks.length);
    expect(items[0].getAttribute("tabindex")).toBe("0");
  });

  it("mostra número, título e duração de cada faixa", () => {
    mount({ scale: "album", alb: 2 });
    const rail = trackRail();
    const first = within(rail).getAllByRole("button")[0];
    expect(first.textContent).toContain("01");
    expect(first.textContent).toContain(ALBUMS[2].tracks[0].title);
    expect(first.textContent).toContain(timecode(ALBUMS[2].tracks[0].dur));
  });

  it("a faixa em curso é anunciada como atual", () => {
    mount({ scale: "track", alb: 2, playAlb: 2, trk: 3 });
    const rail = trackRail();
    const currents = within(rail).getAllByRole("button").filter((b) => b.getAttribute("aria-current"));
    expect(currents).toHaveLength(1);
    expect(currents[0].textContent).toContain(ALBUMS[2].tracks[3].title);
  });

  it("a marca cresce na faixa tocando e na selecionada", () => {
    mount({ scale: "album", alb: 2, playAlb: 2, trk: 1, sel: 3 });
    const rail = trackRail();
    const marks = within(rail).getAllByRole("button").map((b) => b.querySelector("span[aria-hidden]")!);

    expect(marks[1].className).toContain("w-[7px]");
    expect(marks[3].className).toContain("w-[7px]");
    expect(marks[0].className).toContain("w-[5px]");
  });

  it("a faixa tocando usa a ink do disco e a selecionada a ink de texto", () => {
    mount({ scale: "album", alb: 2, playAlb: 2, trk: 1, sel: 3 });
    const rail = trackRail();
    const marks = within(rail).getAllByRole("button").map((b) => b.querySelector("span[aria-hidden]")!);

    expect(numbers(marks[1].getAttribute("style") ?? "")).toEqual(numbers(rgba(ALBUMS[2].inkA, 1)));
    expect(numbers(marks[3].getAttribute("style") ?? "")).toEqual(numbers(COLOR.inkText));
  });

  it("clicar numa faixa pede a reprodução dela no disco aberto", () => {
    const fake = mount({ scale: "album", alb: 2 });
    const rail = trackRail();
    fireEvent.click(within(rail).getAllByRole("button")[2]);
    expect(fake.last("playTrack")?.args).toEqual([2, 2]);
  });
});

describe("transporte", () => {
  it("convida a tocar quando nada foi carregado", () => {
    mount();
    expect(screen.getByRole("button", { name: /Tocar/ })).toBeDefined();
  });

  it("oferece retomar quando há faixa pausada", () => {
    mount({ scale: "track", playAlb: 0, mode: "paused" });
    expect(screen.getByRole("button", { name: /Retomar/ })).toBeDefined();
  });

  it("oferece pausar durante a reprodução e marca o estado", () => {
    mount({ scale: "track", playAlb: 0, mode: "playing" });
    const button = screen.getByRole("button", { name: /Pausar/ });
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("os três controles chamam o motor", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    fireEvent.click(screen.getByRole("button", { name: /Anterior/ }));
    expect(fake.last("skip")?.args).toEqual([-1]);

    fireEvent.click(screen.getByRole("button", { name: /Próxima/ }));
    expect(fake.last("skip")?.args).toEqual([1]);

    fireEvent.click(screen.getByRole("button", { name: /Pausar/ }));
    expect(fake.last("transport")).toBeDefined();
  });

  it("a posição na faixa é um slider de verdade, não uma barra decorativa", () => {
    mount({ scale: "track", playAlb: 0, mode: "playing" });
    const seek = screen.getByRole("slider", { name: "Posição na faixa" });
    expect(seek.tagName).toBe("INPUT");
    expect(seek.tabIndex).toBe(0);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("arrastar o slider busca a fração correspondente", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    const seek = screen.getByRole("slider", { name: "Posição na faixa" });
    fireEvent.change(seek, { target: { value: "500" } });
    expect(fake.last("seekFraction")?.args).toEqual([0.5]);
  });

  it("as setas movem cinco segundos, não uma fração da faixa", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    fake.frame({ progress: 0.5, position: 60, duration: 120 });
    const seek = screen.getByRole("slider", { name: "Posição na faixa" });

    fireEvent.keyDown(seek, { key: "ArrowRight" });
    expect(fake.last("seekFraction")?.args[0]).toBeCloseTo(0.5 + 5 / 120, 6);

    fireEvent.keyDown(seek, { key: "ArrowLeft" });
    expect(fake.last("seekFraction")?.args[0]).toBeCloseTo(0.5 - 5 / 120, 6);
  });

  it("Home e End vão às pontas da faixa", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    fake.frame({ progress: 0.5, position: 60, duration: 120 });
    const seek = screen.getByRole("slider", { name: "Posição na faixa" });

    fireEvent.keyDown(seek, { key: "Home" });
    expect(fake.last("seekFraction")?.args[0]).toBeLessThanOrEqual(0);
    fireEvent.keyDown(seek, { key: "End" });
    expect(fake.last("seekFraction")?.args[0]).toBeGreaterThanOrEqual(1);
  });

  it("sem faixa carregada o teclado não busca no vazio", () => {
    const fake = mount({ scale: "collection" });
    const seek = screen.getByRole("slider", { name: "Posição na faixa" });
    fireEvent.keyDown(seek, { key: "ArrowRight" });
    expect(fake.last("seekFraction")).toBeUndefined();
  });
});

describe("volume", () => {
  it("existe um controle de volume alcançável por teclado", () => {
    mount();
    const vol = screen.getByRole("slider", { name: "Volume" });
    expect(vol.tagName).toBe("INPUT");
    expect(vol.tabIndex).toBe(0);
  });

  it("mover o controle pede o novo nível ao motor", () => {
    const fake = mount();
    const vol = screen.getByRole("slider", { name: "Volume" });
    fireEvent.change(vol, { target: { value: "40" } });
    expect(fake.last("setVolume")?.args).toEqual([0.4]);
  });

  it("o mudo é um estado marcado, e volta a soar ao mexer no nível", () => {
    const fake = mount();
    const botao = screen.getByRole("button", { name: "Som" });
    fireEvent.click(botao);
    expect(fake.last("setMuted")?.args).toEqual([true]);
    expect(screen.getByRole("button", { name: "Mudo" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "70" } });
    expect(fake.last("setVolume")?.args).toEqual([0.7]);
    expect(screen.getByRole("button", { name: "Som" })).toBeDefined();
  });

  it("no mudo o controle mostra zero sem esquecer o nível escolhido", () => {
    mount();
    fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Som" }));
    expect((screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement).value).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Mudo" }));
    expect((screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement).value).toBe("60");
  });
});

describe("falha de reprodução", () => {
  it("em silêncio, nada é dito", () => {
    mount({ scale: "track", playAlb: 0, mode: "playing" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("uma faixa que não carrega diz isso, em vez de fingir que toca", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    act(() => fake.update({ fault: "source", mode: "paused" }));
    const aviso = screen.getByRole("status");
    expect(aviso.textContent).toMatch(/não consegui carregar/i);
    expect(screen.getByRole("button", { name: /Retomar/ })).toBeDefined();
  });

  it("o bloqueio do navegador é dito com o que fazer a seguir", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "paused" });
    act(() => fake.update({ fault: "blocked" }));
    expect(screen.getByRole("status").textContent).toMatch(/bloqueou o som/i);
  });
});

describe("scales e retorno", () => {
  it("marca a scale corrente na trilha", () => {
    mount({ scale: "album" });
    const track = screen.getByRole("navigation", { name: "Escala" });
    const current = within(track).getAllByRole("button").find((b) => b.getAttribute("aria-current") === "step");
    expect(current?.textContent).toBe("Álbum");
  });

  it("clicar numa scale pede a mudança", () => {
    const fake = mount({ scale: "album" });
    const track = screen.getByRole("navigation", { name: "Escala" });
    fireEvent.click(within(track).getByText("Faixa"));
    expect(fake.last("goScale")?.args).toEqual(["track"]);
  });

  it("voltar fica inerte na coleção", () => {
    mount({ scale: "collection" });
    const goBack = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Voltar"))!;
    expect(goBack.getAttribute("tabindex")).toBe("-1");
    expect(goBack.getAttribute("aria-hidden")).toBe("true");
  });

  it("voltar fica ativo fora da coleção e chama o motor", () => {
    const fake = mount({ scale: "album" });
    const goBack = screen.getByRole("button", { name: /Voltar/ });
    expect(goBack.getAttribute("tabindex")).toBe("0");
    fireEvent.click(goBack);
    expect(fake.last("back")).toBeDefined();
  });
});

describe("crédito e anúncio", () => {
  it("credita a licença do disco em foco", () => {
    mount({ alb: 3 });
    const link = screen.getByRole("link", { name: ALBUMS[3].license.name });
    expect(link.getAttribute("href")).toBe(ALBUMS[3].license.source);
    expect(link.getAttribute("title")).toContain(ALBUMS[3].license.attribution);
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("a observação da curadoria acompanha a atribuição, quando o autor exige", () => {
    const i = ALBUMS.findIndex((a) => a.note);
    expect(i, "o acervo precisa de ao menos um disco com observação").toBeGreaterThanOrEqual(0);
    mount({ alb: i });
    const credito = screen.getByRole("link", { name: ALBUMS[i].license.name });
    expect(credito.getAttribute("title")).toContain(ALBUMS[i].note!);
  });

  it("um disco sem observação não ganha traço sobrando no crédito", () => {
    const i = ALBUMS.findIndex((a) => !a.note);
    mount({ alb: i });
    const credito = screen.getByRole("link", { name: ALBUMS[i].license.name });
    expect(credito.getAttribute("title")).toBe(ALBUMS[i].license.attribution);
  });

  it("publica o anúncio do motor numa região viva", () => {
    mount({ announce: "01 · Le Manoir — Tristan Lohengrin" });
    const region = document.querySelector("[aria-live='polite']");
    expect(region?.textContent).toBe("01 · Le Manoir — Tristan Lohengrin");
  });
});

describe("canal contínuo", () => {
  it("escreve progresso, tempo e leitura assistiva sem novo render", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    const seek = screen.getByRole("slider", { name: "Posição na faixa" }) as HTMLInputElement;

    fake.frame({ progress: 0.25, position: 30, duration: 120 });

    expect(seek.style.getPropertyValue("--fill")).toBe("25%");
    expect(seek.value).toBe("250");
    expect(screen.getByText("00:30 / 02:00")).toBeDefined();
    expect(seek.getAttribute("aria-valuetext")).toBe("00:30 de 02:00");
  });

  it("a leitura assistiva é espaçada, o pixel não", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    const seek = screen.getByRole("slider", { name: "Posição na faixa" }) as HTMLInputElement;

    fake.frame({ progress: 0.1, position: 12, duration: 120 });
    fake.frame({ progress: 0.2, position: 24, duration: 120 });

    expect(seek.style.getPropertyValue("--fill")).toBe("20%");
    expect(seek.getAttribute("aria-valuetext")).toBe("00:12 de 02:00");
  });

  it("desmontar cancela o registro do quadro", () => {
    const fake = fakeEngine();
    const display = render(<Instruments engine={fake.engine} />);
    expect(fake.hasFrame()).toBe(true);
    display.unmount();
    expect(fake.hasFrame()).toBe(false);
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
    const fake = mount({ scale: "collection", alb: 0 });
    expect(screen.queryByText(ALBUMS[4].tracks[0].title)).toBe(null);

    act(() => fake.update({ scale: "album", alb: 4 }));
    expect(screen.getByText(ALBUMS[4].tracks[0].title)).toBeDefined();
  });
});

describe("fronteira com o world", () => {
  it("reconhece um alvo nascido na camada de instruments", () => {
    mount();
    const button = screen.getByRole("button", { name: /Tocar/ });
    expect(isInstrumentsTarget({ target: button } as unknown as Event)).toBe(true);
  });

  it("um alvo de fora do painel não pertence à camada", () => {
    mount();
    const outside = document.createElement("canvas");
    document.body.appendChild(outside);
    expect(isInstrumentsTarget({ target: outside } as unknown as Event)).toBe(false);
  });
});

describe("composição compacta — as duas réguas não disputam espaço", () => {
  const regua = (label: string) =>
    document.querySelector(`nav[aria-label^="${label}"]`) as HTMLElement;

  it("no celular, abrir um álbum recolhe a régua de discos", () => {
    mount({ variant: "mobile", scale: "album", alb: 0 });
    const albuns = regua("Álbuns");
    expect(albuns.getAttribute("aria-hidden")).toBe("true");
    expect(albuns.className).toContain("pointer-events-none");
    for (const b of within(albuns).getAllByRole("button", { hidden: true })) {
      expect(b.tabIndex).toBe(-1);
    }
  });

  it("no celular a régua de discos se abre sob demanda, para não cobrir o mundo", () => {
    mount({ variant: "mobile", scale: "collection" });
    const albuns = regua("Álbuns");
    expect(albuns.getAttribute("aria-hidden")).toBe("true");

    const abrir = screen.getByRole("button", { name: "Álbuns" });
    expect(abrir.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(abrir);

    expect(regua("Álbuns").getAttribute("aria-hidden")).toBe("false");
    expect(regua("Álbuns").className).toContain("pointer-events-auto");
    expect(within(regua("Álbuns")).getAllByRole("button")[0].tabIndex).toBe(0);
    expect(screen.getByRole("button", { name: "Fechar" })).toBeDefined();
  });

  it("no celular, escolher um disco fecha a régua", () => {
    const fake = mount({ variant: "mobile", scale: "collection" });
    fireEvent.click(screen.getByRole("button", { name: "Álbuns" }));
    const linha = within(regua("Álbuns")).getAllByRole("button")[0];
    fireEvent.click(linha);
    expect(fake.last("enterAlbum")?.args).toEqual([0]);
    expect(regua("Álbuns").getAttribute("aria-hidden")).toBe("true");
  });

  it("no desktop não existe botão de abrir régua: ela já está aberta", () => {
    mount({ variant: "desktop", scale: "collection" });
    expect(screen.queryByRole("button", { name: "Álbuns" })).toBeNull();
    expect(regua("Álbuns").getAttribute("aria-hidden")).toBe("false");
  });

  it("no desktop as duas convivem, como sempre", () => {
    mount({ variant: "desktop", scale: "album", alb: 0 });
    const albuns = regua("Álbuns");
    expect(albuns.getAttribute("aria-hidden")).toBe("false");
    expect(albuns.className).toContain("pointer-events-auto");
    expect(regua("Faixas").className).toContain("pointer-events-auto");
  });
});

describe("composição compacta — bordas do aparelho e alvos de toque", () => {
  it("a camada de instrumentos respeita as safe areas do aparelho", () => {
    mount();
    const camada = document.querySelector("[data-instruments]") as HTMLElement;
    expect(camada.className).toContain("instruments-safe");
    expect(camada.className, "inset-0 sobrescreveria os recuos de safe-area").not.toContain(
      "inset-0",
    );
  });

  it("as réguas dividem uma coluna limitada, sem contar linhas em pixel", () => {
    mount({ scale: "album" });
    const faixas = document.querySelector('nav[aria-label^="Faixas"]') as HTMLElement;
    const coluna = faixas.parentElement as HTMLElement;

    expect(coluna.className).toContain("top-14");
    expect(coluna.className).toContain("bottom-37.5");
    expect(coluna.className).toContain("flex-col");
    expect(faixas.className).toContain("overflow-y-auto");
    expect(faixas.className).toContain("min-h-0");
  });

  it("a régua de discos rola em vez de transbordar quando o acervo cresce", () => {
    mount();
    const rail = screen.getByRole("navigation", { name: "Álbuns" });
    const lista = within(rail).getAllByRole("listitem")[0].parentElement as HTMLElement;
    expect(lista.className).toContain("overflow-y-auto");
    expect(lista.className).toContain("min-h-0");
    expect(screen.getByText("Trazer um disco").closest("ul")).toBeNull();
  });

  it("a linha de transporte quebra em vez de cortar o timecode", () => {
    mount();
    const tc = screen.getByText(/00:00 \/ 00:00/);
    expect(tc.parentElement?.className).toContain("flex-wrap");
  });
});
