"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { curvature } from "./audio/analysis";
import { AudioBus, type VisualAudioState } from "./audio/bus";
import { drawBack, makeParticles, type BackDeps } from "./composition/back";
import { drawFront, type FrontDeps } from "./composition/front";
import { loadCovers, type CoverAsset } from "./composition/cover";
import {
  albPos,
  hitTest,
  layoutFor,
  variantFor,
  type WorldLayout,
} from "./composition/layout";
import { RingBakery } from "./composition/ring";
import { ALBUMS } from "./data/albums";
import {
  fieldConstantsOf,
  mixConstants,
  reduceMotion,
  type FieldConstants,
} from "./field";
import { createFieldGL, type FieldGL } from "./fieldMaterial";
import {
  COMPOSITION_FALLBACK_W,
  COMPOSITION_MAX_W,
  IDLE_MS,
  LERP,
  SEQ,
  rgba,
} from "./tokens";
import type {
  FieldState,
  FontFamilies,
  LiveNodes,
  Particle,
  Scale,
  Snapshot,
} from "./types";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

const FIELD: FieldConstants[] = ALBUMS.map((a) => fieldConstantsOf(a.signature));
const fmt = (n: number) =>
  `${String(Math.floor(Math.max(0, n) / 60)).padStart(2, "0")}:${String(
    Math.floor(Math.max(0, n) % 60),
  ).padStart(2, "0")}`;

function initialState(): FieldState {
  return {
    scale: "campo",
    zoom: 0,
    zoomT: 0,
    nav: 0,
    navT: 0,
    alb: 0,
    playAlb: -1,
    trk: 0,
    sel: 0,
    hover: -1,
    hoverBody: -1,
    mode: "parado",
    play: 0,
    pos: 0,
    dur: 0,
    spin: 0.06,
    blur: 0,
    fade: 0,
    jet: 0,
    m0k: 0.088,
    m0h: 0.112,
    m1k: 0.02,
    m1h: 0.05,
    m1x: 0.6,
    m1y: 0.1,
    mix: 0,
    fuseB: 0,
    fuseAlb: 0,
    waveR: -1,
    waveA: 0,
    energy: 0.3,
    curK: 0,
    t: 0,
    seqT: 0,
    ringRot: 0,
    fadeSel: 0,
    bass: 0,
    mid: 0,
    treb: 0,
  };
}

export class FieldEngine {
  readonly st: FieldState = initialState();
  readonly bus = new AudioBus();
  private liveNodes: LiveNodes = {
    layer: null,
    bar: null,
    seek: null,
    tc: null,
    albMarks: [],
    trkMarks: [],
  };

  private gl: FieldGL;
  private cvB: HTMLCanvasElement;
  private ctxB: CanvasRenderingContext2D;
  private cvF: HTMLCanvasElement;
  private ctxF: CanvasRenderingContext2D;
  private covers: CoverAsset[];
  private rings: RingBakery;
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
  private pointer = { x: 0.55, y: 0.45 };
  private C: FieldConstants = FIELD[0];
  private railAlb = -1;
  private railTrk = -1;
  private intent = 0;
  private raf = 0;
  private last = 0;
  private reduced = false;
  private coarse = false;
  private dragNav = 0;
  private fuseSwitched = false;
  private ariaTick = 0;
  private audioState: VisualAudioState;

  private snap: Snapshot;
  private listeners = new Set<() => void>();

  constructor(
    canvas: HTMLCanvasElement,
    private fonts: FontFamilies,
  ) {
    this.cvB = document.createElement("canvas");
    this.ctxB = this.cvB.getContext("2d", { alpha: false })!;
    this.cvF = document.createElement("canvas");
    this.ctxF = this.cvF.getContext("2d")!;
    this.covers = loadCovers();
    this.rings = new RingBakery(this.covers);
    this.gl = createFieldGL(canvas, this.cvB, this.cvF);

    this.audioState = this.bus.update(0);
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.coarse = window.matchMedia("(pointer: coarse)").matches;
    this.snap = this.buildSnapshot(true);

    this.bus.onEnded = () => {
      const s = this.st;
      if (s.playAlb < 0) return;
      const N = ALBUMS[s.playAlb].tracks.length;
      this.fuseTo(s.playAlb, (s.trk + 1) % N);
    };

    this.resize();
  }

