import { ALBUMS, boundsOf } from "../content";
import { CANVAS_LABELS, type CanvasLabels } from "../i18n/canvas";
import type { FieldConstants } from "../field";
import { neighborScale, outerAt, satRadiusOf, type AlbumMorphology } from "../morphology";
import { isEngaged, progressOf } from "../state";
import {
  ANATOMY,
  BREATH,
  COLOR,
  GEO,
  MORPH,
  NAMES,
  PARTICLES,
  RING,
  SILHOUETTE,
  rgba,
} from "../tokens";
import type { FieldState, FontFamilies, Particle } from "../types";
import type { CoverAsset } from "./cover";
import { drawFacing, drawGhost, type BodyFrame, type FocusSatellite } from "./focus";
import type { RingBakery, SegShape } from "./ring";
import { ls, type Ctx } from "./ctx";
import { stageBox, type Bands } from "./bands";
import { emergeOf, namePlates, stagesOf } from "./approach";
import {
  albPos,
  atmosphereOf,
  bandsFor,
  collectionBody,
  defocusOf,
  bodyGeom,
  lockup,
  ringBufferScale,
  type WorldLayout,
} from "./layout";

export interface BackDeps {
  fonts: FontFamilies;
  covers: CoverAsset[];
  rings: RingBakery;
  weights: number[];
  parts: Particle[];
  C: FieldConstants;
  morph: AlbumMorphology;
  morphOf: (alb: number) => AlbumMorphology;
  field?: Float32Array | null;
  fieldVersion?: number;
  compare?: SegShape | null;
  frame?: BodyFrame | null;
  ghost?: { m: AlbumMorphology; alpha: number } | null;
  facing?: number;
  labels?: CanvasLabels;
  breath?: (alb: number) => { mass: number; light: number };
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

const smooth01 = (v: number) => {
  const t = Math.min(1, Math.max(0, v));
  return t * t * (3 - 2 * t);
};

function drawSilhouette(
  x: Ctx,
  buf: HTMLCanvasElement,
  cx: number,
  cy: number,
  R: number,
  alpha: number,
  flatten: number,
  mode: GlobalCompositeOperation = "source-over",
) {
  if (alpha <= 0.01) return;
  const sc = ringBufferScale(R);
  x.save();
  x.globalCompositeOperation = mode;
  x.globalAlpha = alpha;
  x.translate(cx, cy);
  x.scale(1, flatten);
  x.rotate(RING.anchor);
  x.drawImage(buf, -sc / 2, -sc / 2, sc, sc);
  x.restore();
}

function drawSatellites(
  x: Ctx,
  bx: number,
  by: number,
  R: number,
  m: AlbumMorphology,
  fade: number,
  ink: string,
  out: FocusSatellite[] | null = null,
  emerge = 1,
) {
  if (fade <= 0.01) return;
  x.save();
  for (const sat of m.satellites) {
    if (sat.weight <= 0.02) continue;
    const at = emergeOf(sat, emerge);
    const px = bx + Math.cos(at.angle) * at.dist * R;
    const py = by + Math.sin(at.angle) * at.dist * R * m.flatten;
    const r = satRadiusOf(m, sat) * R;
    const a = fade * sat.weight;
    const rr = r * (1 + MORPH.satRim * 0.5);
    out?.push({ x: px, y: py, r: rr, ry: rr * m.flatten, w: a });

    x.globalAlpha = a * 0.95;
    x.fillStyle = COLOR.body;
    x.beginPath();
    x.ellipse(px, py, r, r * m.flatten, 0, 0, 6.2832);
    x.fill();

    x.globalAlpha = a * 0.85;
    x.strokeStyle = ink;
    x.lineWidth = Math.max(1.4, r * MORPH.satRim);
    x.beginPath();
    x.ellipse(
      px,
      py,
      r * (1 + MORPH.satRim * 0.5),
      r * (1 + MORPH.satRim * 0.5) * m.flatten,
      0,
      MORPH.satArcSpan[0],
      MORPH.satArcSpan[1],
    );
    x.stroke();
  }
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
  m: AlbumMorphology,
) {
  const A = ALBUMS[s.alb];
  const N = A.tracks.length;
  const bounds = boundsOf(A.signature, N);
  const flatten = m.flatten;
  const silent = L.ringLabels === "none";
  const labels = stagesOf(s).labels;
  x.save();
  x.textBaseline = "middle";
  ls(x, "0.2em");
  x.font = `500 ${W * 0.0105}px ${fonts.mono}`;
  for (let k = 0; k < N; k++) {
    const t = (bounds[k] + bounds[k + 1]) / 2;
    const a = t * 6.2832 + s.ringRot;
    const reach = (m.rMax + 0.16) * R;
    const px = Math.max(W * 0.055, Math.min(W * 0.62, bx + Math.cos(a) * reach));
    const py = Math.max(H * 0.09, Math.min(H * 0.84, by + Math.sin(a) * reach * flatten));
    const on = k === s.sel || (s.playAlb === s.alb && k === s.trk);
    if (L.ringLabels !== "all" && !on) continue;

    if (!silent) {
      const hidden = Math.cos(a) > 0.3 || (py > H * 0.6 && px < W * 0.46);
      if (hidden && !on) continue;

      x.globalAlpha = labels * (on ? 0.95 : 0.42);
      x.fillStyle = on ? rgba(A.inkA, 1) : COLOR.dust;
      x.textAlign = Math.cos(a) < 0 ? "right" : "left";
      x.fillText(
        `${String(k + 1).padStart(2, "0")}  ${A.tracks[k].title.toUpperCase()}`,
        px,
        py,
      );
    }

    const tick = outerAt(m, t) * R;
    const far = silent ? tick * 1.3 : reach - R * 0.05;
    x.globalAlpha = labels * (on ? 0.6 : 0.18);
    x.strokeStyle = on ? rgba(A.inkA, 1) : COLOR.dust;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(bx + Math.cos(a) * tick * 1.04, by + Math.sin(a) * tick * 1.04 * flatten);
    x.lineTo(bx + Math.cos(a) * far, by + Math.sin(a) * far * flatten);
    x.stroke();
  }
  x.restore();
}

function bandScrim(x: Ctx, W: number, H: number, b: Bands, lift: number) {
  const topo = x.createLinearGradient(0, 0, 0, b.top * H);
  topo.addColorStop(0, "rgba(7,7,10,.86)");
  topo.addColorStop(1, "rgba(7,7,10,0)");
  x.fillStyle = topo;
  x.fillRect(0, 0, W, b.top * H);

  const chao = x.createLinearGradient(0, b.stage * H - lift, 0, H);
  chao.addColorStop(0, "rgba(7,7,10,0)");
  chao.addColorStop(0.3, "rgba(7,7,10,.6)");
  chao.addColorStop(1, "rgba(7,7,10,.9)");
  x.fillStyle = chao;
  x.fillRect(0, b.stage * H - lift, W, H - b.stage * H + lift);
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
  const { fonts, covers, rings, weights, parts, C, morph, morphOf } = deps;
  const labels = deps.labels ?? CANVAS_LABELS;
  const breathOf = deps.breath ?? (() => ({ mass: 0, light: 0 }));
  const field = deps.field ?? null;
  const fieldVersion = deps.fieldVersion ?? 0;
  const A = ALBUMS[s.alb];
  const inkA = (a: number) => rgba(A.inkA, a);
  const inkB = (a: number) => rgba(A.inkB, a);
  const b = bandsFor(W, H, s, L);
  const box = stageBox(W, H, b);
  const g = bodyGeom(W, H, s, L, morph);
  const bx = g.cx;
  const by = g.cy;
  const M = L.staged ? Math.min(W, 2 * box.halfH) : Math.min(W, H);
  const frame = deps.frame ?? null;
  if (frame) {
    frame.bx = bx;
    frame.by = by;
    frame.R = g.R;
    frame.flatten = morph.flatten;
    frame.rot = s.ringRot;
    frame.m = morph;
  }

  const stage = stagesOf(s);
  x.fillStyle = COLOR.void;
  x.fillRect(0, 0, W, H);

  const g0 = x.createRadialGradient(bx - W * 0.06, by, 0, bx, by, W * 0.62);
  g0.addColorStop(0, inkA(0.15 + s.energy * 0.07));
  g0.addColorStop(0.45, inkB(0.06));
  g0.addColorStop(1, "rgba(7,7,10,0)");
  x.fillStyle = g0;
  x.fillRect(0, 0, W, H);

  const order = ALBUMS.map((_, i) => i).sort(
    (p, q) => Math.abs(q - s.nav) - Math.abs(p - s.nav),
  );
  for (const i of order) {
    if (i === s.alb) {
      const alpha = (1 - stage.open) * (1 - s.mix * 0.7);
      if (alpha <= 0.01) continue;
      const fg = L.recede > 0 ? collectionBody(W, H, s, L, i, morphOf(i)) : g;
      const sil = rings.silhouette(i);
      const glow = 1 + BREATH.rim * breathOf(i).light;
      drawSilhouette(x, sil.sharp, fg.cx, fg.cy, fg.R, alpha, fg.flatten);
      const rim = alpha * SILHOUETTE.focusRim * glow;
      drawSilhouette(x, sil.rim, fg.cx, fg.cy, fg.R, rim, fg.flatten, "lighter");
      continue;
    }
    const p = albPos(i, s, L);
    const mi = morphOf(i);
    const ns = neighborScale(mi);
    const recede = L.recede > 0;
    const a = recede
      ? atmosphereOf(p.d) * (1 - s.zoom)
      : Math.max(0, 0.62 * p.depth * (1 - s.zoom));
    if (a < 0.02) continue;
    const nb = recede
      ? collectionBody(W, H, s, L, i, mi)
      : {
          cx: p.x * W,
          cy: L.staged ? box.cy : p.y * H,
          R: M * (0.16 + 0.24 * p.depth) * L.ringScale * ns,
          flatten: mi.flatten,
        };
    const pulse = breathOf(i);
    nb.R *= 1 + BREATH.scale * pulse.mass;
    const nx = nb.cx;
    const ny = nb.cy;
    const reach = nb.R * (mi.rMax + 0.1);
    if (nx + reach < 0 || nx - reach > W) continue;

    const sil = rings.silhouette(i);
    const blur = recede ? defocusOf(p.d) : 0;
    if (blur > 0.01) drawSilhouette(x, sil.soft, nx, ny, nb.R, a, mi.flatten);
    if (blur < 0.99) {
      drawSilhouette(x, sil.sharp, nx, ny, nb.R, a * (1 - blur), mi.flatten);
      drawSilhouette(
        x,
        sil.rim,
        nx,
        ny,
        nb.R,
        a * (1 - blur) * (1 + BREATH.rim * pulse.light),
        mi.flatten,
        "lighter",
      );
    }

    const away = recede ? smooth01((Math.abs(p.d) - 0.5) / 0.4) : 1;
    const legible = recede ? smooth01((p.depth - 0.12) / 0.2) : 1;
    x.save();
    const br = recede ? nb.R * mi.coreRatio * 0.96 : M * GEO.neighborR * p.depth * ns;
    x.globalAlpha = a * 0.9 * away;
    x.fillStyle = COLOR.body;
    x.beginPath();
    x.ellipse(nx, ny, br, br * (recede ? mi.flatten : 1), 0, 0, 6.2832);
    x.fill();

    x.strokeStyle = rgba(ALBUMS[i].inkA, 0.9);
    x.lineWidth = 1.6;
    x.beginPath();
    x.ellipse(nx, ny, br, br * (recede ? mi.flatten : 1), 0, 2.0, 4.1);
    x.stroke();

    x.textAlign = "center";
    ls(x, "-0.035em");
    x.globalAlpha = a * (i === s.hoverBody ? 1 : 0.66) * away * legible;
    x.fillStyle = COLOR.inkText;

    const nw = weights[i];
    const tsz = M * GEO.neighborR * p.depth;
    const ty = ny + br * (recede ? mi.flatten : 1) + M * 0.075 * p.depth;
    x.font = `${nw} ${tsz}px ${fonts.archivo}`;
    x.fillText(ALBUMS[i].artist, nx, ty);

    ls(x, "0.2em");
    x.globalAlpha = a * (i === s.hoverBody ? 0.95 : 0.5) * away * legible;
    x.font = `500 ${W * 0.0092}px ${fonts.mono}`;
    x.fillText(
      `${ALBUMS[i].cat} · ${labels.tracks(ALBUMS[i].tracks.length)}`,
      nx,
      ty + M * 0.03 * p.depth,
    );
    x.textAlign = "left";
    x.restore();
  }

  const R = g.R;
  drawSatellites(
    x,
    bx,
    by,
    R,
    morph,
    stage.satellites * (1 - s.mix),
    inkA(0.9),
    frame ? frame.satellites : null,
    stage.satellites,
  );

  if (stage.light > 0.02) {
    const activeTrk =
      s.playAlb === s.alb && (isEngaged(s.mode) || s.mode === "fusion")
        ? s.trk
        : -1;
    const prog = progressOf(s);
    const seg = rings.seg(
      s.alb,
      s.sel,
      s.hover,
      activeTrk,
      prog,
      inkA(1),
      field,
      fieldVersion,
      deps.compare ?? null,
    );
    drawRing(x, seg, bx, by, R, s.ringRot, stage.light * (1 - s.mix * 0.6), morph.flatten);
    if (deps.facing && deps.facing > 0.005) {
      drawFacing(
        x,
        morph,
        bx,
        by,
        R,
        s.ringRot,
        rgba(ANATOMY.ghost.color, ANATOMY.facing.alpha * deps.facing),
        ANATOMY.ghost.width * Math.max(1, W / 1440),
      );
    }
    if (deps.ghost && deps.ghost.alpha > 0.005) {
      const gg = bodyGeom(W, H, s, L, deps.ghost.m);
      drawGhost(
        x,
        deps.ghost.m,
        gg.cx,
        gg.cy,
        gg.R,
        s.ringRot,
        rgba(ANATOMY.ghost.color, deps.ghost.alpha),
        ANATOMY.ghost.width * Math.max(1, W / 1440),
      );
    }

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
        morph.flatten,
      );
    }

