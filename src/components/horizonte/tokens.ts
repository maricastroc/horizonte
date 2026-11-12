export const COLOR = {
  void: "#07070A",
  void2: "#0A0910",
  paper: "#EFEBE3",
  paperHi: "#F4F1EA",
  inkText: "#E8E4DC",
  inkText2: "#CFC9C0",
  inkHover: "#C9C4BB",
  inkFaint: "#5A554F",
  inkGhost: "#3A3631",
  dust: "#CFCAC2",
  body: "#0B0A0E",
} as const;

export type Rgb = readonly [number, number, number];

export const rgba = (v: Rgb, a: number) =>
  `rgba(${Math.round(v[0] * 255)},${Math.round(v[1] * 255)},${Math.round(v[2] * 255)},${a})`;

export const GEO = {
  anchorCollection: { x: 0.46, y: 0.425 },
  anchorAlbum: { x: 0.6, y: 0.44 },
  spreadX: 0.285,
  spreadY: 0.1,
  neighborR: 0.062,
  bandH: 0.115,
  bandAlpha: 0.34,
  scrimBottom: 0.885,
  scrimTop: 0.1,
} as const;

export const RING = {
  buffer: 1000,
  unitR: 330,
  arcIn: 0.737,
  arcOut: 1,
  Rin: 350,
  Rout: 475,
  arcSlices: 280,
  bakeBudget: 4,
  dissolve: 0.45,
  alpha: { normal: 0.42, hover: 0.8, selected: 0.92, playing: 1 },
  lift: 0.035,
  anchor: -1.9,
  neighborPhase: 0.7,
} as const;

export const RING_UNIT = RING.unitR / RING.buffer;

export const MORPH = {
  collectionForm: 0.4,
  massAnchor: [0.1, 0.95],
  circuit: [0.56, 0.94],
  spreadAnchor: [0.02, 0.8],
  spreadShrink: 0.1,
  flatten: [0.46, 0.9],
  core: [0.2, 0.5],
  bandFill: 0.62,
  plate: [0.52, 1.34],
  strataGap: 0.19,
  strataReach: 0.6,
  shells: 3,
  coreRef: 0.34,
  coreLobe: 0.55,
  relief: [0.05, 0.34],
  fragAnchor: [0.12, 0.75],
  fragment: [0.004, 0.052],
  hierAnchor: [0.05, 0.45],
  eccAnchor: [0.02, 0.22],
  eccReach: 0.26,
  satellites: 4,
  satOnset: 0.1,
  satStep: 0.18,
  satKnee: 0.26,
  satPhase: 0.6180339887498949,
  satArc: [-2.6, 4.6],
  satDist: [1.34, 0.32],
  satSize: 0.3,
  satGrow: 0.55,
  satRim: 0.19,
  satArcSpan: [2.05, 4.15],
  satFalloff: 0.72,
  satCap: 0.68,
  neighborDamp: 0.45,
} as const;

export const REACH = {
  core: 1.5,
  inner: 0.86,
  outer: 1.16,
} as const;

export const BAND = {
  tallAnchor: [1.5, 2.2],
  top: [0.17, 0.116],
  player: [0.32, 0.166],
  identity: [0.115, 0.096],
  identityFloor: 0.125,
  shareField: 0.86,
  shareAlbum: 0.46,
  inset: 0.055,
  gutter: 0.042,
  fill: 0.9,
  slack: 0.5,
} as const;

export const GUARD = { soft: 0.05, residual: 0.22 } as const;

export const GLYPH = {
  artist: { descent: 0.18 },
  title: { ascent: 0.76, descent: 0.26 },
  meta: { ascent: 0.78 },
} as const;

export const LOCKUP = {
  desktop: {
    size: 0.098,
    sizeCap: 0.175,
    play: 0.045,
    zoom: 0.018,
    title: 0.53,
    meta: 0.011,
    metaFloor: 0,
    metaCeil: 1,
    margin: 0.028,
    marginTitle: 0.032,
    marginMeta: 0.034,
    baseline: 0.6,
    baselinePlay: 0.03,
    titleGap: 0.6,
    metaGap: 0.24,
    titleAir: 0.36,
    metaAir: 0.6,
    fitTitle: 0.62,
    fitMeta: 0.62,
    floor: 0.4,
    metaAlpha: 0.75,
  },
  mobile: {
    size: 0.105,
    sizeCap: 0.052,
    play: 0.012,
    zoom: 0.008,
    title: 0.56,
    meta: 0.34,
    metaFloor: 0.03,
    metaCeil: 0.9,
    margin: 0.042,
    marginTitle: 0.042,
    marginMeta: 0.042,
    baseline: 0,
    baselinePlay: 0,
    titleGap: 0.82,
    metaGap: 0.62,
    titleAir: 0,
    metaAir: 0,
    fitTitle: 0.98,
    fitMeta: 0.98,
    floor: 0.5,
    metaAlpha: 0.92,
  },
} as const;

