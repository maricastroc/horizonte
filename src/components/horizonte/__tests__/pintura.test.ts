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
import { createFieldUniforms } from "../fieldMaterial";
import { initialState } from "../state";
import { PARTICLES } from "../tokens";
import type { FieldState, Mode, Scale, Variant } from "../types";
import { ambienteDoMotor, contextoDePintura, type AmbienteDoMotor } from "./fakes";

const FONTES = { archivo: "Archivo", bodoni: "Bodoni", mono: "Mono" };

let amb: AmbienteDoMotor;
let covers: CoverAsset[];
let rings: RingBakery;

const estado = (over: Partial<FieldState> = {}): FieldState => ({ ...initialState(), ...over });

const pesos = ALBUMS.map((a) => Math.round(fieldConstantsOf(a.signature).artistWeight));

const depsDeFundo = () => ({
  fonts: FONTES,
  covers,
  rings,
  weights: pesos,
  parts: makeParticles(),
  C: fieldConstantsOf(ALBUMS[0].signature),
});

beforeEach(() => {
  amb = ambienteDoMotor();
  covers = loadCovers();
  rings = new RingBakery(covers);
});

afterEach(() => amb.restaurar());

describe("contrato do shader", () => {
  const declarados = (fonte: string) => {
    const nomes = new Set<string>();
    for (const m of fonte.matchAll(/uniform\s+\w+\s+([^;]+);/g)) {
      for (const nome of m[1].split(",")) nomes.add(nome.trim());
    }
    return nomes;
  };

  it("todo uniforme do shader existe no lado TypeScript", () => {
    const uniformes = createFieldUniforms();
    const faltando = [...declarados(frag), ...declarados(vert)].filter((n) => !(n in uniformes));
    expect(faltando).toEqual([]);
  });

  it("todo uniforme declarado em TypeScript é consumido por algum shader", () => {
    const noShader = new Set([...declarados(frag), ...declarados(vert)]);
    const sobrando = Object.keys(createFieldUniforms()).filter((n) => !noShader.has(n));
    expect(sobrando).toEqual([]);
  });

  it("o atributo de geometria do shader é o que o material declara", () => {
    expect(vert).toContain("aP");
  });
});

describe("frontTitle", () => {
  it("na coleção mostra o nome do disco", () => {
    expect(frontTitle(estado({ alb: 2 }))).toBe(ALBUMS[2].title);
  });

  it("no álbum mostra a faixa selecionada", () => {
    expect(frontTitle(estado({ scale: "album", alb: 2, sel: 1 }))).toBe(ALBUMS[2].tracks[1].title);
  });

  it("na faixa mostra a que está tocando", () => {
    const s = estado({ scale: "faixa", mode: "toca", alb: 2, trk: 3, sel: 0 });
    expect(frontTitle(s)).toBe(ALBUMS[2].tracks[3].title);
  });

  it("durante o colapso ainda mostra a seleção que originou o gesto", () => {
    const s = estado({ scale: "faixa", mode: "colapso", alb: 2, trk: 3, sel: 1 });
    expect(frontTitle(s)).toBe(ALBUMS[2].tracks[1].title);
  });

  it("passada a metade da fusão, o título já é o do destino", () => {
    const s = estado({ scale: "faixa", mode: "fusao", alb: 0, trk: 0, mix: 0.6, fuseAlb: 3, fuseB: 2 });
    expect(frontTitle(s)).toBe(ALBUMS[3].tracks[2].title);
  });

  it("antes da metade da fusão, ainda é o da origem", () => {
    const s = estado({ scale: "faixa", mode: "fusao", alb: 0, trk: 1, mix: 0.4, fuseAlb: 3, fuseB: 2 });
    expect(frontTitle(s)).toBe(ALBUMS[0].tracks[1].title);
  });

  it("índice fora do disco cai no nome do álbum", () => {
    expect(frontTitle(estado({ scale: "album", alb: 0, sel: 999 }))).toBe(ALBUMS[0].title);
  });
});

