import { ALBUMS } from "../content";
import { COLOR } from "../tokens";
import type { FieldState, FontFamilies } from "../types";
import type { CoverAsset } from "./cover";
import { ls, type Ctx } from "./ctx";
import { lockup, type ShardSpec, type WorldLayout } from "./layout";

export interface FrontDeps {
  fonts: FontFamilies;
  covers: CoverAsset[];
}

class FragmentCache {
  private canvas: HTMLCanvasElement | null = null;
  private key = "";

  get(cover: CoverAsset, alb: number, W: number, H: number, spec: ShardSpec): HTMLCanvasElement {
    const key = `${alb}:${cover.version}:${Math.round(W)}x${Math.round(H)}:${spec.w}`;
    if (this.canvas && this.key === key) return this.canvas;

    const sm = document.createElement("canvas");
    sm.width = Math.max(1, Math.round(W * spec.w));
    sm.height = Math.max(1, Math.round(H * spec.h));
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
  if (s.scale === "collection") return A.title;
  if (s.mix > 0.5) {
    const B = ALBUMS[s.fuseAlb] ?? A;
    return B.tracks[s.fuseB]?.title ?? A.title;
  }
  const idx = s.scale === "track" && s.mode !== "collapse" ? s.trk : s.sel;
  return A.tracks[idx]?.title ?? A.title;
}

function fitFont(
  x: Ctx,
  text: string,
  font: (size: number) => string,
  size: number,
  maxW: number,
  floor: number,
): number {
  x.font = font(size);
  if (maxW <= 0) return size;
  const mw = x.measureText(text).width;
  if (mw <= maxW) return size;
  const next = Math.max(size * floor, size * (maxW / mw));
  x.font = font(next);
  return next;
}

export function drawFront(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  s: FieldState,
  L: WorldLayout,
  deps: FrontDeps,
) {
  const x = ctx as Ctx;
  const A = ALBUMS[s.alb];
  x.clearRect(0, 0, W, H);

  const lk = lockup(W, H, s, L);

  if (!L.staged) {
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
  }

  x.save();
  x.textBaseline = "alphabetic";
  ls(x, "-0.01em");
  x.globalAlpha = 1;
  x.fillStyle = COLOR.paperHi;
  const titleFont = (size: number) => `italic 400 ${size}px ${deps.fonts.bodoni}`;
  fitFont(x, frontTitle(s), titleFont, lk.tsize, lk.widthTitle, lk.floor);
  x.fillText(frontTitle(s), lk.marginTitle, lk.ty);

  x.globalAlpha = lk.metaAlpha;
  ls(x, "0.22em");
  x.fillStyle = COLOR.inkText2;
  const sub = (
    s.scale === "collection"
      ? [A.year, `${A.tracks.length} TRACKS`, A.cat]
      : [A.artist, A.title, A.year]
  )
    .filter(Boolean)
    .join(" · ");
  const metaFont = (size: number) => `500 ${size}px ${deps.fonts.mono}`;
  fitFont(x, sub, metaFont, lk.msize, lk.widthMeta, lk.floor);
  x.fillText(sub, lk.marginMeta, lk.my);
  x.restore();

  const spec = L.shard;
  const sm = fragment.get(deps.covers[s.alb], s.alb, W, H, spec);
  x.save();
  x.globalAlpha = spec.alpha + s.play * 0.12;
  x.translate(W * spec.x, H * spec.y);
  x.rotate(spec.rot);
  x.drawImage(sm, 0, 0);
  x.restore();
}
