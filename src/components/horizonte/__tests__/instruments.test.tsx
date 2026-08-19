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
};

function fakeEngine(initial: Partial<Snapshot> = {}) {
  let snap: Snapshot = { ...BASE, ...initial };
  const subscribers = new Set<() => void>();
  let sink: ((f: FrameOut) => void) | null = null;
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
    setRailTrk: register("setRailTrk"),
    skip: register("skip"),
    transport: register("transport"),
    back: register("back"),
    seekFraction: register("seekFraction"),
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

  it("clicar na barra busca a fração correspondente", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    const bar = screen.getByRole("progressbar", { name: "Progresso da faixa" });
    bar.getBoundingClientRect = () => ({ left: 100, width: 400 }) as DOMRect;

    fireEvent.click(bar, { clientX: 300 });
    expect(fake.last("seekFraction")?.args).toEqual([0.5]);
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
    expect(link.getAttribute("title")).toBe(ALBUMS[3].license.attribution);
    expect(link.getAttribute("rel")).toBe("noreferrer");
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
    const bar = screen.getByRole("progressbar", { name: "Progresso da faixa" });
    const filled = bar.querySelector(":scope > div > div") as HTMLElement;

    fake.frame({ progress: 0.25, position: 30, duration: 120 });

    expect(filled.style.width).toBe("25%");
    expect(screen.getByText("00:30 / 02:00")).toBeDefined();
    expect(bar.getAttribute("aria-valuenow")).toBe("25");
    expect(bar.getAttribute("aria-valuetext")).toBe("00:30 de 02:00");
  });

  it("a leitura assistiva é espaçada, o pixel não", () => {
    const fake = mount({ scale: "track", playAlb: 0, mode: "playing" });
    const bar = screen.getByRole("progressbar", { name: "Progresso da faixa" });
    const filled = bar.querySelector(":scope > div > div") as HTMLElement;

    fake.frame({ progress: 0.1, position: 12, duration: 120 });
    fake.frame({ progress: 0.2, position: 24, duration: 120 });

    expect(filled.style.width).toBe("20%");
    expect(bar.getAttribute("aria-valuenow")).toBe("10");
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

  it("no celular, na coleção a régua de discos continua ativa", () => {
    mount({ variant: "mobile", scale: "collection" });
    const albuns = regua("Álbuns");
    expect(albuns.getAttribute("aria-hidden")).toBe("false");
    expect(albuns.className).toContain("pointer-events-auto");
    expect(within(albuns).getAllByRole("button")[0].tabIndex).toBe(0);
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

  it("a régua de faixas mede altura pela viewport dinâmica, não por 100vh", () => {
    mount({ scale: "album" });
    const faixas = document.querySelector('nav[aria-label^="Faixas"]') as HTMLElement;
    expect(faixas.className).toContain("100dvh");
    expect(faixas.className).not.toContain("100vh-");
  });

  it("a linha de transporte quebra em vez de cortar o timecode", () => {
    mount();
    const tc = screen.getByText(/00:00 \/ 00:00/);
    expect(tc.parentElement?.className).toContain("flex-wrap");
  });
});
