import type { AlbumMeasurement, AlbumProbe } from "./dsp";

export type IngestRequest =
  | { type: "begin"; session: number; trackCount: number }
  | { type: "track"; session: number; index: number; pcm: Float32Array }
  | { type: "finish"; session: number }
  | { type: "cancel"; session: number };

export type IngestResponse =
  | { type: "progress"; session: number; index: number; done: number; total: number }
  | { type: "probe"; session: number; index: number; probe: AlbumProbe }
  | { type: "result"; session: number; measurement: AlbumMeasurement }
  | { type: "error"; session: number; message: string };
