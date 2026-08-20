import { describe, expect, it } from "vitest";
import { SIGNATURES } from "../content/signature.generated";
import { trackBiasOf } from "../content/signature";
import { fieldConstantsOf, RANGE, type FieldConstants } from "../field";
import { analyzeTrackPcm, composeAlbum, norm, SR } from "../ingest/dsp";

const SECONDS = 45;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

interface Recipe {
  bpm?: number;
  jitterMs?: number;
  level?: number;
  tone?: "mid" | "dark" | "bright";
  limit?: number;
  pad?: number;
  seed?: number;
  kind?: "clicks" | "noise" | "drone";
}

function make(recipe: Recipe = {}): Float32Array {
  const {
    bpm = 120,
    jitterMs = 0,
    level = 0.25,
    tone = "mid",
    limit = 0,
    pad = 0.04,
    seed = 7,
    kind = "clicks",
  } = recipe;
  const rnd = rng(seed);
  const n = Math.round(SECONDS * SR);
  const x = new Float32Array(n);

  if (kind === "noise") {
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const v = rnd() * 2 - 1;
      lp += (v - lp) * 0.2;
      x[i] = lp * 0.5;
    }
  } else if (kind === "drone") {
    let ph = 0;
    let lp = 0;
    for (let i = 0; i < n; i++) {
      ph += (2 * Math.PI * (110 + 2 * Math.sin((2 * Math.PI * 0.037 * i) / SR))) / SR;
      const v = rnd() * 2 - 1;
      lp += (v - lp) * 0.08;
      x[i] = 0.3 * Math.sin(ph) + 0.1 * lp;
    }
  } else {
    let ph1 = 0;
    let ph2 = 0;
    for (let i = 0; i < n; i++) {
      ph1 += (2 * Math.PI * 110) / SR;
      ph2 += (2 * Math.PI * 164.8) / SR;
      x[i] = pad * (Math.sin(ph1) * 0.6 + Math.sin(ph2) * 0.4);
    }
    const period = 60 / bpm;
    const decay = tone === "dark" ? 0.1 : tone === "bright" ? 0.02 : 0.05;
    for (let k = 0; ; k++) {
      const t = k * period + (jitterMs ? ((rnd() * 2 - 1) * jitterMs) / 1000 : 0);
      if (t < 0) continue;
      const start = Math.round(t * SR);
      if (start >= n) break;
      const len = Math.round(decay * 4 * SR);
      let lp = 0;
      for (let j = 0; j < len && start + j < n; j++) {
        const a = Math.exp(-j / (decay * SR));
        let v = rnd() * 2 - 1;
        if (tone === "dark") {
          lp += (v - lp) * 0.06;
          v = lp * 3;
        }
        if (tone === "bright") {
          lp += (v - lp) * 0.5;
          v = (v - lp) * 1.4;
        }
        x[start + j] += level * a * v;
      }
    }
  }

  if (limit > 0) {
    for (let i = 0; i < n; i++) x[i] = Math.tanh(x[i] * limit) / Math.tanh(limit);
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(x[i]));
  if (peak > 0.99) {
    const g = 0.99 / peak;
    for (let i = 0; i < n; i++) x[i] *= g;
  }
  return x;
}

interface Medida {
  loudness: number;
  dynamics: number;
  brightness: number;
  duration: number;
  pulse: number;
  c: FieldConstants;
}

const cache = new Map<string, Medida>();

function measure(label: string, recipe: Recipe = {}): Medida {
  const hit = cache.get(label);
  if (hit) return hit;
  const m = composeAlbum([analyzeTrackPcm(make(recipe))]);
  const sig = {
    loudness: norm(m.loudnessDb, "loudness"),
    dynamics: norm(m.dynamicsDb, "dynamics"),
    brightness: norm(m.brightnessHz, "brightness", true),
    duration: norm(m.durationS, "duration"),
    pulse: norm(m.pulse, "pulse"),
  };
  const out: Medida = { ...sig, c: fieldConstantsOf({ ...sig } as never) };
  cache.set(label, out);
  return out;
}

const LEGADO = ["loudness", "dynamics", "brightness", "duration"] as const;

const span = (k: keyof typeof RANGE) => Math.abs(RANGE[k][1] - RANGE[k][0]);
const CHANNELS = Object.keys(RANGE) as (keyof typeof RANGE)[];

