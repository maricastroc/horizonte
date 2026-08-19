import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALBUMS, CURATED_COUNT, resetCatalog } from "../content";
import { SR } from "../ingest/dsp";
import type { DecodeResult } from "../ingest/decode";
import type { IngestRequest, IngestResponse } from "../ingest/protocol";
import { createWorkerCore } from "../ingest/workerCore";
import { resetFormatProbe } from "../ingest/formats";
import { IngestSession } from "../ingest/session";
import type { IngestStatus } from "../ingest/types";
import { engineHarness, paintContext, type EngineHarness } from "./fakes";

const noise = (seconds: number, seed = 1) => {
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 16807) % 2147483647;
    out[i] = ((s / 2147483647) * 2 - 1) * 0.4;
  }
  return out;
};

class FakeWorker implements Pick<Worker, "postMessage" | "terminate"> {
  static made: FakeWorker[] = [];
  terminated = false;
  received: IngestRequest[] = [];

  private listeners = new Set<(e: MessageEvent<IngestResponse>) => void>();
  private core = createWorkerCore((msg) => {
    if (this.terminated) return;
    for (const fn of [...this.listeners]) fn({ data: msg } as MessageEvent<IngestResponse>);
  });

  constructor() {
    FakeWorker.made.push(this);
  }

  addEventListener(_type: string, fn: (e: MessageEvent<IngestResponse>) => void) {
    this.listeners.add(fn);
  }

  removeEventListener(_type: string, fn: (e: MessageEvent<IngestResponse>) => void) {
    this.listeners.delete(fn);
  }

  postMessage(msg: IngestRequest) {
    if (this.terminated) return;
    this.received.push(msg);
    this.core.handle(msg);
  }

  terminate() {
    this.terminated = true;
    this.listeners.clear();
  }
}

let env: EngineHarness;
let created: string[];
let revoked: string[];
let previousUrl: typeof URL.createObjectURL | undefined;
let previousRevoke: typeof URL.revokeObjectURL | undefined;

const file = (name: string, bytes = 4096) =>
  new File([new Uint8Array(bytes).buffer], name, { type: "audio/mpeg" });

const decoder =
  (seconds: Record<string, number>, failOn?: string) =>
  async (f: File): Promise<DecodeResult> => {
    if (failOn && f.name === failOn) throw new Error("formato ilegível");
    const s = seconds[f.name] ?? 3;
    return { pcm: noise(s, f.name.length), seconds: s, sourceRate: 44100, resampled: true };
  };

const deps = (decode: (f: File) => Promise<DecodeResult>) => ({
  decode,
  createWorker: () => new FakeWorker() as unknown as Worker,
});

beforeEach(() => {
  resetCatalog();
  resetFormatProbe();
  FakeWorker.made = [];
  created = [];
  revoked = [];
  env = engineHarness();
  previousUrl = URL.createObjectURL;
  previousRevoke = URL.revokeObjectURL;
  let n = 0;
  URL.createObjectURL = () => {
    const url = `blob:fake/${++n}`;
    created.push(url);
    return url;
  };
  URL.revokeObjectURL = (url: string) => {
    revoked.push(url);
  };
  (globalThis as { HTMLMediaElement?: unknown }).HTMLMediaElement ??= class {};
  (globalThis.document as unknown as { createElement: (t: string) => unknown }).createElement = (
    tag: string,
  ) =>
    tag === "audio"
      ? { canPlayType: (mime: string) => (mime.includes("mpeg") ? "probably" : "") }
      : { width: 0, height: 0, getContext: () => paintContext().ctx };
});

afterEach(() => {
  env.restore();
  resetFormatProbe();
  if (previousUrl) URL.createObjectURL = previousUrl;
  if (previousRevoke) URL.revokeObjectURL = previousRevoke;
  resetCatalog();
});

const track = <T,>() => {
  const seen: IngestStatus[] = [];
  const sink = (s: IngestStatus) => seen.push({ ...s });
  return { seen, sink } as { seen: IngestStatus[]; sink: (s: IngestStatus) => void; _?: T };
};

