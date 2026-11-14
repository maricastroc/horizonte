import * as THREE from "three";
import type { VisualAudioState } from "@/components/horizonte/audio/bus";
import { breathAt, temperamentOf, type Temperament } from "@/components/horizonte/breath";
import { createReliefTexture } from "@/components/horizonte/composition/relief";
import type { AlbumWithSignature } from "@/components/horizonte/content";
import { mediaUrl } from "@/components/horizonte/content/assets";
import { fieldConstantsOf } from "@/components/horizonte/field";
import { clamp, lerp } from "@/components/horizonte/math";
import { NEUTRAL_ROUTING, type Routing } from "@/components/horizonte/motion";
import { RING } from "@/components/horizonte/tokens";
import commonSrc from "@/shaders/lab/common.glsl";
import downSrc from "@/shaders/lab/down.glsl";
import finalSrc from "@/shaders/lab/final.glsl";
import glassSrc from "@/shaders/lab/glass.glsl";
import quadSrc from "@/shaders/lab/quad.vert.glsl";
import raysSrc from "@/shaders/lab/rays.glsl";
import tideSrc from "@/shaders/lab/tide.glsl";
import upSrc from "@/shaders/lab/up.glsl";
import { bakeShape, createWarpTexture, sectorAt, type Shape } from "./shape";

export type SceneId = "tide" | "glass";
export type View = "collection" | "album" | "track";
export type Quality = "auto" | "full" | "half";

export interface StageStats {
  fps: number;
  gpu: number | null;
  width: number;
  height: number;
  scale: number;
}

export interface BenchRow {
  scene: SceneId;
  scale: number;
  width: number;
  height: number;
  ms: number;
  timer: boolean;
}

const TAU = Math.PI * 2;
const LEVELS = 5;
const DPR_CAP = 2;
const TIME_ELAPSED = 0x88bf;
const GPU_DISJOINT = 0x8fbb;

const srgb = (v: number) => Math.pow(v, 2.2);
const ease = (t: number) => t * t * (3 - 2 * t);

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

interface Pose {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

export class Stage {
  private renderer: THREE.WebGLRenderer;
  private gl: WebGL2RenderingContext;
  private mesh: THREE.Mesh;
  private world = new THREE.Scene();
  private ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private u: Record<string, THREE.IUniform>;
  private post: Record<string, THREE.IUniform>;
  private scenes: Record<SceneId, THREE.RawShaderMaterial>;
  private down: THREE.RawShaderMaterial;
  private up: THREE.RawShaderMaterial;
  private rays: THREE.RawShaderMaterial;
  private final: THREE.RawShaderMaterial;
  private rtScene = target(2, 2);
  private rtRays = target(2, 2);
  private rtDown: THREE.WebGLRenderTarget[] = [];
  private rtUp: THREE.WebGLRenderTarget[] = [];
  private shapeTex = createReliefTexture();
  private warpTex = createWarpTexture();
  private textCanvas = document.createElement("canvas");
  private textTex: THREE.CanvasTexture;
  private coverTex: THREE.Texture;
  private loader = new THREE.TextureLoader();

  private sceneId: SceneId = "tide";
  private view: View = "collection";
  private quality: Quality = "auto";
  private album: AlbumWithSignature | null = null;
  private next: AlbumWithSignature | null = null;
  private shape: Shape | null = null;
  private temper: Temperament | null = null;
  private cap = 0.1;
  private mass = 1;
  private routing: Routing = NEUTRAL_ROUTING;
  private selected = -1;
  private playing = -1;
  private hover = -1;
  private hoverK = 0;

