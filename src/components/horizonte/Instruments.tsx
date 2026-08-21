"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Ceremony from "./Ceremony";
import { ALBUMS } from "./content";
import { FULL_BANDS } from "./composition/bands";
import { ACCEPT } from "./ingest/formats";
import { useIngest } from "./ingest/useIngest";
import { timecode } from "./format";
import { COLOR, IDLE_OPACITY, rgba } from "./tokens";
import type { Fault, Scale, Snapshot } from "./types";
import type { FieldEngine } from "./engine/FieldEngine";

const DEFAULT_SNAPSHOT: Snapshot = {
  scale: "collection",
  bands: FULL_BANDS,
  mode: "stopped",
  alb: 0,
  navAlb: 0,
  sel: 0,
  trk: 0,
  playAlb: -1,
  hoverTrk: -1,
  hoverAlb: -1,
  idle: false,
  variant: "desktop",
  announce: `Collection · ${ALBUMS.length} bodies`,
  fault: null,
};

const noop = () => () => {};
const getDefault = () => DEFAULT_SNAPSHOT;

const LEVELS: { key: Scale; label: string }[] = [
  { key: "collection", label: "Collection" },
  { key: "album", label: "Album" },
  { key: "track", label: "Track" },
];

const ROW = "h-[26px] items-center gap-[10px] cursor-pointer " +
  "border-b border-rule-2 w-full text-left transition-colors duration-150";

const ROW_TOUCH = "min-h-[48px] items-center gap-[9px] cursor-pointer " +
  "border-b border-rule-2 w-full text-left transition-colors duration-150";

const MARK = "block justify-self-end w-[5px] h-[5px]";
const MARK_ON = "block justify-self-end w-[7px] h-[7px]";

const TAP = "flex min-h-[44px] cursor-pointer items-center whitespace-nowrap";

const ARIA_MS = 1000;

const SEEK_STEPS = 1000;
const SEEK_KEY_S = 5;

const FAULT: Record<Fault, string> = {
  source: "Could not load this track.",
  blocked: "The browser blocked the sound — ask again.",
};

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

export const isInstrumentsTarget = (e: Event) => {
  const target = e.target as HTMLElement | null;
  return !!target?.closest?.("[data-instruments]");
};

