import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import Instruments from "../Instruments";
import { ALBUMS, CURATED_COUNT, nameUnnamed, registerAlbum, resetCatalog } from "../content";
import { setLocale, useDocumentLocale } from "../i18n";
import { LOCALE_KEY, PENDING_ATTR } from "../i18n/locale";
import { forgetLocale, getLocale } from "../i18n/store";
import type { Snapshot } from "../types";
import { fakeEngine } from "./fakeInstruments";

const EWORLD = ALBUMS.findIndex((a) => a.id === "zero-project-e-world");

function Page({ engine }: { engine: Parameters<typeof Instruments>[0]["engine"] }) {
  useDocumentLocale();
  return <Instruments engine={engine} />;
}

const browser = (languages: string[]) => {
  vi.spyOn(window.navigator, "languages", "get").mockReturnValue(languages);
  forgetLocale();
};

const mount = (initial: Partial<Snapshot> = {}) => {
  const fake = fakeEngine(initial);
  render(<Page engine={fake.engine} />);
  return fake;
};

const switchTo = (name: string) =>
  act(() => fireEvent.click(screen.getByRole("button", { name })));

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = "en";
  document.documentElement.removeAttribute(PENDING_ATTR);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  forgetLocale();
});

describe("the first visit", () => {
  it("a Portuguese browser gets the whole interface in Portuguese", () => {
    browser(["pt-BR", "en"]);
    mount();
    expect(screen.getByRole("navigation", { name: "Álbuns" })).toBeDefined();
    expect(screen.getByRole("button", { name: /Tocar/ })).toBeDefined();
    expect(screen.getByText("Trazer um disco")).toBeDefined();
    expect(document.documentElement.lang).toBe("pt-BR");
  });

  it("any other browser gets English", () => {
    browser(["es-ES"]);
    mount();
    expect(screen.getByRole("navigation", { name: "Albums" })).toBeDefined();
    expect(document.documentElement.lang).toBe("en");
  });

  it("a saved choice is honoured over the browser", () => {
    window.localStorage.setItem(LOCALE_KEY, "en");
    browser(["pt-BR"]);
    mount();
    expect(screen.getByRole("button", { name: /Play/ })).toBeDefined();
  });

  it("detection alone does not save anything", () => {
    browser(["pt-BR"]);
    mount();
    expect(window.localStorage.getItem(LOCALE_KEY)).toBeNull();
  });

  it("the instruments are revealed once the page speaks the chosen language", () => {
    browser(["pt-BR"]);
    document.documentElement.setAttribute(PENDING_ATTR, "");
    mount();
    expect(document.documentElement.hasAttribute(PENDING_ATTR)).toBe(false);
  });
});

