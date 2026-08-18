export type Scale = "campo" | "album" | "faixa";
export type Mode = "parado" | "colapso" | "toca" | "pausa" | "fusao";
export type Variant = "desktop" | "tablet" | "mobile";

/** Partícula de poeira em órbita elíptica em torno do corpo focado. */
export interface Particle {
  a: number;
  r: number;
  s: number;
  z: number;
  tw: number;
}

/**
 * Estado mutável do campo. Um único objeto, mutado pelo `step(dt)` — nunca
 * atravessa o ciclo de render do React.
 */
export interface FieldState {
  scale: Scale;
  zoom: number;
  zoomT: number;

  /** posição contínua da câmera no campo */
  nav: number;
  navT: number;
  /** álbum focado */
  alb: number;
  /** álbum em reprodução (-1 = nenhum) */
  playAlb: number;
  /** faixa em reprodução */
  trk: number;
  /** faixa selecionada */
  sel: number;
  /** faixa sob o ponteiro (anel ou régua) */
  hover: number;
  /** corpo sob o ponteiro (mundo ou régua) */
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

  /** mistura entre a arte que sai e a que chega, durante a fusão */
  mix: number;
  fuseB: number;
  fuseAlb: number;
  waveR: number;
  waveA: number;
  energy: number;
  curK: number;

  t: number;
  seqT: number;
  ringRot: number;
  /** 0 = arco assado da coleção, 1 = anel setorizado */
  fadeSel: number;

  bass: number;
  mid: number;
  treb: number;
}

/** Estado discreto que a camada de instrumentos renderiza (React). */
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
}

/** Nós atualizados imperativamente a cada frame (fora do React). */
export interface LiveNodes {
  layer: HTMLElement | null;
  bar: HTMLElement | null;
  seek: HTMLElement | null;
  tc: HTMLElement | null;
  dot: HTMLElement | null;
  albMarks: (HTMLElement | null)[];
  trkMarks: (HTMLElement | null)[];
}

export interface FontFamilies {
  archivo: string;
  bodoni: string;
  mono: string;
}
