import * as THREE from "three";
import { curvature } from "../audio/analysis";
import { AudioBus, type VisualAudioState } from "../audio/bus";
import type { PlaybackFault } from "../audio/playback";
import {
  AXIS_OF,
  compareMorphology,
  inviteOf,
  type AnatomyPart,
  type CompareAxis,
  type Invite,
} from "../anatomy";
import { drawBack, makeParticles, type BackDeps } from "../composition/back";
import { drawFocus, emptyFrame, resetFrame, type BodyFrame } from "../composition/focus";
import { drawFront, type FrontDeps } from "../composition/front";
import { CANVAS_LABELS, type CanvasLabels } from "../i18n/canvas";
import { loadCovers, makeCover, type CoverAsset } from "../composition/cover";
import {
  albPos,
  bandsFor,
  baseRadius,
  bodyGeom,
  hitTest,
  layoutFor,
  ringRotationTarget,
  variantFor,
  type Hit,
  type WorldLayout,
} from "../composition/layout";
import { bandsOf, sameBands, stageBox, FULL_BANDS } from "../composition/bands";
import { RingBakery, type SegShape } from "../composition/ring";
import {
  crownAt,
  mixMorphology,
  morphologyOf,
  NEUTRAL_MORPHOLOGY,
  type AlbumMorphology,
} from "../morphology";
import {
  ALBUMS,
  NEUTRAL_BIAS,
  chargeAt,
  onCatalogChange,
  trackBiasOf,
  type TrackBias,
} from "../content";
import {
  amplitudeOf,
  complianceOf,
  emptyStrain,
  loadOf,
  strainStep,
  type Strain,
} from "../composition/strain";
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
import {
  NEUTRAL_MOTION,
  approachMotion,
  motionQualitiesOf,
  motionResponseOf,
  type MotionResponse,
} from "../motion";
import { albumProgressOf, initialState, isEngaged, progressOf, tideAt } from "../state";
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
  ANATOMY,
  COMPOSITION_FALLBACK_W,
  COMPOSITION_MAX_W,
  GUARD,
  EXPLORED_KEY,
  HINT_MS,
  IDLE_MS,
  TIDE,
  LERP,
  INTAKE,
  MOTION,
  MORPH,
  SECOND_MASS,
  SEQ,
  TRACK_BIAS,
} from "../tokens";
import type {
  FieldState,
  FontFamilies,
  Particle,
  Reach,
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

const BAKED = new Set<CompareAxis>(["spread", "pulse", "dynamics", "loudness"]);

const ease = (t: number) => t * t * (3 - 2 * t);

const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(target, v + step) : Math.max(target, v - step);

const HORIZON_REF = 0.096;

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
  private MORPH: AlbumMorphology[] = [];
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
  private M: AlbumMorphology = NEUTRAL_MORPHOLOGY;
  private hzK = 1;
  private bias: TrackBias = { ...NEUTRAL_BIAS };
  private lightSweep = 0;
  private m1 = { x: 0, y: 0, k: 0, h: 0, alb: -1, ready: false };
  private readonly motion: MotionResponse = { ...NEUTRAL_MOTION };
  private motionTarget: MotionResponse = NEUTRAL_MOTION;
  private motionAlb = -2;
  private motionTrk = -2;
  readonly strain: Strain = emptyStrain();
  private railAlb = -1;
  private railTrk = -1;
  private intake = false;
  private intent = 0;

  private explored = false;

  private readonly cvFocus: HTMLCanvasElement;
  private readonly ctxFocus: CanvasRenderingContext2D;
  private readonly bodyFrame: BodyFrame = emptyFrame();
  private focusPin: AnatomyPart | null = null;
  private focusHover: AnatomyPart | null = null;
  private focusAmt = 0;
  private focusLive = false;
  private focusKey = "";
  private focusAge = 0;
  private compareOn = false;
  private compareAxis: CompareAxis | null = null;
  private compareAlb = -1;
  private compareK = 0;
  private compareStep = -1;
  private compareShape: SegShape | null = null;
  private compareVersion = 1e6;
  private peeking = false;
  private peekBack = false;
  private anatomyMark: string | null = null;
  private dwell = 0;
  private invite: Invite | null = null;
  private inviteAt = 0;
  private inviteAlb = -1;

  private tideT = 0;

  private tideGain = 0;
  private faultKind: PlaybackFault | null = null;
  reach: Reach = "none";
  private reachAmp = 0;
  private onUi = false;
  private raf = 0;
  private last = 0;
  private reduced = false;
  private coarse = false;
  private dragNav = 0;
  private audioState: VisualAudioState;

  private labels: CanvasLabels = CANVAS_LABELS;
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
    this.cvFocus = document.createElement("canvas");
    this.ctxFocus = this.cvFocus.getContext("2d")!;
    this.covers = loadCovers();
    this.rings = new RingBakery(this.covers);
    this.gl = createFieldGL(canvas, this.cvB, this.cvF, this.cvFocus);
    this.syncCatalog(-1);
    this.C = this.FIELD[0];
    this.unsubscribeCatalog = onCatalogChange((i) => this.syncCatalog(i));

    this.audioState = this.bus.update(0);
    this.reduced = prefersReducedMotion();
    this.coarse = hasCoarsePointer();
    try {
      this.explored = window.localStorage.getItem(EXPLORED_KEY) === "1";
    } catch {
      this.explored = false;
    }
    try {
      this.anatomyMark = window.localStorage.getItem(ANATOMY.key);
    } catch {
      this.anatomyMark = null;
    }
    this.snap = this.buildSnapshot(true);

    this.bus.onEnded = () => this.run(T.trackEnded(this.st, CATALOG));
    this.bus.onFault = (fault) => this.raiseFault(fault);

    this.resize();
  }

  private raiseFault(fault: PlaybackFault) {
    const s = this.st;
    this.faultKind = fault;
    if (s.mode === "collapse" || s.mode === "playing") s.mode = "paused";
    this.markIntent();
  }

  setVolume(value: number) {
    this.bus.setVolume(value);
    this.markIntent();
  }

  setMuted(muted: boolean) {
    this.bus.setMuted(muted);
    this.markIntent();
  }

  get volume() {
    return this.bus.volume;
  }

  get muted() {
    return this.bus.muted;
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
    this.MORPH = ALBUMS.map((a) => morphologyOf(a.signature, a.tracks.length));
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

  get frameOut(): Readonly<FrameOut> {
    return this.frame;
  }

  onFrame = (sink: FrameSink) => {
    this.frameSink = sink;
    return () => {
      if (this.frameSink === sink) this.frameSink = null;
    };
  };

  setReducedMotion(reduced: boolean) {
    this.reduced = reduced;
  }

  pointTo(nx: number, ny: number, onUi = false) {
    const m = this.mouse;
    m.v = Math.min(1, m.v + Math.hypot(nx - m.tx, ny - m.ty) * CURSOR_GAIN);
    m.tx = nx;
    m.ty = ny;
    this.onUi = onUi;
  }

  teleportTo(nx: number, ny: number) {
    const m = this.mouse;
    m.tx = m.x = nx;
    m.ty = m.y = ny;
  }

  beginPan() {
    this.dragNav = this.st.navT;
    if (this.compareOn && this.st.scale !== "collection") this.peeking = true;
  }

  panBy(stepPx: number, totalPx: number, viewportW: number) {
    const s = this.st;
    if (s.scale !== "collection" || this.peeking) return;
    if (this.L.variant === "mobile") {
      const total = totalPx / (viewportW * PAN.mobileWidth);
      s.navT = clamp(this.dragNav - total, this.dragNav - 1, this.dragNav + 1);
    } else {
      s.navT -= stepPx / (viewportW * PAN.desktopWidth);
    }
    if (Math.abs(s.navT - this.dragNav) > 0.01) this.markExplored();
  }

  endPan(tap: boolean) {
    const s = this.st;
    if (this.peeking) {
      this.peeking = false;
      this.peekBack = true;
      return;
    }
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
    if (s.scale === "collection") {
      s.navT += deltaY * PAN.wheel + deltaX * PAN.wheel;
      this.markExplored();
    } else this.stepSel(deltaY > 0 ? 1 : -1);
  }

  stepFocus(dir: number) {
    const s = this.st;
    if (s.scale === "collection") {
      s.navT += dir;
      this.markExplored();
    } else this.stepSel(dir);
  }

  private markExplored() {
    if (this.explored) return;
    this.explored = true;
    try {
      window.localStorage.setItem(EXPLORED_KEY, "1");
    } catch {
      return;
    }
  }

  private tideStep(dt: number) {
    const s = this.st;
    const settled = Math.abs(s.navT - s.nav) < 1e-3;
    const quiet = performance.now() - this.intent > IDLE_MS;
    const on =
      quiet && settled && !this.reduced && s.scale === "collection" && ALBUMS.length > 1;

    if (on) {
      this.tideGain = Math.min(1, this.tideGain + dt / TIDE.ramp);
      this.tideT += dt;
    } else {
      this.tideGain = Math.max(0, this.tideGain - dt * TIDE.release);
      if (this.tideGain <= 0) this.tideT = 0;
    }

    const dir = Math.round(s.nav) < ALBUMS.length - 1 ? 1 : -1;
    s.tide = dir * TIDE.amp * this.tideGain * tideAt(this.tideT);
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
    if (cw !== this.cvB.width || ch !== this.cvB.height) this.gl.invalidate();
    this.cvB.width = cw;
    this.cvB.height = ch;
    this.cvF.width = cw;
    this.cvF.height = ch;
    const fw = Math.max(2, Math.round(cw * ANATOMY.focus.scale));
    const fh = Math.max(2, Math.round(ch * ANATOMY.focus.scale));
    this.cvFocus.width = fw;
    this.cvFocus.height = fh;
    this.W = cw;
    this.H = ch;
    this.L = layoutFor(variantFor(w, h));
  }

  setLabels(labels: CanvasLabels) {
    this.labels = labels;
  }

  setRailAlb(i: number) {
    this.railAlb = i;
  }

  setAnatomyFocus(part: AnatomyPart | null) {
    if (this.compareOn && (!part || AXIS_OF[part] !== this.compareAxis)) this.compareOn = false;
    this.focusPin = part;
    this.markIntent();
  }

  previewAnatomy(part: AnatomyPart | null) {
    this.focusHover = part;
  }

  setCompare(on: boolean) {
    const axis = this.focusPin ? AXIS_OF[this.focusPin] : null;
    if (on && (!axis || this.st.scale === "collection")) return;
    if (on && axis && (axis !== this.compareAxis || this.compareAlb !== this.st.alb)) {
      this.dropCompare();
      this.compareAxis = axis;
      this.compareAlb = this.st.alb;
    }
    this.compareOn = on;
    this.markIntent();
  }

  openAnatomy() {
    this.invite = null;
    this.remember("opened");
  }

  closeAnatomy() {
    this.focusPin = null;
    this.focusHover = null;
    this.compareOn = false;
  }

  private dropCompare() {
    this.compareOn = false;
    this.compareAxis = null;
    this.compareAlb = -1;
    this.compareK = 0;
    this.compareStep = -1;
    this.compareShape = null;
  }

  private remember(mark: "opened" | "invited") {
    if (this.anatomyMark === "opened") return;
    this.anatomyMark = mark;
    try {
      window.localStorage.setItem(ANATOMY.key, mark);
    } catch {
      return;
    }
  }

  private focusPart(): AnatomyPart | null {
    if (this.st.scale === "collection") return null;
    if (this.compareOn || this.compareK > 0) return this.focusPin;
    return this.focusHover ?? this.focusPin;
  }

  private anatomyStep(dt: number) {
    const s = this.st;
    if (s.scale === "collection") {
      this.focusHover = null;
      this.focusPin = null;
      this.compareOn = false;
    }
    if (this.compareAxis && this.compareAlb !== s.alb) this.dropCompare();
    if (!this.compareOn) {
      this.peeking = false;
      this.peekBack = false;
    }
    const k = this.compareOn && !this.peeking ? 1 : 0;
    const span = this.peeking || this.peekBack ? ANATOMY.compare.peek : ANATOMY.compare.duration;
    this.compareK = this.reduced ? k : approach(this.compareK, k, dt / span);
    if (this.peekBack && this.compareK >= 1) this.peekBack = false;
    if (!this.compareOn && this.compareK <= 0 && this.compareAxis) {
      const pinned = this.focusPin ? AXIS_OF[this.focusPin] : null;
      if (pinned !== this.compareAxis) this.dropCompare();
    }
    const f = this.focusPart() && this.focusLive ? 1 : 0;
    this.focusAmt = this.reduced ? f : approach(this.focusAmt, f, dt / ANATOMY.focus.fade);
    this.inviteStep(dt);
  }

  private inviteStep(dt: number) {
    const s = this.st;
    const ceremony = s.mode === "collapse" || s.mode === "fusion";
    if (!this.anatomyMark && s.scale !== "collection" && !ceremony && !this.focusPin) {
      this.dwell += dt;
      if (this.dwell >= ANATOMY.invite.dwell) {
        this.invite = inviteOf(s.alb);
        this.inviteAt = s.t;
        this.inviteAlb = s.alb;
        this.remember("invited");
      }
    }
    if (
      this.invite &&
      (s.t - this.inviteAt > ANATOMY.invite.shown ||
        s.scale === "collection" ||
        s.alb !== this.inviteAlb ||
        this.focusPin)
    ) {
      this.invite = null;
    }
  }

  private compareBake(): SegShape | null {
    const s = this.st;
    const axis = this.compareAxis;
    if (!axis || this.compareAlb !== s.alb || s.scale === "collection" || !BAKED.has(axis)) {
      return null;
    }
    const steps = ANATOMY.compare.steps;
    const kq = Math.round(ease(this.compareK) * steps) / steps;
    if (kq !== this.compareStep || !this.compareShape) {
      this.compareStep = kq;
      this.compareVersion++;
      const base = this.morphAt(s.alb);
      const target = compareMorphology(s.alb, axis);
      this.compareShape = {
        m: kq <= 0 ? base : kq >= 1 ? target : mixMorphology(base, target, kq),
        version: this.compareVersion,
        time: s.t,
      };
    } else {
      this.compareShape.time = s.t;
    }
    return this.compareShape;
  }

  private focusFrame(): BodyFrame | null {
    if (!this.focusPart()) return null;
    resetFrame(this.bodyFrame);
    return this.bodyFrame;
  }

  private focusRender() {
    const u = this.gl.uniforms;
    const part = this.focusPart();
    if (part) {
      const rx = this.st.m0h * this.H;
      const body = this.bodyFrame;
      const core = { x: body.bx, y: body.by, rx, ry: rx * u.uFlat.value };
      const r = (v: number) => Math.round(v * 2);
      const sats = body.satellites.map((q) => `${r(q.x)},${r(q.y)},${r(q.r)},${r(q.w * 50)}`);
      const baked = this.compareBake();
      const frame = baked && body.m ? { ...body, m: baked.m } : body;
      const key = [part, r(body.bx), r(body.by), r(body.R), r(body.flatten * 400), r(body.rot * 400),
        r(rx), r(core.ry), this.st.sel, this.st.hover, this.W, sats.join(";"),
        baked ? baked.version : 0].join("|");
      this.focusAge++;
      if (key !== this.focusKey || this.focusAge >= ANATOMY.focus.refresh) {
        this.focusKey = key;
        this.focusAge = 0;
        this.focusLive = drawFocus(this.ctxFocus, this.W, frame, part, core);
        const tex = u.uFocus.value;
        if (tex) tex.needsUpdate = true;
      }
    } else {
      this.focusLive = false;
      this.focusKey = "";
    }
    const mix = u.uFocusMix.value as THREE.Vector3;
    const { ask, what } = ANATOMY.focus.dim;
    mix.x = this.focusAmt;
    mix.y = ask + (what - ask) * ease(this.compareK);
  }

  setRailTrk(i: number) {
    this.railTrk = i;
  }

  setIntake(on: boolean) {
    this.intake = on;
  }

  private morphAt(i: number): AlbumMorphology {
    return this.MORPH[clamp(i, 0, this.MORPH.length - 1)] ?? NEUTRAL_MORPHOLOGY;
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
      (a) => this.morphAt(a),
    );
  }

  private morphFor(): AlbumMorphology {
    const s = this.st;
    const n = this.MORPH.length;
    if (!n) return NEUTRAL_MORPHOLOGY;
    let m: AlbumMorphology;
    if (s.scale === "collection") {
      const i = clamp(Math.floor(s.nav), 0, n - 1);
      const j = clamp(i + 1, 0, n - 1);
      m = mixMorphology(this.MORPH[i], this.MORPH[j], s.nav - i);
    } else {
      m = this.morphAt(s.alb);
      if (this.compareAxis && this.compareK > 0 && this.compareAlb === s.alb) {
        m = mixMorphology(m, compareMorphology(s.alb, this.compareAxis), ease(this.compareK));
      }
    }
    if (s.mix > 0 && this.MORPH[s.fuseAlb]) m = mixMorphology(m, this.MORPH[s.fuseAlb], s.mix);
    return m;
  }

  private leadSatellite() {
    let best: (typeof this.M.satellites)[number] | null = null;
    for (const sat of this.M.satellites) {
      if (sat.weight <= 0.02) continue;
      if (!best || sat.weight * sat.size > best.weight * best.size) best = sat;
    }
    return best;
  }

  private horizonUnit(): number {
    const R = this.L.staged
      ? bodyGeom(this.W, this.H, this.st, this.L, this.M).R
      : baseRadius(this.W, this.H, 1, 0, this.L) * this.M.circuit;
    return (this.M.coreRatio * R) / Math.max(1, this.H);
  }

  private worldUnit(): number {
    if (!this.L.staged) return 1;
    const b = bandsFor(this.W, this.H, this.st, this.L);
    return Math.max(0.05, (2 * stageBox(this.W, this.H, b).halfH) / Math.max(1, this.H));
  }

  private guard(out: THREE.Vector3) {
    if (!this.L.staged) {
      out.set(0, 1, 1);
      return;
    }
    const b = bandsFor(this.W, this.H, this.st, this.L);
    out.set(0.5 - b.stage, GUARD.soft, GUARD.residual);
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

  private apply(effects: AudioEffect[]) {
    for (const e of effects) {
      if (e.kind === "load" || e.kind === "play") this.faultKind = null;
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

  private run(effects: AudioEffect[]) {
    this.apply(effects);
    this.markIntent();
  }

  primary() {
    this.run(T.primary(this.st, CATALOG));
  }

  back() {
    if (this.compareOn) {
      this.setCompare(false);
      return;
    }
    this.run(T.back(this.st));
  }

  goScale(level: Scale) {
    this.run(T.goScale(this.st, CATALOG, level));
  }

  enterAlbum(i: number) {
    if (this.st.scale === "collection" && i !== this.st.alb) this.markExplored();
    this.run(T.enterAlbum(this.st, CATALOG, i));
  }

  playTrack(alb: number, trk: number) {
    this.run(T.playTrack(this.st, CATALOG, alb, trk));
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
      labels: this.labels,
      fonts: this.fonts,
      covers: this.covers,
      rings: this.rings,
      weights: this.WEIGHTS,
      parts: this.parts,
      C: this.C,
      morph: this.M,
      morphOf: (a) => this.morphAt(a),
      field: this.deformation(),
      fieldVersion: this.strain.version,
      compare: this.compareBake(),
      frame: this.focusFrame(),
      ghost:
        this.compareAxis && this.compareK > 0.001 && this.compareAlb === this.st.alb
          ? { m: this.morphAt(this.st.alb), alpha: ANATOMY.ghost.alpha * ease(this.compareK) }
          : null,
    };
  }

  private frontDeps(): FrontDeps {
    return { fonts: this.fonts, covers: this.covers, labels: this.labels };
  }


  private step(dt: number) {
    const s = this.st;
    s.t += dt;
    s.seqT += dt;
    if (s.segueT < SEQ.segue.total) s.segueT += dt;
    this.trackBias(dt);
    this.motionStep(dt);
    this.C = this.fieldFor();
    this.anatomyStep(dt);
    this.M = this.morphFor();

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


    this.strainStep(dt);

    const live = s.mode === "playing" || s.mode === "fusion";
    const target = live ? 0.42 + a.energy * 0.58 : s.mode === "paused" ? 0.22 : 0.3;
    s.energy += (target - s.energy) * Math.min(1, dt * LERP.energy);

    const h = this.hit();
    s.hover = h.kind === "track" ? h.i : this.railTrk >= 0 ? this.railTrk : -1;
    s.hoverBody = h.kind === "body" ? h.i : this.railAlb >= 0 ? this.railAlb : -1;
    if (s.scale === "album" && s.hover >= 0) s.sel = s.hover;
    this.secondMass(dt);
    this.reachOf(h, dt);

    const C = this.C;
    const hzK = this.horizonUnit() / HORIZON_REF;
    this.hzK = hzK;
    const tgt = {
      m0k: 0.088 * K * C.massScale,
      m0h: 0.112 * hzK,
      spin: 0.06 * C.swirl,
      blur: 0,
      fade: 1,
      jet: 0,
      play: 0,
    };
    if (s.scale === "album") {
      tgt.m0k = 0.1 * K * C.massScale;
      tgt.m0h = 0.096 * hzK;
      tgt.spin = 0.16 * C.swirl;
    }

    if (s.mode === "collapse") this.collapse(tgt, K);
    if (isEngaged(s.mode)) this.playing(tgt, K);
    if (s.mode === "fusion") this.fusion(tgt, K);

    if (s.segueT < SEQ.segue.total) {
      const e = s.segueT / SEQ.segue.total;
      tgt.m0h *= 1 - Math.sin(e * Math.PI) * SEQ.segue.depth * K;
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
    s.form +=
      ((s.scale === "collection" ? MORPH.collectionForm : 1) - s.form) * Math.min(1, dt * 4);
    this.tideStep(dt);

    const k = Math.min(1, dt * LERP.field);
    const kr =
      s.mode === "playing" ? Math.min(1, dt * Math.max(LERP.field, 1 / this.motion.attack)) : k;
    s.m0k += (tgt.m0k - s.m0k) * kr;
    s.m0h += (tgt.m0h - s.m0h) * k;
    s.spin += (tgt.spin - s.spin) * kr;
    s.blur += (tgt.blur - s.blur) * kr;
    s.fade += (tgt.fade - s.fade) * Math.min(1, dt * LERP.fade);
    s.jet += (tgt.jet - s.jet) * kr;
    s.play += (tgt.play - s.play) * Math.min(1, dt * LERP.play);

    const pull = s.mode === "collapse" && s.seqT < SEQ.collapse.valleyEnd;
    for (const q of this.parts) {
      q.a += dt * q.s * (0.25 + s.energy * 0.9) * (s.mode === "playing" ? 1.5 : 1);
      if (pull) q.r *= 1 - dt * 1.5;
      else q.r += (0.16 + q.z * 0.62 - q.r) * dt * 1.2;
      if (s.mode === "paused") q.r -= dt * 0.012;
    }
  }

  private reachOf(h: Hit, dt: number) {
    const s = this.st;
    let next: Reach = "none";
    const ceremony = s.mode === "collapse" || s.mode === "fusion";
    if (!this.onUi && !this.coarse && !ceremony) {
      if (h.kind === "body" || h.kind === "track") next = "enter";
      else if (s.scale !== "collection") next = "leave";
    }
    this.reach = next;
    const target = next === "enter" ? 1 : next === "leave" ? -1 : 0;
    this.reachAmp += (target - this.reachAmp) * Math.min(1, dt * LERP.reach);
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
    this.bias.brightness += (target.brightness - this.bias.brightness) * k;
    this.bias.pulse += (target.pulse - this.bias.pulse) * k;
  }

  private motionStep(dt: number) {
    const s = this.st;
    if (s.playAlb !== this.motionAlb || s.trk !== this.motionTrk) {
      this.motionAlb = s.playAlb;
      this.motionTrk = s.trk;
      const album = s.playAlb >= 0 ? ALBUMS[s.playAlb] : undefined;
      this.motionTarget = motionResponseOf(album ? motionQualitiesOf(album, s.trk) : null);
    }
    approachMotion(this.motion, this.motionTarget, Math.min(1, dt * MOTION.lerp));
    this.bus.setResponse(this.motion);
  }

  private ringRotation(dt: number) {
    const s = this.st;
    const onAir = s.playAlb >= 0 && s.playAlb === s.alb;
    const target = ringRotationTarget(this.rings.bounds(s.alb), s.trk, progressOf(s), onAir);
    const raw = target - s.ringRot;
    const d = (((raw + Math.PI) % 6.2832) + 6.2832) % 6.2832 - Math.PI;
    s.ringRot += d * Math.min(1, dt * LERP.ringRot);
  }

  private deformation(): Float32Array | null {
    return this.strain.album === this.st.alb ? this.strain.field : null;
  }

  private strainStep(dt: number) {
    const s = this.st;
    if (s.playAlb < 0) return;
    const album = ALBUMS[s.playAlb];
    const bounds = this.rings.bounds(s.playAlb);
    const trk = clamp(s.trk, 0, bounds.length - 2);
    const turn = albumProgressOf(bounds, trk, progressOf(s));
    const live = s.mode === "playing" || s.mode === "collapse" || s.mode === "fusion";
    const shape = this.morphAt(s.playAlb);
    const crown = crownAt(shape, turn);
    const amp = amplitudeOf(crown.outer - crown.inner);
    const load = live
      ? loadOf(chargeAt(album.signature, turn), complianceOf(album.signature.dynamics), amp)
      : 0;
    strainStep(this.strain, s.playAlb, turn, load, amp, dt, live);
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
    const at = pointed >= 0 && !this.intake ? pointed : focused + dir;

    const p = albPos(at, s, this.L);
    const C = this.FIELD[clamp(at, 0, n - 1)];
    const mm = this.morphAt(at);
    const gain = pointed >= 0 && !this.intake && !this.reduced ? SECOND_MASS.pointGain : 1;
    const k = this.intake
      ? SECOND_MASS.k * INTAKE.mass
      : SECOND_MASS.k * C.massScale * gain;
    const h = this.intake
      ? SECOND_MASS.h * INTAKE.horizon
      : SECOND_MASS.h * (mm.coreRatio / MORPH.coreRef) * mm.circuit;

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
      tgt.m0h = 0.082 * this.hzK;
      tgt.play = e;
      if (p >= SEQ.reduced) s.mode = "playing";
      return;
    }

    if (p < SEQ.collapse.ramp) {
      const e = p / SEQ.collapse.ramp;
      tgt.m0k = 0.055 + e * e * 0.3;
      tgt.m0h = (0.112 + e * 0.03) * this.hzK;
      tgt.spin = 0.06 + e * 2.3;
      tgt.blur = e * 1.5;
      tgt.fade = 1 - Math.pow(e, 2.6);
    } else if (p < SEQ.collapse.valleyEnd) {
      tgt.m0k = 0.36;
      tgt.m0h = 0.1 * this.hzK;
      tgt.spin = 2.4;
      tgt.blur = 1.5;
      tgt.fade = SEQ.valley.fade;
    } else if (p < SEQ.collapse.total) {
      const e = (p - SEQ.collapse.valleyEnd) / 0.95;
      tgt.m0k = 0.36 - e * 0.28;
      tgt.m0h = (0.1 - e * 0.02) * this.hzK;
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
    const { mass, light } = this.motion;
    tgt.play = isPlaying ? 1 : 0.86;
    tgt.m0k =
      curvature(
        0.075 * C.massScale,
        (isPlaying ? a.accent.bass : a.accent.bass * 0.25) * mass,
        cap,
      ) * K;
    tgt.m0h = 0.082 * this.hzK;
    tgt.spin = isPlaying
      ? curvature(0.42 * C.swirl, a.accent.mid * 0.7 + a.flux * 0.3, cap)
      : 0.06 * C.swirl;
    tgt.jet = isPlaying ? 0.06 + a.flux * 0.22 * light + a.bass * 0.06 * mass : 0.02;
    tgt.blur = isPlaying ? a.bass * 0.12 * mass : 0;
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
    const geo = bodyGeom(this.W, this.H, s, this.L, this.M);
    const gx = geo.cx / this.W;
    const gy = geo.cy / this.H;
    const mx = (gx - 0.5) * aspect;
    const my = 0.5 - gy;

    let m1x = mx + s.m1x;
    let m1y = my + s.m1y;
    let m1k = s.m1k;
    let m1h = s.m1h;
    if (s.scale === "collection" && s.mode !== "fusion" && this.m1.ready) {
      m1x = (this.m1.x - 0.5) * aspect;
      m1y = 0.5 - this.m1.y;
      m1k = this.m1.k;
      m1h = this.m1.h;
    } else if (s.scale !== "collection" && s.mode !== "fusion" && s.m1k <= 1e-4) {
      const sat = this.leadSatellite();
      if (sat) {
        const sx = (geo.cx + Math.cos(sat.angle) * sat.dist * geo.R) / this.W;
        const sy = (geo.cy + Math.sin(sat.angle) * sat.dist * geo.R * geo.flatten) / this.H;
        m1x = (sx - 0.5) * aspect;
        m1y = 0.5 - sy;
        m1k = SECOND_MASS.k * this.C.massScale * sat.weight * s.form;
        m1h = ((sat.size * geo.R) / this.H) * (0.4 + 0.6 * sat.weight);
      }
    }

    const A = ALBUMS[s.alb];
    const lobeAmp = this.M.relief * MORPH.coreLobe;
    u.uLobeA.value.set(
      this.M.lobeCos[0] ?? 0,
      this.M.lobeSin[0] ?? 0,
      this.M.lobeCos[1] ?? 0,
      this.M.lobeSin[1] ?? 0,
    );
    u.uLobeB.value.set(
      this.M.lobeCos[2] ?? 0,
      this.M.lobeSin[2] ?? 0,
      lobeAmp * s.form,
      -s.ringRot,
    );
    u.uFlat.value = 1 + (this.M.flatten - 1) * s.form;
    u.uWorld.value = this.worldUnit();
    this.guard(u.uGuard.value as THREE.Vector3);
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
      curvature(0.014, this.audioState.accent.treb * this.motion.light, this.C.reactionCap * 0.6) +
      s.blur * 0.01;
    u.uJet.value = s.jet;
    u.uReach.value = this.reachAmp;
    const dBright = clamp(this.audioState.centroid - A.signature.brightness, -0.5, 0.5);
    u.uRim.value = this.C.rimHardness * (1 + dBright * this.C.reactionCap * this.motion.light);
    const light = lightDirection(this.lightSweep);
    u.uLight.value.set(light[0], light[1]);
    (u.uInk.value as THREE.Vector3).set(A.inkA[0], A.inkA[1], A.inkA[2]);
    this.focusRender();
    this.gl.render();
  }

  private buildSnapshot(force = false): Snapshot {
    const s = this.st;
    const quiet = performance.now() - this.intent;
    const idle = !this.coarse && quiet > IDLE_MS && !this.focusPin && !this.compareOn;
    const navAlb = Math.round(s.nav);
    const hint =
      !this.explored && s.scale === "collection" && quiet > HINT_MS
        ? this.coarse
          ? ("swipe" as const)
          : ("drag" as const)
        : null;
    const next: Snapshot = {
      scale: s.scale,
      bands: this.L.staged ? bandsOf(this.W, this.H, s.zoomT) : FULL_BANDS,
      mode: s.mode,
      alb: s.alb,
      navAlb,
      sel: s.sel,
      trk: s.trk,
      playAlb: s.playAlb,
      hoverTrk: s.hover,
      hoverAlb: s.hoverBody,
      idle,
      hint,
      hintDir: navAlb < ALBUMS.length - 1 ? 1 : -1,
      variant: this.L.variant,
      fault: this.faultKind,
      focus: this.focusPin,
      compare: this.compareOn,
      peek: this.peeking,
      invite: this.invite,
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
      prev.hint === next.hint &&
      prev.hintDir === next.hintDir &&
      prev.variant === next.variant &&
      prev.fault === next.fault &&
      prev.focus === next.focus &&
      prev.compare === next.compare &&
      prev.peek === next.peek &&
      prev.invite === next.invite &&
      sameBands(prev.bands, next.bands);
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
