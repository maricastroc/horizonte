import { afterEach, beforeEach, describe, expect, it } from "vitest";
import frag from "@/shaders/field.frag.glsl";
import vert from "@/shaders/field.vert.glsl";
import { drawBack, makeParticles } from "../composition/back";
import { loadCovers, type CoverAsset } from "../composition/cover";
import { drawFront, frontTitle } from "../composition/front";
import { layoutFor } from "../composition/layout";
import { RingBakery } from "../composition/ring";
import { ALBUMS, boundsOf } from "../content";
import { fieldConstantsOf } from "../field";
import { morphologyOf } from "../morphology";
import { createFieldUniforms } from "../fieldMaterial";
import { initialState } from "../state";
import { PARTICLES } from "../tokens";
import type { FieldState, Mode, Scale, Variant } from "../types";
import { engineHarness, paintContext, type EngineHarness } from "./fakes";

const FONTS = { archivo: "Archivo", bodoni: "Bodoni", mono: "Mono" };

let env: EngineHarness;
let covers: CoverAsset[];
let rings: RingBakery;

const state = (over: Partial<FieldState> = {}): FieldState => ({ ...initialState(), ...over });

const weights = ALBUMS.map((a) => Math.round(fieldConstantsOf(a.signature).artistWeight));

const morphOf = (alb: number) =>
  morphologyOf(ALBUMS[alb].signature, ALBUMS[alb].tracks.length);

const backDeps = () => ({
  fonts: FONTS,
  covers,
  rings,
  weights: weights,
  parts: makeParticles(),
  C: fieldConstantsOf(ALBUMS[0].signature),
  morph: morphOf(0),
  morphOf,
});

beforeEach(() => {
  env = engineHarness();
  covers = loadCovers();
  rings = new RingBakery(covers);
});

afterEach(() => env.restore());

describe("contrato do shader", () => {
  const declared = (source: string) => {
    const names = new Set<string>();
    for (const m of source.matchAll(/uniform\s+\w+\s+([^;]+);/g)) {
      for (const label of m[1].split(",")) names.add(label.trim());
    }
    return names;
  };

  it("todo uniforme do shader existe no lado TypeScript", () => {
    const uniforms = createFieldUniforms();
    const missing = [...declared(frag), ...declared(vert)].filter((n) => !(n in uniforms));
    expect(missing).toEqual([]);
  });

  it("todo uniforme declarado em TypeScript é consumido por algum shader", () => {
    const inShader = new Set([...declared(frag), ...declared(vert)]);
    const leftover = Object.keys(createFieldUniforms()).filter((n) => !inShader.has(n));
    expect(leftover).toEqual([]);
  });

  it("o atributo de geometria do shader é o que o material declara", () => {
    expect(vert).toContain("aP");
  });
});

describe("frontTitle", () => {
  it("na coleção mostra o nome do disco", () => {
    expect(frontTitle(state({ alb: 2 }))).toBe(ALBUMS[2].title);
  });

  it("no álbum mostra a faixa selecionada", () => {
    expect(frontTitle(state({ scale: "album", alb: 2, sel: 1 }))).toBe(ALBUMS[2].tracks[1].title);
  });

  it("na faixa mostra a que está tocando", () => {
    const s = state({ scale: "track", mode: "playing", alb: 2, trk: 3, sel: 0 });
    expect(frontTitle(s)).toBe(ALBUMS[2].tracks[3].title);
  });

  it("durante o colapso ainda mostra a seleção que originou o gesto", () => {
    const s = state({ scale: "track", mode: "collapse", alb: 2, trk: 3, sel: 1 });
    expect(frontTitle(s)).toBe(ALBUMS[2].tracks[1].title);
  });

  it("passada a metade da fusão, o título já é o do destino", () => {
    const s = state({ scale: "track", mode: "fusion", alb: 0, trk: 0, mix: 0.6, fuseAlb: 3, fuseB: 2 });
    expect(frontTitle(s)).toBe(ALBUMS[3].tracks[2].title);
  });

  it("antes da metade da fusão, ainda é o da origem", () => {
    const s = state({ scale: "track", mode: "fusion", alb: 0, trk: 1, mix: 0.4, fuseAlb: 3, fuseB: 2 });
    expect(frontTitle(s)).toBe(ALBUMS[0].tracks[1].title);
  });

  it("índice fora do disco cai no nome do álbum", () => {
    expect(frontTitle(state({ scale: "album", alb: 0, sel: 999 }))).toBe(ALBUMS[0].title);
  });
});

