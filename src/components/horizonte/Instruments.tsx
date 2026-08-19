"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import Ceremony from "./Ceremony";
import { ALBUMS } from "./content";
import { ACCEPT } from "./ingest/formats";
import { useIngest } from "./ingest/useIngest";
import { timecode } from "./format";
import { COLOR, IDLE_OPACITY, rgba } from "./tokens";
import type { Scale, Snapshot } from "./types";
import type { FieldEngine } from "./engine/FieldEngine";

const DEFAULT_SNAPSHOT: Snapshot = {
  scale: "collection",
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
  announce: `Coleção · ${ALBUMS.length} corpos`,
};

const noop = () => () => {};
const getDefault = () => DEFAULT_SNAPSHOT;

const LEVELS: { key: Scale; label: string }[] = [
  { key: "collection", label: "Coleção" },
  { key: "album", label: "Álbum" },
  { key: "track", label: "Faixa" },
];

const ROW = "h-[26px] compact:min-h-[48px] items-center gap-[10px] cursor-pointer " +
  "border-b border-rule-2 w-full text-left transition-colors duration-150";

const MARK = "block justify-self-end w-[5px] h-[5px]";
const MARK_ON = "block justify-self-end w-[7px] h-[7px]";

const ARIA_MS = 1000;

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

  const barRef = useRef<HTMLDivElement>(null);
  const seekRef = useRef<HTMLDivElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);

  const album = ALBUMS[snap.alb];
  const ink = rgba(album.inkA, 1);
  const barInk = rgba(ALBUMS[snap.playAlb >= 0 ? snap.playAlb : snap.alb].inkA, 0.95);
  const focusAlb = snap.scale === "collection" ? snap.navAlb : snap.alb;

  useEffect(() => {
    if (!engine) return;
    const bar = barRef.current;
    const tc = tcRef.current;
    const seek = seekRef.current;
    let ariaAt = 0;

    return engine.onFrame(({ progress, position, duration }) => {
      if (bar) bar.style.width = `${progress * 100}%`;
      if (tc) tc.textContent = `${timecode(position)} / ${timecode(duration)}`;

      const agora = performance.now();
      if (seek && agora - ariaAt > ARIA_MS) {
        ariaAt = agora;
        seek.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
        seek.setAttribute("aria-valuetext", `${timecode(position)} de ${timecode(duration)}`);
      }
    });
  }, [engine]);

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
    (e: React.MouseEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      engine?.seekFraction((e.clientX - r.left) / r.width);
    },
    [engine],
  );

  const trackRailOn = snap.scale !== "collection";
  const railTop = Math.max(238, 56 + (ALBUMS.length + 1) * 26 + 52);
  const focusStyle = useMemo(
    () =>
      ({
        ["--focus-ink" as string]: ink,
        ["--rail-top" as string]: `${railTop}px`,
      }) as React.CSSProperties,
    [ink, railTop],
  );

  const albumRailOn = !(trackRailOn && snap.variant === "mobile");

  return (
    <div
      data-instruments=""
      style={focusStyle}
      onPointerMove={intent}
      className={[
        "pointer-events-none absolute cursor-default select-none instruments-safe",
        "font-mono text-[10.5px] uppercase tracking-[.2em] text-ink-mute",
        "transition-opacity duration-350 ease-out",
      ].join(" ")}
      data-idle={snap.idle ? "" : undefined}
    >
      <style>{`[data-instruments][data-idle]{opacity:${IDLE_OPACITY}}[data-instruments]{opacity:1}`}</style>

      <div className="pointer-events-auto absolute left-8.5 top-7.5 flex flex-col gap-3 compact:left-4 compact:top-4.5">
        <h1 className="text-ink-text">Horizonte</h1>
        <nav aria-label="Escala">
          <ol className="flex items-center gap-2.5">
            {LEVELS.map((lvl, i) => {
              const cur = LEVELS.findIndex((l) => l.key === snap.scale);
              const color = i === cur ? COLOR.inkText : i < cur ? COLOR.inkMute : COLOR.inkFaint;
              return (
                <li key={lvl.key} className="flex items-center gap-2.5">
                  {i > 0 && <span aria-hidden className="text-chevron">›</span>}
                  <button
                    type="button"
                    style={{ color }}
                    aria-current={i === cur ? "step" : undefined}
                    onClick={() => engine?.goScale(lvl.key)}
                    className="cursor-pointer py-0.75 hover:text-ink-text compact:py-3.5"
                  >
                    {lvl.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      <nav
        aria-label="Álbuns"
        aria-hidden={!albumRailOn}
        className={[
          "absolute right-8.5 top-14 w-53.5 border-t border-rule",
          "transition-opacity duration-300 ease-out",
          "tablet:w-47.5",
          "compact:left-4 compact:right-4 compact:top-24 compact:w-auto",
          "backdrop-blur-sm bg-void/35 -mx-2 px-2",
          albumRailOn ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <ul>
          {ALBUMS.map((a, i) => {
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
                  onClick={() => engine?.enterAlbum(i)}
                  className={`grid grid-cols-[1fr_46px_7px] hover:text-ink-text ${ROW}`}
                >
                  <span className="truncate">{a.artist}</span>
                  <span className="text-right text-ink-faint">{a.cat}</span>
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
          })}
          <li>
            <button
              type="button"
              tabIndex={albumRailOn ? 0 : -1}
              onClick={pick}
              onPointerEnter={() => engine?.setRailAlb(-1)}
              className={`grid grid-cols-[1fr_46px_7px] text-ink-faint hover:text-ink-text ${ROW}`}
            >
              <span className="truncate">
                {dragging ? "Solte para medir" : "Trazer um disco"}
              </span>
              <span className="text-right text-ink-ghost">{dragging ? "" : "+"}</span>
              <span aria-hidden className={MARK} style={{ background: COLOR.inkGhost }} />
            </button>
          </li>
        </ul>
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
      </nav>

      <nav
        aria-label={`Faixas de ${album.title}`}
        aria-hidden={!trackRailOn}
        className={[
          "absolute right-8.5 top-[var(--rail-top)] w-65.5 border-t border-rule",
          "transition-opacity duration-300 ease-out",
          "rail-scroll overflow-y-auto overscroll-contain",
          "max-h-[calc(100dvh-var(--rail-top)-150px)] compact:max-h-[min(calc(100dvh-260px),45dvh)]",
          "tablet:w-60",
          "compact:left-4 compact:right-4 compact:top-auto compact:bottom-37.5 compact:w-auto",
          "backdrop-blur-sm bg-void/35 -mx-2 px-2",
          trackRailOn ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <ul>
          {album.tracks.map((t, i) => {
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
                  className={`grid grid-cols-[22px_1fr_34px_7px] hover:text-ink-text ${ROW}`}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate">{t.title}</span>
                  <span className="text-right text-ink-faint">{timecode(t.dur)}</span>
                  <span
                    aria-hidden
                    className={isPlay || isSel ? MARK_ON : MARK}
                    style={{
                      background: isPlay ? ink : isSel ? COLOR.inkText : COLOR.inkGhost,
                    }}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div
        className={[
          "pointer-events-auto absolute bottom-6.5 left-8.5 flex w-150 flex-col gap-2.75",
          "compact:left-4 compact:right-4 compact:bottom-4 compact:w-auto compact:gap-3.5",
        ].join(" ")}
      >
        <div
          ref={seekRef}
          role="progressbar"
          aria-label="Progresso da faixa"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          title="Buscar na faixa"
          onClick={onSeek}
          className="flex h-2.25 cursor-pointer items-center compact:h-11"
        >
          <div className="h-px w-full bg-[rgba(232,228,220,.16)]">
            <div ref={barRef} className="h-px w-0" style={{ background: barInk }} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 compact:gap-x-4.5 compact:gap-y-2">
          <button
            type="button"
            onClick={() => engine?.skip(-1)}
            className="flex-none cursor-pointer whitespace-nowrap hover:text-ink-text compact:py-3.5"
          >
            ◂◂ Anterior
          </button>
          <button
            type="button"
            aria-pressed={snap.mode === "playing"}
            onClick={() => engine?.transport()}
            className="flex-none cursor-pointer whitespace-nowrap tracking-[.22em] text-ink-text hover:text-white compact:py-3.5"
          >
            {snap.mode === "playing"
              ? "❙❙ Pausar"
              : snap.playAlb >= 0 && snap.scale === "track"
                ? "▸ Retomar"
                : "▸ Tocar"}
          </button>
          <button
            type="button"
            onClick={() => engine?.skip(1)}
            className="flex-none cursor-pointer whitespace-nowrap hover:text-ink-text compact:py-3.5"
          >
            Próxima ▸▸
          </button>
          <span ref={tcRef} className="ml-auto flex-none whitespace-nowrap text-ink-faint">
            00:00 / 00:00
          </span>
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-6.5 right-8.5 flex items-center gap-3.5 compact:bottom-auto compact:right-4 compact:top-4.5">
        <button
          type="button"
          onClick={() => engine?.back()}
          tabIndex={snap.scale === "collection" ? -1 : 0}
          aria-hidden={snap.scale === "collection"}
          className={[
            "cursor-pointer whitespace-nowrap transition-opacity duration-250 hover:text-ink-text",
            "compact:py-3.5",
            snap.scale === "collection" ? "pointer-events-none opacity-0" : "opacity-100",
          ].join(" ")}
        >
          ◂ Voltar
        </button>
        <span className="whitespace-nowrap text-ink-faint compact:hidden">
          {snap.scale === "collection"
            ? `Coleção · ${snap.navAlb + 1}/${ALBUMS.length}`
            : `${album.cat} · ${album.tracks.length} faixas`}
        </span>
        {album.license.source ? (
          <a
            href={album.license.source}
            target="_blank"
            rel="noreferrer"
            title={album.license.attribution}
            className="cursor-pointer whitespace-nowrap text-ink-faint hover:text-ink-text compact:py-3.5"
          >
            {album.license.name}
          </a>
        ) : (
          <span
            title={album.license.attribution}
            className="whitespace-nowrap text-ink-faint compact:py-3.5"
          >
            {album.license.name}
          </span>
        )}
      </div>

      {status && <Ceremony status={status} onCancel={cancel} />}

      <p aria-live="polite" className="sr-only">
        {snap.announce}
      </p>
    </div>
  );
}
