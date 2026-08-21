"use client";

import { COLOR } from "./tokens";
import type { IngestProbe, IngestStatus } from "./ingest/types";

interface Reading {
  key: keyof IngestProbe;
  label: string;
  at: number;
  words: [string, string, string];
}

const READINGS: Reading[] = [
  { key: "loudness", label: "its weight", at: 0.2, words: ["light", "dense", "heavy"] },
  {
    key: "dynamics",
    label: "its dynamics",
    at: 0.42,
    words: ["compressed", "breathing", "open"],
  },
  { key: "brightness", label: "its light", at: 0.62, words: ["dark", "warm", "cutting"] },
  { key: "duration", label: "its crossing", at: 0.82, words: ["short", "long", "vast"] },
];

const wordFor = (r: Reading, probe: IngestProbe | null) => {
  if (!probe) return null;
  const v = probe[r.key];
  return r.words[v < 1 / 3 ? 0 : v < 2 / 3 ? 1 : 2];
};

const HEADLINE: Record<IngestStatus["phase"], string> = {
  reading: "opening the record",
  decoding: "measuring the record",
  measuring: "measuring the record",
  composing: "tracing the horizon",
  done: "the record is in",
  failed: "could not measure it",
  cancelled: "measurement stopped",
};

export default function Ceremony({
  status,
  onCancel,
}: {
  status: IngestStatus;
  onCancel: () => void;
}) {
  const failed = status.phase === "failed";
  const settled = status.phase === "done" || failed || status.phase === "cancelled";
  const name = [status.artist, status.title].filter(Boolean).join(" · ");

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "pointer-events-auto fixed left-1/2 top-1/2 w-80 -translate-x-1/2 -translate-y-1/2",
        "flex flex-col gap-3.5 border border-rule backdrop-blur-md bg-void/96 px-5 py-4.5",
        "transition-opacity duration-300 ease-out compact:w-[calc(100vw-2rem)]",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-ink-text">{HEADLINE[status.phase]}</span>
        {status.groupCount > 1 && !settled && (
          <span className="text-ink-faint">
            {status.groupIndex + 1}/{status.groupCount}
          </span>
        )}
      </div>

      {name && <span className="truncate text-ink-text-2 normal-case tracking-[.12em]">{name}</span>}

      <div className="h-px w-full bg-[rgba(232,228,220,.16)]">
        <div
          className="h-px transition-[width] duration-200 ease-out"
          style={{
            width: `${Math.round((failed ? 0 : status.progress) * 100)}%`,
            background: COLOR.inkText,
          }}
        />
      </div>

      {failed ? (
        <p className="normal-case tracking-[.08em] text-ink-mute">{status.error}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {READINGS.map((r) => {
            const shown = status.progress >= r.at || settled;
            const word = wordFor(r, status.probe);
            return (
              <li
                key={r.key}
                className="flex items-baseline justify-between gap-4 transition-opacity duration-500"
                style={{ opacity: shown ? 1 : 0 }}
              >
                <span className="text-ink-mute">{r.label}</span>
                <span style={{ color: word ? COLOR.inkText2 : COLOR.inkGhost }}>
                  {word ?? "—"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-baseline justify-between gap-4">
        <span className="text-ink-faint normal-case tracking-[.08em]">
          Nothing leaves this device.
        </span>
        {!settled && (
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer whitespace-nowrap text-ink-faint hover:text-ink-text"
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