export const SHARD = {
  desktop: { x: 0.855, y: 0.08, w: 0.055, h: 0.62, rot: 0.26, alpha: 0.26 },
  mobile: { x: 0.79, y: -0.02, w: 0.085, h: 0.42, rot: 0.3, alpha: 0.17 },
} as const;

export const SEQ = {
  collapse: { total: 2.25, ramp: 1.1, valleyEnd: 1.3 },
  valley: { fade: 0.03 },
  fusion: { total: 1.6, wave: 0.9 },
  segue: { total: 0.6, depth: 0.045 },
  reduced: 0.3,
} as const;

export const LIGHT = {
  base: [-0.7, 0.71],
  arc: 1,
} as const;

export const TRACK_BIAS = { lerp: 1.2 } as const;

export const MOTION = {
  attack: [0.24, 0.04],
  release: [0.14, 1.2],
  beatRelease: 0.45,
  habitRatio: 5,
  habit: [1.2, 6],
  depth: [0.825, 1.5],
  route: { floor: 0.35, slope: 1.3 },
  track: { cap: 0.2, knee: 0.5 },
  gate: {
    sharpness: { floor: 0.074, knee: 0.12 },
    sustain: { floor: 0.053, knee: 0.12 },
    weight: { floor: 0.071, knee: 0.12 },
    contrast: { floor: 0.109, knee: 0.12 },
  },
  lerp: 1.2,
} as const;

export const CHARGE = {
  fastSeconds: 20,
  ratio: 10,
  stepFloor: 4,
  spreadRank: 0.9,
  spreadFloor: 0.02,
  knee: 0.5,
} as const;

export const STRAIN = {
  dead: 0.2,
  ampRadius: 0.22,
  ampBand: 0.36,
  compliance: [0.55, 1],
  spread: [0.01, 0.03],
  hop: 20,
  rise: 6,
  relax: 26,
  yield: 0.03,
  harden: 0.55,
  creep: 720,
  redraw: 0.0016,
  alpha: 0.95,
  scarFloor: 0.004,
} as const;

export const SECOND_MASS = { k: 0.03, h: 0.052, pointGain: 1.9, lerp: 3.5 } as const;

export const INTAKE = { mass: 0.45, horizon: 1.3 } as const;

export const LERP = {
  zoom: 4.2,
  play: 3.4,
  field: 9,
  fade: 14,
  mouse: 5.2,
  energy: 4,
  ringRot: 2.6,
  light: 2.2,
  reach: 8,
} as const;

export const TIDE = {
  amp: 0.014,
  ramp: 0.9,
  out: 1.15,
  hold: 0.35,
  back: 2.7,
  rest: 1.5,
  release: 6,
} as const;

export const HINT_MS = 1800;
export const EXPLORED_KEY = "horizonte:explored";

export const IDLE_MS = 2600;
export const IDLE_OPACITY = 0.32;

export const DPR_MAX = 1.3;
export const COMPOSITION_MAX_W = 1760;

export const COMPOSITION_FALLBACK_W = 1440;

export const PARTICLES = 240;

export const BREAKPOINT = { mobile: 768, tablet: 1200, short: 520 } as const;

export const ANATOMY = {
  key: "horizonte:anatomy",
  focus: {
    fade: 0.32,
    dim: { ask: 0.55, what: 0.35 },
    light: 0.3,
    scale: 0.25,
    halo: { satellite: 2.4, core: 1.55 },
    margin: 1.12,
    refresh: 12,
    part: { crown: 0.42, line: 2.5, edge: 2.5, glow: 0.5, slit: 0.6 },
  },
  compare: { duration: 1.1, steps: 3, peek: 0.35 },
  ghost: { alpha: 0.42, width: 1.1, color: [0.937, 0.922, 0.89] as Rgb },
  facing: { alpha: 0.5, dash: [4, 5] as const },
  invite: { dwell: 9, shown: 16 },
} as const;
