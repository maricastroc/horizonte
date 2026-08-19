import type { AlbumSignature } from "../content/signature";
import { initialState } from "../state";
import type { FieldState } from "../types";

export const baseState = (over: Partial<FieldState> = {}): FieldState => ({
  ...initialState(),
  ...over,
});

export function signature(
  loudness: number,
  dynamics: number,
  brightness: number,
  duration: number,
  spans: number[] = [],
  envelope = "",
): AlbumSignature {
  return {
    loudness,
    dynamics,
    brightness,
    duration,
    measured: {
      loudnessDb: -22,
      dynamicsDb: 24,
      brightnessHz: 720,
      rolloffHz: 1600,
      bassRatio: 0.5,
      durationS: 2400,
    },
    spans,
    envelope,
    reference: {
      bass: [0.2, 0.85],
      mid: [0.15, 0.7],
      treb: [0.02, 0.45],
      rms: [0.01, 0.09],
    },
  };
}

export const encodeEnvelope = (bytes: number[]) =>
  Buffer.from(Uint8Array.from(bytes)).toString("base64");
