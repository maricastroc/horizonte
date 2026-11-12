"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { anatomyOf, COLOUR_NOTE, type AnatomyPart, type AnatomyRow, type Invite } from "./anatomy";
import { COLOR } from "./tokens";
import type { FieldEngine } from "./engine/FieldEngine";
import type { Snapshot } from "./types";

export type AlbumView = "tracks" | "anatomy";

const HOLD_MS = 350;

const ROW = "h-[26px] items-center gap-[10px] cursor-pointer " +
  "border-b border-rule-2 w-full text-left transition-colors duration-150";

const ROW_TOUCH = "min-h-[48px] items-center gap-[9px] cursor-pointer " +
  "border-b border-rule-2 w-full text-left transition-colors duration-150";

export function AnatomyTabs({
  view,
  onView,
  invited,
  compact,
  ink,
  enabled,
}: {
  view: AlbumView;
  onView: (v: AlbumView) => void;
  invited: boolean;
  compact: boolean;
  ink: string;
  enabled: boolean;
}) {
  const tab = (v: AlbumView, label: string) => {
    const on = view === v;
    return (
      <button
        type="button"
        role="tab"
        id={`album-tab-${v}`}
        aria-selected={on}
        aria-controls={`album-panel-${v}`}
        tabIndex={enabled ? (on ? 0 : -1) : -1}
        onClick={() => onView(v)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const next = v === "tracks" ? "anatomy" : "tracks";
          onView(next);
          document.getElementById(`album-tab-${next}`)?.focus();
        }}
        className={[
          "relative cursor-pointer whitespace-nowrap transition-colors duration-150",
          compact ? "min-h-[44px]" : "py-1",
          on ? "text-ink-text" : "text-ink-faint hover:text-ink-text",
        ].join(" ")}
        style={on ? { boxShadow: `inset 0 -1px 0 ${ink}` } : undefined}
      >
        {label}
        {v === "anatomy" && invited && !on && (
          <span
            aria-hidden
            className="absolute -right-2.5 top-1/2 block h-[4px] w-[4px] -translate-y-1/2"
            style={{ background: ink }}
          />
        )}
      </button>
    );
  };
  return (
    <div
      role="tablist"
      aria-label="Album views"
      className={[
        "flex items-center gap-6 border-b border-rule-2",
        compact ? "sticky top-0 z-10 bg-void/92 backdrop-blur-sm" : "pb-1",
      ].join(" ")}
    >
      {tab("tracks", "Tracks")}
      {tab("anatomy", "Anatomy")}
    </div>
  );
}

export function AnatomyInvite({
  invite,
  onOpen,
  compact,
  ink,
  enabled,
}: {
  invite: Invite | null;
  onOpen: () => void;
  compact: boolean;
  ink: string;
  enabled: boolean;
}) {
  const [shown, setShown] = useState<Invite | null>(invite);
  if (invite && invite !== shown) setShown(invite);
  if (!shown) return null;
  return (
    <button
      type="button"
      tabIndex={enabled && invite ? 0 : -1}
      aria-hidden={!invite}
      onClick={onOpen}
      onTransitionEnd={() => {
        if (!invite) setShown(null);
      }}
      className={[
        "group grid w-full cursor-pointer grid-cols-[3px_1fr] items-start gap-x-[10px]",
        "border-b border-rule-2 text-left",
        compact ? "min-h-[48px] py-2.5" : "py-2",
        "transition-opacity duration-700 ease-out motion-reduce:transition-none",
        invite ? "opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
    >
      <span aria-hidden className="mt-[3px] block h-[11px] w-[3px]" style={{ background: ink }} />
      <span className="flex flex-col gap-1">
        <span className="normal-case leading-[1.5] tracking-[.05em] text-ink-text-2">{shown.line}</span>
        <span className="text-ink-text group-hover:underline group-focus-visible:underline">
          {shown.part ? "See why ›" : "See how ›"}
        </span>
      </span>
    </button>
  );
}

function CompareControl({
  row,
  on,
  engine,
  compact,
  ink,
  enabled,
}: {
  row: AnatomyRow;
  on: boolean;
  engine: FieldEngine | null;
  compact: boolean;
  ink: string;
  enabled: boolean;
}) {
  const pressed = useRef(0);
  const r = row.reading;
  if (!r) return null;
  if (r.near) {
    return (
      <p className="text-ink-faint">
        Already at the median of the 14 ({r.medianShown})
      </p>
    );
  }
  const set = (v: boolean) => engine?.setCompare(v);
  return (
    <div className="flex flex-col gap-1.5">
      {on && (
        <p className="flex flex-col gap-0.5" aria-hidden>
          <span className="text-ink-text">
            {r.label} · {r.shown} <span style={{ color: ink }}>→</span> {r.medianShown}
          </span>
          <span className="text-ink-faint">Median of the 14 · temporary</span>
        </p>
      )}
      <button
        type="button"
        tabIndex={enabled ? 0 : -1}
        aria-pressed={on}
        aria-label={
          on
            ? `Back to the record: ${r.label.toLowerCase()} ${r.shown}`
            : `Show this record with the median ${r.label.toLowerCase()} of the 14 albums, ` +
              `${r.medianShown}. Temporary.`
        }
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          if (on) {
            set(false);
            pressed.current = 0;
            return;
          }
          set(true);
          pressed.current = performance.now();
        }}
        onPointerUp={() => {
          if (pressed.current && performance.now() - pressed.current >= HOLD_MS) set(false);
          pressed.current = 0;
        }}
        onPointerCancel={() => {
          if (pressed.current) set(false);
          pressed.current = 0;
        }}
        onClick={(e) => {
          if (e.detail !== 0) return;
          set(!on);
        }}
        className={[
          "flex w-fit cursor-pointer items-center whitespace-nowrap transition-colors duration-150",
          compact ? "min-h-[44px]" : "py-0.5",
          on ? "text-ink-text-2 hover:text-ink-text" : "text-ink-text hover:text-white",
        ].join(" ")}
        style={on ? undefined : { boxShadow: `inset 0 -1px 0 ${ink}` }}
      >
        {on ? "◂ Back to the record" : `Try the median ${r.label.toLowerCase()} ▸`}
      </button>
      {!on && !compact && (
        <span className="normal-case tracking-[.06em] text-ink-faint">click, or hold to peek</span>
      )}
    </div>
  );
}

