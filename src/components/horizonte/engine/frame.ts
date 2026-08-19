export interface FrameOut {
  progress: number;
  position: number;
  duration: number;
}

export type FrameSink = (frame: FrameOut) => void;
