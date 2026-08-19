import * as THREE from "three";
import { curvature } from "../audio/analysis";
import { leadOf } from "../audio/anticipation";
import { AudioBus, type VisualAudioState } from "../audio/bus";
import { drawBack, makeParticles, type BackDeps } from "../composition/back";
import { drawFront, type FrontDeps } from "../composition/front";
import { loadCovers, makeCover, type CoverAsset } from "../composition/cover";
import {
  albPos,
  hitTest,
  layoutFor,
  ringRotationTarget,
  variantFor,
  type WorldLayout,
} from "../composition/layout";
import { RingBakery } from "../composition/ring";
import { ALBUMS, NEUTRAL_BIAS, onCatalogChange, trackBiasOf, type TrackBias } from "../content";
import {
  fieldConstantsOf,
  lightDirection,
  lightSweepOf,
  mixConstants,
  reduceMotion,
  type FieldConstants,
} from "../field";
import { createFieldGL, type FieldGL } from "../fieldMaterial";
import { clamp } from "../math";
import { albumProgressOf, initialState, isEngaged, progressOf } from "../state";
import * as T from "./transport";
import type { AudioEffect, Catalog } from "./transport";
import type { FrameOut, FrameSink } from "./frame";
import {
  bindInput,
  hasCoarsePointer,
  prefersReducedMotion,
  type InputActions,
  type InputOptions,
} from "./input";
import {
  COMPOSITION_FALLBACK_W,
  COMPOSITION_MAX_W,
  IDLE_MS,
  LERP,
  SECOND_MASS,
  SEQ,
  TRACK_BIAS,
} from "../tokens";
import type {
  FieldState,
  FontFamilies,
  Particle,
  Scale,
  Snapshot,
} from "../types";

const PAN = {
  mobileWidth: 0.72,
  desktopWidth: 0.46,
  pageThreshold: 0.25,
  wheel: 0.0016,
} as const;

const CURSOR_GAIN = 9;

function readExperiment(name: string) {
  const search = (globalThis as { location?: { search?: string } }).location?.search ?? "";
  if (!search) return false;
  return (new URLSearchParams(search).get("x") ?? "").split(",").includes(name);
}

const CATALOG: Catalog = {
  get size() {
    return ALBUMS.length;
  },
  trackCount: (alb) => ALBUMS[alb].tracks.length,
  trackDuration: (alb, trk) => ALBUMS[alb].tracks[trk].dur,
  hasTrack: (alb, trk) => !!ALBUMS[alb]?.tracks[trk],
};

export class FieldEngine implements InputActions {
  readonly st: FieldState = initialState();
  readonly bus = new AudioBus();
  private readonly frame: FrameOut = { progress: 0, position: 0, duration: 0 };
  private frameSink: FrameSink | null = null;

  private gl: FieldGL;
  private cvB: HTMLCanvasElement;
  private ctxB: CanvasRenderingContext2D;
  private cvF: HTMLCanvasElement;
  private ctxF: CanvasRenderingContext2D;
  private covers: CoverAsset[];
  private rings: RingBakery;
  private FIELD: FieldConstants[] = [];
  private WEIGHTS: number[] = [];
  private unsubscribeCatalog: (() => void) | null = null;
  private parts: Particle[] = makeParticles();
  private L: WorldLayout = layoutFor("desktop");

  private W = 1;
  private H = 1;
  private compMaxW = COMPOSITION_MAX_W;
  private frameCost = 16;
  private fpsFrames = 0;
  private fpsSince = 0;
  private fps = 0;
  private slowWindows = 0;

  private mouse = { x: 0.55, y: 0.45, tx: 0.55, ty: 0.45, v: 0, down: false, moved: 0, lx: 0 };
  private C: FieldConstants;
  private bias: TrackBias = { ...NEUTRAL_BIAS };
  private lightSweep = 0;
  private m1 = { x: 0, y: 0, k: 0, h: 0, alb: -1, ready: false };
  readonly experiments = { anticipation: false, anticipationGain: 1 };
  lead = 0;
  private railAlb = -1;
  private railTrk = -1;
  private intent = 0;
  private raf = 0;
  private last = 0;
  private reduced = false;
  private coarse = false;
  private dragNav = 0;
  private audioState: VisualAudioState;

