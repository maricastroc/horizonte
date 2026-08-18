import { ALBUMS } from "../data/albums";
import { COLOR, GEO } from "../tokens";
import type { FieldState, FontFamilies } from "../types";
import type { CoverAsset } from "./cover";
import { lockup, type WorldLayout } from "./layout";

export interface FrontDeps {
  fonts: FontFamilies;
  covers: CoverAsset[];
}

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

const ls = (x: Ctx, v: string) => {
  if (x.letterSpacing !== undefined) x.letterSpacing = v;
};

class FragmentCache {
  private canvas: HTMLCanvasElement | null = null;
  private key = "";

  get(cover: CoverAsset, alb: number, W: number, H: number): HTMLCanvasElement {
    const key = `${alb}:${cover.version}:${Math.round(W)}x${Math.round(H)}`;
    if (this.canvas && this.key === key) return this.canvas;

    const sm = document.createElement("canvas");
    sm.width = Math.max(1, Math.round(W * 0.055));
    sm.height = Math.max(1, Math.round(H * 0.62));
    const sx = sm.getContext("2d")!;
    sx.filter = "blur(5px)";
    sx.drawImage(cover.canvas, 220, 30, 18, 450, 0, 0, sm.width, sm.height);
    sx.filter = "none";

    sx.globalCompositeOperation = "destination-in";
    const mg = sx.createLinearGradient(0, 0, 0, sm.height);
    mg.addColorStop(0, "rgba(0,0,0,0)");
    mg.addColorStop(0.42, "rgba(0,0,0,.95)");
    mg.addColorStop(0.62, "rgba(0,0,0,.7)");
    mg.addColorStop(1, "rgba(0,0,0,0)");
    sx.fillStyle = mg;
    sx.fillRect(0, 0, sm.width, sm.height);

    const hg = sx.createLinearGradient(0, 0, sm.width, 0);
    hg.addColorStop(0, "rgba(0,0,0,0)");
    hg.addColorStop(0.5, "rgba(0,0,0,1)");
    hg.addColorStop(1, "rgba(0,0,0,0)");
    sx.fillStyle = hg;
    sx.fillRect(0, 0, sm.width, sm.height);

    this.canvas = sm;
    this.key = key;
    return sm;
  }
}

const fragment = new FragmentCache();

export function frontTitle(s: FieldState): string {
  const A = ALBUMS[s.alb];
  if (s.scale === "campo") return A.title;
  if (s.mix > 0.5) {
    const B = ALBUMS[s.fuseAlb] ?? A;
    return B.tracks[s.fuseB]?.title ?? A.title;
  }
  const idx = s.scale === "faixa" && s.mode !== "colapso" ? s.trk : s.sel;
  return A.tracks[idx]?.title ?? A.title;
}

export function drawFront(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  s: FieldState,
  _L: WorldLayout,
  deps: FrontDeps,
) {
  const x = ctx as Ctx;
  const A = ALBUMS[s.alb];
  x.clearRect(0, 0, W, H);

  const lk = lockup(W, H, s);

  x.save();
  const scrimTop = lk.ty - lk.tsize * 0.95;
  const scrimBottom = lk.my + lk.msize * 1.6;
  const scrimWidth = W * 0.62;
  const scrimGrad = x.createLinearGradient(0, 0, scrimWidth, 0);
  scrimGrad.addColorStop(0, "rgba(0,0,0,0.34)");
  scrimGrad.addColorStop(0.75, "rgba(0,0,0,0.16)");
  scrimGrad.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = scrimGrad;
  x.fillRect(0, scrimTop, scrimWidth, scrimBottom - scrimTop);
  x.restore();

  x.save();
  x.textBaseline = "alphabetic";
  ls(x, "-0.01em");
  x.font = `italic 400 ${lk.tsize}px ${deps.fonts.bodoni}`;
  x.globalAlpha = 1;
  x.fillStyle = COLOR.paperHi;
  x.fillText(frontTitle(s), W * GEO.marginTitle, lk.ty);

  x.globalAlpha = 0.75;
  x.font = `500 ${lk.msize}px ${deps.fonts.mono}`;
  ls(x, "0.22em");
  x.fillStyle = COLOR.inkText2;
  const sub =
    s.scale === "campo"
      ? `${A.year} · ${A.tracks.length} FAIXAS · ${A.cat}`
      : `${A.artist} · ${A.title} · ${A.year}`;
  x.fillText(sub, W * 0.034, lk.my);
  x.restore();

  const sm = fragment.get(deps.covers[s.alb], s.alb, W, H);
  x.save();
  x.globalAlpha = 0.26 + s.play * 0.12;
  x.translate(W * 0.855, H * 0.08);
  x.rotate(0.26);
  x.drawImage(sm, 0, 0);
  x.restore();
}