export default function Instruments({ engine }: { engine: FieldEngine | null }) {
  const snap = useSyncExternalStore(
    engine?.subscribe ?? noop,
    engine?.getSnapshot ?? getDefault,
    getDefault,
  );

  const { status, dragging, ingest, cancel } = useIngest(engine);
  const fileRef = useRef<HTMLInputElement>(null);

  const seekRef = useRef<HTMLInputElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);
  const durRef = useRef<HTMLSpanElement>(null);
  const scrubbing = useRef(false);

  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    if (!engine) return;
    engine.setVolume(volume);
    engine.setMuted(muted);
  }, [engine, volume, muted]);

  const album = ALBUMS[snap.alb];
  const ink = rgba(album.inkA, 1);
  const barInk = rgba(ALBUMS[snap.playAlb >= 0 ? snap.playAlb : snap.alb].inkA, 0.95);
  const focusAlb = snap.scale === "collection" ? snap.navAlb : snap.alb;

  useEffect(() => {
    if (!engine) return;
    const tc = tcRef.current;
    const dur = durRef.current;
    const seek = seekRef.current;
    let ariaAt = 0;

    return engine.onFrame(({ progress, position, duration }) => {
      if (dur) {
        if (tc) tc.textContent = timecode(position);
        dur.textContent = timecode(duration);
      } else if (tc) {
        tc.textContent = `${timecode(position)} / ${timecode(duration)}`;
      }
      if (!seek || scrubbing.current) return;

      seek.style.setProperty("--fill", `${progress * 100}%`);
      seek.value = String(Math.round(progress * SEEK_STEPS));

      const now = performance.now();
      if (now - ariaAt > ARIA_MS) {
        ariaAt = now;
        seek.setAttribute("aria-valuetext", `${timecode(position)} of ${timecode(duration)}`);
      }
    });
  }, [engine, snap.variant]);

  const intent = useCallback(() => engine?.markIntent(), [engine]);

  const pick = useCallback(() => fileRef.current?.click(), []);

  const onPicked = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = [...(e.target.files ?? [])];
      e.target.value = "";
      void ingest(picked);
    },
    [ingest],
  );

  const onSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      el.style.setProperty("--fill", `${(Number(el.value) / SEEK_STEPS) * 100}%`);
      engine?.seekFraction(Number(el.value) / SEEK_STEPS);
    },
    [engine],
  );

  const onSeekKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!engine) return;
      const { duration, progress } = engine.frameOut;
      if (!duration) return;
      let seconds: number | null = null;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") seconds = -SEEK_KEY_S;
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") seconds = SEEK_KEY_S;
      else if (e.key === "Home") seconds = -duration;
      else if (e.key === "End") seconds = duration;
      if (seconds === null) return;
      e.preventDefault();
      engine.seekFraction(progress + seconds / duration);
    },
    [engine],
  );

  const onVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setVolume(Number(e.currentTarget.value) / 100);
      setMuted(false);
    },
    [],
  );

  const toggleMute = useCallback(() => setMuted((v) => !v), []);

  const trackRailOn = snap.scale !== "collection";
  const compact = snap.variant === "mobile";
  const albumRailOn = compact ? snap.scale === "collection" && railOpen : true;
  const b = snap.bands;

  const focusStyle = useMemo(
    () => ({ ["--focus-ink" as string]: ink }) as React.CSSProperties,
    [ink],
  );

  const shownVolume = muted ? 0 : volume;

  const credit = [album.license.attribution, album.note].filter(Boolean).join(" — ");

  const context = compact
    ? snap.scale === "collection"
      ? `${snap.navAlb + 1}/${ALBUMS.length}`
      : `${album.tracks.length} tracks`
    : snap.scale === "collection"
      ? `Collection · ${snap.navAlb + 1}/${ALBUMS.length}`
      : `${album.cat} · ${album.tracks.length} tracks`;

  const licenseLink = album.license.source ? (
    <a
      href={album.license.source}
      target="_blank"
      rel="noreferrer"
      title={credit}
      className="cursor-pointer whitespace-nowrap text-ink-mute hover:text-ink-text"
    >
      {album.license.name}
    </a>
  ) : (
    <span title={credit} className="whitespace-nowrap text-ink-mute">
      {album.license.name}
    </span>
  );

  const breadcrumb = (
    <nav aria-label="Scale">
      <ol className="flex items-center gap-2.5">
        {LEVELS.map((lvl, i) => {
          const cur = LEVELS.findIndex((l) => l.key === snap.scale);
          const color = i === cur ? COLOR.inkText : i < cur ? COLOR.inkText2 : COLOR.inkFaint;
          return (
            <li key={lvl.key} className="flex items-center gap-2.5">
              {i > 0 && <span aria-hidden className="text-chevron">›</span>}
              <button
                type="button"
                style={{ color }}
                aria-current={i === cur ? "step" : undefined}
                onClick={() => engine?.goScale(lvl.key)}
                className={
                  compact
                    ? `${TAP} px-0.5`
                    : "cursor-pointer py-0.75 hover:text-ink-text"
                }
              >
                {lvl.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );

  const albumRows = ALBUMS.map((a, i) => {
    const isCur = i === focusAlb;
    const isHov = i === snap.hoverAlb;
    return (
      <li key={a.cat}>
        <button
          type="button"
          tabIndex={albumRailOn ? 0 : -1}
          aria-current={isCur ? "true" : undefined}
          style={{ color: isCur ? COLOR.inkText : isHov ? COLOR.inkHover : undefined }}
          onPointerEnter={() => engine?.setRailAlb(i)}
          onPointerLeave={() => engine?.setRailAlb(-1)}
          onFocus={() => engine?.setRailAlb(i)}
          onBlur={() => engine?.setRailAlb(-1)}
          onClick={() => {
            setRailOpen(false);
            engine?.enterAlbum(i);
          }}
          className={`grid grid-cols-[1fr_46px_7px] hover:text-ink-text ${
            compact ? ROW_TOUCH : ROW
          }`}
        >
          <span className="truncate">{a.artist}</span>
          <span className="text-right text-ink-mute">{a.cat}</span>
          <span
            aria-hidden
            className={MARK}
            style={{
              background: isCur
                ? rgba(a.inkA, 1)
                : i === snap.playAlb
                  ? rgba(a.inkA, 0.5)
                  : COLOR.inkGhost,
            }}
          />
        </button>
      </li>
    );
  });

  const intake = (
    <>
      <button
        type="button"
        tabIndex={albumRailOn ? 0 : -1}
        onClick={pick}
        onPointerEnter={() => {
          engine?.setRailAlb(-1);
          engine?.setIntake(true);
        }}
        onPointerLeave={() => engine?.setIntake(false)}
        onFocus={() => engine?.setIntake(true)}
        onBlur={() => engine?.setIntake(false)}
        className={[
          "group mt-2.5 grid w-full flex-none cursor-pointer grid-cols-[1fr_7px] items-center gap-[10px]",
          "border-t border-rule pt-2.5 text-left",
          compact ? "min-h-[52px]" : "h-[34px]",
          "transition-colors duration-200 hover:text-ink-text focus-visible:text-ink-text",
          dragging ? "text-ink-text" : "text-ink-text-2",
        ].join(" ")}
      >
        <span className="truncate">{dragging ? "Drop to measure" : "Bring a record"}</span>
        <span
          aria-hidden
          className={[
            "block h-[7px] w-[7px] justify-self-end border transition-colors duration-200",
            "group-hover:border-paper group-hover:bg-paper",
            "group-focus-visible:border-paper group-focus-visible:bg-paper",
            dragging ? "border-paper bg-paper" : "border-ink-faint",
          ].join(" ")}
        />
      </button>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPT}
        tabIndex={-1}
        aria-hidden
        onChange={onPicked}
        className="sr-only"
      />
    </>
  );

  const trackRows = album.tracks.map((t, i) => {
    const isPlay = snap.playAlb === snap.alb && i === snap.trk;
    const isSel = i === snap.sel;
    const isHov = i === snap.hoverTrk;
    return (
      <li key={t.id}>
        <button
          type="button"
          tabIndex={trackRailOn ? 0 : -1}
          aria-current={isPlay ? "true" : undefined}
          style={{
            color: isPlay ? ink : isSel ? COLOR.inkText : isHov ? COLOR.inkHover : undefined,
          }}
          onPointerEnter={() => engine?.setRailTrk(i)}
          onPointerLeave={() => engine?.setRailTrk(-1)}
          onFocus={() => engine?.setRailTrk(i)}
          onBlur={() => engine?.setRailTrk(-1)}
          onClick={() => engine?.playTrack(snap.alb, i)}
          className={
            compact
              ? `grid grid-cols-[3px_16px_1fr_38px_7px] ${ROW_TOUCH}`
              : `grid grid-cols-[22px_1fr_34px_7px] hover:text-ink-text ${ROW}`
          }
        >
          {compact && (
            <span
              aria-hidden
              className="block h-[18px] w-[3px]"
              style={{ background: isPlay ? ink : isSel ? COLOR.inkFaint : "transparent" }}
            />
          )}
          <span className={compact ? "text-ink-mute" : undefined}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className={compact ? "truncate text-ink-text-2" : "truncate"}>{t.title}</span>
          <span className={compact ? "text-right text-ink-mute" : "text-right text-ink-faint"}>
            {timecode(t.dur)}
          </span>
          <span
            aria-hidden
            className={isPlay || isSel ? MARK_ON : MARK}
            style={{ background: isPlay ? ink : isSel ? COLOR.inkText : COLOR.inkGhost }}
          />
        </button>
      </li>
    );
  });

  const transport = (dense: boolean) => (
    <>
      <button
        type="button"
        onClick={() => engine?.skip(-1)}
        className={
          dense
            ? `${TAP} flex-none`
            : "flex-none cursor-pointer whitespace-nowrap hover:text-ink-text"
        }
      >
        ◂◂ Previous
      </button>
      <button
        type="button"
        aria-pressed={snap.mode === "playing"}
        onClick={() => engine?.transport()}
        className={[
          dense
            ? `${TAP} flex-none tracking-[.18em]`
            : "flex-none cursor-pointer whitespace-nowrap tracking-[.22em] hover:text-white",
          "text-ink-text",
        ].join(" ")}
      >
        {snap.mode === "playing"
          ? "❙❙ Pause"
          : snap.playAlb >= 0 && snap.scale === "track"
            ? "▸ Resume"
            : "▸ Play"}
      </button>
      <button
        type="button"
        onClick={() => engine?.skip(1)}
        className={
          dense
            ? `${TAP} flex-none`
            : "flex-none cursor-pointer whitespace-nowrap hover:text-ink-text"
        }
      >
        Next ▸▸
      </button>
    </>
  );

  const seek = (dense: boolean) => (
    <input
      ref={seekRef}
      type="range"
      min={0}
      max={SEEK_STEPS}
      step={1}
      defaultValue={0}
      aria-label="Position in track"
      aria-valuetext="00:00 of 00:00"
      onChange={onSeek}
      onKeyDown={onSeekKey}
      onPointerDown={() => {
        scrubbing.current = true;
      }}
      onPointerUp={() => {
        scrubbing.current = false;
      }}
      onPointerCancel={() => {
        scrubbing.current = false;
      }}
      style={{ ["--range-ink" as string]: barInk }}
      className={`rail-range w-full ${dense ? "h-10" : "h-2.25"}`}
    />
  );

  const fault = snap.fault && (
    <p role="status" className="normal-case tracking-[.08em] text-ink-text-2">
      {FAULT[snap.fault]}
    </p>
  );

  const shell = (children: React.ReactNode) => (
    <div
      data-instruments=""
      style={focusStyle}
      onPointerMove={intent}
      className={[
        "pointer-events-none absolute cursor-default select-none instruments-safe",
        "font-mono uppercase",
        compact
          ? "text-[10.5px] tracking-[.14em] text-ink-text-2"
          : "text-[10.5px] tracking-[.2em] text-ink-mute",
        "transition-opacity duration-350 ease-out",
      ].join(" ")}
      data-idle={snap.idle ? "" : undefined}
    >
      <style>{`[data-instruments][data-idle]{opacity:${IDLE_OPACITY}}[data-instruments]{opacity:1}`}</style>
      {children}
      {status && <Ceremony status={status} onCancel={cancel} />}
      <p aria-live="polite" className="sr-only">
        {snap.announce}
      </p>
    </div>
  );

  if (compact) {
    const gut = pct(b.gutter);
    return shell(
      <>
        <div
          className="pointer-events-auto absolute flex flex-col justify-center gap-0.5"
          style={{ left: gut, right: gut, top: 0, height: pct(b.top) }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-ink-text">Horizonte</h1>
            <span className="whitespace-nowrap text-ink-mute">
              {context} · {licenseLink}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            {breadcrumb}
            {snap.scale === "collection" && (
              <button
                type="button"
                aria-expanded={railOpen}
                aria-controls="album-rail"
                onClick={() => setRailOpen((v) => !v)}
                className={`${TAP} text-ink-text`}
              >
                {railOpen ? "Close" : "Albums"}
              </button>
            )}
          </div>
        </div>

        <nav
          id="album-rail"
          aria-label="Albums"
          aria-hidden={!albumRailOn}
          className={[
            "absolute flex flex-col border-t border-rule",
            "bg-void/88 backdrop-blur-md",
            "transition-opacity duration-250 ease-out",
            albumRailOn ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
          style={{
            left: gut,
            right: gut,
            top: pct(b.top),
            bottom: pct(1 - b.list),
            paddingInline: "8px",
            marginInline: "-8px",
          }}
        >
          <ul className="rail-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {albumRows}
          </ul>
          {intake}
        </nav>

        <nav
          aria-label={`Tracks of ${album.title}`}
          aria-hidden={!trackRailOn}
          className={[
            "absolute border-t border-rule",
            "rail-scroll overflow-y-auto overscroll-contain",
            "transition-opacity duration-300 ease-out",
            trackRailOn ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
          style={{
            left: gut,
            right: gut,
            top: pct(b.identity),
            bottom: pct(1 - b.list),
          }}
        >
          <ul>{trackRows}</ul>
        </nav>

        <div
          className="pointer-events-auto absolute flex flex-col justify-between pt-1 pb-2"
          style={{ left: gut, right: gut, top: pct(b.list), bottom: 0 }}
        >
          {fault}
          {seek(true)}
          <div className="flex min-h-[32px] items-center justify-between gap-3 text-ink-mute">
            <span className="whitespace-nowrap tabular-nums">
              <span ref={tcRef}>00:00</span>
              <span aria-hidden> / </span>
              <span ref={durRef}>00:00</span>
            </span>
            <button
              type="button"
              aria-pressed={muted}
              onClick={toggleMute}
              className={`-mr-2 flex h-full cursor-pointer items-center whitespace-nowrap px-2 ${
                muted ? "text-ink-text" : ""
              }`}
            >
              {muted ? "Mute" : "Sound"}
            </button>
          </div>
          <div className="flex min-h-[44px] items-center justify-between">{transport(true)}</div>
        </div>
      </>,
    );
  }

  return shell(
    <>
      <div className="pointer-events-auto absolute left-8.5 top-7.5 flex flex-col gap-3">
        <h1 className="text-ink-text">Horizonte</h1>
        {breadcrumb}
      </div>

      <div className="absolute right-8.5 top-14 bottom-37.5 flex flex-col items-end gap-6.5">
        <nav
          id="album-rail"
          aria-label="Albums"
          aria-hidden={!albumRailOn}
          className={[
            "flex min-h-0 shrink flex-col w-53.5 border-t border-rule",
            "pointer-events-auto tablet:w-47.5",
            "backdrop-blur-sm bg-void/55 -mx-2 px-2",
          ].join(" ")}
        >
          <ul className="rail-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {albumRows}
          </ul>
          {intake}
        </nav>

        <nav
          aria-label={`Tracks of ${album.title}`}
          aria-hidden={!trackRailOn}
          className={[
            "w-65.5 border-t border-rule",
            "transition-opacity duration-300 ease-out",
            "rail-scroll min-h-0 overflow-y-auto overscroll-contain",
            "tablet:w-60",
            "backdrop-blur-sm bg-void/55 -mx-2 px-2",
            trackRailOn
              ? "pointer-events-auto flex-1 opacity-100"
              : "pointer-events-none max-h-0 flex-none overflow-hidden opacity-0",
          ].join(" ")}
        >
          <ul>{trackRows}</ul>
        </nav>
      </div>

      <div className="pointer-events-auto absolute bottom-6.5 left-8.5 flex w-150 flex-col gap-2.75">
        {seek(false)}
        {fault}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {transport(false)}
          <div className="flex flex-none items-center gap-2.5">
            <button
              type="button"
              aria-pressed={muted}
              onClick={toggleMute}
              className="cursor-pointer whitespace-nowrap hover:text-ink-text"
            >
              {muted ? "Mute" : "Sound"}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(shownVolume * 100)}
              onChange={onVolume}
              aria-label="Volume"
              aria-valuetext={`${Math.round(shownVolume * 100)}%`}
              style={{
                ["--range-ink" as string]: COLOR.inkText,
                ["--fill" as string]: `${shownVolume * 100}%`,
              }}
              className="rail-range h-2.25 w-18"
            />
          </div>
          <span ref={tcRef} className="ml-auto flex-none whitespace-nowrap text-ink-faint">
            00:00 / 00:00
          </span>
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-6.5 right-8.5 flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => engine?.back()}
          tabIndex={snap.scale === "collection" ? -1 : 0}
          aria-hidden={snap.scale === "collection"}
          className={[
            "cursor-pointer whitespace-nowrap transition-opacity duration-250 hover:text-ink-text",
            snap.scale === "collection" ? "pointer-events-none opacity-0" : "opacity-100",
          ].join(" ")}
        >
          ◂ Back
        </button>
        <span className="whitespace-nowrap text-ink-faint">{context}</span>
        {licenseLink}
      </div>
    </>,
  );
}