    trackLabels(x, bx, by, R, W, H, s, L, fonts, morph);
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

  const lk = lockup(W, H, s, L);

  const coverBand = () => {
    if (s.play <= 0.02) return;
    const bandH = H * GEO.bandH * s.play;
    x.save();
    x.globalAlpha = GEO.bandAlpha * s.play * (L.staged ? 0.6 : 1);
    x.drawImage(covers[s.alb].canvas, 0, H - bandH, W, bandH);
    x.globalCompositeOperation = "destination-out";
    const fg = x.createLinearGradient(0, H - bandH, 0, H);
    fg.addColorStop(0, "rgba(0,0,0,1)");
    fg.addColorStop(0.6, "rgba(0,0,0,0.15)");
    fg.addColorStop(1, "rgba(0,0,0,0.55)");
    x.fillStyle = fg;
    x.fillRect(0, H - bandH, W, bandH);
    x.restore();
  };

  if (L.staged) {
    coverBand();
    bandScrim(x, W, H, b, lk.size * 0.6);
  }

  x.save();
  x.textBaseline = "alphabetic";
  ls(x, "-0.035em");
  const fit = s.scale === "collection" ? L.fitCollection : L.fitAlbum;
  const plates = namePlates(s, ALBUMS.length);
  for (const plate of plates) {
    const name = ALBUMS[plate.alb].artist;
    const settled = plates.length === 1 && plate.alb === s.alb;
    const wgt = settled ? Math.round(C.artistWeight) : weights[plate.alb];
    let asz = lk.size;
    x.font = `${wgt} ${asz}px ${fonts.archivo}`;
    if (fit > 0) {
      const maxW = L.staged ? W - lk.margin * 2 : W * fit - lk.margin;
      const mw = x.measureText(name).width;
      if (mw > maxW) {
        asz = Math.max(asz * lk.floor, asz * (maxW / mw));
        x.font = `${wgt} ${asz}px ${fonts.archivo}`;
      }
    }
    const nx = lk.margin + plate.shift * W * NAMES.slide;
    x.globalAlpha = (1 - s.mix) * (0.92 - s.play * 0.25) * plate.alpha;
    x.fillStyle = COLOR.paper;
    x.fillText(name, nx, lk.ay);
    if (frame && plate.alb === s.alb) frame.name = { text: name, font: x.font, x: nx, y: lk.ay };
  }
  if (s.mix > 0 && ALBUMS[s.fuseAlb]) {
    x.globalAlpha = s.mix * (0.92 - s.play * 0.25);
    x.fillText(
      ALBUMS[s.fuseAlb].artist,
      lk.margin + (1 - s.mix) * W * 0.12,
      lk.ay + (1 - s.mix) * H * 0.05,
    );
  }
  x.restore();

  if (!L.staged) coverBand();

  if (s.play > 0.02) {
    const prog = progressOf(s);
    x.fillStyle = inkA(0.85 * s.play);
    x.fillRect(0, H - 2, W * prog, 2);
  }

  if (L.staged) return;

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
  x.fillRect(0, 0, W, H * (GEO.scrimTop));
}