  private time = 0;
  private last = 0;
  private reveal = 0;
  private sinking = false;
  private fade = 0;
  private swap: SceneId | null = null;
  private pointer = new THREE.Vector2();
  private pointerT = new THREE.Vector2();
  private pose: Pose = { pos: new THREE.Vector3(0.4, 0.45, 7.4), look: new THREE.Vector3(-0.7, 0.95, 0), fov: 27 };
  private camR = new THREE.Vector3();
  private camU = new THREE.Vector3();
  private camF = new THREE.Vector3();
  private focal = 1;
  private bodyY = 1;
  private radius = 1;
  private tilt = 0.5;
  private spin = 0;
  private ring = 0;
  private ringGate = false;
  private ringAt = 0;
  private breathWas = 0;
  private inkA = new THREE.Vector3(0.2, 0.3, 0.8);
  private inkB = new THREE.Vector3(0.6, 0.3, 0.3);

  private cssW = 1;
  private cssH = 1;
  private fullW = 2;
  private fullH = 2;
  private scale = 0.75;
  private fixed: number | null = null;
  private fps = 60;
  private gpu: number | null = null;
  private ext: unknown;
  private query: WebGLQuery | null = null;
  private pending: WebGLQuery | null = null;
  private tuneAt = 0;
  private load = 0;
  private loadN = 0;
  private syncMs: number | null = null;
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

    const blank = new THREE.DataTexture(new Uint8Array([40, 40, 48, 255]), 1, 1);
    blank.needsUpdate = true;
    this.coverTex = blank;

    this.u = {
      uRes: { value: new THREE.Vector2(2, 2) },
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uCamRot: { value: new THREE.Matrix3() },
      uFocal: { value: 1 },
      uBodyPos: { value: new THREE.Vector3(0, 1, 0) },
      uBodyRot: { value: new THREE.Matrix3() },
      uRadius: { value: 1 },
      uShape: { value: this.shapeTex },
      uWarp: { value: this.warpTex },
      uText: { value: this.textTex },
      uCover: { value: this.coverTex },
      uBand: { value: new THREE.Vector4(0, 1, 0.035, 0.016) },
      uBound: { value: new THREE.Vector2(1.2, 0.06) },
      uCoreAt: { value: new THREE.Vector3() },
      uCore: { value: 0.3 },
      uSat: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
      uInkA: { value: this.inkA },
      uInkB: { value: this.inkB },
      uLight: { value: new THREE.Vector3(0, 0.1, -1).normalize() },
      uKey: { value: new THREE.Vector3(-0.55, 0.6, 0.58).normalize() },
      uAudio: { value: new THREE.Vector4() },
      uAccent: { value: new THREE.Vector4() },
      uRings: { value: [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector2(-100, 0)) },
      uSea: { value: new THREE.Vector4(0.02, 2.5, 0.015, 1) },
      uTide: { value: 0.03 },
      uPlay: { value: new THREE.Vector4(0, 0, 0, 0) },
      uHover: { value: new THREE.Vector4(0, 0, 0, 0) },
      uSpin: { value: 0 },
      uGlow: { value: 1 },
      uTextRect: { value: new THREE.Vector4(-4, 0, -0.2, 1) },
      uTextAt: { value: new THREE.Vector2(-2.6, 0.5) },
      uSteps: { value: 64 },
      uLens: { value: 0.55 },
      uGlass: { value: new THREE.Vector4(0.16, 0.5, 1.48, 0.35) },
      uDetail: { value: 1 },
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
      uExposure: { value: 1.1 },
      uBloomAmt: { value: 0.09 },
      uTime: { value: 0 },
      uFade: { value: 0 },
    };

    this.scenes = {
      tide: pass(`#define LENS 1\n${commonSrc}\n${tideSrc}`, this.u),
      glass: pass(`#define GLASS 1\n${commonSrc}\n${glassSrc}`, this.u),
    };
    this.down = pass(downSrc, this.post);
    this.up = pass(upSrc, this.post);
    this.rays = pass(raysSrc, this.post);
    this.final = pass(finalSrc, this.post);

    this.mesh = new THREE.Mesh(triangle(), this.scenes.tide);
    this.mesh.frustumCulled = false;
    this.world.add(this.mesh);
    this.resize();
  }

  get stats(): StageStats {
    return {
      fps: this.fps,
      gpu: this.gpu ?? this.syncMs,
      width: Math.round(this.fullW * this.scale),
      height: Math.round(this.fullH * this.scale),
      scale: this.scale,
    };
  }

