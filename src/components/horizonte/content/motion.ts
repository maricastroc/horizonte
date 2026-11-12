import { MOTIONS } from "./motion.generated";

export interface TrackMotion {
  sharpness: number;
  sustain: number;
  weight: number;
  contrast: number;
  beat: number;
}

export function curatedMotionOf(albumId: string): (TrackMotion | null)[] | null {
  return MOTIONS[albumId] ?? null;
}
