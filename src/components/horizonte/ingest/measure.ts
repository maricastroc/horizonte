import { decodeToMono, MAX_ALBUM_SECONDS, type DecodeResult } from "./decode";
import type { AlbumMeasurement, AlbumProbe } from "./dsp";
import type { IngestRequest, IngestResponse } from "./protocol";

export class Cancelled extends Error {
  constructor() {
    super("cancelado");
    this.name = "Cancelled";
  }
}

export interface MeasureHooks {
  onDecoded?(index: number, seconds: number): void;
  onAnalysis?(index: number, fraction: number): void;
  onProbe?(probe: AlbumProbe): void;
  onComposing?(): void;
}

export interface MeasureOutput {
  measurement: AlbumMeasurement;
  durations: number[];
  decodeMs: number;
  analysisMs: number;
}

function makeWorker(): Worker {
  return new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
}

export interface MeasurerDeps {
  createWorker?: () => Worker;
  decode?: (file: File) => Promise<DecodeResult>;
}

export class Measurer {
  private worker: Worker | null = null;
  private token = 0;
  private aborted = false;

  constructor(private deps: MeasurerDeps = {}) {}

  cancel() {
    this.aborted = true;
    if (this.worker) {
      this.worker.postMessage({ type: "cancel", session: this.token } satisfies IngestRequest);
    }
    this.dispose();
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
  }

  private guard() {
    if (this.aborted) throw new Cancelled();
  }

  async run(files: File[], hooks: MeasureHooks = {}): Promise<MeasureOutput> {
    this.aborted = false;
    const session = ++this.token;
    const worker = (this.worker ??= (this.deps.createWorker ?? makeWorker)());

    let resolveResult: (m: AlbumMeasurement) => void = () => {};
    let rejectResult: (e: Error) => void = () => {};
    const result = new Promise<AlbumMeasurement>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    let analysisStart = 0;
    let analysisMs = 0;

    const onMessage = (event: MessageEvent<IngestResponse>) => {
      const msg = event.data;
      if (msg.session !== session) return;
      if (msg.type === "progress") {
        hooks.onAnalysis?.(msg.index, msg.total > 0 ? msg.done / msg.total : 1);
      } else if (msg.type === "probe") {
        hooks.onProbe?.(msg.probe);
      } else if (msg.type === "result") {
        analysisMs = performance.now() - analysisStart;
        resolveResult(msg.measurement);
      } else if (msg.type === "error") {
        rejectResult(new Error(msg.message));
      }
    };
    worker.addEventListener("message", onMessage);

    try {
      worker.postMessage({ type: "begin", session, trackCount: files.length });
      analysisStart = performance.now();

      const durations: number[] = [];
      let decodeMs = 0;
      let albumSeconds = 0;

      for (let i = 0; i < files.length; i++) {
        this.guard();
        const t0 = performance.now();
        let decoded;
        try {
          decoded = await (this.deps.decode ?? decodeToMono)(files[i]);
        } catch (e) {
          throw new Error(`could not read "${files[i].name}": ${(e as Error).message}`);
        }
        decodeMs += performance.now() - t0;
        this.guard();

        albumSeconds += decoded.seconds;
        if (albumSeconds > MAX_ALBUM_SECONDS) {
          throw new Error("record too long to measure in one pass");
        }
        durations.push(decoded.seconds);
        hooks.onDecoded?.(i, decoded.seconds);

        worker.postMessage({ type: "track", session, index: i, pcm: decoded.pcm }, [
          decoded.pcm.buffer,
        ]);
      }

      hooks.onComposing?.();
      worker.postMessage({ type: "finish", session });
      const measurement = await result;
      this.guard();
      return { measurement, durations, decodeMs, analysisMs };
    } finally {
      worker.removeEventListener("message", onMessage);
    }
  }
}
