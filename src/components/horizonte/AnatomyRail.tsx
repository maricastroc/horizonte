"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COLOUR_NOTE, nameFactOf, questionsOf, type Invite, type Question } from "./anatomy";
import type { FieldEngine } from "./engine/FieldEngine";
import type { Snapshot } from "./types";

export type AlbumView = "tracks" | "shape";

const PREVIEW_MS = 150;
const SHOWN = 3;

const QUESTION = "font-bodoni italic normal-case tracking-normal text-ink-text";
const PROSE = "font-archivo normal-case tracking-[.005em]";
const HINT = "normal-case tracking-[.06em] text-ink-faint";

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
          const next = v === "tracks" ? "shape" : "tracks";
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
        {v === "shape" && invited && !on && (
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
      {tab("shape", "Why this shape?")}
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
        "group grid w-full cursor-pointer grid-cols-[3px_1fr] items-start gap-x-[12px]",
        "border-b border-rule-2 text-left",
        compact ? "py-3.5" : "py-3",
        "transition-opacity duration-700 ease-out motion-reduce:transition-none",
        invite ? "opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
    >
      <span aria-hidden className="mt-[5px] block h-[14px] w-[3px]" style={{ background: ink }} />
      <span className="flex flex-col gap-2">
        <span className={`${QUESTION} ${compact ? "text-[18px]" : "text-[16px]"} leading-[1.28]`}>
          {shown.line}
        </span>
        <span className="text-ink-text group-hover:underline group-focus-visible:underline">
          Find out ›
        </span>
      </span>
    </button>
  );
}

function Numbers({ q, extra }: { q: Question; extra: string[] }) {
  const r = q.reading;
  const rows: [string, string][] = [
    ["Measure", r.label],
    ["This record", r.shown],
    ["Usual here", `${r.medianShown} (median of the 14)`],
    ["Standing", r.standing],
    ["Drawn as", q.drawn],
  ];
  return (
    <div className="flex flex-col gap-2 pt-1.5">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[9.5px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-faint">{k}</dt>
            <dd className="normal-case tracking-[.06em] text-ink-text-2">{v}</dd>
          </div>
        ))}
      </dl>
      {extra.map((line) => (
        <p key={line} className={`${PROSE} text-[11.5px] leading-[1.45] text-ink-dim`}>
          {line}
        </p>
      ))}
    </div>
  );
}