describe("pintura de fundo", () => {
  const scales: Scale[] = ["collection", "album", "track"];
  const modes: Mode[] = ["stopped", "collapse", "playing", "paused", "fusion"];
  const variants: Variant[] = ["desktop", "tablet", "mobile"];

  it("atravessa toda a matriz de scale, modo e variante sem quebrar", () => {
    for (const scale of scales) {
      for (const mode of modes) {
        for (const variant of variants) {
          const s = state({
            scale, mode, alb: 3, sel: 1, trk: 1, playAlb: mode === "stopped" ? -1 : 3,
            play: 0.5, fadeSel: 0.5, mix: mode === "fusion" ? 0.5 : 0, fuseAlb: 4, fuseB: 0,
            dur: 200, pos: 50, energy: 0.6,
          });
          const reg = paintContext();
          expect(() => drawBack(reg.ctx, 1400, 900, s, layoutFor(variant), backDeps()),
            `${scale}/${mode}/${variant}`).not.toThrow();
          expect(reg.calls.length, `${scale}/${mode}/${variant}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("pinta o fundo antes de qualquer corpo", () => {
    const reg = paintContext();
    drawBack(reg.ctx, 1400, 900, state(), layoutFor("desktop"), backDeps());
    expect(reg.calls[0]).toBe("fillRect");
  });

  it("usa o peso tipográfico que o motor derivou, não recalcula", () => {
    const reg = paintContext();
    const deps = { ...backDeps(), weights: ALBUMS.map(() => 777) };
    drawBack(reg.ctx, 1400, 900, state({ nav: 0 }), layoutFor("desktop"), deps);
    expect(reg.sources.some((f) => f.startsWith("777 "))).toBe(true);
  });

  it("o nome do artista encolhe quando não cabe na largura útil", () => {
    const L = layoutFor("desktop");
    const s = state({ alb: 0 });

    const short = paintContext(10);
    drawBack(short.ctx, 1400, 900, s, L, backDeps());
    const long = paintContext(100_000);
    drawBack(long.ctx, 1400, 900, s, L, backDeps());

    const size = (reg: ReturnType<typeof paintContext>) => {
      const f = reg.sources.filter((x) => x.includes("Archivo")).pop() ?? "";
      return Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);
    };
    expect(size(long)).toBeLessThan(size(short));
    expect(size(long)).toBeGreaterThan(0);
  });

  it("o peso é aplicado antes do ajuste de largura", () => {
    const reg = paintContext(100_000);
    const deps = { ...backDeps(), C: fieldConstantsOf(ALBUMS[7].signature) };
    drawBack(reg.ctx, 1400, 900, state({ alb: 7 }), layoutFor("desktop"), deps);
    const fromSource = reg.sources.filter((f) => f.includes("Archivo"));
    const targetWeight = Math.round(deps.C.artistWeight);
    for (const f of fromSource.slice(-2)) expect(f.startsWith(`${targetWeight} `)).toBe(true);
  });

  it("no mobile o nome também é ajustado à largura, senão sai da tela", () => {
    expect(layoutFor("mobile").fitCollection).toBeGreaterThan(0);
    expect(layoutFor("mobile").fitAlbum).toBeGreaterThan(0);
    const reg = paintContext(100_000);
    expect(() => drawBack(reg.ctx, 400, 900, state(), layoutFor("mobile"), backDeps())).not.toThrow();
  });

  it("no mobile um nome largo demais encolhe, como no desktop", () => {
    const L = layoutFor("mobile");
    const s = state({ alb: 0 });

    const short = paintContext(10);
    drawBack(short.ctx, 750, 1300, s, L, backDeps());
    const long = paintContext(100_000);
    drawBack(long.ctx, 750, 1300, s, L, backDeps());

    const size = (reg: ReturnType<typeof paintContext>) => {
      const f = reg.sources.filter((x) => x.includes("Archivo")).pop() ?? "";
      return Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);
    };
    expect(size(long)).toBeLessThan(size(short));
    expect(size(long)).toBeGreaterThan(0);
  });

  it("mede o texto uma vez por quadro quando o ajuste está ligado", () => {
    const reg = paintContext(10);
    drawBack(reg.ctx, 1400, 900, state(), layoutFor("desktop"), backDeps());
    expect(reg.calls.filter((c) => c === "measureText")).toHaveLength(1);
  });
});

describe("pintura de frente", () => {
  it("atravessa as scales sem quebrar", () => {
    for (const scale of ["collection", "album", "track"] as Scale[]) {
      const reg = paintContext();
      const s = state({ scale, alb: 1, sel: 1, trk: 1, play: 0.4 });
      expect(() => drawFront(reg.ctx, 1400, 900, s, layoutFor("desktop"), { fonts: FONTS, covers }),
        scale).not.toThrow();
    }
  });

  it("limpa a camada antes de escrever", () => {
    const reg = paintContext();
    drawFront(reg.ctx, 1400, 900, state(), layoutFor("desktop"), { fonts: FONTS, covers });
    expect(reg.calls[0]).toBe("clearRect");
  });

  it("escreve o título em Bodoni e o subtítulo em mono", () => {
    const reg = paintContext();
    drawFront(reg.ctx, 1400, 900, state(), layoutFor("desktop"), { fonts: FONTS, covers });
    expect(reg.sources.some((f) => f.includes("Bodoni"))).toBe(true);
    expect(reg.sources.some((f) => f.includes("Mono"))).toBe(true);
  });
});

describe("partículas", () => {
  it("nascem em quantidade declarada e dentro do disco", () => {
    const parts = makeParticles();
    expect(parts).toHaveLength(PARTICLES);
    for (const q of parts) {
      expect(q.r).toBeGreaterThan(0);
      expect(q.r).toBeLessThan(1);
      expect(q.a).toBeGreaterThanOrEqual(0);
      expect(q.z).toBeGreaterThanOrEqual(0);
      expect(q.z).toBeLessThanOrEqual(1);
    }
  });

  it("giram nos dois sentidos", () => {
    const parts = makeParticles();
    expect(parts.some((q) => q.s > 0)).toBe(true);
    expect(parts.some((q) => q.s < 0)).toBe(true);
  });
});

describe("RingBakery", () => {
  it("as fronteiras do ring são as da signature do disco", () => {
    for (let i = 0; i < ALBUMS.length; i++) {
      expect(rings.bounds(i)).toEqual(boundsOf(ALBUMS[i].signature, ALBUMS[i].tracks.length));
    }
  });

  it("as fronteiras vêm memoizadas entre quadros", () => {
    expect(rings.bounds(2)).toBe(rings.bounds(2));
  });

  it("o arco de cada disco é horneado uma vez e reaproveitado", () => {
    const a = rings.arc(1);
    expect(rings.arc(1)).toBe(a);
  });

  it("uma capa nova invalida o arco horneado", () => {
    const a = rings.arc(1);
    covers[1].version++;
    expect(rings.arc(1)).not.toBe(a);
  });

  it("o setor devolve sempre o mesmo buffer de saída", () => {
    const s = rings.seg(0, 0, -1, -1, 0, "rgba(0,0,0,1)");
    expect(rings.seg(0, 1, -1, -1, 0, "rgba(0,0,0,1)")).toBe(s);
  });
});