  get timed() {
    return !!this.ext;
  }

  setScene(id: SceneId) {
    if (id === this.sceneId) return;
    this.swap = id;
  }

  setView(view: View) {
    this.view = view;
  }

  setQuality(q: Quality) {
    this.quality = q;
    if (q === "full") this.setScale(1);
    if (q === "half") this.setScale(0.5);
  }

  setPointer(x: number, y: number) {
    this.pointerT.set(clamp(x, -1, 1), clamp(y, -1, 1));
  }

  setRouting(routing: Routing) {
    this.routing = routing;
  }

  setAlbum(album: AlbumWithSignature) {
    if (!this.album) {
      this.adopt(album);
      return;
    }
    if (album === this.album && !this.next) return;
    this.next = album;
    this.sinking = true;
  }

  setTracks(selected: number, playing: number) {
    if (selected === this.selected && playing === this.playing) return;
    this.selected = selected;
    this.playing = playing;
    if (this.album && !this.sinking) this.bake();
  }

  private adopt(album: AlbumWithSignature) {
    this.album = album;
    this.next = null;
    this.temper = temperamentOf(album);
    const k = fieldConstantsOf(album.signature);
    this.cap = k.reactionCap;
    this.mass = k.massScale;
    this.bake();
    this.inkA.set(srgb(album.inkA[0]), srgb(album.inkA[1]), srgb(album.inkA[2]));
    this.inkB.set(srgb(album.inkB[0]), srgb(album.inkB[1]), srgb(album.inkB[2]));
    const sig = album.signature;
    const sea = this.u.uSea.value as THREE.Vector4;
    sea.set(
      lerp(0.006, 0.026, sig.dynamics),
      lerp(4.2, 1.7, sig.pulse),
      lerp(0.002, 0.009, sig.brightness),
      lerp(0.5, 1.2, sig.pulse),
    );
    this.loader.load(mediaUrl(album.cover), (tex) => {
      if (this.album !== album) {
        tex.dispose();
        return;
      }
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      this.coverTex.dispose();
      this.coverTex = tex;
      this.u.uCover.value = tex;
    });
    void this.writeText(album.artist, k.artistWeight);
  }

  private bake() {
    if (!this.album) return;
    const shape = bakeShape(this.album, this.selected, this.playing, this.shapeTex, this.warpTex);
    this.shape = shape;
    const m = shape.morphology;
    this.radius = 1.3 * m.circuit;
    this.tilt = Math.acos(clamp(m.flatten, 0.2, 0.98));
    this.bodyY = this.radius * shape.hi * m.flatten + 0.32;
    (this.u.uCoreAt.value as THREE.Vector3).set(...shape.coreAt);
    this.u.uCore.value = shape.core;
    const sats = this.u.uSat.value as THREE.Vector4[];
    sats.forEach((v, i) => v.set(...(shape.satellites[i] ?? [0, 0, 0, 0])));
  }

  private async writeText(text: string, weight: number) {
    const font = (px: number) => `${Math.round(weight)} ${px}px ${this.family}`;
    await document.fonts.load(font(200), text).catch(() => undefined);
    if (this.album?.artist !== text) return;
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
    const base = c.height * 0.8;
    x.fillText(text, c.width - 20 - w, base);
    this.textTex.needsUpdate = true;
    const height = clamp((4.6 * c.height) / (w + 40), 0.5, 1.15);
    const width = (height * c.width) / c.height;
    const right = -0.15;
    (this.u.uTextRect.value as THREE.Vector4).set(right - width, right, -0.2 * height, 0.8 * height);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    this.cssW = Math.max(1, this.canvas.clientWidth);
    this.cssH = Math.max(1, this.canvas.clientHeight);
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
    this.rtRays.setSize(w >> 1, h >> 1);
    for (let i = 0; i < LEVELS; i++) {
      const dw = w >> (i + 1);
      const dh = h >> (i + 1);
      if (!this.rtDown[i]) {
        this.rtDown[i] = target(dw, dh);
        this.rtUp[i] = target(dw, dh);
      } else {
        this.rtDown[i].setSize(Math.max(2, dw), Math.max(2, dh));
        this.rtUp[i].setSize(Math.max(2, dw), Math.max(2, dh));
      }
    }
  }