export function AnatomyPanel({
  engine,
  snap,
  compact,
  ink,
  enabled,
}: {
  engine: FieldEngine | null;
  snap: Snapshot;
  compact: boolean;
  ink: string;
  enabled: boolean;
}) {
  const rows = useMemo(() => anatomyOf(snap.alb), [snap.alb]);
  const pinned = snap.focus;
  const compare = snap.compare;
  const reading = rows.find((r) => r.part === pinned)?.reading ?? null;
  const said =
    compare && reading
      ? `${reading.label} set to the median of the 14 albums: ${reading.medianShown} ` +
        `instead of ${reading.shown}. Temporary.`
      : "";

  const openRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    openRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [pinned, compare]);

  const toggle = useCallback(
    (part: AnatomyPart) => engine?.setAnatomyFocus(pinned === part ? null : part),
    [engine, pinned],
  );

  return (
    <div
      id="album-panel-anatomy"
      role="tabpanel"
      aria-labelledby="album-tab-anatomy"
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        if (compare) engine?.setCompare(false);
        else if (pinned) engine?.setAnatomyFocus(null);
        else return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerLeave={() => engine?.previewAnatomy(null)}
    >
      <ul>
        {rows.map((row) => {
          const open = row.part === pinned;
          const id = `anatomy-${row.part}`;
          return (
            <li key={row.part}>
              <button
                type="button"
                tabIndex={enabled ? 0 : -1}
                aria-expanded={open}
                aria-controls={id}
                aria-label={`${row.label}: ${row.word}`}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") engine?.previewAnatomy(row.part);
                }}
                onFocus={() => engine?.previewAnatomy(row.part)}
                onBlur={() => engine?.previewAnatomy(null)}
                onClick={() => toggle(row.part)}
                className={[
                  "grid grid-cols-[1fr_auto_8px] hover:text-ink-text",
                  compact ? ROW_TOUCH : ROW,
                ].join(" ")}
                style={{ color: open ? COLOR.inkText : undefined }}
              >
                <span className="truncate">{row.label}</span>
                <span className={open ? "text-ink-text-2" : "text-ink-faint"}>{row.word}</span>
                {open ? (
                  <span
                    aria-hidden
                    className="block h-[7px] w-[7px] justify-self-end"
                    style={{ background: ink }}
                  />
                ) : (
                  <span aria-hidden className="justify-self-end text-ink-faint">›</span>
                )}
              </button>
              {open && (
                <div
                  id={id}
                  ref={openRef}
                  className={[
                    "flex flex-col gap-2 border-b border-rule-2",
                    compact ? "pt-2 pb-3.5" : "pt-1.5 pb-2.5",
                  ].join(" ")}
                >
                  <p className="normal-case leading-[1.55] tracking-[.04em] text-ink-text-2">
                    {row.sentence}
                  </p>
                  {!compare && <p className="text-ink-faint">{row.detail}</p>}
                  <CompareControl
                    row={row}
                    on={compare}
                    engine={engine}
                    compact={compact}
                    ink={ink}
                    enabled={enabled}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="pt-2 normal-case leading-[1.5] tracking-[.05em] text-ink-faint">{COLOUR_NOTE}</p>
      <p aria-live="polite" className="sr-only">
        {said}
      </p>
    </div>
  );
}
