"use client";

import { useCallback, useRef, useState } from "react";
import { CURATION } from "@/components/horizonte/content/curation.generated";
import { SIGNATURES } from "@/components/horizonte/content/signature.generated";
import { ENVELOPE_N, envelopeOf } from "@/components/horizonte/content/signature";
import { mediaUrl } from "@/components/horizonte/content/assets";
import { encodeEnvelope, norm } from "@/components/horizonte/ingest/dsp";
import { Measurer } from "@/components/horizonte/ingest/measure";
import { fieldConstantsOf, RANGE, type FieldConstants } from "@/components/horizonte/field";
import { trackBiasOf } from "@/components/horizonte/content/signature";
import type { AlbumSignature } from "@/components/horizonte/content/signature";

interface Row {
  slug: string;
  tracks: number;
  scalars: { key: string; got: number; want: number; pct: number }[];
  correlation: number;
  maxByte: number;
  identicalEnvelope: boolean;
  spansMaxPct: number;
  devIdx: number;
  devOver8: number;
  window: { i: number; got: number; want: number }[];
  envLo: number;
  envHi: number;
  constants: { key: string; got: number; want: number; pctOfRange: number }[];
  biasMax: { loudness: number; dynamics: number };
  normals: { key: string; got: number; want: number }[];
  fetchMs: number;
  decodeMs: number;
  analysisMs: number;
  audioSeconds: number;
  error?: string;
}

const rel = (got: number, want: number) =>
  want === 0 ? Math.abs(got) : Math.abs((got - want) / want) * 100;

function pearson(a: Float32Array, b: Float32Array) {
  const n = a.length;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return num / Math.sqrt(da * db);
}

