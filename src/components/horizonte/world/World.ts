import * as THREE from "three";
import downSrc from "@/shaders/world/down.glsl";
import finalSrc from "@/shaders/world/final.glsl";
import quadSrc from "@/shaders/world/quad.vert.glsl";
import raysSrc from "@/shaders/world/rays.glsl";
import sceneSrc from "@/shaders/world/scene.glsl";
import upSrc from "@/shaders/world/up.glsl";
import type { VisualAudioState } from "../audio/bus";
import { profileOf } from "../composition/relief";
import type { Hit } from "../composition/layout";
import { ALBUMS } from "../content";
import { fieldConstantsOf } from "../field";
import { clamp, lerp } from "../math";
import { lobeAt, satRadiusOf, type AlbumMorphology } from "../morphology";
import type { Routing } from "../motion";
import { RELIEF, RING } from "../tokens";
import type { FieldState } from "../types";

export interface WorldFocus {
  morph: AlbumMorphology;
  version: number;
  field: Float32Array | null;
  strain: number;
  sel: number;
  active: number;
}

export interface WorldView {
  st: FieldState;
  audio: VisualAudioState;
  cap: number;
  routing: Routing;
  breath: { mass: number; light: number };
  reduced: boolean;
  coarse: boolean;
  mouse: { x: number; y: number; onUi: boolean };
  reach: number;
  morph: (i: number) => AlbumMorphology;
  focus: WorldFocus;
}

export interface WorldPresenter {
  resize(w: number, h: number): void;
  frame(dt: number, view: WorldView): void;
  hit(nx: number, ny: number): Hit;
  dispose(): void;
}

export interface WorldStats {
  fps: number;
  gpu: number | null;
  width: number;
  height: number;
  scale: number;
}

const NB = 3;
const N = RELIEF.texels;
const ROW = N * 4;
const TAU = Math.PI * 2;
const LEVELS = 5;
const DPR_CAP = 2;
const TIME_ELAPSED = 0x88bf;
const GPU_DISJOINT = 0x8fbb;
const SPACING = 3.25;
const RECEDE = 2.5;
const UP = new THREE.Vector3(0, 1, 0);

const srgb = (v: number) => Math.pow(v, 2.2);
const ease = (t: number) => t * t * (3 - 2 * t);
const half = THREE.DataUtils.toHalfFloat;

function triangle(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("aP", new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2));
  g.setDrawRange(0, 3);
  return g;
}

function target(w: number, h: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

function pass(fragment: string, uniforms: Record<string, THREE.IUniform>): THREE.RawShaderMaterial {
  return new THREE.RawShaderMaterial({
    vertexShader: quadSrc,
    fragmentShader: fragment,
    uniforms,
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
  });
}

function atlas(rows: number): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint16Array(ROW * rows), N, rows, THREE.RGBAFormat, THREE.HalfFloatType);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

interface Slot {
  album: number;
  key: string;
  k: number;
  morph: AlbumMorphology | null;
  lo: number;
  hi: number;
  radius: number;
  tilt: number;
  y: number;
}

interface Rig {
  target: THREE.Vector3;
  az: number;
  el: number;
  dist: number;
  fov: number;
}

const mixRig = (a: Rig, b: Rig, t: number): Rig => ({
  target: a.target.clone().lerp(b.target, t),
  az: lerp(a.az, b.az, t),
  el: lerp(a.el, b.el, t),
  dist: lerp(a.dist, b.dist, t),
  fov: lerp(a.fov, b.fov, t),
});

export class World implements WorldPresenter {
  private renderer: THREE.WebGLRenderer;
  private gl: WebGL2RenderingContext;
  private mesh: THREE.Mesh;
  private stage = new THREE.Scene();
  private ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private u: Record<string, THREE.IUniform>;
  private post: Record<string, THREE.IUniform>;
  private scene: THREE.RawShaderMaterial;
  private down: THREE.RawShaderMaterial;
  private up: THREE.RawShaderMaterial;
  private rays: THREE.RawShaderMaterial;
  private final: THREE.RawShaderMaterial;
  private rtScene = target(2, 2);
  private rtRays = target(2, 2);
  private rtDown: THREE.WebGLRenderTarget[] = [];
  private rtUp: THREE.WebGLRenderTarget[] = [];
  private shapeTex = atlas(NB * 2);
  private warpTex = atlas(NB);
  private profile = new Float32Array(ROW * 2);
  private textCanvas = document.createElement("canvas");
  private textTex: THREE.CanvasTexture;

