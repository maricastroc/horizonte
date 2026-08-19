import {
  AbortAnalysis,
  analyzeTrackPcm,
  composeAlbum,
  probeAlbum,
  type TrackAnalysis,
} from "./dsp";
import type { IngestRequest, IngestResponse } from "./protocol";

export interface WorkerCore {
  handle(msg: IngestRequest): void;
}

export function createWorkerCore(post: (msg: IngestResponse) => void): WorkerCore {
  let session = -1;
  let cancelled = false;
  let analyses: TrackAnalysis[] = [];

  return {
    handle(msg) {
      if (msg.type === "begin") {
        session = msg.session;
        cancelled = false;
        analyses = [];
        return;
      }

      if (msg.type === "cancel") {
        if (msg.session === session) {
          cancelled = true;
          analyses = [];
        }
        return;
      }

      if (msg.session !== session || cancelled) return;

      if (msg.type === "track") {
        try {
          analyses[msg.index] = analyzeTrackPcm(
            msg.pcm,
            (done, total) => post({ type: "progress", session, index: msg.index, done, total }),
            () => cancelled,
          );
          const probe = probeAlbum(analyses.filter(Boolean));
          if (probe) post({ type: "probe", session, index: msg.index, probe });
        } catch (e) {
          if (e instanceof AbortAnalysis) return;
          cancelled = true;
          analyses = [];
          post({ type: "error", session, message: (e as Error).message });
        }
        return;
      }

      try {
        post({ type: "result", session, measurement: composeAlbum(analyses.filter(Boolean)) });
      } catch (e) {
        post({ type: "error", session, message: (e as Error).message });
      }
      analyses = [];
    },
  };
}
