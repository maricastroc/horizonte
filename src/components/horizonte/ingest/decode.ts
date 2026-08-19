import { SR, downmix } from "./dsp";

export const MAX_FILE_BYTES = 320 * 1024 * 1024;
export const MAX_TRACK_SECONDS = 45 * 60;
export const MAX_ALBUM_SECONDS = 3 * 60 * 60;

type OfflineCtor = new (channels: number, length: number, rate: number) => OfflineAudioContext;

function offlineCtor(): OfflineCtor {
  type W = typeof globalThis & {
    OfflineAudioContext?: OfflineCtor;
    webkitOfflineAudioContext?: OfflineCtor;
  };
  const g = globalThis as W;
  const Ctor = g.OfflineAudioContext ?? g.webkitOfflineAudioContext;
  if (!Ctor) throw new Error("OfflineAudioContext indisponível neste navegador");
  return Ctor;
}

function decodeAudioData(ctx: OfflineAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  const out = ctx.decodeAudioData(data);
  if (out && typeof (out as Promise<AudioBuffer>).then === "function") {
    return out as Promise<AudioBuffer>;
  }
  return new Promise((resolve, reject) => {
    (ctx as unknown as {
      decodeAudioData(
        d: ArrayBuffer,
        ok: (b: AudioBuffer) => void,
        fail: (e: unknown) => void,
      ): void;
    }).decodeAudioData(data, resolve, (e) => reject(e));
  });
}

function channelsOf(buffer: AudioBuffer): Float32Array[] {
  const out: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) out.push(buffer.getChannelData(c));
  return out;
}

async function resampleChannels(buffer: AudioBuffer): Promise<Float32Array[]> {
  const Ctor = offlineCtor();
  const length = Math.max(1, Math.ceil((buffer.length * SR) / buffer.sampleRate));
  const off = new Ctor(buffer.numberOfChannels, length, SR);
  const src = off.createBufferSource();
  src.buffer = buffer;
  src.connect(off.destination);
  src.start(0);
  const rendered = await off.startRendering();
  return channelsOf(rendered).map((c) => c.slice());
}

export interface DecodeResult {
  pcm: Float32Array;
  seconds: number;
  sourceRate: number;
  resampled: boolean;
}

export async function decodeToMono(file: File): Promise<DecodeResult> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`arquivo grande demais (${Math.round(file.size / 1048576)} MB)`);
  }
  const Ctor = offlineCtor();
  const ctx = new Ctor(1, 1, SR);
  const buffer = await decodeAudioData(ctx, await file.arrayBuffer());
  const seconds = buffer.length / buffer.sampleRate;
  if (seconds > MAX_TRACK_SECONDS) {
    throw new Error(`faixa longa demais (${Math.round(seconds / 60)} min)`);
  }

  if (buffer.sampleRate === SR) {
    return { pcm: downmix(channelsOf(buffer)), seconds, sourceRate: buffer.sampleRate, resampled: false };
  }
  const pcm = downmix(await resampleChannels(buffer));
  return { pcm, seconds, sourceRate: buffer.sampleRate, resampled: true };
}
