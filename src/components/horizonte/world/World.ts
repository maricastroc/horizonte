import * as THREE from "three";
import downSrc from "@/shaders/world/down.glsl";
import finalSrc from "@/shaders/world/final.glsl";
import quadSrc from "@/shaders/world/quad.vert.glsl";
import raysSrc from "@/shaders/world/rays.glsl";
import sceneSrc from "@/shaders/world/scene.glsl";
import upSrc from "@/shaders/world/up.glsl";
import { medianOf, type AnatomyPart } from "../anatomy";
import type { VisualAudioState } from "../audio/bus";
import { profileOf } from "../composition/relief";
import type { Hit } from "../composition/layout";
import { ALBUMS, chargeAt } from "../content";
import { fieldConstantsOf } from "../field";
import { clamp, lerp } from "../math";
import { lobeAt, satRadiusOf, type AlbumMorphology } from "../morphology";
import { motionQualitiesOf, type Routing } from "../motion";
import { MORPH, RELIEF, RING, SEQ } from "../tokens";
import type { FieldState } from "../types";
import { CROWN_CEILING, CROWN_NODES, Crown } from "./crown";
import { ORBIT, crownRestOf, orbitLeanOf, orbitsOf, postureOf } from "./orbits";

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
  rest: { mass: number; light: number };
  reduced: boolean;
  coarse: boolean;
  mouse: { x: number; y: number; onUi: boolean };
  reach: number;
  morph: (i: number) => AlbumMorphology;
  part: AnatomyPart | null;
  partK: number;
  pinned: AnatomyPart | null;
  focus: WorldFocus;
}

export interface WorldPresenter {
  resize(w: number, h: number): void;
  frame(dt: number, view: WorldView): void;
  hit(nx: number, ny: number): Hit;
  dispose(): void;
  grab?(): void;
  orbitBy?(dx: number, dy: number): void;
  zoomBy?(amount: number): void;
  release?(): void;
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
const SPACING = 4.9;
const NEAR = 7.5;
const SMALL = 0.5;
const BANK_CEILING = 0.5;
const PART: Partial<Record<AnatomyPart, number>> = { satellites: 1, gaps: 2, strata: 3, contour: 4, posture: 5, core: 6 };
const POSE: Partial<Record<AnatomyPart, [number, number, number]>> = {
  satellites: [0.5, 0.22, -0.28],
  gaps: [-0.25, 0.32, 0.12],
  strata: [0.6, -0.22, 0.32],
  contour: [0.05, 0.38, 0],
  posture: [1.2, -0.3, -0.05],
  core: [-0.35, -0.08, 0.45],
};
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
  hov: number;
  lip: number;
  spin: number;
  d: number;
  lean: number;
}

interface Rig {
  target: THREE.Vector3;
  az: number;
  el: number;
  dist: number;
  fov: number;
  rise: number;
  high: number;
}

const mixRig = (a: Rig, b: Rig, t: number): Rig => ({
  target: a.target.clone().lerp(b.target, t),
  az: lerp(a.az, b.az, t),
  el: lerp(a.el, b.el, t),
  dist: lerp(a.dist, b.dist, t),
  fov: lerp(a.fov, b.fov, t),
  rise: lerp(a.rise, b.rise, t),
  high: lerp(a.high, b.high, t),
});

const spread = (fov: number) => Math.tan((fov * Math.PI) / 360);

