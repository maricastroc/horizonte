import { beforeEach, describe, expect, it } from "vitest";
import {
  ALBUMS,
  CURATED_COUNT,
  boundsOf,
  envelopeOf,
  registerAlbum,
  resetCatalog,
  trackBiasOf,
} from "../content";
import { SIGNATURES } from "../content/signature.generated";
import { NEUTRAL_SIGNATURE } from "../content/signature";
import { leadOf } from "../audio/anticipation";
import { RANGE, fieldConstantsOf, heftOf, lightSweepOf } from "../field";
import { albumProgressOf } from "../state";
import {
  ENVELOPE_N,
  FFT,
  HOP,
  SR,
  analyzeTrackPcm,
  composeAlbum,
  downmix,
  encodeEnvelope,
  norm,
  percentile,
  round,
} from "../ingest/dsp";
import { RealFFT } from "../ingest/fft";
import {
  FALLBACK_ARTIST,
  assembleAlbum,
  groupFiles,
  orderTracks,
  signatureOf,
  titleFromFilename,
} from "../ingest/album";
import { forceRange, inkFromAudio, oklch, stableHue } from "../ingest/color";
import { readTags } from "../ingest/metadata";

const noise = (seconds: number, seed = 1) => {
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 16807) % 2147483647;
    out[i] = (s / 2147483647) * 2 - 1;
  }
  return out;
};

const tone = (seconds: number, hz: number, amp = 0.5) => {
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * hz * i) / SR) * amp;
  return out;
};

const finite = (v: number) => Number.isFinite(v);

const blobOf = (bytes: Uint8Array) => new Uint8Array(bytes).slice().buffer;

const file = (name: string, bytes: Uint8Array = new Uint8Array([0])) =>
  new File([blobOf(bytes)], name, { type: "audio/mpeg" });

const draftOf = (names: string[]) =>
  names.map((name, order) => ({ file: file(name), title: name, disc: 1, track: 0, order }));

describe("FFT real", () => {
  it("acha a raia certa de uma senoide", () => {
    const fft = new RealFFT(FFT);
    const frame = new Float64Array(FFT);
    const bin = 64;
    for (let i = 0; i < FFT; i++) frame[i] = Math.sin((2 * Math.PI * bin * i) / FFT);
    const mag = fft.magnitudes(frame);
    let peak = 0;
    for (let k = 1; k < mag.length; k++) if (mag[k] > mag[peak]) peak = k;
    expect(peak).toBe(bin);
    expect(mag[bin]).toBeGreaterThan(FFT / 4);
  });

  it("respeita Parseval dentro do erro numérico", () => {
    const fft = new RealFFT(FFT);
    const frame = new Float64Array(FFT);
    let s = 7;
    let time = 0;
    for (let i = 0; i < FFT; i++) {
      s = (s * 16807) % 2147483647;
      frame[i] = (s / 2147483647) * 2 - 1;
      time += frame[i] * frame[i];
    }
    const mag = fft.magnitudes(frame);
    let freq = mag[0] * mag[0] + mag[FFT / 2] * mag[FFT / 2];
    for (let k = 1; k < FFT / 2; k++) freq += 2 * mag[k] * mag[k];
    expect(freq / FFT / time).toBeCloseTo(1, 6);
  });

  it("recusa tamanhos que não são potência de dois", () => {
    expect(() => new RealFFT(1000)).toThrow();
  });
});

