import { nextLocalCat, registerAlbum } from "../content";
import type { Ink } from "../content/types";
import { assembleAlbum, groupFiles, isAudioFile, signatureOf } from "./album";
import { canvasToUrl, drawSignatureCover, inksFromArtwork, inksFromMeasurement } from "./cover";
import { norm } from "./dsp";
import { isSupported, supportedLabels } from "./formats";
import { Cancelled, Measurer, type MeasurerDeps } from "./measure";
import type { IngestProbe, IngestStatus, LocalGroupDraft } from "./types";

const DECODE_SHARE = 0.35;
const ANALYSIS_SHARE = 0.65;

export interface IngestResult {
  indices: number[];
  rejected: string[];
}

type StatusSink = (status: IngestStatus) => void;

export class IngestSession {
  private measurer: Measurer;
  private aborted = false;
  private silent = false;
  private disposed = false;
  private pending: string[] = [];
  private serial = 0;

  private status: IngestStatus = {
    phase: "reading",
    progress: 0,
    groupIndex: 0,
    groupCount: 0,
    artist: "",
    title: "",
    probe: null,
    error: null,
  };

  constructor(
    private sink: StatusSink,
    deps: MeasurerDeps = {},
  ) {
    this.measurer = new Measurer(deps);
  }

  private emit(patch: Partial<IngestStatus>) {
    if (this.silent) return;
    this.status = { ...this.status, ...patch };
    this.sink(this.status);
  }

  private guard() {
    if (this.aborted) throw new Cancelled();
  }

  cancel() {
    this.aborted = true;
    this.measurer.cancel();
    this.releasePending();
    this.emit({ phase: "cancelled", progress: 0, probe: null });
    this.silent = true;
  }

  dispose() {
    this.aborted = true;
    this.silent = true;
    this.disposed = true;
    this.measurer.dispose();
    this.releasePending();
  }

  private releasePending() {
    for (const url of this.pending) URL.revokeObjectURL(url);
    this.pending = [];
  }

  async run(files: File[]): Promise<IngestResult> {
    if (this.disposed) return { indices: [], rejected: [] };
    this.aborted = false;
    this.silent = false;
    const rejected: string[] = [];
    const usable: File[] = [];
    for (const f of files) {
      if (!isAudioFile(f)) continue;
      if (isSupported(f.name)) usable.push(f);
      else rejected.push(f.name);
    }

    if (usable.length === 0) {
      this.emit({
        phase: "failed",
        error:
          rejected.length > 0
            ? `This browser cannot read those files. It reads: ${supportedLabels().join(", ")}.`
            : "No recognized audio file.",
      });
      return { indices: [], rejected };
    }

    this.emit({ phase: "reading", progress: 0, probe: null, error: null });

    const indices: number[] = [];
    try {
      const drafts = await groupFiles(usable);
      this.guard();
      this.emit({ groupCount: drafts.length });

      for (let g = 0; g < drafts.length; g++) {
        this.guard();
        const draft = drafts[g];
        this.emit({
          groupIndex: g,
          artist: draft.artist,
          title: draft.title,
          probe: null,
          phase: "decoding",
        });
        indices.push(await this.ingestGroup(draft, g, drafts.length));
      }

      this.emit({ phase: "done", progress: 1 });
    } catch (e) {
      this.releasePending();
      if (e instanceof Cancelled || this.aborted) this.emit({ phase: "cancelled", progress: 0 });
      else this.emit({ phase: "failed", error: (e as Error).message });
    } finally {
      this.measurer.dispose();
    }

    return { indices, rejected };
  }

  private async coverUrl(
    draft: LocalGroupDraft,
    envelope: Uint8Array,
    inks: [Ink, Ink],
  ): Promise<string> {
    try {
      if (draft.artwork) return URL.createObjectURL(draft.artwork);
      return await canvasToUrl(drawSignatureCover(envelope, inks[0], inks[1]));
    } catch {
      return "";
    }
  }

  private async ingestGroup(
    draft: LocalGroupDraft,
    groupIndex: number,
    groupCount: number,
  ): Promise<number> {
    const sizes = draft.tracks.map((t) => t.file.size);
    const totalSize = sizes.reduce((a, b) => a + b, 0) || 1;
    const decoded = new Array<number>(draft.tracks.length).fill(0);
    const analysed = new Array<number>(draft.tracks.length).fill(0);

    const report = () => {
      let done = 0;
      for (let i = 0; i < sizes.length; i++) {
        done += (sizes[i] / totalSize) * (DECODE_SHARE * decoded[i] + ANALYSIS_SHARE * analysed[i]);
      }
      this.emit({ progress: (groupIndex + done) / groupCount });
    };

    const { measurement, durations } = await this.measurer.run(
      draft.tracks.map((t) => t.file),
      {
        onDecoded: (i) => {
          decoded[i] = 1;
          report();
        },
        onAnalysis: (i, fraction) => {
          analysed[i] = fraction;
          if (this.status.phase === "decoding") this.emit({ phase: "measuring" });
          report();
        },
        onProbe: (p) => {
          const probe: IngestProbe = {
            loudness: norm(p.loudnessDb, "loudness"),
            dynamics: norm(p.dynamicsDb, "dynamics"),
            brightness: norm(p.brightnessHz, "brightness", true),
            duration: norm(p.durationS, "duration"),
          };
          this.emit({ probe });
        },
        onComposing: () => this.emit({ phase: "measuring" }),
      },
    );
    this.guard();
    this.emit({ phase: "composing" });

    const id = `local-${++this.serial}-${groupIndex}`;
    let inks: [Ink, Ink] | null = null;
    if (draft.artwork) inks = await inksFromArtwork(draft.artwork, id);
    if (!inks) inks = inksFromMeasurement(measurement);
    this.guard();

    const signature = signatureOf(measurement, inks[0], inks[1]);

    const urls = draft.tracks.map((t) => {
      const url = URL.createObjectURL(t.file);
      this.pending.push(url);
      return url;
    });
    const cover = await this.coverUrl(draft, measurement.envelopeBytes, inks);
    if (cover) this.pending.push(cover);
    this.guard();

    const album = assembleAlbum({
      id,
      cat: nextLocalCat(),
      draft,
      durations,
      urls,
      cover,
      signature,
    });

    const index = registerAlbum(album);
    const kept = new Set([...urls, cover].filter(Boolean));
    this.pending = this.pending.filter((u) => !kept.has(u));
    return index;
  }
}

export { Cancelled };
