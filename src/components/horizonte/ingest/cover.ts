import { COLOR, rgba } from "../tokens";
import type { Ink } from "../content/types";
import { inkFromAudio, inksFromPixels, stableHue } from "./color";
import { ANCHOR, ENVELOPE_N, norm } from "./dsp";
import type { AlbumMeasurement } from "./dsp";

export const LOCAL_COVER_SIZE = 512;

async function bitmapOf(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("capa ilegível"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function inksFromArtwork(blob: Blob, seed: string): Promise<[Ink, Ink] | null> {
  try {
    const bitmap = await bitmapOf(blob);
    const N = 160;
    const canvas = document.createElement("canvas");
    canvas.width = N;
    canvas.height = N;
    const x = canvas.getContext("2d", { willReadFrequently: true });
    if (!x) return null;
    x.drawImage(bitmap as CanvasImageSource, 0, 0, N, N);
    if ("close" in bitmap) bitmap.close();
    return inksFromPixels(x.getImageData(0, 0, N, N).data, stableHue(seed));
  } catch {
    return null;
  }
}

export function inksFromMeasurement(m: AlbumMeasurement): [Ink, Ink] {
  const [lo, hi] = ANCHOR.bassRatio;
  const bass = Math.min(1, Math.max(0, (m.bassRatio - lo) / (hi - lo)));
  return inkFromAudio(norm(m.brightnessHz, "brightness", true), norm(m.rolloffHz, "rolloff", true), bass);
}

const GRAIN_SEED = 20260819;

export function drawSignatureCover(
  envelope: Uint8Array,
  inkA: Ink,
  inkB: Ink,
): HTMLCanvasElement {
  const S = LOCAL_COVER_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const x = canvas.getContext("2d")!;

  x.fillStyle = COLOR.void2;
  x.fillRect(0, 0, S, S);

  const vertical = x.createLinearGradient(0, 0, 0, S);
  vertical.addColorStop(0, rgba(inkA, 0.5));
  vertical.addColorStop(0.5, rgba(inkB, 0.92));
  vertical.addColorStop(1, rgba(inkA, 0.5));
  x.fillStyle = vertical;
  x.fillRect(0, 0, S, S);

  const at = (i: number) => envelope[Math.min(ENVELOPE_N - 1, i)] / 255;
  const step = S / ENVELOPE_N;
  for (let i = 0; i < ENVELOPE_N; i++) {
    const e = at(i);
    x.fillStyle = `rgba(0,0,0,${(1 - (0.34 + e * 0.66)).toFixed(3)})`;
    x.fillRect(i * step, 0, step + 1, S);
  }

  x.globalCompositeOperation = "lighter";
  x.fillStyle = rgba(inkB, 0.3);
  x.beginPath();
  x.moveTo(0, S / 2);
  for (let i = 0; i < ENVELOPE_N; i++) {
    x.lineTo((i / (ENVELOPE_N - 1)) * S, S / 2 - (0.05 + at(i) * 0.4) * S);
  }
  for (let i = ENVELOPE_N - 1; i >= 0; i--) {
    x.lineTo((i / (ENVELOPE_N - 1)) * S, S / 2 + (0.05 + at(i) * 0.4) * S);
  }
  x.closePath();
  x.fill();
  x.globalCompositeOperation = "source-over";

  let s = GRAIN_SEED;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1400; i++) {
    x.globalAlpha = 0.02 + rnd() * 0.06;
    x.fillStyle = rnd() > 0.5 ? "#F2EFE8" : "#000000";
    x.fillRect(rnd() * S, rnd() * S, 1.6, 1.6);
  }
  x.globalAlpha = 1;
  return canvas;
}

const dataUrl = (canvas: HTMLCanvasElement) =>
  typeof canvas.toDataURL === "function" ? canvas.toDataURL("image/png") : "";

export function canvasToUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== "function") {
      resolve(dataUrl(canvas));
      return;
    }
    canvas.toBlob((blob) => {
      resolve(blob ? URL.createObjectURL(blob) : dataUrl(canvas));
    }, "image/png");
  });
}
