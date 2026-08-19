import * as THREE from "three";
import frag from "@/shaders/field.frag.glsl";
import vert from "@/shaders/field.vert.glsl";
import { DPR_MAX } from "./tokens";

export interface FieldUniforms {
  uBack: { value: THREE.Texture | null };
  uFront: { value: THREE.Texture | null };
  uRes: { value: THREE.Vector2 };
  uM0: { value: THREE.Vector4 };
  uM1: { value: THREE.Vector4 };
  uCur: { value: THREE.Vector3 };
  uWave: { value: THREE.Vector3 };
  uSpin: { value: number };
  uBlur: { value: number };
  uTime: { value: number };
  uFade: { value: number };
  uGrain: { value: number };
  uDisp: { value: number };
  uJet: { value: number };
  uRim: { value: number };
  uLight: { value: THREE.Vector2 };
  uInk: { value: THREE.Vector3 };
  [key: string]: THREE.IUniform;
}

export function createFieldUniforms(): FieldUniforms {
  return {
    uBack: { value: null },
    uFront: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uM0: { value: new THREE.Vector4(0, 0, 0.088, 0.112) },
    uM1: { value: new THREE.Vector4(0, 0, 0.02, 0.05) },
    uCur: { value: new THREE.Vector3(0, 0, 0) },
    uWave: { value: new THREE.Vector3(0, 0, 0) },
    uSpin: { value: 0.06 },
    uBlur: { value: 0 },
    uTime: { value: 0 },
    uFade: { value: 0 },
    uGrain: { value: 0.035 },
    uDisp: { value: 0.014 },
    uJet: { value: 0 },
    uRim: { value: 3.5 },
    uLight: { value: new THREE.Vector2(-0.7, 0.71) },
    uInk: { value: new THREE.Vector3(1, 1, 1) },
  };
}

function fullScreenTriangle(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "aP",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2),
  );
  g.setDrawRange(0, 3);
  return g;
}

export interface FieldGL {
  uniforms: FieldUniforms;
  render: () => void;
  resize: (w: number, h: number) => { dw: number; dh: number };
  dispose: () => void;
}

function planeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.flipY = true;
  t.premultiplyAlpha = false;
  return t;
}

export function createFieldGL(
  canvas: HTMLCanvasElement,
  backCanvas: HTMLCanvasElement,
  frontCanvas: HTMLCanvasElement,
): FieldGL {
  THREE.ColorManagement.enabled = false;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_MAX));
  renderer.setClearColor(0x07070a, 1);

  const uniforms = createFieldUniforms();
  const back = planeTexture(backCanvas);
  const front = planeTexture(frontCanvas);
  uniforms.uBack.value = back;
  uniforms.uFront.value = front;

  const material = new THREE.RawShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(fullScreenTriangle(), material);
  mesh.frustumCulled = false;

  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const size = new THREE.Vector2();

  return {
    uniforms,
    render: () => {
      back.needsUpdate = true;
      front.needsUpdate = true;
      renderer.render(scene, camera);
    },
    resize: (w: number, h: number) => {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_MAX));
      renderer.setSize(w, h, false);
      renderer.getDrawingBufferSize(size);
      uniforms.uRes.value.set(size.x, size.y);
      return { dw: size.x, dh: size.y };
    },
    dispose: () => {
      mesh.geometry.dispose();
      material.dispose();
      back.dispose();
      front.dispose();
      renderer.dispose();
    },
  };
}
