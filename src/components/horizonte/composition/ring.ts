import { ALBUMS } from "../data/albums";
import { RING } from "../tokens";
import type { CoverAsset } from "./cover";
import { COVER_SIZE } from "./cover";

/**
 * Buffers de anel.
 *
 * Dois tipos: o arco assado da coleção (52–64% da circunferência, com fade nas
 * pontas) e o anel setorizado do álbum (um setor por faixa). Ambos são assados
 * num buffer quadrado de 1000px e só depois achatados e rotacionados na
 * composição — escalar antes de rotacionar produz falhas de cobertura entre
 * fatias.
 *
 * Assar é caro: o arco sai uma vez por álbum, o setorizado só quando a seleção
 * muda. O arco de progresso, que varia a cada frame, é desenhado por cima num
 * segundo buffer.
 */

const C = RING.buffer / 2;

function buffer(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = RING.buffer;
  c.height = RING.buffer;
  return c;
}

/** Arco assado: usado pelos corpos da coleção e pela arte que sai na fusão. */
function bakeArc(cover: HTMLCanvasElement, len: number): HTMLCanvasElement {
  const c = buffer();
  const x = c.getContext("2d")!;
  const { Rin, Rout, arcSlices: N } = RING;
  const th = Rout - Rin;
  const sw = COVER_SIZE / N;
  const arc = (2 * Math.PI * Rin) / N;

  x.translate(C, C);
  for (let i = 0; i < N; i++) {
    const t = i / N;
    if (t > len) continue;
    x.save();
    x.rotate(t * 6.2832);
    x.globalAlpha = Math.min(1, (len - t) / 0.13) * Math.min(1, t / 0.1);
    x.drawImage(cover, i * sw, 0, sw + 1.5, COVER_SIZE, Rin, -arc * 1.6, th, arc * 3.2);
    x.restore();
  }

  x.globalCompositeOperation = "destination-in";
  const g = x.createRadialGradient(0, 0, Rin * 0.94, 0, 0, Rout);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.28, "rgba(0,0,0,1)");
  g.addColorStop(0.8, "rgba(0,0,0,.9)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.beginPath();
  x.arc(0, 0, Rout, 0, 6.2832);
  x.fill();

  const out = buffer();
  const ox = out.getContext("2d")!;
  ox.filter = "blur(1.4px)";
  ox.drawImage(c, 0, 0);
  return out;
}

export interface SectorGeometry {
  t0: number;
  t1: number;
  inner: number;
}

/** Fatias do anel setorizado, sem o arco de progresso. */
function bakeSectors(
  cover: HTMLCanvasElement,
  n: number,
  sel: number,
  hover: number,
  active: number,
): { canvas: HTMLCanvasElement; sectors: SectorGeometry[] } {
  const c = buffer();
  const x = c.getContext("2d")!;
  const { Rin, Rout, gap, slices: SL, alpha } = RING;
  const th = Rout - Rin;
  const sectors: SectorGeometry[] = [];

  x.save();
  x.translate(C, C);
  for (let k = 0; k < n; k++) {
    const t0 = k / n + gap / 2;
    const t1 = (k + 1) / n - gap / 2;
    const isSel = k === sel;
    const isHov = k === hover;
    const isAct = k === active;
    const base = isAct
      ? alpha.playing
      : isSel
        ? alpha.selected
        : isHov
          ? alpha.hover
          : alpha.normal;
    const inner = isSel || isAct ? Rin - th * 0.16 : Rin;
    const thick = isSel || isAct ? th * 1.16 : th * 0.82;
    const arcPx = (2 * Math.PI * inner) / (n * SL);
    sectors.push({ t0, t1, inner });

    for (let i = 0; i < SL; i++) {
      const f = i / SL;
      const t = t0 + (t1 - t0) * f;
      x.save();
      x.rotate(t * 6.2832);
      x.globalAlpha = base;
      x.drawImage(
        cover,
        Math.floor((k / n + (t1 - t0) * f) * COVER_SIZE),
        0,
        Math.ceil(COVER_SIZE / (n * SL)) + 2,
        COVER_SIZE,
        inner,
        -arcPx * 1.7,
        thick,
        arcPx * 3.4,
      );
      x.restore();
    }
  }
  x.restore();
  return { canvas: c, sectors };
}

interface SegCacheKey {
  alb: number;
  version: number;
  sel: number;
  hover: number;
  active: number;
}

export class RingBakery {
  private arcs: (HTMLCanvasElement | null)[];
  private arcVersion: number[];
  private segKey: SegCacheKey | null = null;
  private segSlices: HTMLCanvasElement | null = null;
  private segSectors: SectorGeometry[] = [];
  private segOut = buffer();

  constructor(private covers: CoverAsset[]) {
    this.arcs = covers.map(() => null);
    this.arcVersion = covers.map(() => -1);
  }

  /** Arco assado do álbum `i`. 52–64% da circunferência. */
  arc(i: number): HTMLCanvasElement {
    const cover = this.covers[i];
    if (!this.arcs[i] || this.arcVersion[i] !== cover.version) {
      this.arcs[i] = bakeArc(cover.canvas, 0.52 + (i % 3) * 0.06);
      this.arcVersion[i] = cover.version;
    }
    return this.arcs[i]!;
  }

  /**
   * Anel setorizado com o arco de progresso. As fatias são reassadas só quando
   * álbum/seleção/hover/faixa ativa mudam; o progresso é redesenhado por frame.
   */
  seg(
    alb: number,
    sel: number,
    hover: number,
    active: number,
    progress: number,
    ink: string,
  ): HTMLCanvasElement {
    const cover = this.covers[alb];
    const key: SegCacheKey = { alb, version: cover.version, sel, hover, active };
    const stale =
      !this.segKey ||
      this.segKey.alb !== key.alb ||
      this.segKey.version !== key.version ||
      this.segKey.sel !== key.sel ||
      this.segKey.hover !== key.hover ||
      this.segKey.active !== key.active;

    if (stale) {
      const n = ALBUMS[alb].tracks.length;
      const baked = bakeSectors(cover.canvas, n, sel, hover, active);
      this.segSlices = baked.canvas;
      this.segSectors = baked.sectors;
      this.segKey = key;
    }

    const x = this.segOut.getContext("2d")!;
    x.clearRect(0, 0, RING.buffer, RING.buffer);
    x.drawImage(this.segSlices!, 0, 0);

    x.save();
    x.translate(C, C);
    this.segSectors.forEach((s, k) => {
      const isAct = k === active;
      const isSel = k === sel;
      x.globalAlpha = isAct ? 0.9 : isSel ? 0.55 : 0.18;
      x.strokeStyle = ink;
      x.lineWidth = isAct ? 4 : 2;
      x.beginPath();
      x.arc(
        0,
        0,
        s.inner - 10,
        s.t0 * 6.2832,
        (isAct ? s.t0 + (s.t1 - s.t0) * progress : s.t1) * 6.2832,
      );
      x.stroke();
    });
    x.restore();
    return this.segOut;
  }
}