  private poseOf(view: View): Pose {
    const y = this.bodyY;
    if (view === "album") {
      return { pos: new THREE.Vector3(0.7, y + 1.9, 4.7), look: new THREE.Vector3(-0.35, y - 0.1, 0), fov: 33 };
    }
    if (view === "track") {
      const a = RING.anchor;
      const rm = this.shape ? (this.shape.lo + this.shape.hi) * 0.5 : 0.8;
      const at = this.local(Math.cos(a) * rm, 0, Math.sin(a) * rm);
      const n = this.local(0, 1, 0).sub(this.local(0, 0, 0));
      return {
        pos: at.clone().addScaledVector(n, 1.7).add(new THREE.Vector3(0.75, -0.15, 0.4)),
        look: at.add(new THREE.Vector3(0.1, -0.1, 0)),
        fov: 36,
      };
    }
    return { pos: new THREE.Vector3(0.4, 0.45, 7.4), look: new THREE.Vector3(-0.5, y * 0.84, 0), fov: 27 };
  }

  private local(x: number, y: number, z: number): THREE.Vector3 {
    const sa = Math.sin(this.tilt);
    const ca = Math.cos(this.tilt);
    const r = this.radius;
    const drop = this.bodyY - (1 - ease(this.reveal)) * (this.bodyY + this.radius * 1.3);
    return new THREE.Vector3(x * r, (y * sa - z * ca) * r + drop, (y * ca + z * sa) * r);
  }