describe("switching by hand", () => {
  it("rewrites every text in place and saves the choice", () => {
    browser(["en-US"]);
    mount({ scale: "album", alb: 2, playAlb: 2, trk: 0, mode: "playing" });
    const pause = screen.getByRole("button", { name: /Pause/ });
    switchTo("Português (Brasil)");
    expect(pause.textContent).toBe("❙❙ Pausar");
    expect(screen.getByRole("navigation", { name: "Escala" })).toBeDefined();
    expect(screen.getByRole("slider", { name: "Posição na faixa" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Por que esta forma?" })).toBeDefined();
    expect(window.localStorage.getItem(LOCALE_KEY)).toBe("pt-BR");
    expect(document.documentElement.lang).toBe("pt-BR");
    expect(getLocale()).toBe("pt-BR");
  });

  it("the switch says which language is on, by name, in its own language", () => {
    browser(["en-US"]);
    mount();
    const group = screen.getByRole("group", { name: "Language" });
    const [en, pt] = within(group).getAllByRole("button");
    expect(en.getAttribute("aria-pressed")).toBe("true");
    expect(pt.getAttribute("lang")).toBe("pt-BR");
    switchTo("Português (Brasil)");
    expect(screen.getByRole("group", { name: "Idioma" })).toBeDefined();
    expect(pt.getAttribute("aria-pressed")).toBe("true");
    expect(en.getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps focus on the switch and never touches playback or navigation", () => {
    browser(["en-US"]);
    const fake = mount({ scale: "track", alb: 2, playAlb: 2, trk: 3, mode: "playing" });
    const pt = screen.getByRole("button", { name: "Português (Brasil)" });
    pt.focus();
    const before = fake.calls.length;
    switchTo("Português (Brasil)");
    expect(document.activeElement).toBe(pt);
    expect(fake.calls.slice(before)).toEqual([]);
    expect(screen.getByRole("button", { name: /Pausar/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the anatomy where it was: the open question and the experiment", () => {
    browser(["en-US"]);
    const fake = mount({ scale: "album", alb: EWORLD });
    fireEvent.click(screen.getByRole("tab", { name: "Why this shape?" }));
    fireEvent.click(screen.getByRole("button", { name: "What if it were shorter? ▸" }));
    act(() => fake.update({ focus: "satellites", compare: true }));
    const before = fake.calls.length;
    switchTo("Português (Brasil)");
    expect(screen.getByRole("tab", { name: "Por que esta forma?" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("E se fosse mais curto?");
    expect(screen.getByRole("button", { name: "Mais curto" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("group", { name: "Comparar" })).toBeDefined();
    expect(fake.calls.slice(before)).toEqual([]);
  });

  it("speaks the live announcements in the new language", () => {
    browser(["en-US"]);
    mount();
    const region = () => document.querySelector("[aria-live='polite']")?.textContent;
    expect(region()).toBe(`Collection · ${ALBUMS.length} bodies`);
    switchTo("Português (Brasil)");
    expect(region()).toBe(`Coleção · ${ALBUMS.length} corpos`);
  });

  it("going back to English restores English everywhere", () => {
    browser(["pt-BR"]);
    mount({ scale: "album", alb: EWORLD });
    switchTo("English");
    expect(screen.getByRole("tab", { name: "Why this shape?" })).toBeDefined();
    expect(window.localStorage.getItem(LOCALE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });
});

describe("the anatomy in Portuguese", () => {
  it("asks, answers and offers the experiment in Portuguese", () => {
    browser(["pt-BR"]);
    mount({ scale: "album", alb: EWORLD });
    fireEvent.click(screen.getByRole("tab", { name: "Por que esta forma?" }));
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      "Por que há quatro pequenos corpos em volta?",
    );
    expect(screen.getByText(/Porque o disco é longo: 75 minutos/)).toBeDefined();
    expect(screen.getByRole("button", { name: "E se fosse mais curto? ▸" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Em números/ }));
    expect(screen.getByText("34 min (mediana dos 14)")).toBeDefined();
    expect(screen.getByText("o mais longo de 14")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Mais sobre esta forma/ }));
    expect(screen.getByText("A cor vem da capa, não do som.")).toBeDefined();
  });

  it("the invitation is the record's leading question, in Portuguese", () => {
    browser(["pt-BR"]);
    mount({ scale: "album", alb: EWORLD, invite: { part: "satellites" } });
    expect(screen.getByText("Por que há quatro pequenos corpos em volta?")).toBeDefined();
    expect(screen.getByRole("button", { name: /Descobrir/ })).toBeDefined();
  });
});

describe("the credit and local records", () => {
  it("the licence credit follows the language", () => {
    browser(["pt-BR"]);
    const i = ALBUMS.findIndex((a) => a.notePt);
    mount({ alb: i });
    const link = screen.getByRole("link", { name: ALBUMS[i].license.name });
    expect(link.getAttribute("title")).toContain("Licenciado sob");
    expect(link.getAttribute("title")).toContain(ALBUMS[i].notePt!);
  });

  it("a local record without a name is renamed when the language changes", () => {
    browser(["en-US"]);
    const local = {
      ...ALBUMS[0],
      id: "local-x",
      cat: "L—001",
      provider: "local" as const,
      artist: "Local album",
      title: "Untitled",
      unnamed: ["artist", "title"] as ("artist" | "title")[],
    };
    nameUnnamed({ artist: "Local album", title: "Untitled" });
    const index = registerAlbum(local);
    try {
      mount({ alb: index });
      expect(screen.getByText("Local file")).toBeDefined();
      switchTo("Português (Brasil)");
      expect(ALBUMS[index].artist).toBe("Álbum local");
      expect(ALBUMS[index].title).toBe("Sem título");
      expect(screen.getByText("Arquivo local")).toBeDefined();
    } finally {
      resetCatalog();
      expect(ALBUMS).toHaveLength(CURATED_COUNT);
    }
  });

  it("an explicit call to change the language outside React reaches the page", () => {
    browser(["en-US"]);
    mount();
    act(() => setLocale("pt-BR"));
    expect(screen.getByText("Trazer um disco")).toBeDefined();
  });
});
