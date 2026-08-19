import { afterEach, describe, expect, it, vi } from "vitest";
import { ALBUMS, NEUTRAL_SIGNATURE } from "../content";
import { mediaUrl, needsCors } from "../content/assets";
import { CURATION } from "../content/curation.generated";
import { SIGNATURES } from "../content/signature.generated";

describe("mediaUrl sem base remota", () => {
  it("mantém caminhos locais como caminhos locais", () => {
    expect(mediaUrl("/music/a/01.m4a")).toBe("/music/a/01.m4a");
  });

  it("garante a barra inicial", () => {
    expect(mediaUrl("music/a/01.m4a")).toBe("/music/a/01.m4a");
  });

  it("não mexe em caminho vazio", () => {
    expect(mediaUrl("")).toBe("");
  });

  it("deixa passar URL absoluta e data URI", () => {
    expect(mediaUrl("https://cdn.exemplo/a.m4a")).toBe("https://cdn.exemplo/a.m4a");
    expect(mediaUrl("//cdn.exemplo/a.m4a")).toBe("//cdn.exemplo/a.m4a");
    expect(mediaUrl("data:audio/mp4;base64,AAA")).toBe("data:audio/mp4;base64,AAA");
  });
});

describe("needsCors", () => {
  it("só exige CORS para origem externa", () => {
    expect(needsCors("/music/a.m4a")).toBe(false);
    expect(needsCors("https://cdn.exemplo/a.m4a")).toBe(true);
    expect(needsCors("//cdn.exemplo/a.m4a")).toBe(true);
    expect(needsCors("data:audio/mp4;base64,AAA")).toBe(true);
  });
});

describe("mediaUrl com base remota", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const comBase = async (base: string) => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", base);
    vi.resetModules();
    return (await import("../content/assets")).mediaUrl;
  };

  it("prefixa os caminhos locais", async () => {
    const url = await comBase("https://blob.exemplo");
    expect(url("/music/a/01.m4a")).toBe("https://blob.exemplo/music/a/01.m4a");
  });

  it("tolera barra sobrando na base", async () => {
    const url = await comBase("https://blob.exemplo///");
    expect(url("/music/a/01.m4a")).toBe("https://blob.exemplo/music/a/01.m4a");
  });

  it("não prefixa o que já é absoluto", async () => {
    const url = await comBase("https://blob.exemplo");
    expect(url("https://outro.exemplo/a.m4a")).toBe("https://outro.exemplo/a.m4a");
  });
});

describe("integridade do acervo", () => {
  it("todo álbum curado tem assinatura medida", () => {
    const sem = CURATION.filter((a) => !SIGNATURES[a.id]).map((a) => a.id);
    expect(sem).toEqual([]);
  });

  it("nenhum álbum caiu na assinatura neutra", () => {
    const neutros = ALBUMS.filter((a) => a.signature === NEUTRAL_SIGNATURE).map((a) => a.id);
    expect(neutros).toEqual([]);
  });

  it("os identificadores são únicos", () => {
    const ids = CURATION.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("os catálogos são únicos", () => {
    const cats = CURATION.map((a) => a.cat);
    expect(new Set(cats).size).toBe(cats.length);
  });

  it("as tintas são RGB normalizado", () => {
    for (const a of ALBUMS) {
      for (const tinta of [a.inkA, a.inkB]) {
        expect(tinta, a.id).toHaveLength(3);
        for (const canal of tinta) {
          expect(canal, a.id).toBeGreaterThanOrEqual(0);
          expect(canal, a.id).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("a assinatura sobrepõe a tinta da curadoria quando a mediu", () => {
    for (const a of ALBUMS) {
      if (a.signature.inkA) expect(a.inkA, a.id).toEqual(a.signature.inkA);
      if (a.signature.inkB) expect(a.inkB, a.id).toEqual(a.signature.inkB);
    }
  });

  it("todo álbum tem faixas com duração positiva e fonte local", () => {
    for (const a of ALBUMS) {
      expect(a.tracks.length, a.id).toBeGreaterThan(0);
      for (const t of a.tracks) {
        expect(t.dur, `${a.id}/${t.id}`).toBeGreaterThan(0);
        expect(t.source.kind, `${a.id}/${t.id}`).toBe("local");
      }
    }
  });

  it("os descritores normalizados ficam em [0, 1]", () => {
    for (const a of ALBUMS) {
      for (const k of ["loudness", "dynamics", "brightness", "duration"] as const) {
        expect(a.signature[k], `${a.id}.${k}`).toBeGreaterThanOrEqual(0);
        expect(a.signature[k], `${a.id}.${k}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("os spans de faixa, quando medidos, cobrem o álbum inteiro", () => {
    for (const a of ALBUMS) {
      const spans = a.signature.spans;
      if (!spans.length) continue;
      expect(spans, a.id).toHaveLength(a.tracks.length);
      expect(spans.reduce((x, y) => x + y, 0), a.id).toBeCloseTo(1, 3);
      for (const s of spans) expect(s, a.id).toBeGreaterThan(0);
    }
  });

  it("as âncoras de referência ao vivo são intervalos crescentes", () => {
    for (const a of ALBUMS) {
      const r = a.signature.reference;
      for (const k of ["bass", "mid", "treb", "rms"] as const) {
        expect(r[k][1], `${a.id}.${k}`).toBeGreaterThan(r[k][0]);
      }
    }
  });

  it("toda licença declara origem, atribuição e verificação", () => {
    for (const a of ALBUMS) {
      expect(a.license.name, a.id).toBeTruthy();
      expect(a.license.source, a.id).toMatch(/^https?:\/\//);
      expect(a.license.url, a.id).toMatch(/^https?:\/\//);
      expect(a.license.attribution, a.id).toBeTruthy();
      expect(a.license.redistributable, a.id).toBe(true);
      expect(a.license.verifiedAt, a.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("as capas e faixas apontam para dentro da pasta do álbum", () => {
    for (const a of ALBUMS) {
      expect(a.cover, a.id).toContain(`/music/${a.id}/`);
      for (const t of a.tracks) {
        if (t.source.kind !== "local") continue;
        expect(t.source.src, t.id).toContain(`/music/${a.id}/`);
      }
    }
  });
});