  private step(dt: number, audio: VisualAudioState, albumPos: number) {
    this.time += dt;
    const u = this.u;

    if (this.sinking) {
      this.reveal = Math.max(0, this.reveal - dt / 0.55);
      if (this.reveal === 0 && this.next) {
        this.adopt(this.next);
        this.sinking = false;
      }
    } else {
      this.reveal = Math.min(1, this.reveal + dt / 1.1);
    }

    if (this.swap) {
      this.fade = Math.max(0, this.fade - dt / 0.22);
      if (this.fade === 0) {
        this.sceneId = this.swap;
        this.swap = null;
      }
    } else {
      this.fade = Math.min(1, this.fade + dt / 0.45);
    }

    const glass = this.sceneId === "glass";
    const live = audio.playing ? 1 : 0;
    const gain = this.cap / 0.2;
    const breath = this.temper && !audio.playing ? breathAt(this.temper, this.time) : 0;
    const bass = audio.playing ? audio.accent.bass : 0;
    const massK = this.routing.mass * gain;
    const lightK = this.routing.light * gain;

    if (audio.playing) {
      const open = bass > 0.42;
      if (open && !this.ringGate && this.time - this.ringAt > 0.16) {
        this.emit((0.008 + 0.03 * clamp(bass, 0, 1)) * (0.4 + massK));
      }
      this.ringGate = open;
    } else if (this.temper) {
      if (breath > 0.5 && this.breathWas <= 0.5) this.emit(0.006 + 0.012 * this.temper.mass);
      this.breathWas = breath;
    }

    (u.uAudio.value as THREE.Vector4).set(audio.bass, audio.mid, audio.treb, audio.flux);
    (u.uAccent.value as THREE.Vector4).set(
      bass,
      audio.playing ? audio.accent.mid : 0,
      audio.playing ? audio.accent.treb : 0,
      audio.playing ? audio.energy : breath * 0.25,
    );
    u.uTide.value = 0.06 + 0.07 * audio.bass * massK * live + 0.03 * breath;
    u.uGlow.value =
      ease(this.reveal) *
      (1 + (audio.flux * 0.55 + Math.max(0, audio.accent.treb) * 0.3) * lightK * live + 0.18 * breath);
    u.uLens.value = 0.42 * this.mass * (1 + bass * this.cap * this.routing.mass + 0.06 * breath);
    u.uTime.value = this.time;

    const k = 1 - Math.exp(-dt * 2.2);
    const want = this.poseOf(this.view);
    this.pose.pos.lerp(want.pos, k);
    this.pose.look.lerp(want.look, k);
    this.pose.fov += (want.fov - this.pose.fov) * k;
    this.pointer.lerp(this.pointerT, 1 - Math.exp(-dt * 3));

    const drift = Math.sin(this.time * 0.11) * 0.07;
    const pos = this.pose.pos.clone().sub(this.pose.look);
    pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), drift + this.pointer.x * 0.07);
    pos.add(this.pose.look);
    pos.y = Math.max(0.12, pos.y + this.pointer.y * 0.16 + Math.sin(this.time * 0.17) * 0.03);
    this.camF.copy(this.pose.look).sub(pos).normalize();
    this.camR.crossVectors(this.camF, new THREE.Vector3(0, 1, 0)).normalize();
    this.camU.crossVectors(this.camR, this.camF);
    (u.uCamPos.value as THREE.Vector3).copy(pos);
    (u.uCamRot.value as THREE.Matrix3).set(
      this.camR.x, this.camU.x, this.camF.x,
      this.camR.y, this.camU.y, this.camF.y,
      this.camR.z, this.camU.z, this.camF.z,
    );
    this.focal = Math.min(1, this.cssW / this.cssH / 1.6) / Math.tan((this.pose.fov * Math.PI) / 360);
    u.uFocal.value = this.focal;

    const sa = Math.sin(this.tilt);
    const ca = Math.cos(this.tilt);
    (u.uBodyRot.value as THREE.Matrix3).set(1, 0, 0, 0, sa, -ca, 0, ca, sa);
    const origin = this.local(0, 0, 0);
    origin.y += Math.sin(this.time * 0.6) * 0.012;
    (u.uBodyPos.value as THREE.Vector3).copy(origin);
    u.uRadius.value = this.radius;

    const rest = this.poseOf("collection");
    const core = new THREE.Vector3(0, this.bodyY, 0);
    const toward = core.sub(rest.pos).normalize();
    (u.uLight.value as THREE.Vector3).set(toward.x + 0.014, toward.y + 0.022, toward.z).normalize();

    const anchor = RING.anchor / TAU;
    const spinT = anchor - albumPos;
    let d = spinT - this.spin;
    d -= Math.round(d);
    this.spin += d * (1 - Math.exp(-dt * 3));
    u.uSpin.value = this.spin;

    const shape = this.shape;
    if (shape) {
      const m = shape.morphology;
      const amp = glass ? (0.1 + 0.42 * m.relief) * (1 + bass * this.cap * 1.6 * this.routing.mass + 0.05 * breath) : 0;
      const bank = glass ? 0.3 + 0.6 * m.strata : 0;
      const half = glass ? 0.042 : 0.042;
      (u.uGlass.value as THREE.Vector4).set(amp, bank, 1.48, 0.3);
      (u.uBand.value as THREE.Vector4).set(shape.lo, shape.hi, half, glass ? 0 : 0.02);
      const reach = (shape.hi - shape.lo) * 0.5;
      (u.uBound.value as THREE.Vector2).set(shape.hi + 0.06, half + (glass ? amp * 1.05 + bank * reach + 0.02 : 0.01));
      const lit = audio.playing || audio.position > 0 ? 1 : 0;
      if (this.playing >= 0 && this.playing < m.bounds.length - 1) {
        (u.uPlay.value as THREE.Vector4).set(albumPos, m.bounds[this.playing], m.bounds[this.playing + 1], lit);
      } else {
        (u.uPlay.value as THREE.Vector4).set(0, 0, 0, 0);
      }
      this.hoverK += ((this.hover >= 0 ? 1 : 0) - this.hoverK) * (1 - Math.exp(-dt * 10));
      if (this.hover >= 0 && this.hover < m.bounds.length - 1) {
        (u.uHover.value as THREE.Vector4).set(m.bounds[this.hover], m.bounds[this.hover + 1], this.hoverK, 0);
      } else {
        (u.uHover.value as THREE.Vector4).z = this.hoverK;
      }
    }

    (u.uTextAt.value as THREE.Vector2).set(-2.6, 0.34 * ease(this.fade));
    const tier = this.scale < 0.55 ? 0 : 1;
    u.uSteps.value = tier ? 72 : 48;
    u.uDetail.value = tier ? 1 : 0.6;
  }

  private emit(amp: number) {
    const rings = this.u.uRings.value as THREE.Vector2[];
    rings[this.ring].set(this.time, amp);
    this.ring = (this.ring + 1) % rings.length;
    this.ringAt = this.time;
  }

  private draw(material: THREE.RawShaderMaterial, rt: THREE.WebGLRenderTarget | null, w: number, h: number) {
    (this.post.uOut.value as THREE.Vector2).set(w, h);
    this.mesh.material = material;
    this.renderer.setRenderTarget(rt);
    this.renderer.render(this.world, this.ortho);
  }

  private render() {
    const p = this.post;
    const w = this.rtScene.width;
    const h = this.rtScene.height;
    (this.u.uRes.value as THREE.Vector2).set(w, h);
    this.mesh.material = this.scenes[this.sceneId];
    this.renderer.setRenderTarget(this.rtScene);
    this.renderer.render(this.world, this.ortho);

    const light = this.u.uLight.value as THREE.Vector3;
    const lx = light.dot(this.camR);
    const ly = light.dot(this.camU);
    const lz = light.dot(this.camF);
    const aspect = w / h;
    const on = lz > 0.05 ? 1 : 0;
    (p.uLightUv.value as THREE.Vector3).set(
      on ? ((lx / lz) * this.focal) / aspect / 2 + 0.5 : 0.5,
      on ? ((ly / lz) * this.focal) / 2 + 0.5 : 0.5,
      on * 0.22,
    );
    p.uSrc.value = this.rtScene.texture;
    this.draw(this.rays, this.rtRays, this.rtRays.width, this.rtRays.height);

    let src = this.rtScene;
    for (let i = 0; i < LEVELS; i++) {
      const dst = this.rtDown[i];
      p.uSrc.value = src.texture;
      (p.uTexel.value as THREE.Vector2).set(0.5 / src.width, 0.5 / src.height);
      p.uKnee.value = i === 0 ? 1.1 : 0;
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
    (p.uRayCol.value as THREE.Vector3)
      .copy(this.inkA)
      .lerp(new THREE.Vector3(1, 0.92, 0.8), 0.45)
      .multiplyScalar(0.9);
    p.uTime.value = this.time;
    p.uFade.value = ease(this.fade);
    this.draw(this.final, null, this.fullW, this.fullH);
  }

  frame(now: number, audio: VisualAudioState, albumPos: number) {
    const dt = clamp((now - (this.last || now)) / 1000, 0, 0.1);
    this.last = now;
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    this.step(dt, audio, albumPos);

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
    const timed = this.ext && !this.pending;
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

  advance(seconds: number, audio: VisualAudioState, albumPos: number) {
    for (let t = 0; t < seconds; t += 1 / 60) this.step(1 / 60, audio, albumPos);
    this.render();
  }

  private tune(now: number) {
    if (now - this.tuneAt < 700) return;
    this.tuneAt = now;
    const ms = this.loadN ? this.load / this.loadN : 0;
    this.load = 0;
    this.loadN = 0;
    if (this.quality !== "auto" || this.fixed !== null || !ms) return;
    if (this.ext) {
      if (ms > 11) this.setScale(this.scale * clamp(Math.sqrt(9.5 / ms), 0.7, 0.95));
      else if (ms < 6.5) this.setScale(this.scale * 1.08);
    } else {
      if (ms > 19.5) this.setScale(this.scale * 0.88);
      else if (ms < 17.2) this.setScale(this.scale * 1.04);
    }
  }

  pick(x: number, y: number): number {
    const shape = this.shape;
    if (!shape) return -1;
    const nx = ((x / this.cssW) * 2 - 1) * (this.cssW / this.cssH);
    const ny = 1 - (y / this.cssH) * 2;
    const rd = new THREE.Vector3()
      .addScaledVector(this.camR, nx)
      .addScaledVector(this.camU, ny)
      .addScaledVector(this.camF, this.focal)
      .normalize();
    const ro = this.u.uCamPos.value as THREE.Vector3;
    const origin = this.u.uBodyPos.value as THREE.Vector3;
    const sa = Math.sin(this.tilt);
    const ca = Math.cos(this.tilt);
    const n = new THREE.Vector3(0, sa, ca);
    const denom = rd.dot(n);
    if (Math.abs(denom) < 1e-4) return -1;
    const t = origin.clone().sub(ro).dot(n) / denom;
    if (t <= 0) return -1;
    const hit = ro.clone().addScaledVector(rd, t).sub(origin).divideScalar(this.radius);
    const lx = hit.x;
    const lz = -hit.y * ca + hit.z * sa;
    const r = Math.hypot(lx, lz);
    if (r < shape.lo - 0.03 || r > shape.hi + 0.03) return -1;
    const turn = (((Math.atan2(lz, lx) / TAU - this.spin) % 1) + 1) % 1;
    return sectorAt(shape.morphology, turn);
  }

  setHover(k: number) {
    this.hover = k;
  }

  labelAt(k: number): { x: number; y: number } | null {
    const shape = this.shape;
    if (!shape || k < 0 || k >= shape.morphology.bounds.length - 1) return null;
    const b = shape.morphology.bounds;
    const a = ((b[k] + b[k + 1]) * 0.5 + this.spin) * TAU;
    const rr = shape.hi + 0.12;
    const w = this.local(Math.cos(a) * rr, 0, Math.sin(a) * rr).sub(this.u.uCamPos.value as THREE.Vector3);
    const z = w.dot(this.camF);
    if (z <= 0.01) return null;
    const px = ((w.dot(this.camR) / z) * this.focal) / (this.cssW / this.cssH);
    const py = (w.dot(this.camU) / z) * this.focal;
    return { x: (px * 0.5 + 0.5) * this.cssW, y: (0.5 - py * 0.5) * this.cssH };
  }

  async bench(scales: number[], seconds = 1.6): Promise<BenchRow[]> {
    const rows: BenchRow[] = [];
    const gl = this.gl;
    const px = new Uint8Array(4);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const median = (v: number[]) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)];
    for (const s of scales) {
      this.fixed = s;
      this.scale = clamp(s, 0.2, 1);
      this.allocate();
      await wait(400);
      this.trace = [];
      await wait(seconds * 1000);
      const timed = this.trace;
      this.trace = null;
      const samples: number[] = [];
      if (timed.length < 6) {
        for (let i = 0; i < 12; i++) {
          this.render();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const t0 = performance.now();
          this.render();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          samples.push(performance.now() - t0);
        }
      }
      rows.push({
        scene: this.sceneId,
        scale: s,
        width: this.rtScene.width,
        height: this.rtScene.height,
        ms: median(timed.length >= 6 ? timed : samples),
        timer: timed.length >= 6,
      });
    }
    this.fixed = null;
    return rows;
  }

  dispose() {
    [this.rtScene, this.rtRays, ...this.rtDown, ...this.rtUp].forEach((t) => t.dispose());
    Object.values(this.scenes).forEach((m) => m.dispose());
    [this.down, this.up, this.rays, this.final].forEach((m) => m.dispose());
    this.mesh.geometry.dispose();
    this.shapeTex.dispose();
    this.warpTex.dispose();
    this.textTex.dispose();
    this.coverTex.dispose();
    this.renderer.dispose();
  }
}
