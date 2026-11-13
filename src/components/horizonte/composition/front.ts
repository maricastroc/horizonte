import { ALBUMS } from "../content";
import { CANVAS_LABELS, type CanvasLabels } from "../i18n/canvas";
import { COLOR, GLYPH, NAMES } from "../tokens";
import type { FieldState, FontFamilies } from "../types";
import type { CoverAsset } from "./cover";
import type { BodyFrame } from "./focus";
import { drawCaptions, type Caption } from "./back";
import { namePlates } from "./approach";
import { ls, type Ctx } from "./ctx";
import { lockup, type ShardSpec, type WorldLayout } from "./layout";

export interface FrontDeps {
  fonts: FontFamilies;
  covers: CoverAsset[];
  labels?: CanvasLabels;
  weights?: number[];
  artistWeight?: number;
  frame?: BodyFrame | null;
  captions?: Caption[];
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
  x.clearRect(0, 0, W, H);

  const lk = lockup(W, H, s, L);

  if (!L.staged) {
    x.save();
    const scrimTop = lk.ay - lk.size * GLYPH.artistCap;
    const scrimBottom = lk.my + lk.msize * 1.6;
    const scrimY = (scrimTop + scrimBottom) / 2;
    const scrimR = Math.max(W * 0.6, (scrimBottom - scrimTop) * 1.5);
    const scrimGrad = x.createRadialGradient(0, scrimY, 0, 0, scrimY, scrimR);
    scrimGrad.addColorStop(0, "rgba(0,0,0,0.34)");
    scrimGrad.addColorStop(0.62, "rgba(0,0,0,0.15)");
    scrimGrad.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = scrimGrad;
    x.fillRect(0, scrimY - scrimR, scrimR, scrimR * 2);
    x.restore();
  }

  if (deps.captions?.length) drawCaptions(x, deps.captions, deps.fonts);

  const fit = s.scale === "collection" ? L.fitCollection : L.fitAlbum;
  const plates = namePlates(s, ALBUMS.length);
  x.save();
  x.textBaseline = "alphabetic";
  ls(x, "-0.035em");
  x.fillStyle = COLOR.paper;
  for (const plate of plates) {
    const name = ALBUMS[plate.alb].artist;
    const settled = plates.length === 1 && plate.alb === s.alb;
    const wgt =
      settled && deps.artistWeight !== undefined
        ? Math.round(deps.artistWeight)
        : (deps.weights?.[plate.alb] ?? 700);
    let asz = lk.size;
    x.font = `${wgt} ${asz}px ${deps.fonts.archivo}`;
    if (fit > 0) {
      const maxW = L.staged ? W - lk.margin * 2 : W * fit - lk.margin;
      const mw = x.measureText(name).width;
      if (mw > maxW) {
        asz = Math.max(asz * lk.floor, asz * (maxW / mw));
        x.font = `${wgt} ${asz}px ${deps.fonts.archivo}`;
      }
    }
    const nx = lk.margin + plate.shift * W * NAMES.slide;
    x.globalAlpha = (1 - s.mix) * (GLYPH.artistAlpha - s.play * 0.25) * plate.alpha;
    x.fillText(name, nx, lk.ay);
    if (deps.frame && plate.alb === s.alb) {
      deps.frame.name = { text: name, font: x.font, x: nx, y: lk.ay };
    }
  }
  if (s.mix > 0 && ALBUMS[s.fuseAlb]) {
    x.globalAlpha = s.mix * (GLYPH.artistAlpha - s.play * 0.25);
    x.fillText(
      ALBUMS[s.fuseAlb].artist,
      lk.margin + (1 - s.mix) * W * 0.12,
      lk.ay + (1 - s.mix) * H * 0.05,
    );
  }
  x.restore();

  const labels = deps.labels ?? CANVAS_LABELS;
  const titleFont = (size: number) => `italic 400 ${size}px ${deps.fonts.bodoni}`;
  const metaFont = (size: number) => `500 ${size}px ${deps.fonts.mono}`;
  for (const plate of plates) {
    const P = ALBUMS[plate.alb];
    const slide = plate.shift * W * NAMES.slide;
    const title = s.scale === "collection" ? P.title : frontTitle(s);
    x.save();
    x.textBaseline = "alphabetic";
    ls(x, "-0.01em");
    x.globalAlpha = plate.alpha;
    x.fillStyle = COLOR.paperHi;
    fitFont(x, title, titleFont, lk.tsize, lk.widthTitle, lk.floor);
    x.fillText(title, lk.marginTitle + slide * NAMES.lag, lk.ty);

    x.globalAlpha = lk.metaAlpha * plate.alpha;
    ls(x, "0.22em");
    x.fillStyle = COLOR.inkText2;
    const sub = (
      s.scale === "collection"
        ? [P.year, labels.tracks(P.tracks.length), P.cat]
        : [P.artist, P.title, P.year]
    )
      .filter(Boolean)
      .join(" · ");
    fitFont(x, sub, metaFont, lk.msize, lk.widthMeta, lk.floor);
    x.fillText(sub, lk.marginMeta + slide * NAMES.lag * NAMES.lag, lk.my);
    x.restore();
  }

  const spec = L.shard;
  const sm = fragment.get(deps.covers[s.alb], s.alb, W, H, spec);
  x.save();
  x.globalAlpha = spec.alpha + s.play * 0.12;
  x.translate(W * spec.x, H * spec.y);
  x.rotate(spec.rot);
  x.drawImage(sm, 0, 0);
  x.restore();
}