const worldDistance = (a: FieldConstants, b: FieldConstants, chs = CHANNELS) => {
  const uteis = chs.filter((k) => span(k) > 0);
  if (uteis.length === 0) return 0;
  return Math.max(...uteis.map((k) => Math.abs(a[k] - b[k]) / span(k)));
};

describe("o descritor mede periodicidade, e não outra coisa disfarçada", () => {
  it("separa uma grade regular de ataques soltos com a mesma densidade", () => {
    const grade = measure("regular");
    const solto = measure("jitter", { jitterMs: 110 });

    for (const k of LEGADO) expect(grade[k]).toBeCloseTo(solto[k], 2);
    expect(grade.pulse - solto.pulse).toBeGreaterThan(0.6);
  });

  it("sem ataques não há pulso, por mais estacionário que o sinal seja", () => {
    expect(measure("ruído", { kind: "noise" }).pulse).toBeLessThan(0.05);
    expect(measure("drone", { kind: "drone" }).pulse).toBeLessThan(0.05);
  });

  it("não é volume disfarçado: vinte dB abaixo, o mesmo pulso", () => {
    const alto = measure("regular");
    const baixo = measure("baixo", { level: 0.025, pad: 0.004 });
    expect(Math.abs(alto.pulse - baixo.pulse)).toBeLessThan(0.05);
  });

  it("não é brilho disfarçado: escuro e cortante medem o mesmo pulso", () => {
    const escuro = measure("escuro", { tone: "dark" });
    const claro = measure("claro", { tone: "bright" });
    expect(Math.abs(escuro.brightness - claro.brightness)).toBeGreaterThan(0.05);
    expect(Math.abs(escuro.pulse - claro.pulse)).toBeLessThan(0.08);
  });

  it("não é andamento disfarçado: 76 e 120 BPM são igualmente periódicos", () => {
    const rapido = measure("regular");
    const lento = measure("lento", { bpm: 76 });
    expect(Math.abs(rapido.pulse - lento.pulse)).toBeLessThan(0.1);
    expect(rapido.pulse).toBeGreaterThan(0.85);
    expect(lento.pulse).toBeGreaterThan(0.85);
  });
});

describe("o pulso sobrevive à masterização — que é o ponto", () => {
  it("esmagar o master destrói a dinâmica medida", () => {
    const cru = measure("regular");
    const esmagado = measure("esmagado", { limit: 14 });
    expect(cru.dynamics - esmagado.dynamics).toBeGreaterThanOrEqual(0);
    expect(esmagado.dynamics).toBeLessThan(0.05);
    expect(esmagado.loudness).toBeGreaterThan(0.8);
  });

  it("e não mexe no pulso", () => {
    const cru = measure("regular");
    const esmagado = measure("esmagado", { limit: 14 });
    expect(Math.abs(cru.pulse - esmagado.pulse)).toBeLessThan(0.05);
  });

  it("dois masters igualmente esmagados continuam distinguíveis pelo pulso", () => {
    const gradeEsmagada = measure("esmagado", { limit: 14 });
    const soltoEsmagado = measure("esmagado-solto", { jitterMs: 110, limit: 14 });

    for (const k of LEGADO) expect(gradeEsmagada[k]).toBeCloseTo(soltoEsmagado[k], 1);
    expect(gradeEsmagada.c.reactionCap).toBeCloseTo(soltoEsmagado.c.reactionCap, 3);
    expect(gradeEsmagada.c.rimHardness).toBeCloseTo(soltoEsmagado.c.rimHardness, 1);

    expect(worldDistance(gradeEsmagada.c, soltoEsmagado.c)).toBeGreaterThan(0.4);
  });

  it("o mundo de um master esmagado deixou de ser inevitavelmente o mesmo", () => {
    const a = measure("esmagado", { limit: 14 });
    const b = measure("esmagado-solto", { jitterMs: 110, limit: 14 });
    const antes = worldDistance(
      a.c,
      b.c,
      CHANNELS.filter((k) => k !== "swirl"),
    );
    const depois = worldDistance(a.c, b.c);
    expect(antes).toBeLessThan(0.01);
    expect(depois).toBeGreaterThan(antes * 20);
  });
});

