import { mediaUrl, needsCors } from "../content/assets";
import { ALBUMS } from "../content";
import { COLOR, rgba } from "../tokens";

export const COVER_SIZE = 512;

const DESSATURA = 0.92;
const OVERPRINT_A = 0.1;
const OVERPRINT_B = 0.07;
const GRAIN_SEED = 20260818;
const GRAIN_POINTS = 900;
const EXPOSICAO_ALVO = 0.4;
const GANHO_MIN = 0.75;
const GANHO_MAX = 2.4;

export interface CoverAsset {
  canvas: HTMLCanvasElement;
  loaded: boolean;
  version: number;
}

function blank(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = COVER_SIZE;
  c.height = COVER_SIZE;
  const x = c.getContext("2d")!;
  x.fillStyle = COLOR.void2;
  x.fillRect(0, 0, COVER_SIZE, COVER_SIZE);
  return c;
}

function meanLuma(img: HTMLImageElement): number {
  const N = 48;
  const probe = document.createElement("canvas");
  probe.width = N;
  probe.height = N;
  const px = probe.getContext("2d", { willReadFrequently: true })!;
  px.drawImage(img, 0, 0, N, N);
  const d = px.getImageData(0, 0, N, N).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
  }
  return sum / (d.length / 4);
}

function treat(canvas: HTMLCanvasElement, img: HTMLImageElement, albIdx: number) {
  const S = COVER_SIZE;
  const x = canvas.getContext("2d")!;
  const A = ALBUMS[albIdx];

  x.clearRect(0, 0, S, S);
  x.fillStyle = COLOR.void2;
  x.fillRect(0, 0, S, S);

  const ganho = Math.min(
    GANHO_MAX,
    Math.max(GANHO_MIN, EXPOSICAO_ALVO / Math.max(0.02, meanLuma(img))),
  );

  const contraste = ganho > 1.6 ? 92 : 100;

  x.save();
  if ("filter" in x) {
    x.filter = `saturate(${DESSATURA * 100}%) brightness(${ganho.toFixed(3)}) contrast(${contraste}%)`;
  }
  x.drawImage(img, 0, 0, S, S);
  x.restore();

  x.save();
  x.globalCompositeOperation = "overlay";
  x.fillStyle = rgba(A.inkA, OVERPRINT_A);
  x.fillRect(0, 0, S, S);
  x.globalCompositeOperation = "soft-light";
  x.fillStyle = rgba(A.inkB, OVERPRINT_B);
  x.fillRect(0, 0, S, S);
  x.restore();

  let s = GRAIN_SEED;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.save();
  for (let i = 0; i < GRAIN_POINTS; i++) {
    x.globalAlpha = 0.015 + rnd() * 0.05;
    x.fillStyle = rnd() > 0.5 ? "#F2EFE8" : "#000000";
    x.fillRect(rnd() * S, rnd() * S, 1.6, 1.6);
  }
  x.restore();
}

export function loadCovers(onReady?: (i: number) => void): CoverAsset[] {
  return ALBUMS.map((album, i) => {
    const asset: CoverAsset = { canvas: blank(), loaded: false, version: 0 };
    const img = new Image();
    img.decoding = "async";
    const url = mediaUrl(album.cover);
    if (needsCors(url)) img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      treat(asset.canvas, img, i);
      asset.loaded = true;
      asset.version++;
      onReady?.(i);
    };
    img.onerror = () => {
      asset.loaded = true;
      asset.version++;
      onReady?.(i);
    };
    return asset;
  });
}