  start() {
    this.last = performance.now();
    this.intent = performance.now();
    this.bind();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.unbind();
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

  private onResize = () => this.resize();

  private onMotionPref = (e: MediaQueryListEvent) => {
    this.reduced = e.matches;
  };

  private onMove = (e: PointerEvent) => {
    this.markIntent();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const nx = e.clientX / w;
    const ny = e.clientY / h;
    this.pointer.x = nx;
    this.pointer.y = ny;
    this.mouse.v = Math.min(
      1,
      this.mouse.v + Math.hypot(nx - this.mouse.tx, ny - this.mouse.ty) * 9,
    );
    if (this.mouse.down) {
      const dx = e.clientX - this.mouse.lx;
      this.mouse.moved += Math.abs(dx);
      if (this.st.scale === "campo") {
        if (this.L.variant === "mobile") {
          const total = (e.clientX - this.dragStartX) / (w * 0.72);
          this.st.navT = clamp(this.dragNav - total, this.dragNav - 1, this.dragNav + 1);
        } else {
          this.st.navT -= dx / (w * 0.46);
        }
      }
    }
    this.mouse.lx = e.clientX;
    this.mouse.tx = nx;
    this.mouse.ty = ny;
  };

  private dragStartX = 0;

  private inInstruments(e: Event) {
    const t = e.target as HTMLElement | null;
    return !!t?.closest?.("[data-instruments]");
  }

  private onDown = (e: PointerEvent) => {
    this.markIntent();
    if (this.inInstruments(e)) return;
    this.mouse.down = true;
    this.mouse.moved = 0;
    this.mouse.lx = e.clientX;
    this.dragStartX = e.clientX;
    this.dragNav = this.st.navT;
    if (e.pointerType !== "mouse") {
      this.mouse.tx = e.clientX / window.innerWidth;
      this.mouse.ty = e.clientY / window.innerHeight;
      this.mouse.x = this.mouse.tx;
      this.mouse.y = this.mouse.ty;
      this.pointer.x = this.mouse.tx;
      this.pointer.y = this.mouse.ty;
    }
  };

  private onUp = (e: PointerEvent) => {
    const wasDown = this.mouse.down;
    this.mouse.down = false;
    if (!wasDown || this.inInstruments(e)) return;
    if (this.mouse.moved < 7) this.click();
    else if (this.st.scale === "campo") {
      const d = this.st.navT - this.dragNav;
      this.st.navT =
        this.L.variant === "mobile"
          ? this.dragNav + (Math.abs(d) > 0.25 ? Math.sign(d) : 0)
          : Math.round(this.st.navT);
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (this.inInstruments(e)) return;
    e.preventDefault();
    this.markIntent();
    const s = this.st;
    if (s.scale === "campo") s.navT += e.deltaY * 0.0016 + e.deltaX * 0.0016;
    else this.stepSel(e.deltaY > 0 ? 1 : -1);
  };

  private onKey = (e: KeyboardEvent) => {
    this.markIntent();
    const el = e.target as HTMLElement | null;
    const onControl = !!el?.closest?.("[data-instruments]");
    const s = this.st;

    if (e.code === "Space" || e.key === "Enter") {
      if (onControl) return;
      e.preventDefault();
      this.primary();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      this.back();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      if (onControl) return;
      e.preventDefault();
      if (s.scale === "campo") s.navT += 1;
      else this.stepSel(1);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      if (onControl) return;
      e.preventDefault();
      if (s.scale === "campo") s.navT -= 1;
      else this.stepSel(-1);
    }
  };

  private motionQuery: MediaQueryList | null = null;

  private bind() {
    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onMove, { passive: true });
    window.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
    window.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKey);
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.motionQuery.addEventListener("change", this.onMotionPref);
  }