describe("o acervo não converge", () => {
  const slugs = Object.keys(SIGNATURES);
  const worlds = slugs.map((s) => ({ slug: s, sig: SIGNATURES[s], c: fieldConstantsOf(SIGNATURES[s]) }));

  const minSeparation = (chs: (keyof typeof RANGE)[]) => {
    let min = Infinity;
    let pair: [string, string] = ["", ""];
    for (let i = 0; i < worlds.length; i++) {
      for (let j = i + 1; j < worlds.length; j++) {
        const d = worldDistance(worlds[i].c, worlds[j].c, chs);
        if (d < min) {
          min = d;
          pair = [worlds[i].slug, worlds[j].slug];
        }
      }
    }
    return { min, pair };
  };

  it("nenhum par de discos do acervo produz praticamente o mesmo mundo", () => {
    const { min, pair } = minSeparation(CHANNELS);
    expect(min, `${pair[0]} e ${pair[1]} quase colidem`).toBeGreaterThan(0.15);
  });

  it("o pulso afastou o par mais próximo, em vez de só existir", () => {
    const antes = minSeparation(CHANNELS.filter((k) => k !== "swirl"));
    const depois = minSeparation(CHANNELS);
    expect(depois.min / antes.min).toBeGreaterThan(1.2);
  });

  it("o pulso carrega informação que os outros descritores não carregam", () => {
    const cor = (a: number[], b: number[]) => {
      const n = a.length;
      const ma = a.reduce((x, y) => x + y, 0) / n;
      const mb = b.reduce((x, y) => x + y, 0) / n;
      let s = 0;
      let da = 0;
      let db = 0;
      for (let i = 0; i < n; i++) {
        const u = a[i] - ma;
        const v = b[i] - mb;
        s += u * v;
        da += u * u;
        db += v * v;
      }
      return s / Math.sqrt(da * db);
    };
    const pulse = worlds.map((w) => w.sig.pulse);
    for (const k of LEGADO) {
      const r = Math.abs(cor(pulse, worlds.map((w) => w.sig[k])));
      expect(r, `pulso virou proxy de ${k}`).toBeLessThan(0.7);
    }
  });

  it("o acervo percorre o range do pulso, não se amontoa numa ponta", () => {
    const values = worlds.map((w) => w.sig.pulse);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.6);
  });

  it("os dois canais por faixa não são o mesmo sinal com dois nomes", () => {
    const cor = (a: number[], b: number[]) => {
      const n = a.length;
      const ma = a.reduce((x, y) => x + y, 0) / n;
      const mb = b.reduce((x, y) => x + y, 0) / n;
      let s = 0;
      let da = 0;
      let db = 0;
      for (let i = 0; i < n; i++) {
        const u = a[i] - ma;
        const v = b[i] - mb;
        s += u * v;
        da += u * u;
        db += v * v;
      }
      return s / Math.sqrt(da * db);
    };
    const dp: number[] = [];
    const db: number[] = [];
    for (const w of worlds) {
      const tp = w.sig.trackPulse;
      const tb = w.sig.trackBrightness;
      if (!tp || !tb || tp.length !== tb.length) continue;
      const mp = tp.reduce((x, y) => x + y, 0) / tp.length;
      const mb = tb.reduce((x, y) => x + y, 0) / tb.length;
      tp.forEach((v, i) => {
        dp.push(v - mp);
        db.push(tb[i] - mb);
      });
    }
    expect(dp.length).toBeGreaterThan(20);
    expect(Math.abs(cor(dp, db))).toBeLessThan(0.5);
  });

  it("dentro de um álbum, a grade se move sem estourar o range do giro", () => {
    for (const w of worlds) {
      const n = w.sig.trackPulse?.length ?? 0;
      if (n < 2) continue;
      for (const bias of trackBiasOf(w.sig, n)) {
        const c = fieldConstantsOf(w.sig, bias);
        expect(c.swirl, w.slug).toBeGreaterThanOrEqual(RANGE.swirl[0]);
        expect(c.swirl, w.slug).toBeLessThanOrEqual(RANGE.swirl[1]);
      }
    }
  });

  it("o pulso move o giro do campo e mais nada", () => {
    const base = SIGNATURES[slugs[0]];
    const a = fieldConstantsOf({ ...base, pulse: 0 });
    const b = fieldConstantsOf({ ...base, pulse: 1 });
    for (const k of CHANNELS) {
      if (k === "swirl") expect(b[k]).toBeGreaterThan(a[k]);
      else expect(b[k]).toBe(a[k]);
    }
  });
});
