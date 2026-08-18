export const COLOR = {
  void: "#07070A",
  void2: "#0A0910",
  paper: "#EFEBE3",
  paperHi: "#F4F1EA",
  inkText: "#E8E4DC",
  inkText2: "#CFC9C0",
  inkHover: "#C9C4BB",
  inkMute: "#8C867E",
  inkDim: "#6E6862",
  inkFaint: "#5A554F",
  inkGhost: "#3A3631",
  rule: "rgba(232,228,220,.14)",
  rule2: "rgba(232,228,220,.08)",
  dust: "#CFCAC2",
  body: "#0B0A0E",
} as const;

export type Rgb = readonly [number, number, number];

export const rgba = (v: Rgb, a: number) =>
  `rgba(${Math.round(v[0] * 255)},${Math.round(v[1] * 255)},${Math.round(v[2] * 255)},${a})`;

export const GEO = {
  marginText: 0.028,
  marginTitle: 0.032,
  anchorCampo: { x: 0.615, y: 0.425 },
  anchorAlbum: { x: 0.6, y: 0.44 },
  flatten: 0.62,
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
  Rin: 350,
  Rout: 475,
  gap: 0.02,
  slices: 44,
  arcSlices: 280,
  alpha: { normal: 0.42, hover: 0.8, selected: 0.92, playing: 1 },
} as const;

export const RING_UNIT = RING.Rout / RING.buffer;

export const SEQ = {
  colapso: { total: 2.25, rampa: 1.1, valeFim: 1.3 },
  vale: { fade: 0.03 },
  fusao: { total: 1.6, onda: 0.9 },
  reduzido: 0.3,
} as const;

export const LERP = {
  nav: 5.5,
  zoom: 4.2,
  play: 3.4,
  campo: 9,
  fade: 14,
  mouse: 5.2,
  energy: 4,
} as const;

export const IDLE_MS = 2600;
export const IDLE_OPACITY = 0.32;

export const DPR_MAX = 1.3;
export const COMPOSITION_MAX_W = 1760;

export const COMPOSITION_FALLBACK_W = 1440;

export const PARTICLES = 240;

export const AUDIO_CURVATURE_CAP = 0.15;

export const BREAKPOINT = { mobile: 768, tablet: 1200 } as const;