describe("pintura de fundo", () => {
  const escalas: Scale[] = ["campo", "album", "faixa"];
  const modos: Mode[] = ["parado", "colapso", "toca", "pausa", "fusao"];
  const variantes: Variant[] = ["desktop", "tablet", "mobile"];

  it("atravessa toda a matriz de escala, modo e variante sem quebrar", () => {
    for (const scale of escalas) {
      for (const mode of modos) {
        for (const variant of variantes) {
          const s = estado({
            scale, mode, alb: 3, sel: 1, trk: 1, playAlb: mode === "parado" ? -1 : 3,
            play: 0.5, fadeSel: 0.5, mix: mode === "fusao" ? 0.5 : 0, fuseAlb: 4, fuseB: 0,
            dur: 200, pos: 50, energy: 0.6,
          });
          const reg = contextoDePintura();
          expect(() => drawBack(reg.ctx, 1400, 900, s, layoutFor(variant), depsDeFundo()),
            `${scale}/${mode}/${variant}`).not.toThrow();
          expect(reg.chamadas.length, `${scale}/${mode}/${variant}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("pinta o fundo antes de qualquer corpo", () => {
    const reg = contextoDePintura();
    drawBack(reg.ctx, 1400, 900, estado(), layoutFor("desktop"), depsDeFundo());
    expect(reg.chamadas[0]).toBe("fillRect");
  });

  it("usa o peso tipográfico que o motor derivou, não recalcula", () => {
    const reg = contextoDePintura();
    const deps = { ...depsDeFundo(), weights: ALBUMS.map(() => 777) };
    drawBack(reg.ctx, 1400, 900, estado({ nav: 0 }), layoutFor("desktop"), deps);
    expect(reg.fontes.some((f) => f.startsWith("777 "))).toBe(true);
  });

  it("o nome do artista encolhe quando não cabe na largura útil", () => {
    const L = layoutFor("desktop");
    const s = estado({ alb: 0 });

    const curto = contextoDePintura(10);
    drawBack(curto.ctx, 1400, 900, s, L, depsDeFundo());
    const longo = contextoDePintura(100_000);
    drawBack(longo.ctx, 1400, 900, s, L, depsDeFundo());

    const tamanho = (reg: ReturnType<typeof contextoDePintura>) => {
      const f = reg.fontes.filter((x) => x.includes("Archivo")).pop() ?? "";
      return Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);
    };
    expect(tamanho(longo)).toBeLessThan(tamanho(curto));
    expect(tamanho(longo)).toBeGreaterThan(0);
  });

  it("o peso é aplicado antes do ajuste de largura", () => {
    const reg = contextoDePintura(100_000);
    const deps = { ...depsDeFundo(), C: fieldConstantsOf(ALBUMS[7].signature) };
    drawBack(reg.ctx, 1400, 900, estado({ alb: 7 }), layoutFor("desktop"), deps);
    const daFonte = reg.fontes.filter((f) => f.includes("Archivo"));
    const pesoAlvo = Math.round(deps.C.artistWeight);
    for (const f of daFonte.slice(-2)) expect(f.startsWith(`${pesoAlvo} `)).toBe(true);
  });

  it("no mobile o ajuste de largura é dispensado", () => {
    expect(layoutFor("mobile").fitCampo).toBe(0);
    const reg = contextoDePintura(100_000);
    expect(() => drawBack(reg.ctx, 400, 900, estado(), layoutFor("mobile"), depsDeFundo())).not.toThrow();
  });

  it("mede o texto uma vez por quadro quando o ajuste está ligado", () => {
    const reg = contextoDePintura(10);
    drawBack(reg.ctx, 1400, 900, estado(), layoutFor("desktop"), depsDeFundo());
    expect(reg.chamadas.filter((c) => c === "measureText")).toHaveLength(1);
  });
});

describe("pintura de frente", () => {
  it("atravessa as escalas sem quebrar", () => {
    for (const scale of ["campo", "album", "faixa"] as Scale[]) {
      const reg = contextoDePintura();
      const s = estado({ scale, alb: 1, sel: 1, trk: 1, play: 0.4 });
      expect(() => drawFront(reg.ctx, 1400, 900, s, layoutFor("desktop"), { fonts: FONTES, covers }),
        scale).not.toThrow();
    }
  });

  it("limpa a camada antes de escrever", () => {
    const reg = contextoDePintura();
    drawFront(reg.ctx, 1400, 900, estado(), layoutFor("desktop"), { fonts: FONTES, covers });
    expect(reg.chamadas[0]).toBe("clearRect");
  });

  it("escreve o título em Bodoni e o subtítulo em mono", () => {
    const reg = contextoDePintura();
    drawFront(reg.ctx, 1400, 900, estado(), layoutFor("desktop"), { fonts: FONTES, covers });
    expect(reg.fontes.some((f) => f.includes("Bodoni"))).toBe(true);
    expect(reg.fontes.some((f) => f.includes("Mono"))).toBe(true);
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
  it("as fronteiras do anel são as da assinatura do disco", () => {
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
    const s = rings.seg(0, 0, -1, -1, 0, "rgba(0,0,0,1)", 0.2);
    expect(rings.seg(0, 1, -1, -1, 0, "rgba(0,0,0,1)", 0.2)).toBe(s);
  });
});