  private snap: Snapshot;
  private listeners = new Set<() => void>();

  private unbind: (() => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private fonts: FontFamilies,
    private input: InputOptions,
  ) {
    this.cvB = document.createElement("canvas");
    this.ctxB = this.cvB.getContext("2d", { alpha: false })!;
    this.cvF = document.createElement("canvas");
    this.ctxF = this.cvF.getContext("2d")!;
    this.covers = loadCovers();
    this.rings = new RingBakery(this.covers);
    this.gl = createFieldGL(canvas, this.cvB, this.cvF);
    this.syncCatalog(-1);
    this.C = this.FIELD[0];
    this.unsubscribeCatalog = onCatalogChange((i) => this.syncCatalog(i));

    this.audioState = this.bus.update(0);
    this.experiments.anticipation = readExperiment("anticipate");
    this.reduced = prefersReducedMotion();
    this.coarse = hasCoarsePointer();
    this.snap = this.buildSnapshot(true);

    this.bus.onEnded = () => this.run(T.trackEnded(this.st, CATALOG));

    this.resize();
  }

  private syncCatalog(added: number) {
    if (added < 0) {
      this.covers.length = 0;
      this.covers.push(...loadCovers());
    } else {
      for (let i = this.covers.length; i < ALBUMS.length; i++) {
        this.covers.push(makeCover(ALBUMS[i]));
      }
    }
    this.FIELD = ALBUMS.map((a) => fieldConstantsOf(a.signature));
    this.WEIGHTS = this.FIELD.map((c) => Math.round(c.artistWeight));
    this.rings.sync();
  }

