import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { BOOT_SCRIPT, LOCALE_KEY, PENDING_ATTR, pickLocale } from "../i18n/locale";

describe("choosing the visitor's language", () => {
  it("uses Portuguese for any Portuguese browser", () => {
    for (const tag of ["pt-BR", "pt-PT", "pt", "PT-br", "pt-AO"]) {
      expect(pickLocale(null, [tag])).toBe("pt-BR");
    }
  });

  it("falls back to English for every other language", () => {
    for (const tag of ["en-US", "en", "es-ES", "fr", "ja", "", "ptx"]) {
      expect(pickLocale(null, [tag])).toBe("en");
    }
    expect(pickLocale(null, [])).toBe("en");
  });

  it("follows the first language it speaks in the browser's order", () => {
    expect(pickLocale(null, ["es-ES", "pt-BR", "en"])).toBe("pt-BR");
    expect(pickLocale(null, ["fr", "en-GB", "pt-BR"])).toBe("en");
    expect(pickLocale(null, ["de", "it"])).toBe("en");
  });

  it("a saved choice wins over the browser, and an unknown one is ignored", () => {
    expect(pickLocale("en", ["pt-BR"])).toBe("en");
    expect(pickLocale("pt-BR", ["en-US"])).toBe("pt-BR");
    expect(pickLocale("de", ["pt-BR"])).toBe("pt-BR");
    expect(pickLocale("", ["en"])).toBe("en");
  });
});

describe("the boot script", () => {
  const boot = (stored: string | null, languages: string[], throws = false) => {
    const attrs = new Map<string, string>();
    const root = {
      lang: "en",
      setAttribute: (k: string, v: string) => attrs.set(k, v),
    };
    runInNewContext(BOOT_SCRIPT, {
      document: { documentElement: root },
      navigator: { languages, language: languages[0] },
      localStorage: {
        getItem: (k: string) => {
          if (throws) throw new Error("blocked");
          return k === LOCALE_KEY ? stored : null;
        },
      },
    });
    return { lang: root.lang, pending: attrs.has(PENDING_ATTR) };
  };

  it("agrees with the app on every case", () => {
    const cases: [string | null, string[]][] = [
      [null, ["pt-BR"]],
      [null, ["en-US"]],
      [null, ["es", "pt"]],
      ["en", ["pt-BR"]],
      ["pt-BR", ["en"]],
      ["xx", ["pt-PT"]],
      [null, []],
    ];
    for (const [stored, languages] of cases) {
      expect(boot(stored, languages).lang).toBe(pickLocale(stored, languages));
    }
  });

  it("holds the instruments back only when the page will not stay in English", () => {
    expect(boot(null, ["pt-BR"]).pending).toBe(true);
    expect(boot(null, ["en-US"]).pending).toBe(false);
    expect(boot("en", ["pt-BR"]).pending).toBe(false);
  });

  it("survives a browser that blocks storage", () => {
    expect(boot("en", ["pt-BR"], true)).toEqual({ lang: "pt-BR", pending: true });
  });
});