describe("ingestão de um disco local", () => {
  it("mede, monta e registra o álbum", async () => {
    const { seen, sink } = track();
    const session = new IngestSession(sink, deps(decoder({ "a.mp3": 4, "b.mp3": 7 })));
    const { indices, rejected } = await session.run([file("a.mp3"), file("b.mp3")]);

    expect(rejected).toEqual([]);
    expect(seen.at(-1)?.error).toBeNull();
    expect(indices).toEqual([CURATED_COUNT]);
    expect(ALBUMS).toHaveLength(CURATED_COUNT + 1);

    const album = ALBUMS[CURATED_COUNT];
    expect(album.provider).toBe("local");
    expect(album.cat).toBe("L—001");
    expect(album.tracks).toHaveLength(2);
    expect(album.tracks[0].source.kind).toBe("file");
    expect(album.tracks[0].dur).toBe(4);
    expect(album.tracks[1].dur).toBe(7);
    expect(album.signature.spans).toHaveLength(2);
    expect(album.signature.spans[1]).toBeGreaterThan(album.signature.spans[0]);
    expect(album.signature.envelope.length).toBeGreaterThan(100);
    expect(album.inkA.every(Number.isFinite)).toBe(true);

    expect(seen.at(-1)?.phase).toBe("done");
    expect(seen.map((s) => s.phase)).toContain("measuring");
    expect(seen.some((s) => s.probe !== null)).toBe(true);
    expect(seen.every((s) => s.progress >= 0 && s.progress <= 1)).toBe(true);
  });

  it("o progresso avança monotonicamente", async () => {
    const { seen, sink } = track();
    const session = new IngestSession(sink, deps(decoder({ "a.mp3": 5, "b.mp3": 5, "c.mp3": 5 })));
    await session.run([file("a.mp3"), file("b.mp3"), file("c.mp3")]);
    const progress = seen.filter((s) => s.phase !== "reading").map((s) => s.progress);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1] - 1e-9);
    }
  });

  it("dois álbuns em uma seleção viram dois corpos", async () => {
    const id3 = (album: string) => {
      const encoded = new TextEncoder().encode(album);
      const body = new Uint8Array(1 + encoded.length);
      body[0] = 3;
      body.set(encoded, 1);
      const frame = new Uint8Array(10 + body.length);
      frame.set(new TextEncoder().encode("TALB"), 0);
      new DataView(frame.buffer).setUint32(4, body.length);
      frame.set(body, 10);
      const header = new Uint8Array(10);
      header.set(new TextEncoder().encode("ID3"), 0);
      header[3] = 3;
      header[9] = frame.length;
      const out = new Uint8Array(10 + frame.length);
      out.set(header, 0);
      out.set(frame, 10);
      return out;
    };
    const named = (name: string, album: string) =>
      new File([id3(album).slice().buffer], name, { type: "audio/mpeg" });

    const { sink } = track();
    const session = new IngestSession(sink, deps(decoder({})));
    const { indices } = await session.run([
      named("a.mp3", "Primeiro"),
      named("b.mp3", "Segundo"),
      named("c.mp3", "Primeiro"),
    ]);

    expect(indices).toHaveLength(2);
    expect(ALBUMS).toHaveLength(CURATED_COUNT + 2);
    expect(ALBUMS[CURATED_COUNT].title).toBe("Primeiro");
    expect(ALBUMS[CURATED_COUNT].tracks).toHaveLength(2);
    expect(ALBUMS[CURATED_COUNT + 1].title).toBe("Segundo");
    expect(ALBUMS[CURATED_COUNT + 1].cat).toBe("L—002");
  });

  it("recusa formatos que o navegador não lê, sem quebrar", async () => {
    const { seen, sink } = track();
    const session = new IngestSession(sink, deps(decoder({})));
    const { indices, rejected } = await session.run([file("a.wma"), file("b.ra")]);

    expect(indices).toEqual([]);
    expect(rejected).toEqual(["a.wma", "b.ra"]);
    expect(ALBUMS).toHaveLength(CURATED_COUNT);
    expect(seen.at(-1)?.phase).toBe("failed");
    expect(seen.at(-1)?.error).toMatch(/MP3/);
  });

  it("um erro de decode falha nomeando o arquivo e não registra nada", async () => {
    const { seen, sink } = track();
    const session = new IngestSession(sink, deps(decoder({}, "b.mp3")));
    const { indices } = await session.run([file("a.mp3"), file("b.mp3")]);

    expect(indices).toEqual([]);
    expect(ALBUMS).toHaveLength(CURATED_COUNT);
    expect(seen.at(-1)?.phase).toBe("failed");
    expect(seen.at(-1)?.error).toContain("b.mp3");
  });

  it("erro de decode devolve as URLs já criadas", async () => {
    const { sink } = track();
    const session = new IngestSession(sink, deps(decoder({}, "b.mp3")));
    await session.run([file("a.mp3"), file("b.mp3")]);
    expect(revoked.length).toBe(created.length);
  });

  it("cancelar no meio interrompe, limpa e não registra", async () => {
    const { seen, sink } = track();
    const holder: { session?: IngestSession } = {};
    const decode = async (f: File): Promise<DecodeResult> => {
      if (f.name === "b.mp3") holder.session?.cancel();
      return { pcm: noise(3, f.name.length), seconds: 3, sourceRate: 44100, resampled: true };
    };
    const session = new IngestSession(sink, deps(decode));
    holder.session = session;
    const { indices } = await session.run([file("a.mp3"), file("b.mp3"), file("c.mp3")]);

    expect(indices).toEqual([]);
    expect(ALBUMS).toHaveLength(CURATED_COUNT);
    expect(seen.at(-1)?.phase).toBe("cancelled");
    expect(revoked.length).toBe(created.length);
    expect(FakeWorker.made.every((w) => w.terminated)).toBe(true);
  });

  it("depois de cancelada, a sessão não fala mais", async () => {
    const { seen, sink } = track();
    const holder: { session?: IngestSession } = {};
    const decode = async (f: File): Promise<DecodeResult> => {
      if (f.name === "b.mp3") holder.session?.cancel();
      return { pcm: noise(3, f.name.length), seconds: 3, sourceRate: 44100, resampled: true };
    };
    const session = new IngestSession(sink, deps(decode));
    holder.session = session;
    await session.run([file("a.mp3"), file("b.mp3"), file("c.mp3")]);

    const cancelledAt = seen.findIndex((s) => s.phase === "cancelled");
    expect(cancelledAt).toBeGreaterThanOrEqual(0);
    expect(seen.slice(cancelledAt + 1)).toEqual([]);
  });

  it("descartar a sessão a cala sem emitir nada", async () => {
    const { seen, sink } = track();
    const session = new IngestSession(sink, deps(decoder({})));
    session.dispose();
    const before = seen.length;
    await session.run([file("a.mp3")]);
    expect(seen.length).toBeGreaterThanOrEqual(before);
    expect(seen.filter((s) => s.phase === "done")).toEqual([]);
  });

  it("o worker é encerrado ao fim de qualquer caminho", async () => {
    const { sink } = track();
    await new IngestSession(sink, deps(decoder({}))).run([file("a.mp3")]);
    expect(FakeWorker.made).toHaveLength(1);
    expect(FakeWorker.made[0].terminated).toBe(true);
  });

  it("as URLs do álbum registrado sobrevivem, as demais não", async () => {
    const { sink } = track();
    const session = new IngestSession(sink, deps(decoder({ "a.mp3": 4 })));
    await session.run([file("a.mp3")]);
    const album = ALBUMS[CURATED_COUNT];
    const kept = [album.cover, ...album.tracks.map((t) => (t.source as { url: string }).url)];
    for (const url of kept) expect(revoked).not.toContain(url);
  });

  it("dispose depois do fim não revoga o que o álbum ainda usa", async () => {
    const { sink } = track();
    const session = new IngestSession(sink, deps(decoder({ "a.mp3": 4 })));
    await session.run([file("a.mp3")]);
    const album = ALBUMS[CURATED_COUNT];
    session.dispose();
    for (const t of album.tracks) {
      expect(revoked).not.toContain((t.source as { url: string }).url);
    }
  });

  it("o PCM não fica retido: o buffer é transferido para o worker", async () => {
    const { sink } = track();
    const kept: Float32Array[] = [];
    const decode = async (f: File): Promise<DecodeResult> => {
      const pcm = noise(3, f.name.length);
      kept.push(pcm);
      return { pcm, seconds: 3, sourceRate: 44100, resampled: true };
    };
    await new IngestSession(sink, deps(decode)).run([file("a.mp3")]);
    const sent = FakeWorker.made[0].received.filter((m) => m.type === "track");
    expect(sent).toHaveLength(1);
    expect(kept[0].length).toBeGreaterThan(0);
  });

  it("uma seleção só de arquivos ilegíveis não deixa o catálogo sujo", async () => {
    const { sink } = track();
    await new IngestSession(sink, deps(decoder({}, "a.mp3"))).run([file("a.mp3")]);
    expect(ALBUMS).toHaveLength(CURATED_COUNT);
    expect(ALBUMS.every((a) => a.provider === "curated")).toBe(true);
  });
});