describe("invariantes numéricos da medição", () => {
  it("percentil segue a interpolação linear do numpy", () => {
    const v = [1, 2, 3, 4];
    expect(percentile(v, 0)).toBe(1);
    expect(percentile(v, 100)).toBe(4);
    expect(percentile(v, 50)).toBeCloseTo(2.5, 12);
    expect(percentile(v, 10)).toBeCloseTo(1.3, 12);
  });

  it("arredonda para par no empate, como o numpy", () => {
    expect(round(0.5, 0)).toBe(0);
    expect(round(1.5, 0)).toBe(2);
    expect(round(2.5, 0)).toBe(2);
    expect(round(-14.365, 2)).toBeCloseTo(-14.36, 10);
  });

  it("normaliza contra âncoras absolutas e satura nas pontas", () => {
    expect(norm(-32, "loudness")).toBe(0);
    expect(norm(-12, "loudness")).toBe(1);
    expect(norm(-40, "loudness")).toBe(0);
    expect(norm(0, "loudness")).toBe(1);
    expect(norm(2600, "brightness", true)).toBe(1);
  });

  it("faz downmix de energia constante e corta em ±1, como o afconvert", () => {
    const l = new Float32Array([1, -1, 0.5]);
    const r = new Float32Array([1, -1, 0.5]);
    const out = downmix([l, r]);
    expect(out[0]).toBe(1);
    expect(out[1]).toBe(-1);
    expect(out[2]).toBeCloseTo(1 / Math.SQRT2, 6);
  });

  it("fonte mono não ganha nem perde nível, só o corte de escala cheia", () => {
    const out = downmix([new Float32Array([0.3, -0.4, 1.6])]);
    expect(out[0]).toBeCloseTo(0.3, 6);
    expect(out[1]).toBeCloseTo(-0.4, 6);
    expect(out[2]).toBe(1);
  });
});

describe("análise de faixa", () => {
  it("mede uma faixa sintética sem produzir NaN nem Infinity", () => {
    const a = analyzeTrackPcm(noise(3));
    expect(a.frames).toBeGreaterThan(4);
    expect(a.durationS).toBeCloseTo(3, 6);
    for (const v of [a.lowEnergy, a.totalEnergy, a.durationS]) expect(finite(v)).toBe(true);
    for (const arr of [a.rms, a.centroid, a.rolloff, a.envelope]) {
      expect(arr.length).toBeGreaterThan(0);
      expect([...arr].every(finite)).toBe(true);
    }
    for (const key of ["bass", "mid", "treb"] as const) {
      expect([...a.bands[key]].every((v) => v >= 0 && v <= 1)).toBe(true);
    }
  });

  it("faixa curta demais não gera quadros, mas ainda tem duração", () => {
    const a = analyzeTrackPcm(new Float32Array(FFT + HOP));
    expect(a.frames).toBe(0);
    expect(a.envelope.length).toBe(1);
    expect(a.durationS).toBeGreaterThan(0);
  });

  it("silêncio absoluto não vira NaN em lugar nenhum", () => {
    const a = analyzeTrackPcm(new Float32Array(SR * 2));
    const m = composeAlbum([a]);
    for (const v of [m.loudnessDb, m.dynamicsDb, m.brightnessHz, m.rolloffHz, m.bassRatio]) {
      expect(finite(v)).toBe(true);
    }
    expect([...m.envelopeBytes].every((b) => b >= 0 && b <= 255)).toBe(true);
  });

  it("um tom agudo mede mais brilho que um grave", () => {
    const low = composeAlbum([analyzeTrackPcm(tone(2, 120))]);
    const high = composeAlbum([analyzeTrackPcm(tone(2, 4000))]);
    expect(high.brightnessHz).toBeGreaterThan(low.brightnessHz * 3);
    expect(low.bassRatio).toBeGreaterThan(high.bassRatio);
  });

  it("um sinal mais alto mede mais volume", () => {
    const quiet = composeAlbum([analyzeTrackPcm(tone(2, 440, 0.05))]);
    const loud = composeAlbum([analyzeTrackPcm(tone(2, 440, 0.5))]);
    expect(loud.loudnessDb - quiet.loudnessDb).toBeCloseTo(20, 0);
  });
});

