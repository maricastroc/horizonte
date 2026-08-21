import { afterEach, describe, expect, it, vi } from "vitest";
import { ALBUMS, NEUTRAL_SIGNATURE } from "../content";
import { mediaUrl, needsCors } from "../content/assets";
import { CURATION } from "../content/curation.generated";
import { SIGNATURES } from "../content/signature.generated";

describe("mediaUrl without a remote base", () => {
  it("keeps local paths as local paths", () => {
    expect(mediaUrl("/music/a/01.m4a")).toBe("/music/a/01.m4a");
  });

  it("guarantees the leading slash", () => {
    expect(mediaUrl("music/a/01.m4a")).toBe("/music/a/01.m4a");
  });

  it("leaves an empty path alone", () => {
    expect(mediaUrl("")).toBe("");
  });

  it("lets absolute URLs and data URIs through", () => {
    expect(mediaUrl("https://cdn.exemplo/a.m4a")).toBe("https://cdn.exemplo/a.m4a");
    expect(mediaUrl("//cdn.exemplo/a.m4a")).toBe("//cdn.exemplo/a.m4a");
    expect(mediaUrl("data:audio/mp4;base64,AAA")).toBe("data:audio/mp4;base64,AAA");
  });
});

describe("needsCors", () => {
  it("only requires CORS for an external origin", () => {
    expect(needsCors("/music/a.m4a")).toBe(false);
    expect(needsCors("https://cdn.exemplo/a.m4a")).toBe(true);
    expect(needsCors("//cdn.exemplo/a.m4a")).toBe(true);
    expect(needsCors("data:audio/mp4;base64,AAA")).toBe(true);
  });
});

describe("mediaUrl with a remote base", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const withBase = async (base: string) => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", base);
    vi.resetModules();
    return (await import("../content/assets")).mediaUrl;
  };

  it("prefixes local paths", async () => {
    const url = await withBase("https://blob.exemplo");
    expect(url("/music/a/01.m4a")).toBe("https://blob.exemplo/music/a/01.m4a");
  });

  it("tolerates a trailing slash on the base", async () => {
    const url = await withBase("https://blob.exemplo///");
    expect(url("/music/a/01.m4a")).toBe("https://blob.exemplo/music/a/01.m4a");
  });

  it("does not prefix what is already absolute", async () => {
    const url = await withBase("https://blob.exemplo");
    expect(url("https://outro.exemplo/a.m4a")).toBe("https://outro.exemplo/a.m4a");
  });
});

describe("catalogue integrity", () => {
  it("every curated album has a measured signature", () => {
    const sem = CURATION.filter((a) => !SIGNATURES[a.id]).map((a) => a.id);
    expect(sem).toEqual([]);
  });

  it("no album fell back to the neutral signature", () => {
    const neutral = ALBUMS.filter((a) => a.signature === NEUTRAL_SIGNATURE).map((a) => a.id);
    expect(neutral).toEqual([]);
  });

  it("the identifiers are unique", () => {
    const ids = CURATION.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the catalogue numbers are unique", () => {
    const cats = CURATION.map((a) => a.cat);
    expect(new Set(cats).size).toBe(cats.length);
  });

  it("the inks are normalized RGB", () => {
    for (const a of ALBUMS) {
      for (const ink of [a.inkA, a.inkB]) {
        expect(ink, a.id).toHaveLength(3);
        for (const channel of ink) {
          expect(channel, a.id).toBeGreaterThanOrEqual(0);
          expect(channel, a.id).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("the signature overrides the curated ink when it measured one", () => {
    for (const a of ALBUMS) {
      if (a.signature.inkA) expect(a.inkA, a.id).toEqual(a.signature.inkA);
      if (a.signature.inkB) expect(a.inkB, a.id).toEqual(a.signature.inkB);
    }
  });

  it("every album has tracks with positive duration and a local source", () => {
    for (const a of ALBUMS) {
      expect(a.tracks.length, a.id).toBeGreaterThan(0);
      for (const t of a.tracks) {
        expect(t.dur, `${a.id}/${t.id}`).toBeGreaterThan(0);
        expect(t.source.kind, `${a.id}/${t.id}`).toBe("local");
      }
    }
  });

  it("the normalized descriptors stay in [0, 1]", () => {
    for (const a of ALBUMS) {
      for (const k of ["loudness", "dynamics", "brightness", "duration"] as const) {
        expect(a.signature[k], `${a.id}.${k}`).toBeGreaterThanOrEqual(0);
        expect(a.signature[k], `${a.id}.${k}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("the track spans, when measured, cover the whole album", () => {
    for (const a of ALBUMS) {
      const spans = a.signature.spans;
      if (!spans.length) continue;
      expect(spans, a.id).toHaveLength(a.tracks.length);
      expect(spans.reduce((x, y) => x + y, 0), a.id).toBeCloseTo(1, 3);
      for (const s of spans) expect(s, a.id).toBeGreaterThan(0);
    }
  });

  it("the live reference anchors are increasing ranges", () => {
    for (const a of ALBUMS) {
      const r = a.signature.reference;
      for (const k of ["bass", "mid", "treb", "rms"] as const) {
        expect(r[k][1], `${a.id}.${k}`).toBeGreaterThan(r[k][0]);
      }
    }
  });

  it("every licence declares source, attribution and verification", () => {
    for (const a of ALBUMS) {
      expect(a.license.name, a.id).toBeTruthy();
      expect(a.license.source, a.id).toMatch(/^https?:\/\//);
      expect(a.license.url, a.id).toMatch(/^https?:\/\//);
      expect(a.license.attribution, a.id).toBeTruthy();
      expect(a.license.redistributable, a.id).toBe(true);
      expect(a.license.verifiedAt, a.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("covers and tracks point inside the album folder", () => {
    for (const a of ALBUMS) {
      expect(a.cover, a.id).toContain(`/music/${a.id}/`);
      for (const t of a.tracks) {
        if (t.source.kind !== "local") continue;
        expect(t.source.src, t.id).toContain(`/music/${a.id}/`);
      }
    }
  });
});