  private slots: Slot[] = [0, 1, 2].map(() => ({
    album: -1,
    key: "",
    k: 0,
    morph: null,
    lo: 0.5,
    hi: 1,
    radius: 1,
    tilt: 0.6,
    y: 1,
  }));
  private time = 0;
  private scaleNow: FieldState["scale"] = "collection";
  private alb = 0;
  private textAlb = -1;
  private textWant = -1;
  private textK = 0;
  private ink = new THREE.Vector3(0.2, 0.3, 0.8);
  private ring = 0;
  private ringGate = false;
  private ringAt = 0;
  private waveWas = -1;
  private hoverK = 0;
  private hoverRange: [number, number] = [0, 0];

  readonly orbit = { az: 0, el: 0, zoom: 0, held: false };
  private camPos = new THREE.Vector3(0, 0.5, 7);
  private camR = new THREE.Vector3(1, 0, 0);
  private camU = new THREE.Vector3(0, 1, 0);
  private camF = new THREE.Vector3(0, 0, -1);
  private focal = 1;
  private pointer = new THREE.Vector2();

  private cssW = 1;
  private cssH = 1;
  private fullW = 2;
  private fullH = 2;
  private scale = 0.7;
  private fixed: number | null = null;
  private fps = 60;
  private gpu: number | null = null;
  private ext: unknown;
  private query: WebGLQuery | null = null;
  private pending: WebGLQuery | null = null;
  private tuneAt = 0;
  private load = 0;
  private loadN = 0;
  private trace: number[] | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private family: string,
  ) {
    THREE.ColorManagement.enabled = false;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = false;
    this.gl = this.renderer.getContext() as WebGL2RenderingContext;
    this.ext = this.gl.getExtension("EXT_disjoint_timer_query_webgl2");

    this.textCanvas.width = 2048;
    this.textCanvas.height = 512;
    this.textTex = new THREE.CanvasTexture(this.textCanvas);
    this.textTex.minFilter = THREE.LinearMipmapLinearFilter;
    this.textTex.magFilter = THREE.LinearFilter;
    this.textTex.generateMipmaps = true;
    this.textTex.anisotropy = 4;

    const v3 = () => [0, 1, 2].map(() => new THREE.Vector3());
    const v4 = (n = NB) => Array.from({ length: n }, () => new THREE.Vector4());
    this.u = {
      uRes: { value: new THREE.Vector2(2, 2) },
      uTime: { value: 0 },
      uCamPos: { value: this.camPos },
      uCamRot: { value: new THREE.Matrix3() },
      uFocal: { value: 1 },
      uShape: { value: this.shapeTex },
      uWarp: { value: this.warpTex },
      uText: { value: this.textTex },
      uBPos: { value: v3() },
      uBRot: { value: v4() },
      uBBand: { value: v4() },
      uBCore: { value: v4() },
      uBGlass: { value: v4() },
      uBInkA: { value: v3() },
      uBInkB: { value: v3() },
      uBSat: { value: v4(NB * 4) },
      uPlay: { value: new THREE.Vector4() },
      uHover: { value: new THREE.Vector4() },
      uFocus: { value: 0 },
      uInk: { value: this.ink },
      uMoon: { value: new THREE.Vector3(-0.36, 0.155, -0.92).normalize() },
      uKey: { value: new THREE.Vector3(-0.55, 0.6, 0.58).normalize() },
      uRim: { value: new THREE.Vector3(0.75, 0.25, -0.6).normalize() },
      uAudio: { value: new THREE.Vector4() },
      uAccent: { value: new THREE.Vector4() },
      uRings: { value: [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3(0, 0, -1)) },
      uSea: { value: new THREE.Vector4(0.015, 3, 0.004, 0.8) },
      uCursor: { value: new THREE.Vector4() },
      uGlow: { value: 1 },
      uJet: { value: 0 },
      uTextRect: { value: new THREE.Vector4(-8, 0, -0.3, 1.2) },
      uTextAt: { value: new THREE.Vector3(-6.5, 0, 0.3) },
      uSteps: { value: 64 },
      uDetail: { value: 1 },
      uIor: { value: 1.48 },
      uIrid: { value: 0.32 },
    };
    this.post = {
      uSrc: { value: null },
      uAdd: { value: null },
      uOut: { value: new THREE.Vector2(2, 2) },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uKnee: { value: 0 },
      uSpread: { value: 0.9 },
      uLightUv: { value: new THREE.Vector3(0.5, 0.5, 0) },
      uScene: { value: null },
      uBloom: { value: null },
      uRays: { value: null },
      uRayCol: { value: new THREE.Vector3(1, 1, 1) },
      uInk: { value: this.ink },
      uCur: { value: new THREE.Vector4(0.5, 0.5, 0, 0) },
      uExposure: { value: 1.15 },
      uBloomAmt: { value: 0.075 },
      uTime: { value: 0 },
      uFade: { value: 0 },
    };

    this.scene = pass(sceneSrc, this.u);
    this.down = pass(downSrc, this.post);
    this.up = pass(upSrc, this.post);
    this.rays = pass(raysSrc, this.post);
    this.final = pass(finalSrc, this.post);
    this.mesh = new THREE.Mesh(triangle(), this.scene);
    this.mesh.frustumCulled = false;
    this.stage.add(this.mesh);
    this.resize(window.innerWidth, window.innerHeight);
  }

  get stats(): WorldStats {
    return {
      fps: this.fps,
      gpu: this.gpu,
      width: Math.round(this.fullW * this.scale),
      height: Math.round(this.fullH * this.scale),
      scale: this.scale,
    };
  }

  resize(w: number, h: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    this.cssW = Math.max(1, w);
    this.cssH = Math.max(1, h);
    this.fullW = Math.round(this.cssW * dpr);
    this.fullH = Math.round(this.cssH * dpr);
    this.renderer.setSize(this.fullW, this.fullH, false);
    this.allocate();
  }

  private setScale(s: number) {
    const v = clamp(s, 0.3, 1);
    if (Math.abs(v - this.scale) < 0.02) return;
    this.scale = v;
    this.allocate();
  }

  private allocate() {
    const w = Math.round(this.fullW * this.scale);
    const h = Math.round(this.fullH * this.scale);
    this.rtScene.setSize(w, h);
    this.rtRays.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    for (let i = 0; i < LEVELS; i++) {
      const dw = Math.max(2, w >> (i + 1));
      const dh = Math.max(2, h >> (i + 1));
      if (!this.rtDown[i]) {
        this.rtDown[i] = target(dw, dh);
        this.rtUp[i] = target(dw, dh);
      } else {
        this.rtDown[i].setSize(dw, dh);
        this.rtUp[i].setSize(dw, dh);
      }
    }
  }

  private bake(slot: number, album: number, m: AlbumMorphology, focus: WorldFocus | null) {
    const s = this.slots[slot];
    const band = profileOf(m, focus ? focus.sel : -1, focus ? focus.active : -1, focus ? focus.field : null, this.profile, 1);
    const data = this.shapeTex.image.data as Uint16Array;
    const at = slot * ROW * 2;
    for (let i = 0; i < ROW * 2; i++) data[at + i] = half(this.profile[i]);
    this.shapeTex.needsUpdate = true;
    if (s.album !== album || s.morph !== m) {
      const warp = this.warpTex.image.data as Uint16Array;
      const wa = slot * ROW;
      for (let i = 0; i < N; i++) {
        const turn = (i + 0.5) / N;
        warp[wa + i * 4] = half(lobeAt(m, turn));
        warp[wa + i * 4 + 1] = 0;
        warp[wa + i * 4 + 2] = 0;
        warp[wa + i * 4 + 3] = half(lobeAt(m, turn + 0.25));
      }
      this.warpTex.needsUpdate = true;
    }
    s.album = album;
    s.morph = m;
    s.lo = band.lo;
    s.hi = band.hi;
    s.radius = 1.3 * m.circuit;
    s.tilt = Math.acos(clamp(m.flatten, 0.2, 0.98));
    s.y = s.radius * band.hi * m.flatten + 0.34;
  }

  private async writeText(album: number) {
    const a = ALBUMS[album];
    if (!a) return;
    const weight = fieldConstantsOf(a.signature).artistWeight;
    const text = a.artist;
    const font = (px: number) => `${Math.round(weight)} ${px}px ${this.family}`;
    await document.fonts.load(font(200), text).catch(() => undefined);
    if (this.textWant !== album) return;
    const c = this.textCanvas;
    const x = c.getContext("2d")!;
    x.fillStyle = "#000";
    x.fillRect(0, 0, c.width, c.height);
    let px = 330;
    x.font = font(px);
    const wide = x.measureText(text).width;
    if (wide > c.width - 40) px = Math.floor((px * (c.width - 40)) / wide);
    x.font = font(px);
    const w = x.measureText(text).width;
    x.fillStyle = "#fff";
    x.textBaseline = "alphabetic";
    x.fillText(text, c.width - 20 - w, c.height * 0.8);
    this.textTex.needsUpdate = true;
    const height = clamp((6.6 * c.height) / (w + 40), 0.8, 1.7);
    const width = (height * c.width) / c.height;
    const right = 0.4;
    (this.u.uTextRect.value as THREE.Vector4).set(right - width, right, -0.2 * height, 0.8 * height);
    this.textAlb = album;
  }

  private place(slot: number, nav: number, spread: number): THREE.Vector3 {
    const s = this.slots[slot];
    const d = s.album - nav;
    const sink = (1 - ease(s.k)) * (s.y + s.radius * 1.4);
    const bob = Math.sin(this.time * 0.6 + s.album * 1.7) * 0.012;
    return new THREE.Vector3(d * SPACING * spread, s.y - sink + bob, -Math.abs(d) * RECEDE * spread);
  }

  private rigs(focus: Slot, portrait: boolean): [Rig, Rig, Rig] {
    const y = focus.y;
    const side = portrait ? 0 : 1;
    const drop = portrait ? 0.7 : 0;
    const a = RING.anchor;
    const rm = (focus.lo + focus.hi) * 0.5 * focus.radius;
    const sa = Math.sin(focus.tilt);
    const ca = Math.cos(focus.tilt);
    const at = new THREE.Vector3(Math.cos(a) * rm, y - Math.sin(a) * rm * ca, Math.sin(a) * rm * sa);
    return [
      { target: new THREE.Vector3(-0.36 * side, y * 0.8 - drop, 0), az: 0.05, el: -0.05, dist: 7.9, fov: 27 },
      { target: new THREE.Vector3(-0.42 * side, y - 0.08 - drop * 0.6, 0), az: 0.16, el: focus.tilt * 0.62, dist: 5.9, fov: 32 },
      { target: at.lerp(new THREE.Vector3(0, y, 0), 0.45), az: 0.34, el: focus.tilt * 0.8, dist: 3.9, fov: 35 },
    ];
  }

  frame(dt: number, view: WorldView) {
    const now = performance.now();
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    this.step(dt, view);

    const gl = this.gl;
    if (this.pending && gl.getQueryParameter(this.pending, gl.QUERY_RESULT_AVAILABLE)) {
      if (!gl.getParameter(GPU_DISJOINT)) {
        const ms = (gl.getQueryParameter(this.pending, gl.QUERY_RESULT) as number) / 1e6;
        this.gpu = this.gpu === null ? ms : this.gpu + (ms - this.gpu) * 0.15;
        this.load += ms;
        this.loadN++;
        this.trace?.push(ms);
      }
      gl.deleteQuery(this.pending);
      this.pending = null;
    }
    const timed = !!this.ext && !this.pending;
    if (timed) {
      this.query = gl.createQuery();
      if (this.query) gl.beginQuery(TIME_ELAPSED, this.query);
    }
    this.render();
    if (timed && this.query) {
      gl.endQuery(TIME_ELAPSED);
      this.pending = this.query;
      this.query = null;
    }
    if (!this.ext) {
      this.load += dt * 1000;
      this.loadN++;
    }
    this.tune(now);
  }

  private tune(now: number) {
    if (now - this.tuneAt < 700) return;
    this.tuneAt = now;
    const ms = this.loadN ? this.load / this.loadN : 0;
    this.load = 0;
    this.loadN = 0;
    if (this.fixed !== null || !ms) return;
    if (this.ext) {
      if (ms > 11) this.setScale(this.scale * clamp(Math.sqrt(9.5 / ms), 0.7, 0.95));
      else if (ms < 6.5) this.setScale(this.scale * 1.08);
    } else if (ms > 19.5) this.setScale(this.scale * 0.88);
    else if (ms < 17.2) this.setScale(this.scale * 1.04);
  }

  private step(dt: number, view: WorldView) {
    const s = view.st;
    const u = this.u;
    this.time += dt;
    this.scaleNow = s.scale;
    this.alb = s.alb;
    const inside = s.scale !== "collection";
    const k1 = ease(clamp(s.fadeSel, 0, 1));
    const k2 = ease(clamp(s.play, 0, 1));
    const count = ALBUMS.length;
    const centre = clamp(Math.round(inside ? s.alb : s.nav), 0, count - 1);
    const focusSlot = centre % NB;

    for (let i = 0; i < NB; i++) {
      const slot = this.slots[i];
      let want = -1;
      for (let a = centre - 1; a <= centre + 1; a++) {
        if (a >= 0 && a < count && a % NB === i) want = a;
      }
      const isFocus = want === centre && inside;
      const m = want < 0 ? null : isFocus ? view.focus.morph : view.morph(want);
      const key = !m
        ? ""
        : isFocus
          ? `${want}:${view.focus.version}:${view.focus.sel}:${view.focus.active}:${view.focus.strain}`
          : `${want}`;
      if (want !== slot.album) {
        slot.k = slot.album < 0 ? 0 : Math.max(0, slot.k - dt / 0.5);
        if (slot.k === 0) {
          slot.album = -1;
          slot.key = "";
          if (m && want >= 0) {
            this.bake(i, want, m, isFocus ? view.focus : null);
            slot.key = key;
          }
        }
      } else if (want >= 0 && m) {
        slot.k = Math.min(1, slot.k + dt / (view.reduced ? 0.2 : 1.1));
        if (key !== slot.key) {
          this.bake(i, want, m, isFocus ? view.focus : null);
          slot.key = key;
        }
      }
    }

    const focus = this.slots[focusSlot];
    const album = ALBUMS[centre];
    if (album) {
      const t = 1 - Math.exp(-dt * 3);
      this.ink.x += (srgb(album.inkA[0]) - this.ink.x) * t;
      this.ink.y += (srgb(album.inkA[1]) - this.ink.y) * t;
      this.ink.z += (srgb(album.inkA[2]) - this.ink.z) * t;
      const sig = album.signature;
      const sea = u.uSea.value as THREE.Vector4;
      const st = 1 - Math.exp(-dt * 1.5);
      sea.x += (lerp(0.004, 0.013, sig.dynamics) - sea.x) * st;
      sea.y += (lerp(4.4, 2, sig.pulse) - sea.y) * st;
      sea.z += (lerp(0.001, 0.0045, sig.brightness) - sea.z) * st;
      sea.w += (lerp(0.45, 1.1, sig.pulse) - sea.w) * st;
    }
    if (view.reduced) (u.uSea.value as THREE.Vector4).w = 0;

    if (this.textWant !== centre) {
      this.textWant = centre;
      void this.writeText(centre);
    }
    const textOn = this.textAlb === centre ? 1 : 0;
    this.textK += (textOn - this.textK) * (1 - Math.exp(-dt * (textOn ? 4 : 10)));

    const a = view.audio;
    const live = s.mode === "playing" || s.mode === "fusion" ? 1 : 0;
    const gain = view.cap / 0.2;
    const bass = live ? a.accent.bass : 0;
    const lightK = view.routing.light * gain;
    const origin = this.place(focusSlot, inside ? s.alb : s.nav, 1 + 2.4 * k1);

    if (!view.reduced) {
      if (live) {
        const open = bass > 0.42;
        if (open && !this.ringGate && this.time - this.ringAt > 0.16) this.emit(origin.x, origin.z);
        this.ringGate = open;
      } else if (view.breath.mass > 0.5 && this.time - this.ringAt > 2.4) {
        this.emit(origin.x, origin.z);
      }
      if (s.waveR >= 0 && this.waveWas < 0) {
        this.emit(origin.x, origin.z);
        this.emit(origin.x, origin.z);
      }
    }
    this.waveWas = s.waveR;

    (u.uAudio.value as THREE.Vector4).set(a.bass, a.mid, a.treb, a.flux);
    (u.uAccent.value as THREE.Vector4).set(bass, live ? a.accent.mid : 0, live ? a.accent.treb : 0, live ? a.energy : view.breath.light * 0.25);
    u.uTime.value = this.time;
    u.uJet.value = s.jet;
    u.uGlow.value = 1 + (a.flux * 0.5 + Math.max(0, a.accent.treb) * 0.3) * lightK * live + 0.2 * view.breath.light;
    u.uFocus.value = focusSlot;

    const pos = u.uBPos.value as THREE.Vector3[];
    const rot = u.uBRot.value as THREE.Vector4[];
    const band = u.uBBand.value as THREE.Vector4[];
    const core = u.uBCore.value as THREE.Vector4[];
    const glass = u.uBGlass.value as THREE.Vector4[];
    const inkA = u.uBInkA.value as THREE.Vector3[];
    const inkB = u.uBInkB.value as THREE.Vector3[];
    const sats = u.uBSat.value as THREE.Vector4[];
    const mass = clamp(Math.pow(s.m0k / 0.088, 0.7), 0.5, 2.6);

    for (let i = 0; i < NB; i++) {
      const slot = this.slots[i];
      const m = slot.morph;
      const alb = ALBUMS[slot.album];
      if (!m || !alb || slot.k <= 0.001) {
        rot[i].set(0, 1, 1, 0);
        for (let j = 0; j < 4; j++) sats[i * 4 + j].set(0, 0, 0, 0);
        continue;
      }
      const isFocus = i === focusSlot;
      pos[i].copy(this.place(i, inside ? s.alb : s.nav, 1 + 2.4 * k1));
      rot[i].set(Math.sin(slot.tilt), Math.cos(slot.tilt), slot.radius, ease(slot.k));
      const flex = isFocus ? 1 + bass * view.cap * 1.6 * view.routing.mass + 0.06 * view.breath.mass : 1;
      const amp = (0.1 + 0.42 * m.relief) * flex;
      const bank = 0.3 + 0.6 * m.strata;
      const thick = 0.044;
      band[i].set(slot.lo, slot.hi, thick, thick + amp * 1.05 + bank * (slot.hi - slot.lo) * 0.5 + 0.02);
      const k = fieldConstantsOf(alb.signature);
      core[i].set(m.eccX, m.eccY, m.coreRatio * 0.9, 0.07 * k.massScale * (isFocus ? mass : 1));
      const spin = isFocus && inside ? s.ringRot / TAU : RING.anchor / TAU;
      glass[i].set(amp, bank, spin, ease(slot.k) * (isFocus ? (u.uGlow.value as number) : 1));
      inkA[i].set(srgb(alb.inkA[0]), srgb(alb.inkA[1]), srgb(alb.inkA[2]));
      inkB[i].set(srgb(alb.inkB[0]), srgb(alb.inkB[1]), srgb(alb.inkB[2]));
      const drift = view.reduced ? 0 : this.time * 0.045 * k.swirl;
      m.satellites.forEach((sat, j) => {
        if (j > 3) return;
        if (sat.weight <= 0.02) {
          sats[i * 4 + j].set(0, 0, 0, 0);
          return;
        }
        const ang = sat.angle + (j % 2 === 0 ? 1 : -0.6) * drift / (1 + j * 0.5);
        sats[i * 4 + j].set(Math.cos(ang) * sat.dist, Math.sin(ang) * sat.dist, satRadiusOf(m, sat), sat.dist);
      });
    }

    const fm = focus.morph;
    if (fm && inside) {
      const b = fm.bounds;
      const lit = s.playAlb === s.alb && (s.mode === "playing" || s.mode === "paused" || s.mode === "fusion") ? 1 : 0;
      const trk = clamp(s.trk, 0, b.length - 2);
      const head = (((RING.anchor - s.ringRot) / TAU) % 1 + 1) % 1;
      (u.uPlay.value as THREE.Vector4).set(head, b[trk], b[trk + 1], lit * k1);
      const hv = s.hover >= 0 && s.hover < b.length - 1 ? s.hover : -1;
      if (hv >= 0) this.hoverRange = [b[hv], b[hv + 1]];
      this.hoverK += ((hv >= 0 ? 1 : 0) - this.hoverK) * (1 - Math.exp(-dt * 10));
      (u.uHover.value as THREE.Vector4).set(this.hoverRange[0], this.hoverRange[1], this.hoverK, 0);
    } else {
      (u.uPlay.value as THREE.Vector4).set(0, 0, 0, 0);
      (u.uHover.value as THREE.Vector4).set(0, 0, 0, 0);
    }

    const portrait = this.cssW / this.cssH < 1;
    const [r0, r1, r2] = this.rigs(focus, portrait);
    const rig = mixRig(mixRig(r0, r1, k1), r2, k2);
    const push = inside ? Math.sin(Math.PI * clamp(s.fadeSel, 0, 1)) : 0;
    const o = this.orbit;
    if (!o.held) {
      const back = 1 - Math.exp(-dt * 2.5);
      o.az -= o.az * back;
      o.el -= o.el * back;
      o.zoom -= o.zoom * back;
    }
    this.pointer.lerp(new THREE.Vector2(view.mouse.x * 2 - 1, 1 - view.mouse.y * 2), 1 - Math.exp(-dt * 3));
    const still = view.reduced ? 0 : 1;
    const az = rig.az + o.az + still * (Math.sin(this.time * 0.11) * 0.06 + this.pointer.x * 0.06);
    const el = clamp(rig.el + o.el + still * (Math.sin(this.time * 0.17) * 0.006 + this.pointer.y * 0.02), -0.2, 1.45);
    const dist = rig.dist * (1 - 0.07 * push) * Math.exp(-o.zoom);
    this.camPos.set(
      rig.target.x + dist * Math.sin(az) * Math.cos(el),
      Math.max(0.12, rig.target.y + dist * Math.sin(el)),
      rig.target.z + dist * Math.cos(az) * Math.cos(el),
    );
    this.camF.copy(rig.target).sub(this.camPos).normalize();
    this.camR.crossVectors(this.camF, UP).normalize();
    this.camU.crossVectors(this.camR, this.camF);
    (u.uCamRot.value as THREE.Matrix3).set(
      this.camR.x, this.camU.x, this.camF.x,
      this.camR.y, this.camU.y, this.camF.y,
      this.camR.z, this.camU.z, this.camF.z,
    );
    this.focal = Math.min(1, this.cssW / this.cssH / 0.85) / Math.tan((rig.fov * Math.PI) / 360);
    u.uFocal.value = this.focal;

    (u.uKey.value as THREE.Vector3)
      .set(-0.55, 0.6, 0.58)
      .multiplyScalar(0.55)
      .addScaledVector(this.camR, -0.3)
      .addScaledVector(this.camU, 0.3)
      .addScaledVector(this.camF, -0.3)
      .normalize();

    const ray = this.rayAt(view.mouse.x, view.mouse.y);
    const cur = u.uCursor.value as THREE.Vector4;
    if (ray.y < -0.01 && !view.mouse.onUi && !view.reduced && !view.coarse) {
      const t = -this.camPos.y / ray.y;
      cur.set(this.camPos.x + ray.x * t, this.camPos.z + ray.z * t, t < 40 ? 0.0028 : 0, 0);
    } else cur.z = 0;
    (this.post.uCur.value as THREE.Vector4).set(view.mouse.x, 1 - view.mouse.y, view.reach, view.coarse || view.mouse.onUi ? 0 : 1);

    (u.uTextAt.value as THREE.Vector3).set(-6.5, portrait ? 0 : 0.2 * this.textK * (1 - 0.55 * k1), 0.25);
    this.post.uFade.value = clamp(s.fade, 0, 1.2);
    const tier = this.scale < 0.55 ? 0 : 1;
    u.uSteps.value = tier ? 72 : 48;
    u.uDetail.value = tier ? 1 : 0.6;
  }

  private emit(x: number, z: number) {
    const rings = this.u.uRings.value as THREE.Vector3[];
    rings[this.ring].set(x, z, this.time);
    this.ring = (this.ring + 1) % rings.length;
    this.ringAt = this.time;
  }

  private rayAt(nx: number, ny: number): THREE.Vector3 {
    const x = (nx * 2 - 1) * (this.cssW / this.cssH);
    const y = 1 - ny * 2;
    return new THREE.Vector3()
      .addScaledVector(this.camR, x)
      .addScaledVector(this.camU, y)
      .addScaledVector(this.camF, this.focal)
      .normalize();
  }

  private project(w: THREE.Vector3): { x: number; y: number; z: number } {
    const d = w.clone().sub(this.camPos);
    const z = d.dot(this.camF);
    const px = ((d.dot(this.camR) / z) * this.focal) / (this.cssW / this.cssH);
    const py = (d.dot(this.camU) / z) * this.focal;
    return { x: (px * 0.5 + 0.5) * this.cssW, y: (0.5 - py * 0.5) * this.cssH, z };
  }

  private local(slot: number, x: number, z: number): THREE.Vector3 {
    const s = this.slots[slot];
    const p = (this.u.uBPos.value as THREE.Vector3[])[slot];
    const sa = Math.sin(s.tilt);
    const ca = Math.cos(s.tilt);
    return new THREE.Vector3(p.x + x * s.radius, p.y - z * ca * s.radius, p.z + z * sa * s.radius);
  }

  hit(nx: number, ny: number): Hit {
    const rd = this.rayAt(nx, ny);
    if (this.scaleNow === "collection") {
      let best: Hit = { kind: "empty", i: -1 };
      let near = Infinity;
      for (let i = 0; i < NB; i++) {
        const s = this.slots[i];
        if (s.album < 0 || s.k < 0.5) continue;
        const c = (this.u.uBPos.value as THREE.Vector3[])[i].clone().sub(this.camPos);
        const along = c.dot(rd);
        if (along <= 0) continue;
        const miss = c.addScaledVector(rd, -along).length();
        if (miss < s.radius * s.hi * 0.92 && along < near) {
          near = along;
          best = { kind: "body", i: s.album };
        }
      }
      return best;
    }
    const slot = this.alb % NB;
    const s = this.slots[slot];
    if (!s.morph || s.album !== this.alb) return { kind: "empty", i: -1 };
    const origin = (this.u.uBPos.value as THREE.Vector3[])[slot];
    const sa = Math.sin(s.tilt);
    const ca = Math.cos(s.tilt);
    const n = new THREE.Vector3(0, sa, ca);
    const denom = rd.dot(n);
    if (Math.abs(denom) < 1e-4) return { kind: "empty", i: -1 };
    const t = origin.clone().sub(this.camPos).dot(n) / denom;
    if (t <= 0) return { kind: "empty", i: -1 };
    const p = this.camPos.clone().addScaledVector(rd, t).sub(origin).divideScalar(s.radius);
    const lx = p.x;
    const lz = -p.y * ca + p.z * sa;
    const r = Math.hypot(lx, lz);
    if (r < s.lo - 0.02) return { kind: "body", i: this.alb };
    if (r > s.hi + 0.04) return { kind: "empty", i: -1 };
    const spin = (this.u.uBGlass.value as THREE.Vector4[])[slot].z;
    const turn = (((Math.atan2(lz, lx) / TAU - spin) % 1) + 1) % 1;
    const b = s.morph.bounds;
    for (let k = 0; k < b.length - 1; k++) if (turn < b[k + 1]) return { kind: "track", i: k };
    return { kind: "track", i: b.length - 2 };
  }

  sectorLabel(k: number): { x: number; y: number } | null {
    const slot = this.alb % NB;
    const s = this.slots[slot];
    if (!s.morph || s.album !== this.alb || k < 0 || k >= s.morph.bounds.length - 1) return null;
    const b = s.morph.bounds;
    const spin = (this.u.uBGlass.value as THREE.Vector4[])[slot].z;
    const a = ((b[k] + b[k + 1]) * 0.5 + spin) * TAU;
    const rr = s.hi + 0.16;
    const at = this.project(this.local(slot, Math.cos(a) * rr, Math.sin(a) * rr));
    return at.z > 0.01 ? { x: at.x, y: at.y } : null;
  }

  caption(album: number): { x: number; y: number; k: number } | null {
    const slot = album % NB;
    const s = this.slots[slot];
    if (album < 0 || s.album !== album || s.k < 0.05) return null;
    const p = (this.u.uBPos.value as THREE.Vector3[])[slot].clone();
    p.y -= s.radius * s.hi * Math.cos(s.tilt) + 0.2;
    const at = this.project(p);
    return at.z > 0.01 ? { x: at.x, y: at.y, k: ease(s.k) } : null;
  }

  private draw(material: THREE.RawShaderMaterial, rt: THREE.WebGLRenderTarget | null, w: number, h: number) {
    (this.post.uOut.value as THREE.Vector2).set(w, h);
    this.mesh.material = material;
    this.renderer.setRenderTarget(rt);
    this.renderer.render(this.stage, this.ortho);
  }

  private render() {
    const p = this.post;
    const w = this.rtScene.width;
    const h = this.rtScene.height;
    (this.u.uRes.value as THREE.Vector2).set(w, h);
    this.mesh.material = this.scene;
    this.renderer.setRenderTarget(this.rtScene);
    this.renderer.render(this.stage, this.ortho);

    const moon = this.u.uMoon.value as THREE.Vector3;
    const lz = moon.dot(this.camF);
    const on = lz > 0.05 ? 1 : 0;
    (p.uLightUv.value as THREE.Vector3).set(
      on ? ((moon.dot(this.camR) / lz) * this.focal) / (w / h) / 2 + 0.5 : 0.5,
      on ? ((moon.dot(this.camU) / lz) * this.focal) / 2 + 0.5 : 0.5,
      on * 0.16,
    );
    p.uSrc.value = this.rtScene.texture;
    this.draw(this.rays, this.rtRays, this.rtRays.width, this.rtRays.height);

    let src = this.rtScene;
    for (let i = 0; i < LEVELS; i++) {
      const dst = this.rtDown[i];
      p.uSrc.value = src.texture;
      (p.uTexel.value as THREE.Vector2).set(0.5 / src.width, 0.5 / src.height);
      p.uKnee.value = i === 0 ? 1.2 : 0;
      this.draw(this.down, dst, dst.width, dst.height);
      src = dst;
    }
    let acc = this.rtDown[LEVELS - 1];
    for (let i = LEVELS - 2; i >= 0; i--) {
      const dst = this.rtUp[i];
      p.uSrc.value = acc.texture;
      p.uAdd.value = this.rtDown[i].texture;
      (p.uTexel.value as THREE.Vector2).set(1 / acc.width, 1 / acc.height);
      this.draw(this.up, dst, dst.width, dst.height);
      acc = dst;
    }

    p.uScene.value = this.rtScene.texture;
    p.uBloom.value = acc.texture;
    p.uRays.value = this.rtRays.texture;
    (p.uRayCol.value as THREE.Vector3).copy(this.ink).lerp(new THREE.Vector3(1, 0.92, 0.8), 0.45).multiplyScalar(0.8);
    p.uTime.value = this.time;
    this.draw(this.final, null, this.fullW, this.fullH);
  }

  async bench(scales: number[], seconds = 1.6) {
    const rows: { scale: number; width: number; height: number; ms: number }[] = [];
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (const s of scales) {
      this.fixed = s;
      this.scale = clamp(s, 0.2, 1);
      this.allocate();
      await wait(400);
      this.trace = [];
      await wait(seconds * 1000);
      const t = this.trace.sort((a, b) => a - b);
      this.trace = null;
      rows.push({ scale: s, width: this.rtScene.width, height: this.rtScene.height, ms: t.length ? t[Math.floor(t.length / 2)] : -1 });
    }
    this.fixed = null;
    return rows;
  }

  dispose() {
    [this.rtScene, this.rtRays, ...this.rtDown, ...this.rtUp].forEach((t) => t.dispose());
    [this.scene, this.down, this.up, this.rays, this.final].forEach((m) => m.dispose());
    this.mesh.geometry.dispose();
    this.shapeTex.dispose();
    this.warpTex.dispose();
    this.textTex.dispose();
    this.renderer.dispose();
  }
}
