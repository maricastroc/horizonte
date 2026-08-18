/**
 * Domínio de conteúdo do Horizonte.
 *
 * A camada visual nunca fala com um arquivo, uma API ou um `<audio>`: ela lê
 * um `Album`/`Track` normalizado. A origem do som é um `AudioSource`, o que
 * mantém a porta aberta para outros provedores (ex.: Spotify) sem tocar em
 * composição, shader ou instrumentos.
 */

/** De onde o som vem. Hoje só `local`; o domínio não presume arquivo. */
export type AudioSource =
  | { kind: "local"; src: string; mime?: string }
  | { kind: "spotify"; uri: string };

export type ProviderId = "curadoria" | "spotify";

/** Procedência e direitos — registrado por obra, não por arquivo. */
export interface License {
  /** Nome curto, ex.: "CC BY 4.0" */
  name: string;
  url: string;
  /** Página de origem da obra. */
  source: string;
  /** Texto de atribuição exigido pela licença. */
  attribution: string;
  /** A licença permite hospedar/redistribuir o áudio neste projeto? */
  redistributable: boolean;
}

export interface Track {
  id: string;
  title: string;
  /** Duração real da obra, em segundos. Em curso, vale a do playback. */
  dur: number;
  source: AudioSource;
}

/** Tinta RGB 0..1 — duas por álbum, extraídas da capa real. */
export type Ink = [number, number, number];

export interface Album {
  id: string;
  provider: ProviderId;
  artist: string;
  title: string;
  year: string;
  /** Código de catálogo da edição original. */
  cat: string;
  /** Capa real, quadrada. */
  cover: string;
  inkA: Ink;
  inkB: Ink;
  license: License;
  tracks: Track[];
}