export function ShapePanel({
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
  const questions = useMemo(() => questionsOf(snap.alb), [snap.alb]);
  const lead = questions[0];
  const open = questions.find((q) => q.part === snap.focus) ?? lead;
  const key = `${snap.alb}:${open?.part}`;
  const [seen, setSeen] = useState(key);
  const [trying, setTrying] = useState(false);
  const [nums, setNums] = useState(false);
  const [more, setMore] = useState(false);
  if (seen !== key) {
    setSeen(key);
    setTrying(false);
    setNums(false);
  }

  const album = useRef(-1);
  useEffect(() => {
    if (!engine || !enabled || !lead) return;
    if (album.current !== snap.alb) {
      album.current = snap.alb;
      engine.setAnatomyFocus(lead.part);
      return;
    }
    if (!snap.focus) engine.setAnatomyFocus(lead.part);
  }, [engine, enabled, lead, snap.alb, snap.focus]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!open) return null;

  const alt = snap.compare && !snap.peek;
  const pick = (q: Question) => {
    if (timer.current) clearTimeout(timer.current);
    engine?.previewAnatomy(null);
    engine?.setAnatomyFocus(q.part);
  };
  const hover = (q: Question | null) => {
    if (timer.current) clearTimeout(timer.current);
    if (!q) {
      engine?.previewAnatomy(null);
      return;
    }
    timer.current = setTimeout(() => engine?.previewAnatomy(q.part), PREVIEW_MS);
  };
  const leave = () => {
    setTrying(false);
    engine?.setCompare(false);
  };
  const others = questions.filter((q) => q !== open);
  const also = others.filter((q) => questions.indexOf(q) < SHOWN).slice(0, SHOWN - 1);
  const rest = others.filter((q) => !also.includes(q));
  const extra = [nameFactOf(snap.alb), COLOUR_NOTE];
  const said = trying ? (alt ? `${open.label}. ${open.result}` : "As it is.") : "";

  const askButton = (q: Question) => (
    <li key={q.part}>
      <button
        type="button"
        tabIndex={enabled ? 0 : -1}
        onClick={() => pick(q)}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") hover(q);
        }}
        onPointerLeave={() => hover(null)}
        onFocus={() => engine?.previewAnatomy(q.part)}
        onBlur={() => engine?.previewAnatomy(null)}
        className={[
          "grid w-full cursor-pointer grid-cols-[1fr_auto] items-baseline gap-3 border-b border-rule-2",
          "text-left text-ink-mute transition-colors duration-150 hover:text-ink-text",
          compact ? "min-h-[48px] py-2.5" : "py-2",
        ].join(" ")}
      >
        <span className={`${PROSE} text-[12.5px] leading-[1.35]`}>{q.ask}</span>
        <span aria-hidden className="text-ink-faint">›</span>
      </button>
    </li>
  );

  const next = questions[(questions.indexOf(open) + 1) % questions.length];

  return (
    <div
      id="album-panel-shape"
      role="tabpanel"
      aria-labelledby="album-tab-shape"
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !trying) return;
        leave();
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <section
        aria-label={open.ask}
        className={["flex flex-col border-b border-rule-2", compact ? "py-4" : "py-4.5"].join(" ")}
      >
        <h3 className={`${QUESTION} ${compact ? "text-[18px]" : "text-[17px]"} leading-[1.26]`}>
          {trying && open.what ? open.what : open.ask}
        </h3>
        <p
          className={[
            PROSE,
            compact ? "text-[14px]" : "text-[13px]",
            "mt-3 leading-[1.5]",
            trying && alt ? "text-ink-text" : "text-ink-text-2",
          ].join(" ")}
        >
          {trying && alt ? open.result : open.answer}
        </p>

        {!trying &&
          (open.what ? (
            <button
              type="button"
              tabIndex={enabled ? 0 : -1}
              onClick={() => {
                setTrying(true);
                engine?.setCompare(true);
              }}
              className={[
                "mt-4.5 w-fit cursor-pointer whitespace-nowrap text-ink-text hover:text-white",
                compact ? "min-h-[44px]" : "pb-1",
              ].join(" ")}
              style={{ boxShadow: `inset 0 -1px 0 ${ink}` }}
            >
              {open.what} ▸
            </button>
          ) : (
            <p className={`${PROSE} mt-4 text-[12px] leading-[1.45] text-ink-dim`}>
              It already sits where most records here do, so there is nothing to change.
            </p>
          ))}

        {trying && (
          <>
            <div
              role="group"
              aria-label="Compare"
              className={["mt-4.5 flex border border-rule", compact ? "w-full" : "w-fit"].join(" ")}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") engine?.setCompare(false);
                else if (e.key === "ArrowRight") engine?.setCompare(true);
                else return;
                e.preventDefault();
              }}
            >
              {[
                { on: !alt, label: "As it is", value: false },
                { on: alt, label: open.label, value: true },
              ].map((b, i) => (
                <button
                  key={b.label}
                  type="button"
                  tabIndex={enabled ? 0 : -1}
                  aria-pressed={b.on}
                  onClick={() => engine?.setCompare(b.value)}
                  className={[
                    "cursor-pointer whitespace-nowrap transition-colors duration-150",
                    compact ? "min-h-[46px] flex-1 px-3" : "px-4 py-2",
                    i > 0 ? "border-l border-rule" : "",
                    b.on ? "text-ink-text" : "text-ink-faint hover:text-ink-text",
                  ].join(" ")}
                  style={b.on ? { boxShadow: `inset 0 -1px 0 ${ink}` } : undefined}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <p className={`${HINT} mt-3 text-[9.5px]`}>
              {compact ? "Hold the image to compare" : "Hold the image to compare · Esc returns"}
            </p>
          </>
        )}

        <button
          type="button"
          tabIndex={enabled ? 0 : -1}
          aria-expanded={nums}
          onClick={() => setNums((v) => !v)}
          className={[
            "mt-4 w-fit cursor-pointer text-[9.5px] text-ink-dim hover:text-ink-text",
            compact ? "min-h-[40px]" : "",
          ].join(" ")}
        >
          In numbers {nums ? "▾" : "›"}
        </button>
        {nums && <Numbers q={open} extra={compact ? extra : []} />}
        {compact && (
          <button
            type="button"
            tabIndex={enabled ? 0 : -1}
            onClick={() => pick(next)}
            className="mt-1 min-h-[44px] w-fit cursor-pointer text-ink-text-2 hover:text-ink-text"
          >
            Next question ›
          </button>
        )}
      </section>

      {!compact && (
        <>
          <p className="pt-3.5 pb-1 text-ink-faint">Also</p>
          <ul>{also.map(askButton)}</ul>
          <button
            type="button"
            tabIndex={enabled ? 0 : -1}
            aria-expanded={more}
            onClick={() => setMore((v) => !v)}
            className="mt-3 cursor-pointer text-ink-dim hover:text-ink-text"
          >
            More about this shape {more ? "▾" : "›"}
          </button>
          {more && (
            <div className="flex flex-col gap-2.5 pt-2">
              <ul>{rest.map(askButton)}</ul>
              {extra.map((line) => (
                <p key={line} className={`${PROSE} text-[11.5px] leading-[1.45] text-ink-dim`}>
                  {line}
                </p>
              ))}
            </div>
          )}
        </>
      )}

      <p aria-live="polite" className="sr-only">
        {said}
      </p>
    </div>
  );
}