export default function Parity() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState("");
  const measurer = useRef(new Measurer());

  const runOne = useCallback(async (slug: string): Promise<Row> => {
    const album = CURATION.find((a) => a.id === slug)!;
    const want = SIGNATURES[slug];
    const t0 = performance.now();
    const files: File[] = [];
    for (const track of album.tracks) {
      if (track.source.kind !== "local") continue;
      let response = await fetch(track.source.src);
      if (!response.ok) response = await fetch(mediaUrl(track.source.src));
      const blob = await response.blob();
      files.push(new File([blob], track.source.src.split("/").pop() ?? "track.m4a"));
    }
    const fetchMs = performance.now() - t0;

    const { measurement, decodeMs, analysisMs } = await measurer.current.run(files);

    const wantEnv = envelopeOf(want);
    const gotEnv = new Float32Array(ENVELOPE_N);
    for (let i = 0; i < ENVELOPE_N; i++) gotEnv[i] = measurement.envelopeBytes[i] / 255;
    let maxByte = 0;
    let devIdx = 0;
    let devOver8 = 0;
    for (let i = 0; i < ENVELOPE_N; i++) {
      const d = Math.abs(gotEnv[i] - wantEnv[i]) * 255;
      if (d > 8) devOver8++;
      if (d > maxByte) {
        maxByte = d;
        devIdx = i;
      }
    }
    const window: { i: number; got: number; want: number }[] = [];
    for (let i = Math.max(0, devIdx - 4); i < Math.min(ENVELOPE_N, devIdx + 5); i++) {
      window.push({ i, got: Math.round(gotEnv[i] * 255), want: Math.round(wantEnv[i] * 255) });
    }

    const gotSignature: AlbumSignature = {
      loudness: norm(measurement.loudnessDb, "loudness"),
      dynamics: norm(measurement.dynamicsDb, "dynamics"),
      brightness: norm(measurement.brightnessHz, "brightness", true),
      duration: norm(measurement.durationS, "duration"),
      pulse: norm(measurement.pulse, "pulse"),
      measured: {
        loudnessDb: measurement.loudnessDb,
        dynamicsDb: measurement.dynamicsDb,
        brightnessHz: measurement.brightnessHz,
        rolloffHz: measurement.rolloffHz,
        bassRatio: measurement.bassRatio,
        pulse: measurement.pulse,
        durationS: measurement.durationS,
      },
      spans: measurement.spans,
      envelope: encodeEnvelope(measurement.envelopeBytes),
      reference: measurement.reference,
    };

    const gotConstants = fieldConstantsOf(gotSignature);
    const wantConstants = fieldConstantsOf(want);
    const constants = (Object.keys(RANGE) as (keyof FieldConstants)[]).map((key) => {
      const span = Math.abs(RANGE[key][1] - RANGE[key][0]);
      return {
        key,
        got: gotConstants[key],
        want: wantConstants[key],
        pctOfRange: (Math.abs(gotConstants[key] - wantConstants[key]) / span) * 100,
      };
    });

    const n = album.tracks.length;
    const gotBias = trackBiasOf(gotSignature, n);
    const wantBias = trackBiasOf(want, n);
    const biasMax = { loudness: 0, dynamics: 0 };
    for (let i = 0; i < n; i++) {
      biasMax.loudness = Math.max(biasMax.loudness, Math.abs(gotBias[i].loudness - wantBias[i].loudness));
      biasMax.dynamics = Math.max(biasMax.dynamics, Math.abs(gotBias[i].dynamics - wantBias[i].dynamics));
    }

    const scalars = [
      ["loudnessDb", measurement.loudnessDb, want.measured.loudnessDb],
      ["dynamicsDb", measurement.dynamicsDb, want.measured.dynamicsDb],
      ["brightnessHz", measurement.brightnessHz, want.measured.brightnessHz],
      ["rolloffHz", measurement.rolloffHz, want.measured.rolloffHz],
      ["bassRatio", measurement.bassRatio, want.measured.bassRatio],
      ["pulse", measurement.pulse, want.measured.pulse],
      ["durationS", measurement.durationS, want.measured.durationS],
    ].map(([key, got, wantV]) => ({
      key: key as string,
      got: got as number,
      want: wantV as number,
      pct: rel(got as number, wantV as number),
    }));

    const spansMaxPct = Math.max(
      ...measurement.spans.map((s, i) => rel(s, want.spans[i] ?? s)),
      0,
    );

    return {
      slug,
      tracks: files.length,
      scalars,
      correlation: pearson(gotEnv, wantEnv),
      maxByte,
      identicalEnvelope: encodeEnvelope(measurement.envelopeBytes) === want.envelope,
      spansMaxPct,
      devIdx,
      devOver8,
      window,
      envLo: measurement.envelopeLo,
      envHi: measurement.envelopeHi,
      constants,
      biasMax,
      normals: [
        { key: "loudness", got: norm(measurement.loudnessDb, "loudness"), want: want.loudness },
        { key: "dynamics", got: norm(measurement.dynamicsDb, "dynamics"), want: want.dynamics },
        {
          key: "brightness",
          got: norm(measurement.brightnessHz, "brightness", true),
          want: want.brightness,
        },
        { key: "duration", got: norm(measurement.durationS, "duration"), want: want.duration },
      ],
      fetchMs,
      decodeMs,
      analysisMs,
      audioSeconds: measurement.durationS,
    };
  }, []);

  const runAll = useCallback(
    async (slugs: string[]) => {
      setRows([]);
      for (const slug of slugs) {
        setBusy(slug);
        try {
          const row = await runOne(slug);
          setRows((prev) => [...prev, row]);
        } catch (e) {
          setRows((prev) => [
            ...prev,
            {
              slug,
              tracks: 0,
              scalars: [],
              correlation: 0,
              maxByte: 0,
              identicalEnvelope: false,
              spansMaxPct: 0,
              devIdx: 0,
              devOver8: 0,
              window: [],
              envLo: 0,
              envHi: 0,
              constants: [],
              biasMax: { loudness: 0, dynamics: 0 },
              normals: [],
              fetchMs: 0,
              decodeMs: 0,
              analysisMs: 0,
              audioSeconds: 0,
              error: (e as Error).message,
            },
          ]);
        }
      }
      setBusy("");
    },
    [runOne],
  );

  return (
    <main className="min-h-dvh overflow-auto bg-void p-8 font-mono text-[11px] text-ink-text">
      <h1 className="mb-4 uppercase tracking-[.2em]">Parity — browser vs offline pipeline</h1>
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="cursor-pointer border border-rule px-3 py-1.5 uppercase tracking-[.2em]"
          onClick={() => void runAll(CURATION.map((a) => a.id))}
        >
          Measure all {CURATION.length}
        </button>
        {CURATION.map((a) => (
          <button
            key={a.id}
            type="button"
            className="cursor-pointer border border-rule-2 px-2 py-1 text-ink-mute"
            onClick={() => void runAll([a.id])}
          >
            {a.id}
          </button>
        ))}
      </div>

      {busy && <p className="mb-4 text-ink-mute">measuring {busy}…</p>}

      <pre id="parity-output" className="whitespace-pre-wrap text-ink-text-2">
        {JSON.stringify(rows, null, 1)}
      </pre>
    </main>
  );
}