function riseFor(el: number, dist: number, fov: number, level: number, slack: number): number {
  const pitch = Math.max(Math.atan(level * spread(fov)), el - slack);
  return Math.max(0, dist * (Math.sin(el) - Math.cos(el) * Math.tan(pitch)));
}

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
  private crown = new Crown();
  private crownOut = new Float32Array(CROWN_NODES * 8);
  private crownTex = new THREE.DataTexture(new Uint16Array(CROWN_NODES * 8), CROWN_NODES, 2, THREE.RGBAFormat, THREE.HalfFloatType);
  private crownAlb = -1;
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
    hov: 0,
    lip: 1,
    spin: RING.anchor / TAU,
    d: 0,
    lean: ORBIT.lean[0],
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
  private swell = 0;
  private swellSlow = 0;
  private impact = 0;
  private shimmer = 0;
  private tension = 0;
  private warm = 0.35;
  private spinPhase = 0;
  private drift = 0;
  private dropAt = 0;
  private textFrac = 1;
  private ink2 = new THREE.Vector3(0.5, 0.3, 0.3);
  private air = { fog: 0.02, haze: 1, stars: 1, moon: 9000, az: -0.37, el: 0.155 };

  readonly orbit = { az: 0, el: 0, zoom: 0, vaz: 0, vel: 0, held: false, idle: 99, active: 0, used: false };
  private pose = { az: 0, el: 0, zoom: 0 };
  private poseK = 0;
  private navWas = 0;
  private navVel = 0;
  private dtWas = 1 / 60;
  private flash = 0;
  private fusing = false;
  private row = -1;
  private focusWas = 0;
  private seat = { y: 1, tilt: 0.6, radius: 1, lo: 0.5, hi: 1 };
  private rowVel = 0;
  private hush = 0;
  private dawn = 0;
  private seqWas = 0;
  private whirl = 0;
  private moonDrift = 0;
  private keySweep = 0;
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
  private probe: { at: number; prev: Uint8Array | null; sum: number; n: number } | null = null;
  private inspector: THREE.RawShaderMaterial | null = null;
  frozen = false;
  forced: { impact: number; wave: number; spread: number } | null = null;

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

    this.crownTex.wrapS = THREE.RepeatWrapping;
    this.crownTex.wrapT = THREE.ClampToEdgeWrapping;
    this.crownTex.minFilter = THREE.LinearFilter;
    this.crownTex.magFilter = THREE.LinearFilter;
    this.crownTex.generateMipmaps = false;
    this.crownTex.needsUpdate = true;

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
      uRing: { value: this.crownTex },
      uSpan: { value: new THREE.Vector2(0.5, 0.5) },
      uBPos: { value: v3() },
      uBRot: { value: v4() },
      uBBand: { value: v4() },
      uBCore: { value: v4() },
      uBGlass: { value: v4() },
      uBInkA: { value: v3() },
      uBInkB: { value: v3() },
      uBSat: { value: v4(NB * 4) },
      uBOrbit: { value: [0, 1, 2].map(() => new THREE.Vector2(Math.sin(ORBIT.lean[0]), Math.cos(ORBIT.lean[0]))) },
      uBMat: { value: v4() },
      uScore: { value: new THREE.Vector4() },
      uWave: { value: new THREE.Vector4(0, 3, 0, 0) },
      uPulse: { value: new THREE.Vector4(0.15, 0, 1, 0) },
      uKeyCol: { value: new THREE.Vector3(1, 0.8, 0.6) },
      uInk2: { value: this.ink2 },
      uAir: { value: new THREE.Vector4(0.02, 1, 1, 9000) },
      uReflK: { value: 0.6 },
      uPart: { value: new THREE.Vector2() },
      uSeed: { value: new THREE.Vector4() },
      uRef: { value: 0 },
      uDebug: { value: 0 },
      uBLip: { value: [1, 1, 1] },
      uBHaze: { value: [0, 0, 0] },
      uPix: { value: 0.001 },
      uPlay: { value: new THREE.Vector4() },
      uHover: { value: new THREE.Vector4() },
      uFocus: { value: 0 },
      uInk: { value: this.ink },
      uMoon: { value: new THREE.Vector3(-0.36, 0.155, -0.92).normalize() },
      uKey: { value: new THREE.Vector3(-0.55, 0.6, 0.58).normalize() },
      uRim: { value: new THREE.Vector3(0.75, 0.25, -0.6).normalize() },
      uAudio: { value: new THREE.Vector4() },
      uAccent: { value: new THREE.Vector4() },
      uRings: { value: [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector4(0, 0, -1, 0)) },
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
      uGrain: { value: 0.026 },
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
        const h = 0.5 / N;
        warp[wa + i * 4] = half(lobeAt(m, turn));
        warp[wa + i * 4 + 1] = half((lobeAt(m, turn + h) - lobeAt(m, turn - h)) / (2 * h));
        warp[wa + i * 4 + 2] = half((lobeAt(m, turn + 0.25 + h) - lobeAt(m, turn + 0.25 - h)) / (2 * h));
        warp[wa + i * 4 + 3] = half(lobeAt(m, turn + 0.25));
      }
      this.warpTex.needsUpdate = true;
    }
    let steep = 0;
    for (let i = 0; i < N; i++) {
      const j = ((i + 1) % N) * 4;
      const k = i * 4;
      if (this.profile[ROW + k + 2] <= 0 || this.profile[ROW + j + 2] <= 0) continue;
      const inner = this.profile[k];
      if (inner <= 0) continue;
      const outer = Math.max(this.profile[k + 1], this.profile[k + 3], this.profile[ROW + k + 1]);
      const outerNext = Math.max(this.profile[j + 1], this.profile[j + 3], this.profile[ROW + j + 1]);
      const rise = Math.max(Math.abs(outerNext - outer), Math.abs(this.profile[j] - inner));
      steep = Math.max(steep, (rise * N) / (TAU * inner));
    }
    s.lip = Math.sqrt(1 + Math.min(steep, 2.5) ** 2);
    if (s.album !== album) s.spin = RING.anchor / TAU;
    s.album = album;
    s.morph = m;
    s.lo = band.lo;
    s.hi = band.hi;
    s.radius = 1.3 * m.circuit;
    s.tilt = postureOf(m);
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
    x.fillText(text, 20, c.height * 0.8);
    this.textTex.needsUpdate = true;
    this.textFrac = clamp((w + 40) / c.width, 0.1, 1);
    this.textAlb = album;
  }

  private indexOf(album: number): number {
    const i = this.slots.findIndex((s) => s.album === album);
    return i < 0 ? ((album % NB) + NB) % NB : i;
  }

  private slotOf(album: number): Slot | null {
    const s = this.slots[this.indexOf(album)];
    return s.album === album && s.morph ? s : null;
  }

  private mixAt(nav: number, pick: (s: Slot) => number, fallback: number): number {
    const a = Math.floor(nav);
    const lo = this.slotOf(a);
    const hi = this.slotOf(a + 1);
    const va = lo ? pick(lo) : hi ? pick(hi) : fallback;
    const vb = hi ? pick(hi) : va;
    return lerp(va, vb, ease(nav - a));
  }

  private sizeAt(nav: number): number {
    return this.mixAt(nav, (s) => s.radius * s.hi, 1.15);
  }

  private reachOf(nav: number): number {
    return NEAR * clamp(this.sizeAt(nav) / 1.15, 0.72, 1.12);
  }

  private farOf(slot: number): number {
    return ease(clamp(this.slots[slot].d, 0, 1));
  }

  private place(slot: number, nav: number, k1: number): THREE.Vector3 {
    const s = this.slots[slot];
    const d = s.d;
    const sink = (1 - ease(s.k)) * (s.y + s.radius * 1.4);
    const bob = Math.sin(this.time * 0.6 + s.album * 1.7) * 0.012;
    const ratio = lerp(1, SMALL, this.farOf(slot)) / (1 + 0.5 * Math.max(0, d - 1));
    const reach = this.reachOf(nav);
    const back = Math.max(0, reach * ((s.radius * s.hi) / (ratio * this.sizeAt(nav)) - 1));
    const aside = ease(clamp((d - 0.2) / 0.6, 0, 1));
    return new THREE.Vector3(s.album * SPACING, s.y - sink + bob + s.hov * 0.06, -back - 2.4 * k1 * aside);
  }

  grab() {
    const o = this.orbit;
    o.held = true;
    o.vaz = 0;
    o.vel = 0;
    o.idle = 0;
  }

  orbitBy(dx: number, dy: number) {
    const o = this.orbit;
    if (!o.held) return;
    o.used = true;
    o.az -= dx * 3.4;
    o.el += dy * 2.6;
    o.vaz = clamp(o.vaz + ((-dx * 3.4) / this.dtWas - o.vaz) * 0.5, -2.4, 2.4);
    o.vel = clamp(o.vel + ((dy * 2.6) / this.dtWas - o.vel) * 0.5, -1.4, 1.4);
  }

  zoomBy(amount: number) {
    const o = this.orbit;
    o.used = true;
    o.idle = 0;
    o.zoom = clamp(o.zoom + amount, -0.5, 0.8);
  }

  release() {
    const o = this.orbit;
    if (!o.held) return;
    o.held = false;
    o.idle = 0;
  }

  recenter() {
    const o = this.orbit;
    o.idle = 99;
    o.vaz = 0;
    o.vel = 0;
  }

  get exploring() {
    const o = this.orbit;
    return { held: o.held, away: Math.abs(o.az) + Math.abs(o.el) + Math.abs(o.zoom) > 0.05 };
  }

  private rigs(focus: World["seat"], portrait: boolean, nav: number): [Rig, Rig, Rig] {
    const y = focus.y;
    const f = clamp((focus.radius * focus.hi) / 1.15, 0.72, 1.12);
    const reach = this.reachOf(nav);
    const rest = this.mixAt(nav, (s) => s.y, y);
    const aspect = this.cssW / this.cssH;
    const rail = portrait || this.cssW < 768 ? 0 : clamp(300 / this.cssW, 0, 0.26);
    const lead = ((rail * 0.5 - 0.045) * 2 * reach * aspect) / 4.165;
    const side = portrait ? 0 : 1;
    const drop = portrait ? 0.7 : 0;
    const a = RING.anchor;
    const rm = (focus.lo + focus.hi) * 0.5 * focus.radius;
    const sa = Math.sin(focus.tilt);
    const ca = Math.cos(focus.tilt);
    const at = new THREE.Vector3(Math.cos(a) * rm, y - Math.sin(a) * rm * ca, Math.sin(a) * rm * sa);
    const el1 = Math.max(0.12 + 0.2 * focus.tilt, focus.tilt - 0.62);
    const el2 = Math.max(0.1 + 0.16 * focus.tilt, focus.tilt - 0.66);
    const d1 = 5.64 * f;
    const d2 = 4.62 * f;
    return [
      { target: new THREE.Vector3(lead * side, rest * 0.8 - drop, 0), az: 0.05, el: -0.05, dist: reach, fov: 27, rise: 0, high: -0.05 },
      {
        target: new THREE.Vector3(-0.42 * side, y - 0.08 - drop * 0.6, 0),
        az: 0.16,
        el: el1,
        dist: d1,
        fov: 36,
        rise: riseFor(el1, d1, 36, 0.82, 0.055),
        high: focus.tilt * 0.62,
      },
      {
        target: at.lerp(new THREE.Vector3(-0.15 * side, y - drop * 0.5, 0), 0.74),
        az: 0.3,
        el: el2,
        dist: d2,
        fov: 38,
        rise: riseFor(el2, d2, 38, 0.75, 0.03),
        high: focus.tilt * 0.78,
      },
    ];
  }

  frame(dt: number, view: WorldView) {
    const now = performance.now();
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    this.step(this.frozen ? 0 : dt, view);
    if (this.forced) {
      const n = CROWN_NODES;
      const head = (this.u.uPlay.value as THREE.Vector4).x * n;
      for (let b = 0; b < 3; b++) {
        for (let i = 0; i < n; i++) {
          let d = Math.abs(i - head);
          if (d > n / 2) d = n - d;
          this.crown.lift[b * n + i] =
            this.forced.wave * Math.sin((TAU * 4 * i) / n + b) + this.forced.impact * CROWN_CEILING[b] * Math.exp(-(d * d) / 18);
        }
      }
      this.crown.pace.fill(0);
      this.ripple();
      (this.u.uWave.value as THREE.Vector4).w = this.forced.spread;
      (this.u.uPlay.value as THREE.Vector4).w = 1;
    }

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
    const k2 = ease(clamp(s.play, 0, 1)) * k1;
    const count = ALBUMS.length;
    const centre = clamp(Math.round(inside ? s.alb : s.nav), 0, count - 1);

    const goal = inside ? s.alb : s.nav;
    if (this.row < 0 || view.reduced || (!inside && Math.abs(goal - this.row) < 0.05)) {
      this.rowVel = dt > 0 && this.row >= 0 ? clamp((goal - this.row) / dt, -40, 40) : 0;
      this.row = goal;
    } else {
      const pull = inside ? 5.2 : 9;
      this.rowVel += (pull * pull * (goal - this.row) - 2 * pull * this.rowVel) * dt;
      this.row += this.rowVel * dt;
    }
    const row = this.row;
    const rite = s.mode === "collapse" || s.mode === "fusion" ? clamp(1 - s.fade, 0, 1) : 0;
    this.hush += (rite - this.hush) * (1 - Math.exp(-dt / 0.1));
    const hush = view.reduced ? 0 : this.hush;

    const wants: number[] = [];
    for (let a = centre - 1; a <= centre + 1; a++) {
      if (a >= 0 && a < count && (!inside || a === centre)) wants.push(a);
    }
    for (const slot of this.slots) {
      if (slot.album < 0 || wants.includes(slot.album)) continue;
      slot.k = Math.max(0, slot.k - dt / 0.6);
      if (slot.k === 0) {
        slot.album = -1;
        slot.key = "";
      }
    }
    for (const want of wants) {
      const isFocus = want === centre && inside;
      const m = isFocus ? view.focus.morph : view.morph(want);
      if (!m) continue;
      const key = isFocus
        ? `${want}:${view.focus.version}:${view.focus.sel}:${view.focus.active}:${view.focus.strain}`
        : `${want}`;
      let i = this.slots.findIndex((x) => x.album === want);
      const fresh = i < 0;
      if (fresh) {
        const own = want % NB;
        i = this.slots[own].album < 0 ? own : this.slots.findIndex((x) => x.album < 0);
        if (i < 0) continue;
      }
      const slot = this.slots[i];
      slot.k = fresh ? 0 : Math.min(1, slot.k + dt / (view.reduced ? 0.2 : 1.1));
      slot.d = Math.abs(want - row);
      if (fresh || key !== slot.key) {
        this.bake(i, want, m, isFocus ? view.focus : null);
        slot.key = key;
      }
    }
    const held = this.slots.findIndex((x) => x.album === centre);
    const focusSlot = held < 0 ? this.focusWas : held;
    this.focusWas = focusSlot;

    const focus = this.slots[focusSlot];
    const seat = this.seat;
    if (focus.morph && focus.album === centre) {
      const sk = k1 > 0 && !view.reduced ? 1 - Math.exp(-dt / 0.3) : 1;
      seat.y += (focus.y - seat.y) * sk;
      seat.tilt += (focus.tilt - seat.tilt) * sk;
      seat.radius += (focus.radius - seat.radius) * sk;
      seat.lo += (focus.lo - seat.lo) * sk;
      seat.hi += (focus.hi - seat.hi) * sk;
    }
    const album = ALBUMS[centre];
    if (album) {
      const t = 1 - Math.exp(-dt * 3);
      this.ink.x += (srgb(album.inkA[0]) - this.ink.x) * t;
      this.ink.y += (srgb(album.inkA[1]) - this.ink.y) * t;
      this.ink.z += (srgb(album.inkA[2]) - this.ink.z) * t;
      const sig = album.signature;
      const sea = u.uSea.value as THREE.Vector4;
      const st = 1 - Math.exp(-dt * 1.5);
      const lull = 1 - 0.85 * hush;
      sea.x += (lerp(0.004, 0.013, sig.dynamics) * (1 + 0.9 * this.swell) * lull - sea.x) * st;
      sea.y += (lerp(4.4, 2, sig.pulse) - sea.y) * st;
      sea.z += (lerp(0.001, 0.0045, sig.brightness) * (1 + 2.5 * this.shimmer) * lull - sea.z) * st;
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
    const calm = view.reduced ? 0 : 1;
    const gain = lerp(0.6, 1, clamp((view.cap - 0.05) / 0.15, 0, 1));
    const bass = live ? a.accent.bass : 0;
    const massK = view.routing.mass;
    const lightK = view.routing.light;
    const q = album && live ? motionQualitiesOf(album, clamp(s.trk, 0, album.tracks.length - 1)) : null;
    const sustain = q ? q.sustain : 0.4;
    const beat = q && q.beat > 0 ? q.beat : 0;
    const e = live ? a.energy : 0;
    const ke = (tau: number) => 1 - Math.exp(-dt / tau);
    this.swell += (e - this.swell) * ke(e > this.swell ? 0.9 : 2.6);
    this.swellSlow += (this.swell - this.swellSlow) * ke(5);
    this.impact *= Math.exp(-dt / lerp(0.16, 0.6, sustain));
    const treb = live ? Math.max(0, a.accent.treb) : 0;
    this.shimmer += (treb - this.shimmer) * ke(treb > this.shimmer ? 0.04 : 0.3);
    const head = ((((RING.anchor - s.ringRot) / TAU) % 1) + 1) % 1;
    const charge = album && live ? clamp(chargeAt(album.signature, head), -1, 1) : 0;
    this.tension += (charge - this.tension) * ke(2.2);
    this.warm += ((live ? a.centroid : 0.35) - this.warm) * ke(1.6);
    const origin = this.place(focusSlot, row, k1);

    if (calm) {
      if (live) {
        const open = bass > 0.42;
        if (open && !this.ringGate && this.time - this.ringAt > 0.16) {
          this.impact = Math.max(this.impact, 0.45 + 0.55 * clamp(bass, 0, 1));
          this.emit(origin.x, origin.z, (0.005 + 0.016 * clamp(bass, 0, 1)) * gain * (0.5 + 0.5 * massK));
        }
        this.ringGate = open;
        if (this.swell - e > 0.32 && this.time - this.dropAt > 3) {
          this.dropAt = this.time;
          this.emit(origin.x, origin.z, 0.022 * gain);
        }
      } else if (view.breath.mass > 0.5 && this.time - this.ringAt > 2.4) {
        this.emit(origin.x, origin.z, 0.006);
      }
      if (s.waveR >= 0 && this.waveWas < 0) this.emit(origin.x, origin.z, 0.03);
    }
    this.waveWas = s.waveR;

    const sig = album ? album.signature : null;
    if (this.crownAlb !== centre || view.reduced) {
      this.crown.settle();
      this.crownAlb = centre;
    }
    const quiet = live ? clamp(1 - this.swell / 0.35, 0, 1) : 0;
    const breathMass = view.breath.mass + view.rest.mass * quiet;
    const breathLight = view.breath.light + view.rest.light * quiet;
    const lead = inside && s.playAlb === s.alb ? 1 : 0.5;
    const reach = gain * calm * live * lead * lerp(0.6, 1, Math.sqrt(clamp(this.swell, 0, 1)));
    const tide = clamp((this.swell - this.swellSlow) / (this.swellSlow + 0.12), -1, 1);
    if (calm && quiet > 0.5 && view.rest.mass > 0.5 && this.time - this.ringAt > 2.4) this.emit(origin.x, origin.z, 0.006 * quiet);
    const lean = (x: number) => (x > 0 ? x : 0.5 * x);
    this.crown.step(dt, {
      head,
      push: [
        0.085 * lean(a.accent.bass) * (0.5 + 0.5 * massK) * reach +
          gain * calm * live * lead * (0.045 * tide + 0.02 * view.rest.mass * quiet),
        0.06 * lean(a.accent.mid) * reach,
        0.036 * lean(a.accent.treb) * lightK * reach,
      ],
      speed: beat > 0 ? clamp(1 / (beat * 4), 0.14, 0.6) : lerp(0.16, 0.42, q ? q.sharpness : 0.5),
      carry: lerp(0.16, 0.55, sustain),
      hold: live * calm,
    });
    this.ripple();
    this.spinPhase += dt * (0.25 + 1.6 * e);
    this.drift += dt * 0.11 * (1 + 1.2 * e);
    const spread = gain * calm * (0.09 * this.swell + 0.03 * Math.max(0, this.tension)) - 0.035 * hush;
    (u.uAudio.value as THREE.Vector4).set(a.bass, a.mid, a.treb, live ? a.flux : 0);
    (u.uAccent.value as THREE.Vector4).set(bass, live ? a.accent.mid : 0, treb, live ? a.energy + breathLight * 0.25 : breathLight * 0.25);
    (u.uScore.value as THREE.Vector4).set(this.swell, this.impact * gain * calm, this.shimmer * lightK, this.tension);
    (u.uWave.value as THREE.Vector4).set(0, 0, 0, spread);
    (u.uPulse.value as THREE.Vector4).set(
      0.15 + live * (1.1 * a.bass * massK + 0.7 * this.impact) + 0.3 * breathLight + 0.9 * hush,
      this.spinPhase,
      1 - 0.45 * this.swell * lightK,
      0.45 * this.shimmer * lightK,
    );
    const cool = clamp((this.warm - 0.25) / 0.5, 0, 1);
    const key = (0.9 + live * (0.55 * this.swell * lightK + 0.2 * this.impact * gain)) * (1 - 0.35 * hush) + 0.5 * this.flash;
    (u.uKeyCol.value as THREE.Vector3).set(lerp(1, 0.7, cool) * key, lerp(0.78, 0.84, cool) * key, lerp(0.58, 1, cool) * key);
    this.post.uExposure.value = 1.12 * (live ? 0.9 + 0.1 * this.swell + 0.2 * this.swellSlow : 1) * (1 + 0.15 * this.flash);
    u.uTime.value = this.time;
    u.uJet.value = s.jet;
    u.uGlow.value =
      1 + (a.flux * 0.5 + this.shimmer * 0.4) * lightK * live + 0.2 * breathLight + 0.25 * this.swell;
    u.uFocus.value = focusSlot;
    const partK = inside ? clamp(view.partK, 0, 1) : 0;
    (u.uPart.value as THREE.Vector2).set(view.part ? (PART[view.part] ?? 0) : 0, partK);
    u.uRef.value = view.part === "contour" ? 1 : view.part === "core" ? lerp(MORPH.core[0], MORPH.core[1], medianOf("loudness")) * 0.9 : 0;
    this.post.uExposure.value = (this.post.uExposure.value as number) * (1 + 0.14 * partK);

    const fusing = s.mode === "fusion";
    const seed = u.uSeed.value as THREE.Vector4;
    if (fusing && calm) {
      const f = clamp(s.seqT / 0.9, 0, 1);
      const rr = 2.3 * (1 - ease(f));
      const ang = RING.anchor + f * 7.5;
      seed.set(Math.cos(ang) * rr, Math.sin(ang) * rr, f < 1 ? 0.12 * (1 - 0.6 * f * f) : 0, 1);
      if (f >= 1 && this.fusing) {
        this.flash = 1;
        this.fusing = false;
      }
      if (f < 1) this.fusing = true;
    } else {
      seed.set(0, 0, 0, 0);
      this.fusing = false;
    }
    if (s.mode === "collapse" && calm && this.seqWas < SEQ.collapse.valleyEnd && s.seqT >= SEQ.collapse.valleyEnd) {
      this.flash = 1;
      this.emit(origin.x, origin.z, 0.03);
    }
    this.seqWas = s.mode === "collapse" ? s.seqT : 0;
    this.flash *= Math.exp(-dt / 0.5);
    (u.uPulse.value as THREE.Vector4).x += 1.6 * this.flash;

    if (album && sig) {
      const t = ke(0.9);
      this.ink2.x += (srgb(album.inkB[0]) - this.ink2.x) * t;
      this.ink2.y += (srgb(album.inkB[1]) - this.ink2.y) * t;
      this.ink2.z += (srgb(album.inkB[2]) - this.ink2.z) * t;
      const air = this.air;
      air.fog += (lerp(0.032, 0.014, sig.brightness) - air.fog) * t;
      air.haze += (lerp(1.5, 0.8, sig.brightness) * (0.8 + 0.5 * sig.loudness) - air.haze) * t;
      air.stars += (lerp(0.25, 1.25, sig.brightness) * (1 - 0.5 * sig.loudness) - air.stars) * t;
      air.moon += (lerp(3200, 13000, sig.brightness) - air.moon) * t;
      air.az += (lerp(-0.52, -0.2, sig.duration) - air.az) * t;
      air.el += (lerp(0.11, 0.26, sig.brightness) - air.el) * t;
      const mood = live * this.tension;
      (u.uAir.value as THREE.Vector4).set(air.fog * (1 + 0.3 * mood), air.haze * (1 + 0.4 * mood), air.stars * (1 - 0.35 * mood), air.moon);
      const drift = live && s.dur ? (clamp(s.pos / s.dur, 0, 1) - 0.5) * 0.24 : 0;
      this.moonDrift += (drift - this.moonDrift) * ke(2.5);
      const az = air.az + this.moonDrift;
      (u.uMoon.value as THREE.Vector3).set(Math.sin(az) * Math.cos(air.el), Math.sin(air.el), -Math.cos(az) * Math.cos(air.el));
    }

    const pos = u.uBPos.value as THREE.Vector3[];
    const rot = u.uBRot.value as THREE.Vector4[];
    const band = u.uBBand.value as THREE.Vector4[];
    const core = u.uBCore.value as THREE.Vector4[];
    const glass = u.uBGlass.value as THREE.Vector4[];
    const inkA = u.uBInkA.value as THREE.Vector3[];
    const inkB = u.uBInkB.value as THREE.Vector3[];
    const sats = u.uBSat.value as THREE.Vector4[];
    const mats = u.uBMat.value as THREE.Vector4[];
    const mass = clamp(Math.pow(s.m0k / 0.088, 0.7), 0.5, 2.6);
    this.whirl += dt * 0.045 * (1 + 9 * hush);

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
      const want = s.hoverBody === slot.album && !isFocus && !inside ? 1 : 0;
      slot.hov += (want - slot.hov) * ke(0.16);
      pos[i].copy(this.place(i, row, k1));
      rot[i].set(Math.sin(slot.tilt), Math.cos(slot.tilt), slot.radius, ease(slot.k));
      (u.uBLip.value as number[])[i] = slot.lip;
      const far = this.farOf(i);
      (u.uBHaze.value as number[])[i] = 0.4 * far * (1 - 0.5 * slot.hov);
      const flex = isFocus ? 1 + gain * 0.2 * this.swell + 0.06 * breathMass : 1;
      const amp = (0.1 + 0.42 * m.relief) * flex;
      const lean = BANK_CEILING * Math.tanh((0.3 + 0.6 * m.strata) / BANK_CEILING);
      const bank = lean * (isFocus ? 1 + 0.5 * this.shimmer * lightK * calm : 1);
      const thick = 0.044;
      const loose = isFocus ? CROWN_CEILING[0] + 0.03 : 0;
      band[i].set(slot.lo, slot.hi + (isFocus ? spread + 0.06 : 0), thick, thick + amp * 1.05 + bank * (slot.hi - slot.lo) * 0.5 + 0.02 + loose);
      const sg = alb.signature;
      mats[i].set(
        lerp(0.25, 1, sg.brightness),
        lerp(0.35, 1, sg.loudness),
        Math.round(m.strata * 3),
        clamp((sg.loudness - 0.55) * 2.2, 0, 1) * clamp((sg.brightness - 0.3) * 2, 0, 1),
      );
      const k = fieldConstantsOf(alb.signature);
      core[i].set(m.eccX, m.eccY, m.coreRatio * 0.9, 0.07 * k.massScale * (isFocus ? mass : 1));
      if (slot.album === s.alb) slot.spin = s.ringRot / TAU;
      else {
        const turn = RING.anchor / TAU - slot.spin;
        slot.spin += (turn - Math.round(turn)) * (view.reduced ? 1 : ke(0.25));
      }
      const side = (1 + 0.6 * slot.hov) * (1 - 0.55 * k1) * (1 - 0.35 * far);
      const own = lerp(side, u.uGlow.value as number, 1 - far) * (isFocus ? 1 - 0.8 * hush : 1);
      glass[i].set(amp, bank, slot.spin, ease(slot.k) * own);
      inkA[i].set(srgb(alb.inkA[0]), srgb(alb.inkA[1]), srgb(alb.inkA[2]));
      inkB[i].set(srgb(alb.inkB[0]), srgb(alb.inkB[1]), srgb(alb.inkB[2]));
      const drift = view.reduced ? 0 : this.whirl * k.swirl;
      slot.lean = orbitLeanOf(m);
      (u.uBOrbit.value as THREE.Vector2[])[i].set(Math.sin(slot.lean), Math.cos(slot.lean));
      const orbit = orbitsOf(m, Math.max(crownRestOf(m), slot.hi) + (isFocus ? Math.max(0, spread) : 0), slot.lean);
      m.satellites.forEach((sat, j) => {
        if (j > 3) return;
        if (sat.weight <= 0.02) {
          sats[i * 4 + j].set(0, 0, 0, 0);
          return;
        }
        const ang = sat.angle + (j % 2 === 0 ? 1 : -0.6) * drift / (1 + j * 0.5);
        sats[i * 4 + j].set(Math.cos(ang) * orbit[j], Math.sin(ang) * orbit[j], satRadiusOf(m, sat), orbit[j]);
      });
    }

    (u.uSpan.value as THREE.Vector2).set(focus.lo, Math.max(0.12, focus.hi - focus.lo));
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
    const [r0, r1, r2] = this.rigs(seat, portrait, row);
    const rig = mixRig(mixRig(r0, r1, k1), r2, k2);
    const push = inside ? Math.sin(Math.PI * clamp(s.fadeSel, 0, 1)) : 0;
    const navNow = row;
    this.dtWas = Math.max(dt, 1 / 240);
    this.navVel += (clamp((navNow - this.navWas) / this.dtWas, -3, 3) - this.navVel) * ke(0.25);
    this.navWas = navNow;
    rig.target.x += navNow * SPACING;

    const o = this.orbit;
    const quick = view.reduced;
    if (!inside) {
      o.held = false;
      o.idle = 99;
    }
    if (!o.held) {
      if (quick) {
        o.vaz = 0;
        o.vel = 0;
      }
      o.az += o.vaz * dt;
      o.el += o.vel * dt;
      const damp = Math.exp(-dt * 3.4);
      o.vaz *= damp;
      o.vel *= damp;
      o.idle += dt;
      if (o.idle > (quick ? 50 : 6.5)) {
        const back = 1 - Math.exp(-dt * (quick ? 9 : 1.7));
        o.az = Math.atan2(Math.sin(o.az), Math.cos(o.az));
        o.az -= o.az * back;
        o.el -= o.el * back;
        o.zoom -= o.zoom * back;
      }
    }
    const want = view.pinned && inside ? POSE[view.pinned] : undefined;
    const pk = want ? 1 : 0;
    const pt = ke(quick ? 0.05 : 0.5);
    this.pose.az += ((want ? want[0] : 0) * pk - this.pose.az) * pt;
    this.pose.el += ((want ? want[1] : 0) * pk - this.pose.el) * pt;
    this.pose.zoom += ((want ? want[2] : 0) * pk - this.pose.zoom) * pt;
    this.poseK += (pk - this.poseK) * pt;
    const level = lerp(rig.el, rig.high, this.poseK);
    o.el = clamp(o.el, -level - this.pose.el - 0.1, 1.42 - level - this.pose.el);
    const away = o.held || Math.abs(o.az) + Math.abs(o.el) + Math.abs(o.zoom) > 0.05 ? 1 : 0;
    o.active += (away - o.active) * ke(0.35);

    this.pointer.lerp(new THREE.Vector2(view.mouse.x * 2 - 1, 1 - view.mouse.y * 2), 1 - Math.exp(-dt * 3));
    const still = (view.reduced ? 0 : 1) * (1 - o.active) * (1 - 0.8 * this.poseK);
    const az =
      rig.az + o.az + this.pose.az + still * (Math.sin(this.drift) * 0.06 + this.pointer.x * 0.06) - 0.07 * this.navVel * (1 - 0.5 * k1);
    const el = clamp(
      level + o.el + this.pose.el + still * (Math.sin(this.time * 0.17) * 0.006 + this.pointer.y * 0.02 + 0.025 * this.tension * k2),
      -0.2,
      1.45,
    );
    const dist =
      rig.dist *
      (1 - 0.07 * push) *
      (1 - 0.05 * this.swellSlow * still) *
      (1 + 0.06 * Math.min(Math.abs(this.navVel), 1.5) * (1 - 0.4 * k1)) *
      (1 - 0.035 * hush) *
      Math.exp(-o.zoom - this.pose.zoom);
    const heart = new THREE.Vector3(navNow * SPACING, seat.y, 0);
    if (inside) rig.target.lerp(heart, clamp(o.active * 0.85 + this.poseK * 0.7, 0, 1) * k1);
    this.camPos.set(
      rig.target.x + dist * Math.sin(az) * Math.cos(el),
      Math.max(0.12, rig.target.y + dist * Math.sin(el)),
      rig.target.z + dist * Math.cos(az) * Math.cos(el),
    );
    const lookUp = rig.rise * (1 - o.active) * (1 - this.poseK);
    this.camF.copy(rig.target).addScaledVector(UP, lookUp).sub(this.camPos).normalize();
    this.camR.crossVectors(this.camF, UP).normalize();
    this.camU.crossVectors(this.camR, this.camF);
    (u.uCamRot.value as THREE.Matrix3).set(
      this.camR.x, this.camU.x, this.camF.x,
      this.camR.y, this.camU.y, this.camF.y,
      this.camR.z, this.camU.z, this.camF.z,
    );
    this.focal = Math.min(1, this.cssW / this.cssH / 0.85) / Math.tan((rig.fov * Math.PI) / 360);
    u.uFocal.value = this.focal;

    const sweep = live && s.dur ? (clamp(s.pos / s.dur, 0, 1) - 0.5) * 0.9 : 0;
    this.keySweep += (sweep - this.keySweep) * ke(2.5);
    (u.uKey.value as THREE.Vector3).set(-0.5, 0.64, 0.59).applyAxisAngle(UP, this.keySweep).normalize();

    const ray = this.rayAt(view.mouse.x, view.mouse.y);
    const cur = u.uCursor.value as THREE.Vector4;
    if (ray.y < -0.01 && !view.mouse.onUi && !view.reduced && !view.coarse) {
      const t = -this.camPos.y / ray.y;
      cur.set(this.camPos.x + ray.x * t, this.camPos.z + ray.z * t, t < 40 ? 0.0028 : 0, 0);
    } else cur.z = 0;
    (this.post.uCur.value as THREE.Vector4).set(view.mouse.x, 1 - view.mouse.y, view.reach, view.coarse || view.mouse.onUi ? 0 : 1);

    const size = this.sizeAt(navNow);
    const behind = size + 3.6;
    const depth = this.camPos.z + behind;
    const wide = (depth / this.focal) * (this.cssW / this.cssH);
    const mid = this.camPos.x + (this.camF.x / -this.camF.z) * depth;
    const left = mid - wide * 0.955;
    const span = Math.max(1, Math.min(mid + wide * 0.4, navNow * SPACING - 0.45 * size) - left);
    const tall = Math.min(span / this.textFrac / 4, 1.25);
    (u.uTextRect.value as THREE.Vector4).set(left, left + tall * 4, -0.2 * tall, 0.8 * tall);
    (u.uTextAt.value as THREE.Vector3).set(-behind, portrait ? 0 : 0.3 * this.textK * (1 - k1) * (1 - k1), 0.2);
    this.dawn = Math.max(this.dawn, clamp(s.fade, 0, 1));
    this.post.uFade.value = this.dawn * (1 - (view.reduced ? 0.5 : 0.16) * this.hush);
    const tier = this.scale < 0.55 ? 0 : 1;
    u.uSteps.value = tier ? 96 : 64;
    u.uDetail.value = tier ? 1 : 0.6;
  }

  private ripple() {
    this.crown.write(this.crownOut);
    const data = this.crownTex.image.data as Uint16Array;
    for (let i = 0; i < data.length; i++) data[i] = half(this.crownOut[i]);
    this.crownTex.needsUpdate = true;
  }

  private emit(x: number, z: number, amp: number) {
    const rings = this.u.uRings.value as THREE.Vector4[];
    rings[this.ring].set(x, z, this.time, amp);
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

  private local(slot: number, x: number, z: number, y = 0): THREE.Vector3 {
    const s = this.slots[slot];
    const p = (this.u.uBPos.value as THREE.Vector3[])[slot];
    const sa = Math.sin(s.tilt);
    const ca = Math.cos(s.tilt);
    return new THREE.Vector3(p.x + x * s.radius, p.y + (y * sa - z * ca) * s.radius, p.z + (y * ca + z * sa) * s.radius);
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
    const slot = this.indexOf(this.alb);
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
    const slot = this.indexOf(this.alb);
    const s = this.slots[slot];
    if (!s.morph || s.album !== this.alb || k < 0 || k >= s.morph.bounds.length - 1) return null;
    const b = s.morph.bounds;
    const spin = (this.u.uBGlass.value as THREE.Vector4[])[slot].z;
    const a = ((b[k] + b[k + 1]) * 0.5 + spin) * TAU;
    const rr = s.hi + 0.16;
    const at = this.project(this.local(slot, Math.cos(a) * rr, Math.sin(a) * rr));
    return at.z > 0.01 ? { x: at.x, y: at.y } : null;
  }

  partAnchor(part: AnatomyPart): { x: number; y: number; ox: number; oy: number; hidden: boolean } | null {
    const slot = this.indexOf(this.alb);
    const s = this.slots[slot];
    const m = s.morph;
    if (!m || s.album !== this.alb) return null;
    const spin = (this.u.uBGlass.value as THREE.Vector4[])[slot].z;
    const mid = (s.lo + s.hi) * 0.5;
    let x = 0;
    let z = 0;
    let y = 0;
    if (part === "core") {
      x = m.eccX;
      z = m.eccY;
    } else if (part === "satellites") {
      const v = (this.u.uBSat.value as THREE.Vector4[])[slot * 4];
      x = v.z > 0.001 ? v.x : 1.1;
      z = v.z > 0.001 ? v.y : -0.75;
      y = z * Math.sin(s.lean);
      z *= Math.cos(s.lean);
    } else {
      let a = -Math.PI / 2;
      let r = s.hi;
      if (part === "contour") a = RING.anchor + 2.2;
      else if (part === "strata") {
        a = RING.anchor - 1.3;
        r = mid;
      } else if (part === "gaps") {
        a = ((m.bounds[1] ?? 0) + spin) * TAU;
        r = mid;
      } else if (part !== "posture") return null;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    }
    const world = this.local(slot, x, z, y);
    const at = this.project(world);
    if (at.z <= 0.01) return null;
    const heart = this.project(this.local(slot, m.eccX, m.eccY));
    let ox = at.x - heart.x;
    let oy = at.y - heart.y;
    const len = Math.hypot(ox, oy);
    if (len < 8) {
      ox = 0.7;
      oy = -0.7;
    } else {
      ox /= len;
      oy /= len;
    }
    let hidden = false;
    if (part !== "core") {
      const c = this.local(slot, m.eccX, m.eccY).sub(this.camPos);
      const d = world.clone().sub(this.camPos);
      const far = d.length();
      d.divideScalar(far);
      const along = c.dot(d);
      const miss = c.addScaledVector(d, -along).length();
      hidden = along > 0 && along < far && miss < m.coreRatio * 0.9 * s.radius;
    }
    return { x: at.x, y: at.y, ox, oy, hidden };
  }

  caption(album: number): { x: number; y: number; k: number } | null {
    const slot = this.indexOf(album);
    const s = this.slots[slot];
    if (album < 0 || s.album !== album || s.k < 0.05) return null;
    const p = (this.u.uBPos.value as THREE.Vector3[])[slot].clone();
    p.y += s.radius * s.hi * Math.cos(s.tilt) + 0.42;
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
    this.u.uPix.value = 2 / (h * this.focal);
    this.mesh.material = (this.u.uDebug.value as number) > 0 && this.inspector ? this.inspector : this.scene;
    this.renderer.setRenderTarget(this.rtScene);
    this.renderer.render(this.stage, this.ortho);

    const moon = this.u.uMoon.value as THREE.Vector3;
    const lz = moon.dot(this.camF);
    const on = lz > 0.05 ? 1 : 0;
    (p.uLightUv.value as THREE.Vector3).set(
      on ? ((moon.dot(this.camR) / lz) * this.focal) / (w / h) / 2 + 0.5 : 0.5,
      on ? ((moon.dot(this.camU) / lz) * this.focal) / 2 + 0.5 : 0.5,
      on * 0.07 * (1 + 1.5 * this.shimmer),
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

    const probe = this.probe;
    if (probe && performance.now() - probe.at > 100) {
      probe.at = performance.now();
      const size = 160;
      const at = this.project((this.u.uBPos.value as THREE.Vector3[])[this.u.uFocus.value as number]);
      const dpr = this.fullW / this.cssW;
      const x = clamp(Math.round(at.x * dpr - size / 2), 0, this.fullW - size);
      const y = clamp(Math.round(this.fullH - at.y * dpr - size / 2), 0, this.fullH - size);
      const px = new Uint8Array(size * size * 4);
      this.gl.readPixels(x, y, size, size, this.gl.RGBA, this.gl.UNSIGNED_BYTE, px);
      if (probe.prev) {
        let d = 0;
        for (let i = 0; i < px.length; i += 16) d += Math.abs(px[i] - probe.prev[i]) + Math.abs(px[i + 1] - probe.prev[i + 1]) + Math.abs(px[i + 2] - probe.prev[i + 2]);
        probe.sum += d / ((px.length / 16) * 3);
        probe.n++;
      }
      probe.prev = px;
    }
  }

  inspect(mode: number) {
    this.inspector ??= pass(`#define DEBUG 1\n${sceneSrc}`, this.u);
    this.u.uDebug.value = mode;
  }

  defects() {
    this.inspect(2);
    this.render();
    const w = this.rtScene.width;
    const h = this.rtScene.height;
    const px = new Uint16Array(w * h * 4);
    this.renderer.readRenderTargetPixels(this.rtScene, 0, 0, w, h, px);
    this.u.uDebug.value = 0;
    const on = THREE.DataUtils.toHalfFloat(0.5);
    let missed = 0;
    let spent = 0;
    let solid = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] >= on && px[i] < 0x7c00) missed++;
      if (px[i + 1] >= on && px[i + 1] < 0x7c00) spent++;
      if (px[i + 2] >= on && px[i + 2] < 0x7c00) solid++;
    }
    return { missed, spent, solid, width: w, height: h };
  }

  async motion(seconds: number): Promise<number> {
    this.probe = { at: 0, prev: null, sum: 0, n: 0 };
    this.post.uGrain.value = 0;
    await new Promise((r) => setTimeout(r, seconds * 1000));
    const p = this.probe;
    this.probe = null;
    this.post.uGrain.value = 0.026;
    return p.n ? p.sum / p.n : 0;
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
    this.crownTex.dispose();
    this.warpTex.dispose();
    this.textTex.dispose();
    this.renderer.dispose();
  }
}