  start() {
    this.last = performance.now();
    this.intent = performance.now();
    this.unbind = bindInput(this, this.input);
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.unsubscribeCatalog?.();
    this.unsubscribeCatalog = null;
    this.unbind?.();
    this.unbind = null;
    this.bus.dispose();
    this.gl.dispose();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = () => this.snap;

  onFrame = (sink: FrameSink) => {
    this.frameSink = sink;
    return () => {
      if (this.frameSink === sink) this.frameSink = null;
    };
  };

  setReducedMotion(reduced: boolean) {
    this.reduced = reduced;
  }

  pointTo(nx: number, ny: number) {
    const m = this.mouse;
    m.v = Math.min(1, m.v + Math.hypot(nx - m.tx, ny - m.ty) * CURSOR_GAIN);
    m.tx = nx;
    m.ty = ny;
  }

  teleportTo(nx: number, ny: number) {
    const m = this.mouse;
    m.tx = m.x = nx;
    m.ty = m.y = ny;
  }

  beginPan() {
    this.dragNav = this.st.navT;
  }

  panBy(stepPx: number, totalPx: number, viewportW: number) {
    const s = this.st;
    if (s.scale !== "collection") return;
    if (this.L.variant === "mobile") {
      const total = totalPx / (viewportW * PAN.mobileWidth);
      s.navT = clamp(this.dragNav - total, this.dragNav - 1, this.dragNav + 1);
    } else {
      s.navT -= stepPx / (viewportW * PAN.desktopWidth);
    }
  }

  endPan(tap: boolean) {
    const s = this.st;
    if (tap) {
      this.click();
      return;
    }
    if (s.scale !== "collection") return;
    const d = s.navT - this.dragNav;
    s.navT =
      this.L.variant === "mobile"
        ? this.dragNav + (Math.abs(d) > PAN.pageThreshold ? Math.sign(d) : 0)
        : Math.round(s.navT);
  }

  wheelBy(deltaY: number, deltaX: number) {
    const s = this.st;
    if (s.scale === "collection") s.navT += deltaY * PAN.wheel + deltaX * PAN.wheel;
    else this.stepSel(deltaY > 0 ? 1 : -1);
  }

  stepFocus(dir: number) {
    const s = this.st;
    if (s.scale === "collection") s.navT += dir;
    else this.stepSel(dir);
  }

  markIntent() {
    this.intent = performance.now();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const { dw, dh } = this.gl.resize(w, h);
    const sw = dw > 0 ? dw : 2;
    const sh = dh > 0 ? dh : 2;
    const cw = Math.max(2, Math.min(sw, this.compMaxW));
    const ch = Math.max(2, Math.round((cw * sh) / sw));
    this.cvB.width = cw;
    this.cvB.height = ch;
    this.cvF.width = cw;
    this.cvF.height = ch;
    this.W = cw;
    this.H = ch;
    this.L = layoutFor(variantFor(w, h));
  }

  setRailAlb(i: number) {
    this.railAlb = i;
  }

  setRailTrk(i: number) {
    this.railTrk = i;
  }

  private hit() {
    return hitTest(
      this.mouse.tx,
      this.mouse.ty,
      this.W,
      this.H,
      this.st,
      this.L,
      (a) => this.rings.bounds(a),
      ALBUMS.length,
      this.C.flatten,
    );
  }

  private fieldFor(): FieldConstants {
    const s = this.st;
    const n = ALBUMS.length;
    let c: FieldConstants;
    if (s.scale === "collection") {
      const i = clamp(Math.floor(s.nav), 0, n - 1);
      const j = clamp(i + 1, 0, n - 1);
      c = mixConstants(this.FIELD[i], this.FIELD[j], s.nav - i);
    } else {
      const alb = clamp(s.alb, 0, n - 1);
      c = fieldConstantsOf(ALBUMS[alb].signature, this.bias);
    }
    if (s.mix > 0 && this.FIELD[s.fuseAlb]) c = mixConstants(c, this.FIELD[s.fuseAlb], s.mix);
    return this.reduced ? reduceMotion(c) : c;
  }

  private click() {
    const s = this.st;
    const h = this.hit();
    if (s.scale === "collection") {
      if (h.kind === "body") this.enterAlbum(h.i);
      return;
    }
    if (h.kind === "track") {
      this.playTrack(s.alb, h.i);
      return;
    }
    if (h.kind === "body") {
      if (s.scale === "track") this.transport();
      else this.playTrack(s.alb, s.sel);
      return;
    }
    this.back();
  }

  private apply(efeitos: AudioEffect[]) {
    for (const e of efeitos) {
      if (e.kind === "load") {
        const album = ALBUMS[e.alb];
        this.bus.setSignature(album.signature);
        this.bus.load(album.tracks[e.trk]);
        void this.bus.play();
      } else if (e.kind === "play") {
        void this.bus.play();
      } else if (e.kind === "pause") {
        this.bus.pause();
      } else {
        this.bus.seek(e.seconds);
      }
    }
  }

  private run(efeitos: AudioEffect[]) {
    this.apply(efeitos);
    this.markIntent();
  }

  primary() {
    this.run(T.primary(this.st, CATALOG));
  }

  back() {
    this.run(T.back(this.st));
  }

  goScale(level: Scale) {
    this.run(T.goScale(this.st, CATALOG, level));
  }

  enterAlbum(i: number) {
    this.run(T.enterAlbum(this.st, CATALOG, i));
  }

  playTrack(alb: number, trk: number) {
    this.run(T.playTrack(this.st, CATALOG, alb, trk));
  }

  fuseTo(alb: number, trk: number) {
    this.run(T.fuseTo(this.st, alb, trk));
  }

  private commitFusion() {
    this.apply(T.commitFusion(this.st, CATALOG));
  }

  stepSel(dir: number) {
    this.run(T.stepSel(this.st, CATALOG, dir));
  }

  skip(dir: number) {
    this.run(T.skip(this.st, CATALOG, dir));
  }

  transport() {
    this.run(T.transport(this.st, CATALOG));
  }

  seekFraction(f: number) {
    this.apply(T.seekFraction(this.st, f));
    this.st.pos = this.bus.position;
    this.markIntent();
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;

    const t0 = performance.now();
    this.step(dt);
    drawBack(this.ctxB, this.W, this.H, this.st, this.L, this.backDeps());
    drawFront(this.ctxF, this.W, this.H, this.st, this.L, this.frontDeps());
    this.render();
    this.publish();

    this.frameCost += (performance.now() - t0 - this.frameCost) * 0.05;
    this.fpsFrames++;
    if (now - this.fpsSince > 1000) {
      const visible = document.visibilityState === "visible";
      this.fps = (this.fpsFrames * 1000) / (now - this.fpsSince);
      this.slowWindows = visible && this.fpsFrames > 10 && this.fps < 52 ? this.slowWindows + 1 : 0;
      this.fpsFrames = 0;
      this.fpsSince = now;
    }

    if (this.slowWindows >= 3 && this.compMaxW !== COMPOSITION_FALLBACK_W) {
      this.compMaxW = COMPOSITION_FALLBACK_W;
      this.slowWindows = 0;
      this.resize();
    }
  };

  private backDeps(): BackDeps {
    return {
      fonts: this.fonts,
      covers: this.covers,
      rings: this.rings,
      weights: this.WEIGHTS,
      parts: this.parts,
      C: this.C,
    };
  }

  private frontDeps(): FrontDeps {
    return { fonts: this.fonts, covers: this.covers };
  }

  private step(dt: number) {
    const s = this.st;
    s.t += dt;
    s.seqT += dt;
    if (s.segueT < SEQ.segue.total) s.segueT += dt;
    this.trackBias(dt);
    this.C = this.fieldFor();

    const K = this.reduced ? 0.25 : 1;
    const m = this.mouse;
    m.x += (m.tx - m.x) * Math.min(1, dt * LERP.mouse);
    m.y += (m.ty - m.y) * Math.min(1, dt * LERP.mouse);
    m.v *= Math.pow(0.05, dt);
    s.curK = this.reduced || this.coarse ? 0 : (0.006 + m.v * 0.02) * K;

    s.navT = clamp(s.navT, 0, ALBUMS.length - 1);
    s.nav += (s.navT - s.nav) * Math.min(1, dt * this.C.navLerp);
    s.zoom += (s.zoomT - s.zoom) * Math.min(1, dt * LERP.zoom);
    if (s.scale === "collection") s.alb = Math.round(s.nav);

    const a = this.bus.update(dt);
    this.audioState = a;
    s.treb = a.treb;

    if (s.playAlb >= 0) {
      s.dur = a.duration || ALBUMS[s.playAlb].tracks[s.trk]?.dur || 0;
      s.pos = Math.min(a.position, s.dur || a.position);
    }

    const live = s.mode === "playing" || s.mode === "fusion";
    const target = live ? 0.42 + a.energy * 0.58 : s.mode === "paused" ? 0.22 : 0.3;
    s.energy += (target - s.energy) * Math.min(1, dt * LERP.energy);

    const h = this.hit();
    s.hover = h.kind === "track" ? h.i : this.railTrk >= 0 ? this.railTrk : -1;
    s.hoverBody = h.kind === "body" ? h.i : this.railAlb >= 0 ? this.railAlb : -1;
    if (s.scale === "album" && s.hover >= 0) s.sel = s.hover;
    this.secondMass(dt);

    const C = this.C;
    const tgt = {
      m0k: 0.088 * K * C.massScale,
      m0h: 0.112 * C.horizonScale,
      spin: 0.06,
      blur: 0,
      fade: 1,
      jet: 0,
      play: 0,
    };
    if (s.scale === "album") {
      tgt.m0k = 0.1 * K * C.massScale;
      tgt.m0h = 0.096 * C.horizonScale;
      tgt.spin = 0.16;
    }

    if (s.mode === "collapse") this.collapse(tgt, K);
    if (isEngaged(s.mode)) this.playing(tgt, K);
    if (s.mode === "fusion") this.fusion(tgt, K);

    if (s.segueT < SEQ.segue.total) {
      const e = s.segueT / SEQ.segue.total;
      tgt.m0h *= 1 - Math.sin(e * Math.PI) * SEQ.segue.depth * K;
    }

    this.anticipation(dt);
    if (this.lead !== 0) {
      const amp = C.reactionCap * this.experiments.anticipationGain;
      tgt.m0h *= 1 - this.lead * amp;
      tgt.fade *= 1 + this.lead * amp * 0.4;
    }

    if (this.reduced) tgt.blur = 0;

    if (s.waveR >= 0) {
      s.waveR += dt * 2.1;
      s.waveA = 0.075 * Math.max(0, 1 - s.waveR / 2.3) * K;
      if (s.waveR > 2.4) s.waveR = -1;
    } else {
      s.waveA = 0;
    }

    this.ringRotation(dt);
    this.lightAngle(dt);
    s.fadeSel += ((s.scale === "collection" ? 0 : 1) - s.fadeSel) * Math.min(1, dt * 4);

    const k = Math.min(1, dt * LERP.field);
    s.m0k += (tgt.m0k - s.m0k) * k;
    s.m0h += (tgt.m0h - s.m0h) * k;
    s.spin += (tgt.spin - s.spin) * k;
    s.blur += (tgt.blur - s.blur) * k;
    s.fade += (tgt.fade - s.fade) * Math.min(1, dt * LERP.fade);
    s.jet += (tgt.jet - s.jet) * k;
    s.play += (tgt.play - s.play) * Math.min(1, dt * LERP.play);

    const pull = s.mode === "collapse" && s.seqT < SEQ.collapse.valleyEnd;
    for (const q of this.parts) {
      q.a += dt * q.s * (0.25 + s.energy * 0.9) * (s.mode === "playing" ? 1.5 : 1);
      if (pull) q.r *= 1 - dt * 1.5;
      else q.r += (0.16 + q.z * 0.62 - q.r) * dt * 1.2;
      if (s.mode === "paused") q.r -= dt * 0.012;
    }
  }

  private trackBias(dt: number) {
    const s = this.st;
    const album = ALBUMS[clamp(s.alb, 0, ALBUMS.length - 1)];
    const onAir = s.playAlb >= 0 && s.playAlb === s.alb && s.scale !== "collection";
    const target = onAir
      ? (trackBiasOf(album.signature, album.tracks.length)[s.trk] ?? NEUTRAL_BIAS)
      : NEUTRAL_BIAS;
    const k = Math.min(1, dt * TRACK_BIAS.lerp);
    this.bias.loudness += (target.loudness - this.bias.loudness) * k;
    this.bias.dynamics += (target.dynamics - this.bias.dynamics) * k;
  }

  private ringRotation(dt: number) {
    const s = this.st;
    const onAir = s.playAlb >= 0 && s.playAlb === s.alb;
    const target = ringRotationTarget(this.rings.bounds(s.alb), s.trk, progressOf(s), onAir);
    const raw = target - s.ringRot;
    const d = (((raw + Math.PI) % 6.2832) + 6.2832) % 6.2832 - Math.PI;
    s.ringRot += d * Math.min(1, dt * LERP.ringRot);
  }

  private anticipation(dt: number) {
    const s = this.st;
    const onAir = this.experiments.anticipation && s.playAlb >= 0 && s.playAlb === s.alb;
    let target = 0;
    if (onAir) {
      const sig = ALBUMS[s.playAlb].signature;
      const pos = albumProgressOf(this.rings.bounds(s.playAlb), s.trk, progressOf(s));
      target = leadOf(sig, pos, sig.measured.durationS);
    }
    this.lead += (target - this.lead) * Math.min(1, dt * LERP.lead);
  }

  private secondMass(dt: number) {
    const s = this.st;
    if (s.scale !== "collection" || s.mode === "fusion") {
      this.m1.ready = false;
      return;
    }

    const n = ALBUMS.length;
    const focused = clamp(Math.round(s.nav), 0, n - 1);
    const pointed = s.hoverBody >= 0 && s.hoverBody !== focused ? s.hoverBody : -1;
    const dir = s.nav - Math.round(s.nav) >= 0 ? 1 : -1;
    const at = pointed >= 0 ? pointed : focused + dir;

    const p = albPos(at, s, this.L);
    const C = this.FIELD[clamp(at, 0, n - 1)];
    const gain = pointed >= 0 && !this.reduced ? SECOND_MASS.pointGain : 1;
    const k = SECOND_MASS.k * C.massScale * gain;
    const h = SECOND_MASS.h * C.horizonScale;

    const m = this.m1;
    if (!m.ready || m.alb !== at) m.alb = at;
    if (!m.ready) {
      m.x = p.x;
      m.y = p.y;
      m.k = k;
      m.h = h;
      m.ready = true;
      return;
    }

    const e = Math.min(1, dt * SECOND_MASS.lerp);
    m.x += (p.x - m.x) * e;
    m.y += (p.y - m.y) * e;
    m.k += (k - m.k) * e;
    m.h += (h - m.h) * e;
  }

  private lightAngle(dt: number) {
    const s = this.st;
    const onAir = s.playAlb >= 0 && s.playAlb === s.alb && s.mode !== "stopped";
    const target = onAir ? lightSweepOf(progressOf(s)) : 0;
    this.lightSweep += (target - this.lightSweep) * Math.min(1, dt * LERP.light);
  }

  private collapse(tgt: Record<string, number>, K: number) {
    const s = this.st;
    const p = s.seqT;

    if (this.reduced) {
      const e = Math.min(1, p / SEQ.reduced);
      tgt.fade = 0.45 + 0.55 * Math.abs(e * 2 - 1);
      tgt.m0k = 0.075 * K;
      tgt.m0h = 0.082;
      tgt.play = e;
      if (p >= SEQ.reduced) s.mode = "playing";
      return;
    }

    if (p < SEQ.collapse.ramp) {
      const e = p / SEQ.collapse.ramp;
      tgt.m0k = 0.055 + e * e * 0.3;
      tgt.m0h = 0.112 + e * 0.03;
      tgt.spin = 0.06 + e * 2.3;
      tgt.blur = e * 1.5;
      tgt.fade = 1 - Math.pow(e, 2.6);
    } else if (p < SEQ.collapse.valleyEnd) {
      tgt.m0k = 0.36;
      tgt.m0h = 0.1;
      tgt.spin = 2.4;
      tgt.blur = 1.5;
      tgt.fade = SEQ.valley.fade;
    } else if (p < SEQ.collapse.total) {
      const e = (p - SEQ.collapse.valleyEnd) / 0.95;
      tgt.m0k = 0.36 - e * 0.28;
      tgt.m0h = 0.1 - e * 0.02;
      tgt.spin = 2.4 - e * 2.1;
      tgt.blur = 1.5 * (1 - e);
      tgt.fade = Math.min(1, e * 1.9);
      tgt.jet = Math.sin(Math.min(1, e * 1.5) * Math.PI) * 1.1;
      tgt.play = e;
    } else {
      s.mode = "playing";
    }
  }

  private playing(tgt: Record<string, number>, K: number) {
    const s = this.st;
    const isPlaying = s.mode === "playing";
    const a = this.audioState;
    const C = this.C;
    const cap = C.reactionCap;
    tgt.play = isPlaying ? 1 : 0.86;
    tgt.m0k =
      curvature(0.075 * C.massScale, isPlaying ? a.accent.bass : a.accent.bass * 0.25, cap) * K;
    tgt.m0h = 0.082 * C.horizonScale;
    tgt.spin = isPlaying ? curvature(0.42, a.accent.mid * 0.7 + a.flux * 0.3, cap) : 0.06;
    tgt.jet = isPlaying ? 0.06 + a.flux * 0.22 + a.bass * 0.06 : 0.02;
    tgt.blur = isPlaying ? a.bass * 0.12 : 0;
    if (s.scale === "album") tgt.play *= 0.25;
  }

  private fusion(tgt: Record<string, number>, K: number) {
    const s = this.st;
    const p = s.seqT;
    tgt.play = 1;

    if (this.reduced) {
      const e = Math.min(1, p / SEQ.reduced);
      s.mix = e;
      tgt.m0k = 0.075 * K;
      tgt.fade = 0.5 + 0.5 * Math.abs(e * 2 - 1);
      this.commitFusion();
      if (p >= SEQ.reduced) this.endFusion();
      return;
    }

    if (p < SEQ.fusion.wave) {
      const e = p / SEQ.fusion.wave;
      const ee = e * e;
      const ang = -0.7 + ee * 5.4;
      const rad = 1.5 * (1 - ee) + 0.02;
      s.m1x = Math.cos(ang) * rad;
      s.m1y = Math.sin(ang) * rad;
      s.m1k = (0.03 + ee * 0.05) * K;
      s.m1h = 0.055 + ee * 0.02;
      s.mix = e * 0.5;
      tgt.m0k = (0.075 + ee * 0.05) * K;
      tgt.spin = 0.42 + ee * 0.9;
      tgt.blur = ee * 0.4;
      tgt.jet = 0.1;
    } else if (p < SEQ.fusion.total) {
      const e = (p - SEQ.fusion.wave) / 0.7;
      if (s.waveR < 0) s.waveR = 0.02;
      this.commitFusion();
      s.m1k *= 0.72;
      s.m1h *= 0.8;
      s.mix = 0.5 + e * 0.5;
      tgt.m0k = (0.075 + (1 - e) * 0.08) * K;
      tgt.spin = 0.42 + (1 - e) * 0.8;
      tgt.blur = (1 - e) * 0.25;
      tgt.jet = 0.1;
    } else {
      this.endFusion();
    }
  }

  private endFusion() {
    T.endFusion(this.st, CATALOG, this.bus.duration);
  }

  private render() {
    const s = this.st;
    const u = this.gl.uniforms;
    const res = u.uRes.value;
    const aspect = res.x / res.y;
    const p0 = albPos(s.alb, s, this.L);
    const mx = (p0.x - 0.5) * aspect;
    const my = 0.5 - p0.y;

    let m1x = mx + s.m1x;
    let m1y = my + s.m1y;
    let m1k = s.m1k;
    let m1h = s.m1h;
    if (s.scale === "collection" && s.mode !== "fusion" && this.m1.ready) {
      m1x = (this.m1.x - 0.5) * aspect;
      m1y = 0.5 - this.m1.y;
      m1k = this.m1.k;
      m1h = this.m1.h;
    }

    const A = ALBUMS[s.alb];
    u.uM0.value.set(mx, my, s.m0k, s.m0h);
    u.uM1.value.set(m1x, m1y, m1k, m1h);
    u.uCur.value.set((this.mouse.x - 0.5) * aspect, 0.5 - this.mouse.y, s.curK);
    u.uWave.value.set(Math.max(0, s.waveR), s.waveA, 0);
    u.uSpin.value = s.spin;
    u.uBlur.value = s.blur;
    u.uTime.value = s.t;
    u.uFade.value = Math.max(0, s.fade);
    u.uGrain.value = 0.035;
    u.uDisp.value =
      curvature(0.014, this.audioState.accent.treb, this.C.reactionCap * 0.6) + s.blur * 0.01;
    u.uJet.value = s.jet;
    const dBright = clamp(this.audioState.centroid - A.signature.brightness, -0.5, 0.5);
    u.uRim.value = this.C.rimHardness * (1 + dBright * this.C.reactionCap);
    const light = lightDirection(this.lightSweep);
    u.uLight.value.set(light[0], light[1]);
    (u.uInk.value as THREE.Vector3).set(A.inkA[0], A.inkA[1], A.inkA[2]);
    this.gl.render();
  }

  private buildSnapshot(force = false): Snapshot {
    const s = this.st;
    const idle = performance.now() - this.intent > IDLE_MS;
    const navAlb = Math.round(s.nav);
    const next: Snapshot = {
      scale: s.scale,
      mode: s.mode,
      alb: s.alb,
      navAlb,
      sel: s.sel,
      trk: s.trk,
      playAlb: s.playAlb,
      hoverTrk: s.hover,
      hoverAlb: s.hoverBody,
      idle,
      variant: this.L.variant,
      announce:
        s.playAlb >= 0
          ? `${String(s.trk + 1).padStart(2, "0")} · ${
              ALBUMS[s.playAlb].tracks[s.trk]?.title ?? ""
            } — ${ALBUMS[s.playAlb].artist}`
          : `Coleção · ${ALBUMS.length} corpos`,
    };
    if (force) return next;
    const prev = this.snap;
    const same =
      prev.scale === next.scale &&
      prev.mode === next.mode &&
      prev.alb === next.alb &&
      prev.navAlb === next.navAlb &&
      prev.sel === next.sel &&
      prev.trk === next.trk &&
      prev.playAlb === next.playAlb &&
      prev.hoverTrk === next.hoverTrk &&
      prev.hoverAlb === next.hoverAlb &&
      prev.idle === next.idle &&
      prev.variant === next.variant &&
      prev.announce === next.announce;
    return same ? prev : next;
  }

  private publish() {
    const s = this.st;
    const f = this.frame;
    f.progress = progressOf(s);
    f.position = s.pos;
    f.duration = s.dur || 0;
    this.frameSink?.(f);

    const next = this.buildSnapshot();
    if (next !== this.snap) {
      this.snap = next;
      this.listeners.forEach((fn) => fn());
    }
  }
}