describe("composição do álbum", () => {
  const album = () =>
    composeAlbum([
      analyzeTrackPcm(tone(4, 300, 0.4)),
      analyzeTrackPcm(noise(6, 3)),
      analyzeTrackPcm(tone(2, 1200, 0.2)),
    ]);

  it("spans são proporcionais à duração e somam 1", () => {
    const m = album();
    expect(m.spans).toHaveLength(3);
    expect(m.spans.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
    expect(m.spans[1]).toBeGreaterThan(m.spans[0]);
    expect(m.spans[0]).toBeGreaterThan(m.spans[2]);
  });

  it("o envelope tem 512 bytes e percorre o range", () => {
    const m = album();
    expect(m.envelopeBytes).toHaveLength(ENVELOPE_N);
    expect(Math.max(...m.envelopeBytes)).toBe(255);
    expect(Math.min(...m.envelopeBytes)).toBe(0);
    expect(encodeEnvelope(m.envelopeBytes)).toHaveLength(Math.ceil(ENVELOPE_N / 3) * 4);
  });

  it("as âncoras p10/p90 saem ordenadas e dentro do domínio", () => {
    const m = album();
    for (const key of ["bass", "mid", "treb"] as const) {
      const [lo, hi] = m.reference[key];
      expect(lo).toBeLessThanOrEqual(hi);
      expect(lo).toBeGreaterThanOrEqual(0);
      expect(hi).toBeLessThanOrEqual(1);
    }
    expect(m.reference.rms[0]).toBeLessThanOrEqual(m.reference.rms[1]);
  });

  it("recusa um álbum sem áudio analisável", () => {
    expect(() => composeAlbum([])).toThrow();
    expect(() => composeAlbum([analyzeTrackPcm(new Float32Array(64))])).toThrow();
  });

  it("uma faixa curta demais não some do álbum: entra no span e no envelope", () => {
    const m = composeAlbum([
      analyzeTrackPcm(tone(4, 300, 0.4)),
      analyzeTrackPcm(new Float32Array(128)),
    ]);
    expect(m.spans).toHaveLength(2);
    expect(m.spans[1]).toBeGreaterThan(0);
  });
});

describe("um disco local alimenta os mesmos contratos sensoriais", () => {
  const measurement = composeAlbum([
    analyzeTrackPcm(tone(5, 200, 0.45)),
    analyzeTrackPcm(noise(9, 11)),
    analyzeTrackPcm(tone(3, 3000, 0.3)),
  ]);
  const signature = signatureOf(measurement, [0.4, 0.3, 0.6], [0.7, 0.4, 0.2]);

  it("produz uma AlbumSignature com a mesma forma da curada", () => {
    const curated = SIGNATURES["meho-mkultra"];
    expect(Object.keys(signature).sort()).toEqual(
      expect.arrayContaining(Object.keys(curated).sort()),
    );
    expect(Object.keys(signature.measured).sort()).toEqual(Object.keys(curated.measured).sort());
    expect(Object.keys(signature.reference).sort()).toEqual(Object.keys(curated.reference).sort());
  });

  it("os quatro descritores caem em 0..1", () => {
    for (const key of ["loudness", "dynamics", "brightness", "duration"] as const) {
      expect(signature[key]).toBeGreaterThanOrEqual(0);
      expect(signature[key]).toBeLessThanOrEqual(1);
    }
  });

  it("P1–P8: as constantes do campo ficam dentro dos guardrails", () => {
    const c = fieldConstantsOf(signature);
    for (const key of Object.keys(RANGE) as (keyof typeof RANGE)[]) {
      const [a, b] = RANGE[key];
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      expect(finite(c[key])).toBe(true);
      expect(c[key]).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(c[key]).toBeLessThanOrEqual(hi + 1e-9);
    }
    expect(finite(heftOf(signature))).toBe(true);
  });

  it("P9: os setores do anel vêm das durações medidas", () => {
    const bounds = boundsOf(signature, 3);
    expect(bounds).toHaveLength(4);
    expect(bounds[0]).toBe(0);
    expect(bounds[3]).toBeCloseTo(1, 9);
    expect(bounds[2] - bounds[1]).toBeGreaterThan(bounds[1] - bounds[0]);
  });

  it("P5/P10: o envelope é legível pelo motor", () => {
    const env = envelopeOf(signature);
    expect(env).toHaveLength(ENVELOPE_N);
    expect([...env].every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it("P11: a identidade por faixa se move e tem viés médio nulo", () => {
    const bias = trackBiasOf(signature, 3);
    expect(bias).toHaveLength(3);
    expect(bias.every((b) => finite(b.loudness) && finite(b.dynamics))).toBe(true);
    const spread = Math.max(...bias.map((b) => b.loudness)) - Math.min(...bias.map((b) => b.loudness));
    expect(spread).toBeGreaterThan(0);
    const bounds = boundsOf(signature, 3);
    const weighted = bias.reduce(
      (acc, b, k) => acc + b.loudness * (bounds[k + 1] - bounds[k]),
      0,
    );
    expect(Math.abs(weighted)).toBeLessThan(0.02);
  });

  it("P12/P13: luz e rotação leem a posição sem estourar", () => {
    for (const p of [0, 0.5, 1]) expect(finite(lightSweepOf(p))).toBe(true);
    const bounds = boundsOf(signature, 3);
    expect(albumProgressOf(bounds, 1, 0.5)).toBeGreaterThan(bounds[1]);
    expect(albumProgressOf(bounds, 1, 0.5)).toBeLessThan(bounds[2]);
  });

  it("a antecipação funciona sobre um envelope medido no navegador", () => {
    const lead = leadOf(signature, 0.2, signature.measured.durationS);
    expect(finite(lead)).toBe(true);
    expect(Math.abs(lead)).toBeLessThanOrEqual(1);
    expect(leadOf(signature, 0.2, 0)).toBe(0);
  });

  it("o motor não distingue disco local de curado pela assinatura", () => {
    const local = fieldConstantsOf(signature);
    const curated = fieldConstantsOf(SIGNATURES["darin-wilson-impromptu"]);
    expect(Object.keys(local)).toEqual(Object.keys(curated));
  });
});

function id3v3(frames: [string, string][], picture?: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const [id, text] of frames) {
    const body = new TextEncoder().encode(`${text}`);
    const head = new Uint8Array(10);
    head.set(new TextEncoder().encode(id), 0);
    new DataView(head.buffer).setUint32(4, body.length);
    parts.push(head, body);
  }
  if (picture) {
    const mime = new TextEncoder().encode("image/png");
    const body = new Uint8Array(1 + mime.length + 1 + 1 + 1 + picture.length);
    let at = 0;
    body[at++] = 0;
    body.set(mime, at);
    at += mime.length;
    body[at++] = 0;
    body[at++] = 3;
    body[at++] = 0;
    body.set(picture, at);
    const head = new Uint8Array(10);
    head.set(new TextEncoder().encode("APIC"), 0);
    new DataView(head.buffer).setUint32(4, body.length);
    parts.push(head, body);
  }
  let size = 0;
  for (const p of parts) size += p.length;
  const header = new Uint8Array(10);
  header.set(new TextEncoder().encode("ID3"), 0);
  header[3] = 3;
  header[6] = (size >> 21) & 0x7f;
  header[7] = (size >> 14) & 0x7f;
  header[8] = (size >> 7) & 0x7f;
  header[9] = size & 0x7f;
  const out = new Uint8Array(10 + size);
  out.set(header, 0);
  let at = 10;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function atom(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  new DataView(out.buffer).setUint32(0, out.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i) & 0xff;
  out.set(payload, 8);
  return out;
}

const join = (...parts: Uint8Array[]) => {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

function ilstText(name: string, text: string): Uint8Array {
  const payload = join(new Uint8Array(8), new TextEncoder().encode(text));
  return atom(name, atom("data", payload));
}

function m4a(entries: Uint8Array[]): Uint8Array {
  const ilst = atom("ilst", join(...entries));
  const meta = atom("meta", join(new Uint8Array(4), ilst));
  return join(atom("ftyp", new TextEncoder().encode("M4A ")), atom("moov", atom("udta", meta)));
}

function flac(comments: string[]): Uint8Array {
  const vendor = new TextEncoder().encode("horizonte");
  const encoded = comments.map((c) => new TextEncoder().encode(c));
  let size = 4 + vendor.length + 4;
  for (const c of encoded) size += 4 + c.length;
  const body = new Uint8Array(size);
  const dv = new DataView(body.buffer);
  let at = 0;
  dv.setUint32(at, vendor.length, true);
  at += 4;
  body.set(vendor, at);
  at += vendor.length;
  dv.setUint32(at, encoded.length, true);
  at += 4;
  for (const c of encoded) {
    dv.setUint32(at, c.length, true);
    at += 4;
    body.set(c, at);
    at += c.length;
  }
  const header = new Uint8Array(4);
  header[0] = 0x84;
  header[1] = (body.length >> 16) & 0xff;
  header[2] = (body.length >> 8) & 0xff;
  header[3] = body.length & 0xff;
  return join(new TextEncoder().encode("fLaC"), header, body);
}

describe("metadata embutida", () => {
  it("lê ID3v2.3 de um MP3, com capa", async () => {
    const bytes = id3v3(
      [
        ["TIT2", "Nancy Holiday"],
        ["TPE1", "Madison Kenny"],
        ["TALB", "All Systems Go"],
        ["TRCK", "3/9"],
        ["TPOS", "2"],
        ["TYER", "2021"],
      ],
      new Uint8Array([137, 80, 78, 71]),
    );
    const tags = await readTags(new File([blobOf(bytes)], "a.mp3"));
    expect(tags.title).toBe("Nancy Holiday");
    expect(tags.artist).toBe("Madison Kenny");
    expect(tags.album).toBe("All Systems Go");
    expect(tags.track).toBe(3);
    expect(tags.disc).toBe(2);
    expect(tags.year).toBe("2021");
    expect(tags.artwork?.type).toBe("image/png");
  });

  it("lê átomos de um M4A", async () => {
    const trkn = atom("trkn", atom("data", join(new Uint8Array(8), new Uint8Array([0, 0, 0, 5, 0, 9, 0, 0]))));
    const bytes = m4a([
      ilstText("©nam", "Le Hall"),
      ilstText("©ART", "Tristan Lohengrin"),
      ilstText("©alb", "Le Manoir"),
      ilstText("©day", "2019-03-01"),
      trkn,
    ]);
    const tags = await readTags(new File([blobOf(bytes)], "a.m4a"));
    expect(tags.title).toBe("Le Hall");
    expect(tags.artist).toBe("Tristan Lohengrin");
    expect(tags.album).toBe("Le Manoir");
    expect(tags.year).toBe("2019");
    expect(tags.track).toBe(5);
  });

  it("lê comentários Vorbis de um FLAC", async () => {
    const bytes = flac([
      "TITLE=Blue in Green",
      "ARTIST=Darin Wilson",
      "ALBUM=Impromptu",
      "TRACKNUMBER=05",
      "DATE=2018",
    ]);
    const tags = await readTags(new File([blobOf(bytes)], "a.flac"));
    expect(tags.title).toBe("Blue in Green");
    expect(tags.album).toBe("Impromptu");
    expect(tags.track).toBe(5);
    expect(tags.year).toBe("2018");
  });

  it("arquivo sem tags devolve objeto vazio, nunca inventa", async () => {
    const tags = await readTags(new File([blobOf(new Uint8Array(2048))], "a.wav"));
    expect(tags).toEqual({});
  });

  it("arquivo corrompido não explode", async () => {
    const bytes = new Uint8Array(600).fill(0xff);
    bytes.set(new TextEncoder().encode("ID3"), 0);
    await expect(readTags(new File([blobOf(bytes)], "a.mp3"))).resolves.toBeTruthy();
  });
});

describe("formar um álbum a partir de arquivos", () => {
  it("ordena por número de faixa quando todos têm", () => {
    const drafts = draftOf(["z.mp3", "a.mp3", "m.mp3"]);
    drafts[0].track = 2;
    drafts[1].track = 3;
    drafts[2].track = 1;
    expect(orderTracks(drafts).map((d) => d.file.name)).toEqual(["m.mp3", "z.mp3", "a.mp3"]);
  });

  it("ordena por disco antes de faixa", () => {
    const drafts = draftOf(["a.mp3", "b.mp3"]);
    drafts[0].disc = 2;
    drafts[0].track = 1;
    drafts[1].disc = 1;
    drafts[1].track = 9;
    expect(orderTracks(drafts).map((d) => d.file.name)).toEqual(["b.mp3", "a.mp3"]);
  });

  it("sem número de faixa usa ordem natural do nome, não lexicográfica", () => {
    const drafts = draftOf(["10 dez.mp3", "2 dois.mp3", "1 um.mp3"]);
    expect(orderTracks(drafts).map((d) => d.file.name)).toEqual([
      "1 um.mp3",
      "2 dois.mp3",
      "10 dez.mp3",
    ]);
  });

  it("numeração parcial cai para o nome, e não mistura os dois critérios", () => {
    const drafts = draftOf(["03 c.mp3", "01 a.mp3", "02 b.mp3"]);
    drafts[0].track = 3;
    expect(orderTracks(drafts).map((d) => d.file.name)).toEqual([
      "01 a.mp3",
      "02 b.mp3",
      "03 c.mp3",
    ]);
  });

  it("empate total preserva a ordem de seleção", () => {
    const drafts = draftOf(["x.mp3", "x.mp3", "x.mp3"]);
    expect(orderTracks(drafts).map((d) => d.order)).toEqual([0, 1, 2]);
  });

  it("limpa o número do começo do nome do arquivo", () => {
    expect(titleFromFilename("01 - Le Manoir.m4a")).toBe("Le Manoir");
    expect(titleFromFilename("01-hypnosis.m4a")).toBe("hypnosis");
    expect(titleFromFilename("07_Poursuivi.mp3")).toBe("Poursuivi");
    expect(titleFromFilename("03.Le Hall.mp3")).toBe("Le Hall");
    expect(titleFromFilename("Dans le Jardin.flac")).toBe("Dans le Jardin");
    expect(titleFromFilename("2001.mp3")).toBe("2001");
    expect(titleFromFilename("1984 remaster.mp3")).toBe("1984 remaster");
  });

  it("agrupa por álbum declarado nas tags", async () => {
    const a = file("a.mp3", id3v3([["TALB", "Um"], ["TPE1", "Artista"], ["TIT2", "A"]]));
    const b = file("b.mp3", id3v3([["TALB", "Um"], ["TPE1", "Artista"], ["TIT2", "B"]]));
    const c = file("c.mp3", id3v3([["TALB", "Dois"], ["TPE1", "Artista"], ["TIT2", "C"]]));
    const groups = await groupFiles([a, c, b]);
    expect(groups).toHaveLength(2);
    expect(groups[0].title).toBe("Um");
    expect(groups[0].tracks.map((t) => t.title)).toEqual(["A", "B"]);
    expect(groups[1].title).toBe("Dois");
  });

  it("sem tag de álbum tudo vira um disco só, sem inventar nome", async () => {
    const groups = await groupFiles([file("um.mp3"), file("dois.mp3")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].artist).toBe(FALLBACK_ARTIST);
    expect(groups[0].tracks.map((t) => t.title)).toEqual(["dois", "um"]);
    expect(groups[0].title).toBe("Sem título");
  });

  it("uma faixa só vira um álbum de uma faixa, com o título dela", async () => {
    const groups = await groupFiles([file("04 - Solar.mp3")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("Solar");
    expect(groups[0].tracks).toHaveLength(1);
  });

  it("monta um Album completo com fontes de arquivo", () => {
    const m = composeAlbum([analyzeTrackPcm(tone(3, 440, 0.3)), analyzeTrackPcm(noise(4, 5))]);
    const signature = signatureOf(m, [0.4, 0.3, 0.6], [0.7, 0.4, 0.2]);
    const album = assembleAlbum({
      id: "local-1",
      cat: "L—001",
      draft: {
        key: "k",
        artist: "Alguém",
        title: "Disco",
        year: "",
        artwork: null,
        tracks: draftOf(["a.mp3", "b.mp3"]),
      },
      durations: [3, 4],
      urls: ["blob:a", "blob:b"],
      cover: "blob:cover",
      signature,
    });
    expect(album.provider).toBe("local");
    expect(album.cat).toBe("L—001");
    expect(album.tracks[0].source).toEqual({ kind: "file", url: "blob:a", name: "a.mp3" });
    expect(album.tracks[1].dur).toBe(4);
    expect(album.license.source).toBe("");
    expect(album.license.attribution).toMatch(/Nada foi enviado/);
  });
});

describe("tinta do disco local", () => {
  it("cai no corredor oklch da coleção", () => {
    for (const seed of ["a", "outro", "terceiro"]) {
      const [a, b] = inkFromAudio(Math.random(), Math.random(), Math.random());
      void seed;
      for (const ink of [a, b]) {
        const [L, C] = oklch(ink[0], ink[1], ink[2]);
        expect(L).toBeGreaterThan(0.44);
        expect(L).toBeLessThan(0.68);
        expect(C).toBeGreaterThan(0.1);
        expect(C).toBeLessThan(0.2);
      }
    }
  });

  it("discos escuros e brilhantes recebem matizes distantes", () => {
    const [dark] = inkFromAudio(0.1, 0.1, 0.9);
    const [bright] = inkFromAudio(0.95, 0.95, 0.1);
    expect(oklch(dark[0], dark[1], dark[2])[2]).not.toBeCloseTo(
      oklch(bright[0], bright[1], bright[2])[2],
      1,
    );
  });

  it("a matiz de reserva é determinística e não depende da posição na lista", () => {
    expect(stableHue("disco")).toBe(stableHue("disco"));
    expect(stableHue("disco")).not.toBe(stableHue("outro"));
    expect(forceRange(stableHue("disco"))).toEqual(forceRange(stableHue("disco")));
  });
});

describe("regressão do catálogo curado", () => {
  beforeEach(() => resetCatalog());

  it("o acervo curado continua íntegro", () => {
    expect(ALBUMS).toHaveLength(CURATED_COUNT);
    expect(ALBUMS.every((a) => a.provider === "curated")).toBe(true);
  });

  it("registrar um disco local não altera assinatura de nenhum curado", () => {
    const before = ALBUMS.map((a) => JSON.stringify(a.signature));
    const m = composeAlbum([analyzeTrackPcm(noise(4, 21))]);
    registerAlbum({
      ...assembleAlbum({
        id: "local-x",
        cat: "L—001",
        draft: {
          key: "k",
          artist: "A",
          title: "T",
          year: "",
          artwork: null,
          tracks: draftOf(["a.mp3"]),
        },
        durations: [4],
        urls: ["blob:a"],
        cover: "blob:c",
        signature: signatureOf(m, [0.4, 0.3, 0.6], [0.7, 0.4, 0.2]),
      }),
    });
    expect(ALBUMS).toHaveLength(CURATED_COUNT + 1);
    expect(ALBUMS.slice(0, CURATED_COUNT).map((a) => JSON.stringify(a.signature))).toEqual(before);
    expect(fieldConstantsOf(ALBUMS[0].signature)).toEqual(
      fieldConstantsOf(SIGNATURES[ALBUMS[0].id]),
    );
  });

  it("resetCatalog devolve o acervo ao estado curado", () => {
    const m = composeAlbum([analyzeTrackPcm(noise(4, 22))]);
    registerAlbum({
      ...assembleAlbum({
        id: "local-y",
        cat: "L—001",
        draft: {
          key: "k",
          artist: "A",
          title: "T",
          year: "",
          artwork: null,
          tracks: draftOf(["a.mp3"]),
        },
        durations: [4],
        urls: ["blob:a"],
        cover: "blob:c",
        signature: signatureOf(m, [0.4, 0.3, 0.6], [0.7, 0.4, 0.2]),
      }),
    });
    resetCatalog();
    expect(ALBUMS).toHaveLength(CURATED_COUNT);
  });

  it("a assinatura neutra continua sendo o piso, não o caminho local", () => {
    const m = composeAlbum([analyzeTrackPcm(noise(5, 31))]);
    const local = signatureOf(m, [0.4, 0.3, 0.6], [0.7, 0.4, 0.2]);
    expect(local.envelope).not.toBe(NEUTRAL_SIGNATURE.envelope);
    expect(local.spans.length).toBeGreaterThan(0);
    expect(local.reference.rms).not.toEqual(NEUTRAL_SIGNATURE.reference.rms);
  });
});
