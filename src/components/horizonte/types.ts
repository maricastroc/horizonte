export type Scale = "collection" | "album" | "track";
export type Mode = "stopped" | "collapse" | "playing" | "paused" | "fusion";
export type Variant = "desktop" | "tablet" | "mobile";

export interface Particle {
  a: number;
  r: number;
  s: number;
  z: number;
  tw: number;
}

export interface FieldState {
  scale: Scale;
  zoom: number;
  zoomT: number;

  nav: number;
  navT: number;
  alb: number;
  playAlb: number;
  trk: number;
  sel: number;
  hover: number;
  hoverBody: number;

  mode: Mode;
  play: number;
  pos: number;
  dur: number;

  spin: number;
  blur: number;
  fade: number;
  jet: number;
  m0k: number;
  m0h: number;
  m1k: number;
  m1h: number;
  m1x: number;
  m1y: number;

  mix: number;
  fuseB: number;
  fuseAlb: number;
  fuseFrom: number;
  fuseLoaded: boolean;
  waveR: number;
  waveA: number;
  energy: number;
  curK: number;

  t: number;
  seqT: number;
  segueT: number;
  ringRot: number;
  fadeSel: number;

  treb: number;
}

export type Fault = "source" | "blocked";

export interface Snapshot {
  scale: Scale;
  mode: Mode;
  alb: number;
  navAlb: number;
  sel: number;
  trk: number;
  playAlb: number;
  hoverTrk: number;
  hoverAlb: number;
  idle: boolean;
  variant: Variant;
  announce: string;
  fault: Fault | null;
}

export type Reach = "none" | "enter" | "leave";

export interface FontFamilies {
  archivo: string;
  bodoni: string;
  mono: string;
}
