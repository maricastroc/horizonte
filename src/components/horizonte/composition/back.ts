import { ALBUMS, boundsOf } from "../content";
import type { FieldConstants } from "../field";
import { isEngaged, progressOf } from "../state";
import { COLOR, GEO, PARTICLES, rgba } from "../tokens";
import type { FieldState, FontFamilies, Particle } from "../types";
import type { CoverAsset } from "./cover";
import type { RingBakery } from "./ring";
import { ls, type Ctx } from "./ctx";
import { albPos, lockup, ringBufferScale, ringR, type WorldLayout } from "./layout";

export interface BackDeps {
  fonts: FontFamilies;
  covers: CoverAsset[];
  rings: RingBakery;
  weights: number[];
  parts: Particle[];
  C: FieldConstants;
}

export function makeParticles(): Particle[] {
  const parts: Particle[] = [];
  for (let i = 0; i < PARTICLES; i++) {
    parts.push({
      a: Math.random() * 6.2832,
      r: 0.16 + Math.pow(Math.random(), 0.7) * 0.62,
      s: (0.12 + Math.random() * 0.5) * (Math.random() < 0.5 ? 1 : -1),
      z: Math.random(),
      tw: Math.random() * 6.28,
    });
  }
  return parts;
}

function drawRing(
  x: Ctx,
  buf: HTMLCanvasElement,
  cx: number,
  cy: number,
  R: number,
  rot: number,
  alpha: number,
  flatten: number,
) {
  if (alpha <= 0.01) return;
  const sc = ringBufferScale(R);
  x.save();
  x.globalCompositeOperation = "lighter";
  x.globalAlpha = alpha;
  x.translate(cx, cy);
  x.scale(1, flatten);
  x.rotate(rot);
  x.drawImage(buf, -sc / 2, -sc / 2, sc, sc);
  x.restore();
}

function trackLabels(
  x: Ctx,
  bx: number,
  by: number,
  R: number,
  W: number,
  H: number,
  s: FieldState,
  L: WorldLayout,
  fonts: FontFamilies,
  flatten: number,
) {
  const A = ALBUMS[s.alb];
  const N = A.tracks.length;
  const bounds = boundsOf(A.signature, N);
  x.save();
  x.textBaseline = "middle";
  ls(x, "0.2em");
  x.font = `500 ${W * 0.0105}px ${fonts.mono}`;
  for (let k = 0; k < N; k++) {
    const t = (bounds[k] + bounds[k + 1]) / 2;
    const a = t * 6.2832 + s.ringRot;
    const px = Math.max(W * 0.055, Math.min(W * 0.62, bx + Math.cos(a) * R * 1.24));
    const py = by + Math.sin(a) * R * 1.24 * flatten;
    const on = k === s.sel || (s.playAlb === s.alb && k === s.trk);
    if (L.ringLabels === "selecionado" && !on) continue;
    const hidden = Math.cos(a) > 0.3 || (py > H * 0.6 && px < W * 0.46);
    if (hidden && !on) continue;

    x.globalAlpha = s.fadeSel * (on ? 0.95 : 0.42);
    x.fillStyle = on ? rgba(A.inkA, 1) : COLOR.dust;
    x.textAlign = Math.cos(a) < 0 ? "right" : "left";
    x.fillText(
      `${String(k + 1).padStart(2, "0")}  ${A.tracks[k].title.toUpperCase()}`,
      px,
      py,
    );

    x.globalAlpha = s.fadeSel * (on ? 0.6 : 0.18);
    x.strokeStyle = on ? rgba(A.inkA, 1) : COLOR.dust;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(bx + Math.cos(a) * R * 1.08, by + Math.sin(a) * R * 1.08 * flatten);
    x.lineTo(bx + Math.cos(a) * R * 1.2, by + Math.sin(a) * R * 1.2 * flatten);
    x.stroke();
  }
  x.restore();
}