  private unbind() {
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
    window.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKey);
    this.motionQuery?.removeEventListener("change", this.onMotionPref);
  }

  markIntent() {
    this.intent = performance.now();
  }

  get stats() {
    return { fps: Math.round(this.fps), frameCost: +this.frameCost.toFixed(2), W: this.W, H: this.H };
  }

  registerNodes(nodes: Partial<LiveNodes>) {
    this.liveNodes = { ...this.liveNodes, ...nodes };
  }

  private resize() {
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
    this.L = layoutFor(variantFor(w));
  }

  setRailAlb(i: number) {
    this.railAlb = i;
  }

  setRailTrk(i: number) {
    this.railTrk = i;
  }

  private hit() {
    return hitTest(
      this.pointer.x,
      this.pointer.y,
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
    if (s.scale === "campo") {
      const i = clamp(Math.floor(s.nav), 0, n - 1);
      const j = clamp(i + 1, 0, n - 1);
      c = mixConstants(FIELD[i], FIELD[j], s.nav - i);
    } else {
      c = FIELD[clamp(s.alb, 0, n - 1)];
    }
    if (s.mix > 0 && FIELD[s.fuseAlb]) c = mixConstants(c, FIELD[s.fuseAlb], s.mix);
    return this.reduced ? reduceMotion(c) : c;
  }

  private click() {
    const s = this.st;
    const h = this.hit();
    if (s.scale === "campo") {
      if (h.kind === "corpo") this.enterAlbum(h.i);
      return;
    }
    if (h.kind === "faixa") {
      this.playTrack(s.alb, h.i);
      return;
    }
    if (h.kind === "corpo") {
      if (s.scale === "faixa") this.transport();
      else this.playTrack(s.alb, s.sel);
      return;
    }
    this.back();
  }

  primary() {
    const s = this.st;
    if (s.scale === "campo") {
      this.enterAlbum(Math.round(s.nav));
      return;
    }
    if (s.scale === "album") {
      this.playTrack(s.alb, s.sel);
      return;
    }
    this.transport();
  }

  back() {
    const s = this.st;
    if (s.scale === "faixa") {
      s.scale = "album";
      s.zoomT = 1;
    } else if (s.scale === "album") {
      s.scale = "campo";
      s.zoomT = 0;
      s.hover = -1;
    }
    this.markIntent();
  }

  goScale(level: Scale) {
    const s = this.st;
    if (level === "campo") {
      s.scale = "campo";
      s.zoomT = 0;
      s.hover = -1;
    } else if (level === "album") {
      if (s.scale === "campo") this.enterAlbum(Math.round(s.nav));
      else {
        s.scale = "album";
        s.zoomT = 1;
      }
    } else if (s.playAlb >= 0) {
      s.alb = s.playAlb;
      s.scale = "faixa";
      s.zoomT = 1;
    } else {
      this.playTrack(s.alb, s.sel);
    }
    this.markIntent();
  }

  enterAlbum(i: number) {
    const s = this.st;
    s.alb = clamp(Math.round(i), 0, ALBUMS.length - 1);
    s.navT = s.alb;
    s.scale = "album";
    s.zoomT = 1;
    s.sel = s.playAlb === s.alb ? s.trk : 0;
    this.markIntent();
  }

  playTrack(alb: number, trk: number) {
    const s = this.st;
    if (s.scale === "faixa" && s.playAlb === alb && s.trk === trk) {
      this.transport();
      return;
    }
    if (s.playAlb >= 0 && (s.mode === "toca" || s.mode === "pausa") && s.scale === "faixa") {
      this.fuseTo(alb, trk);
      return;
    }
    s.playAlb = alb;
    s.alb = alb;
    s.trk = trk;
    s.sel = trk;
    s.dur = ALBUMS[alb].tracks[trk].dur;
    s.pos = 0;
    s.scale = "faixa";
    s.zoomT = 1;
    s.mode = "colapso";
    s.seqT = 0;
    this.bus.setSignature(ALBUMS[alb].signature);
    this.bus.load(ALBUMS[alb].tracks[trk]);
    void this.bus.play();
    this.markIntent();
  }

  fuseTo(alb: number, trk: number) {
    const s = this.st;
    if (s.mode === "fusao") return;
    s.fuseB = trk;
    s.fuseAlb = alb;
    s.mode = "fusao";
    s.seqT = 0;
    s.mix = 0;
    this.fuseSwitched = false;
    s.m1x = Math.cos(-0.7) * 1.5;
    s.m1y = Math.sin(-0.7) * 1.5;
    s.m1k = 0.03;
    s.m1h = 0.055;
    this.markIntent();
  }

  private commitFusion() {
    const s = this.st;
    if (this.fuseSwitched) return;
    this.fuseSwitched = true;
    const track = ALBUMS[s.fuseAlb]?.tracks[s.fuseB];
    if (track) {
      this.bus.setSignature(ALBUMS[s.fuseAlb].signature);
      this.bus.load(track);
      void this.bus.play();
    }
  }

  stepSel(dir: number) {
    const s = this.st;
    if (s.scale === "campo") return;
    const N = ALBUMS[s.alb].tracks.length;
    s.sel = (s.sel + dir + N) % N;
    if (s.scale === "faixa" && (s.mode === "toca" || s.mode === "pausa")) {
      this.fuseTo(s.alb, s.sel);
    }
    this.markIntent();
  }

  skip(dir: number) {
    const s = this.st;
    if (s.scale === "campo" && s.playAlb < 0) {
      s.navT = clamp(Math.round(s.nav) + dir, 0, ALBUMS.length - 1);
      this.markIntent();
      return;
    }
    const alb = s.playAlb >= 0 && s.scale !== "album" ? s.playAlb : s.alb;
    const N = ALBUMS[alb].tracks.length;
    const from = s.playAlb === alb && s.scale === "faixa" ? s.trk : s.sel;
    const next = (from + dir + N) % N;
    if (s.playAlb === alb && (s.mode === "toca" || s.mode === "pausa" || s.mode === "colapso")) {
      this.fuseTo(alb, next);
    } else {
      s.sel = next;
      if (s.scale === "faixa") this.playTrack(alb, next);
    }
    this.markIntent();
  }

  transport() {
    const s = this.st;
    if (s.mode === "fusao") return;
    if (s.playAlb < 0 || s.scale !== "faixa") {
      this.playTrack(s.alb, s.sel);
      return;
    }
    if (s.mode === "toca" || s.mode === "colapso") {
      s.mode = "pausa";
      this.bus.pause();
    } else {
      s.mode = "toca";
      void this.bus.play();
    }
    this.markIntent();
  }

  seekFraction(f: number) {
    const s = this.st;
    if (!s.dur) return;
    this.bus.seek(clamp(f, 0, 1) * s.dur);
    s.pos = this.bus.position;
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
    this.updateInstruments(now);

    this.frameCost += (performance.now() - t0 - this.frameCost) * 0.05;
    this.fpsFrames++;
    if (now - this.fpsSince > 1000) {
      const visivel = document.visibilityState === "visible";
      this.fps = (this.fpsFrames * 1000) / (now - this.fpsSince);
      this.slowWindows = visivel && this.fpsFrames > 10 && this.fps < 52 ? this.slowWindows + 1 : 0;
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
    if (s.scale === "campo") s.alb = Math.round(s.nav);

    const a = this.bus.update(dt);
    this.audioState = a;
    s.bass = a.bass;
    s.mid = a.mid;
    s.treb = a.treb;

    if (s.playAlb >= 0) {
      s.dur = a.duration || ALBUMS[s.playAlb].tracks[s.trk]?.dur || 0;
      s.pos = Math.min(a.position, s.dur || a.position);
    }

    const live = s.mode === "toca" || s.mode === "fusao";
    const target = live ? 0.42 + a.energy * 0.58 : s.mode === "pausa" ? 0.22 : 0.3;
    s.energy += (target - s.energy) * Math.min(1, dt * LERP.energy);

    const h = this.hit();
    s.hover = h.kind === "faixa" ? h.i : this.railTrk >= 0 ? this.railTrk : -1;
    s.hoverBody = h.kind === "corpo" ? h.i : this.railAlb >= 0 ? this.railAlb : -1;
    if (s.scale === "album" && s.hover >= 0) s.sel = s.hover;

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

    if (s.mode === "colapso") this.colapso(tgt, K);
    if (s.mode === "toca" || s.mode === "pausa") this.tocando(tgt, K);
    if (s.mode === "fusao") this.fusao(tgt, K);

    if (this.reduced) tgt.blur = 0;

    if (s.waveR >= 0) {
      s.waveR += dt * 2.1;
      s.waveA = 0.075 * Math.max(0, 1 - s.waveR / 2.3) * K;
      if (s.waveR > 2.4) s.waveR = -1;
    } else {
      s.waveA = 0;
    }

    s.ringRot += dt * (0.05 + s.energy * 0.14) * (s.mode === "toca" ? 1.6 : 1);
    s.fadeSel += ((s.scale === "campo" ? 0 : 1) - s.fadeSel) * Math.min(1, dt * 4);

    const k = Math.min(1, dt * LERP.campo);
    s.m0k += (tgt.m0k - s.m0k) * k;
    s.m0h += (tgt.m0h - s.m0h) * k;
    s.spin += (tgt.spin - s.spin) * k;
    s.blur += (tgt.blur - s.blur) * k;
    s.fade += (tgt.fade - s.fade) * Math.min(1, dt * LERP.fade);
    s.jet += (tgt.jet - s.jet) * k;
    s.play += (tgt.play - s.play) * Math.min(1, dt * LERP.play);

    const pull = s.mode === "colapso" && s.seqT < SEQ.colapso.valeFim;
    for (const q of this.parts) {
      q.a += dt * q.s * (0.25 + s.energy * 0.9) * (s.mode === "toca" ? 1.5 : 1);
      if (pull) q.r *= 1 - dt * 1.5;
      else q.r += (0.16 + q.z * 0.62 - q.r) * dt * 1.2;
      if (s.mode === "pausa") q.r -= dt * 0.012;
    }
  }

  private colapso(tgt: Record<string, number>, K: number) {
    const s = this.st;
    const p = s.seqT;

    if (this.reduced) {
      const e = Math.min(1, p / SEQ.reduzido);
      tgt.fade = 0.45 + 0.55 * Math.abs(e * 2 - 1);
      tgt.m0k = 0.075 * K;
      tgt.m0h = 0.082;
      tgt.play = e;
      if (p >= SEQ.reduzido) s.mode = "toca";
      return;
    }

    if (p < SEQ.colapso.rampa) {
      const e = p / SEQ.colapso.rampa;
      tgt.m0k = 0.055 + e * e * 0.3;
      tgt.m0h = 0.112 + e * 0.03;
      tgt.spin = 0.06 + e * 2.3;
      tgt.blur = e * 1.5;
      tgt.fade = 1 - Math.pow(e, 2.6);
    } else if (p < SEQ.colapso.valeFim) {
      tgt.m0k = 0.36;
      tgt.m0h = 0.1;
      tgt.spin = 2.4;
      tgt.blur = 1.5;
      tgt.fade = SEQ.vale.fade;
    } else if (p < SEQ.colapso.total) {
      const e = (p - SEQ.colapso.valeFim) / 0.95;
      tgt.m0k = 0.36 - e * 0.28;
      tgt.m0h = 0.1 - e * 0.02;
      tgt.spin = 2.4 - e * 2.1;
      tgt.blur = 1.5 * (1 - e);
      tgt.fade = Math.min(1, e * 1.9);
      tgt.jet = Math.sin(Math.min(1, e * 1.5) * Math.PI) * 1.1;
      tgt.play = e;
    } else {
      s.mode = "toca";
    }
  }

  private tocando(tgt: Record<string, number>, K: number) {
    const s = this.st;
    const toca = s.mode === "toca";
    const a = this.audioState;
    const C = this.C;
    const cap = C.reactionCap;
    tgt.play = toca ? 1 : 0.86;
    tgt.m0k =
      curvature(0.075 * C.massScale, toca ? a.accent.bass : a.accent.bass * 0.25, cap) * K;
    tgt.m0h = 0.082 * C.horizonScale;
    tgt.spin = toca ? curvature(0.42, a.accent.mid * 0.7 + a.flux * 0.3, cap) : 0.06;
    tgt.jet = toca ? 0.06 + a.flux * 0.22 + a.bass * 0.06 : 0.02;
    tgt.blur = toca ? a.bass * 0.12 : 0;
    if (s.scale === "album") tgt.play *= 0.25;
  }

  private fusao(tgt: Record<string, number>, K: number) {
    const s = this.st;
    const p = s.seqT;
    tgt.play = 1;

    if (this.reduced) {
      const e = Math.min(1, p / SEQ.reduzido);
      s.mix = e;
      tgt.m0k = 0.075 * K;
      tgt.fade = 0.5 + 0.5 * Math.abs(e * 2 - 1);
      this.commitFusion();
      if (p >= SEQ.reduzido) this.endFusion();
      return;
    }

    if (p < SEQ.fusao.onda) {
      const e = p / SEQ.fusao.onda;
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
    } else if (p < SEQ.fusao.total) {
      const e = (p - SEQ.fusao.onda) / 0.7;
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
    const s = this.st;
    s.playAlb = s.fuseAlb;
    s.trk = s.fuseB;
    s.sel = s.fuseB;
    s.alb = s.fuseAlb;
    s.dur = this.bus.duration || ALBUMS[s.alb].tracks[s.trk].dur;
    s.pos = 0;
    s.mix = 0;
    s.m1k = 0;
    s.m1h = 0;
    s.waveR = -1;
    s.mode = "toca";
    if (s.scale !== "album") {
      s.scale = "faixa";
      s.zoomT = 1;
    }
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
    if (s.scale === "campo" && s.mode !== "fusao") {
      const dir = s.nav - Math.round(s.nav) >= 0 ? 1 : -1;
      const nb = albPos(Math.round(s.nav) + dir, s, this.L);
      m1x = (nb.x - 0.5) * aspect;
      m1y = 0.5 - nb.y;
      m1k = 0.03;
      m1h = 0.052;
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

  private updateInstruments(now: number) {
    const s = this.st;
    const L = this.liveNodes;
    const A = ALBUMS[s.playAlb >= 0 ? s.playAlb : s.alb];
    const prog = s.dur ? Math.min(1, s.pos / s.dur) : 0;

    if (L.layer) L.layer.style.setProperty("--focus-ink", rgba(ALBUMS[s.alb].inkA, 1));
    if (L.bar) {
      L.bar.style.width = `${prog * 100}%`;
      L.bar.style.background = rgba(A.inkA, 0.95);
    }
    if (L.tc) L.tc.textContent = `${fmt(s.pos)} / ${fmt(s.dur || 0)}`;
    L.albMarks.forEach((mk, i) => {
      if (!mk) return;
      const cur = i === (s.scale === "campo" ? Math.round(s.nav) : s.alb);
      mk.style.background = cur
        ? rgba(ALBUMS[i].inkA, 1)
        : i === s.playAlb
          ? rgba(ALBUMS[i].inkA, 0.5)
          : "#3A3631";
    });
    const cur = ALBUMS[s.alb];
    L.trkMarks.forEach((mk, i) => {
      if (!mk) return;
      const isPlay = s.playAlb === s.alb && i === s.trk;
      const isSel = i === s.sel;
      mk.style.background = isPlay ? rgba(cur.inkA, 1) : isSel ? "#E8E4DC" : "#3A3631";
      const size = isSel || isPlay ? "7px" : "5px";
      mk.style.width = size;
      mk.style.height = size;
    });

    if (L.seek && now - this.ariaTick > 1000) {
      this.ariaTick = now;
      L.seek.setAttribute("aria-valuenow", String(Math.round(prog * 100)));
      L.seek.setAttribute("aria-valuetext", `${fmt(s.pos)} de ${fmt(s.dur || 0)}`);
    }

    const next = this.buildSnapshot();
    if (next !== this.snap) {
      this.snap = next;
      this.listeners.forEach((fn) => fn());
    }
  }
}

export function useField(fonts: FontFamilies) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [engine, setEngine] = useState<FieldEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const inst = new FieldEngine(canvas, fonts);
    inst.start();
    setEngine(inst);
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __horizonte?: FieldEngine }).__horizonte = inst;
    }
    return () => {
      inst.stop();
      setEngine(null);
    };
    //
  }, [fonts]);

  return { canvasRef, engine };
}