export function drawBack(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  s: FieldState,
  L: WorldLayout,
  deps: BackDeps,
) {
  const x = ctx as Ctx;
  const { fonts, covers, rings, weights, parts, C } = deps;
  const A = ALBUMS[s.alb];
  const inkA = (a: number) => rgba(A.inkA, a);
  const inkB = (a: number) => rgba(A.inkB, a);
  const p0 = albPos(s.alb, s, L);
  const bx = p0.x * W;
  const by = p0.y * H;
  const M = Math.min(W, H);

  x.fillStyle = COLOR.void;
  x.fillRect(0, 0, W, H);

  const g = x.createRadialGradient(bx - W * 0.06, by, 0, bx, by, W * 0.62);
  g.addColorStop(0, inkA(0.15 + s.energy * 0.07));
  g.addColorStop(0.45, inkB(0.06));
  g.addColorStop(1, "rgba(7,7,10,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);

  for (let i = 0; i < ALBUMS.length; i++) {
    if (i === s.alb) continue;
    const p = albPos(i, s, L);
    const a = Math.max(0, 0.62 * p.depth * (1 - s.zoom));
    if (a < 0.02) continue;
    const R = M * (0.16 + 0.24 * p.depth) * L.ringScale;
    drawRing(x, rings.arc(i), p.x * W, p.y * H, R, s.t * 0.04 + i, a, C.flatten);

    x.save();
    const br = M * GEO.neighborR * p.depth;
    x.globalAlpha = a * 0.9;
    x.fillStyle = COLOR.body;
    x.beginPath();
    x.ellipse(p.x * W, p.y * H, br, br, 0, 0, 6.2832);
    x.fill();

    x.strokeStyle = rgba(ALBUMS[i].inkA, 0.9);
    x.lineWidth = 1.6;
    x.beginPath();
    x.arc(p.x * W, p.y * H, br, 2.0, 4.1);
    x.stroke();

    x.textAlign = "center";
    ls(x, "-0.035em");
    x.globalAlpha = a * (i === s.hoverBody ? 1 : 0.66);
    x.fillStyle = COLOR.inkText;

    const nw = weights[i];
    x.font = `${nw} ${M * GEO.neighborR * p.depth}px ${fonts.archivo}`;
    x.fillText(ALBUMS[i].artist, p.x * W, p.y * H + br + M * 0.075 * p.depth);

    ls(x, "0.2em");
    x.globalAlpha = a * (i === s.hoverBody ? 0.95 : 0.5);
    x.font = `500 ${W * 0.0092}px ${fonts.mono}`;
    x.fillText(
      `${ALBUMS[i].cat} · ${ALBUMS[i].tracks.length} FAIXAS`,
      p.x * W,
      p.y * H + br + M * 0.105 * p.depth,
    );
    x.textAlign = "left";
    x.restore();
  }

  const R = ringR(W, H, s, L);
  if (s.fadeSel < 0.98) {
    drawRing(
      x,
      rings.arc(s.alb),
      bx,
      by,
      R,
      s.ringRot,
      (1 - s.fadeSel) * (1 - s.mix * 0.7) * 0.85,
      C.flatten,
    );
  }
  if (s.fadeSel > 0.02) {
    const activeTrk =
      s.playAlb === s.alb && (isEngaged(s.mode) || s.mode === "fusion")
        ? s.trk
        : -1;
    const prog = progressOf(s);
    const seg = rings.seg(s.alb, s.sel, s.hover, activeTrk, prog, inkA(1), C.envelopeDepth);
    drawRing(x, seg, bx, by, R, s.ringRot, s.fadeSel * (1 - s.mix * 0.6), C.flatten);

    if (s.mix > 0) {
      const other = ALBUMS[s.fuseAlb] ? s.fuseAlb : s.alb;
      drawRing(
        x,
        rings.arc(other),
        bx,
        by,
        R * (1.18 - s.mix * 0.18),
        -s.ringRot * 0.7 + 1.1,
        s.mix * 0.8,
        C.flatten,
      );
    }

    trackLabels(x, bx, by, R, W, H, s, L, fonts, C.flatten);
  }

  x.save();
  x.globalCompositeOperation = "lighter";
  for (const q of parts) {
    const rr = q.r * M * 0.9;
    const px = bx + Math.cos(q.a) * rr * 1.25;
    const py = by + Math.sin(q.a) * rr * 0.72;
    const tw = s.mode === "playing" ? 0.62 + 0.38 * Math.sin(q.tw + s.t * 5 + s.treb * 5) : 0.6;
    x.globalAlpha = (0.02 + q.z * 0.13) * tw * (0.5 + s.energy * 0.7);
    x.fillStyle = q.z > 0.6 ? inkA(1) : COLOR.dust;
    x.fillRect(px, py, 1.1, 1.1);
  }
  x.restore();

  const lk = lockup(W, H, s);
  x.save();
  x.textBaseline = "alphabetic";
  ls(x, "-0.035em");
  let asz = lk.size;
  const wgt = Math.round(C.artistWeight);
  x.font = `${wgt} ${asz}px ${fonts.archivo}`;
  const fit = s.scale === "collection" ? L.fitCollection : L.fitAlbum;
  if (fit > 0) {
    const maxW = W * fit - W * GEO.marginText;
    const mw = x.measureText(A.artist).width;
    if (mw > maxW) {
      asz = Math.max(asz * 0.55, asz * (maxW / mw));
      x.font = `${wgt} ${asz}px ${fonts.archivo}`;
    }
  }
  x.globalAlpha = (1 - s.mix) * (0.92 - s.play * 0.25);
  x.fillStyle = COLOR.paper;
  x.fillText(A.artist, W * GEO.marginText, lk.ay);
  if (s.mix > 0 && ALBUMS[s.fuseAlb]) {
    x.globalAlpha = s.mix * (0.92 - s.play * 0.25);
    x.fillText(
      ALBUMS[s.fuseAlb].artist,
      W * GEO.marginText + (1 - s.mix) * W * 0.12,
      lk.ay + (1 - s.mix) * H * 0.05,
    );
  }
  x.restore();

  if (s.play > 0.02) {
    const bandH = H * GEO.bandH * s.play;
    x.save();
    x.globalAlpha = GEO.bandAlpha * s.play;
    x.drawImage(covers[s.alb].canvas, 0, H - bandH, W, bandH);
    x.globalCompositeOperation = "destination-out";
    const fg = x.createLinearGradient(0, H - bandH, 0, H);
    fg.addColorStop(0, "rgba(0,0,0,1)");
    fg.addColorStop(0.6, "rgba(0,0,0,0.15)");
    fg.addColorStop(1, "rgba(0,0,0,0.55)");
    x.fillStyle = fg;
    x.fillRect(0, H - bandH, W, bandH);
    x.restore();

    const prog = progressOf(s);
    x.fillStyle = inkA(0.85 * s.play);
    x.fillRect(0, H - 2, W * prog, 2);
  }

  const scrim = x.createLinearGradient(0, H * GEO.scrimBottom, 0, H);
  scrim.addColorStop(0, "rgba(7,7,10,0)");
  scrim.addColorStop(0.55, "rgba(7,7,10,.62)");
  scrim.addColorStop(1, "rgba(7,7,10,.88)");
  x.fillStyle = scrim;
  x.fillRect(0, H * GEO.scrimBottom, W, H * (1 - GEO.scrimBottom));

  const scrimT = x.createLinearGradient(0, 0, 0, H * GEO.scrimTop);
  scrimT.addColorStop(0, "rgba(7,7,10,.72)");
  scrimT.addColorStop(1, "rgba(7,7,10,0)");
  x.fillStyle = scrimT;
  x.fillRect(0, 0, W, H * GEO.scrimTop);
}
