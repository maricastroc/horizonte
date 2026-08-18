"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { ALBUMS } from "./data/albums";
import { COLOR, IDLE_OPACITY, rgba } from "./tokens";
import type { Scale, Snapshot } from "./types";
import type { FieldEngine } from "./useField";

const DEFAULT_SNAPSHOT: Snapshot = {
  scale: "campo",
  mode: "parado",
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

const fmt = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

const LEVELS: { key: Scale; label: string }[] = [
  { key: "campo", label: "Coleção" },
  { key: "album", label: "Álbum" },
  { key: "faixa", label: "Faixa" },
];

const ROW = "h-[26px] max-md:min-h-[48px] items-center gap-[10px] cursor-pointer " +
  "border-b border-rule-2 w-full text-left transition-colors duration-150";

const MARK = "block justify-self-end w-[5px] h-[5px]";

export default function Instruments({ engine }: { engine: FieldEngine | null }) {
  const snap = useSyncExternalStore(
    engine?.subscribe ?? noop,
    engine?.getSnapshot ?? getDefault,
    getDefault,
  );

  const layerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const seekRef = useRef<HTMLDivElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const albMarks = useRef<(HTMLElement | null)[]>([]);
  const trkMarks = useRef<(HTMLElement | null)[]>([]);

  const album = ALBUMS[snap.alb];
  const nowAlbum = snap.playAlb >= 0 ? ALBUMS[snap.playAlb] : null;
  const nowTrack = nowAlbum?.tracks[snap.trk] ?? null;
  const ink = rgba(album.inkA, 1);

  const trackCount = album.tracks.length;
  useEffect(() => {
    engine?.registerNodes({
      layer: layerRef.current,
      bar: barRef.current,
      seek: seekRef.current,
      tc: tcRef.current,
      dot: dotRef.current,
      albMarks: albMarks.current.slice(0, ALBUMS.length),
      trkMarks: trkMarks.current.slice(0, trackCount),
    });
  }, [engine, trackCount, snap.alb]);

  const intent = useCallback(() => engine?.markIntent(), [engine]);

  const onSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      engine?.seekFraction((e.clientX - r.left) / r.width);
    },
    [engine],
  );

  const trackRailOn = snap.scale !== "campo";
  const focusStyle = useMemo(
    () => ({ ["--focus-ink" as string]: ink }) as React.CSSProperties,
    [ink],
  );

  return (
    <div
      ref={layerRef}
      data-instruments=""
      style={focusStyle}
      onPointerMove={intent}
      className={[
        "pointer-events-none absolute inset-0 cursor-default select-none",
        "font-mono text-[10.5px] uppercase tracking-[.2em] text-ink-mute",
        "transition-opacity duration-350 ease-out",
      ].join(" ")}
      data-idle={snap.idle ? "" : undefined}
    >
      <style>{`[data-instruments][data-idle]{opacity:${IDLE_OPACITY}}[data-instruments]{opacity:1}`}</style>

      <div className="pointer-events-auto absolute left-8.5 top-7.5 flex flex-col gap-3 max-md:left-4 max-md:top-4.5">
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
                    className="cursor-pointer py-0.75 hover:text-ink-text max-md:py-2.5"
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
        className={[
          "pointer-events-auto absolute right-8.5 top-14 w-53.5 border-t border-rule",
          "md:max-[1199px]:w-47.5",
          "max-md:left-4 max-md:right-4 max-md:top-24 max-md:w-auto",
        ].join(" ")}
      >
        <ul>
          {ALBUMS.map((a, i) => {
            const isCur = i === (snap.scale === "campo" ? snap.navAlb : snap.alb);
            const isHov = i === snap.hoverAlb;
            return (
              <li key={a.cat}>
                <button
                  type="button"
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
                    ref={(el) => {
                      albMarks.current[i] = el;
                    }}
                    aria-hidden
                    className={MARK}
                    style={{ background: COLOR.inkGhost }}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav
        aria-label={`Faixas de ${album.title}`}
        aria-hidden={!trackRailOn}
        className={[
          "absolute right-8.5 top-59.5 w-65.5 border-t border-rule",
          "transition-opacity duration-300 ease-out",
          "md:max-[1199px]:top-66.5 md:max-[1199px]:w-60",
          "max-md:left-4 max-md:right-4 max-md:top-auto max-md:bottom-37.5 max-md:w-auto",
          trackRailOn ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <ul>
          {album.tracks.map((t, i) => {
            const isPlay = snap.playAlb === snap.alb && i === snap.trk;
            const isSel = i === snap.sel;
            const isHov = i === snap.hoverTrk;
            return (
              <li key={t.title}>
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
                  <span className="text-right text-ink-faint">{fmt(t.dur)}</span>
                  <span
                    ref={(el) => {
                      trkMarks.current[i] = el;
                    }}
                    aria-hidden
                    className={MARK}
                    style={{ background: COLOR.inkGhost }}
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
          "max-md:left-4 max-md:right-4 max-md:bottom-4 max-md:w-auto max-md:gap-3.5",
        ].join(" ")}
      >
        <div className="flex items-baseline gap-2.5">
          <span
            ref={dotRef}
            aria-hidden
            className="block h-1.25 w-1.25 -translate-y-px"
            style={{ background: "#4E4A45" }}
          />
          <span className="text-ink-text">
            {nowTrack
              ? `${String(snap.trk + 1).padStart(2, "0")} · ${nowTrack.title}`
              : "Nada em curso"}
          </span>
          <span className="truncate text-ink-dim">
            {nowAlbum
              ? `${nowAlbum.artist}${snap.mode === "pausa" ? " · pausado" : ""}`
              : `Coleção · ${ALBUMS.length} corpos`}
          </span>
        </div>

        <div
          ref={seekRef}
          role="progressbar"
          aria-label="Progresso da faixa"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          title="Buscar na faixa"
          onClick={onSeek}
          className="flex h-2.25 cursor-pointer items-center max-md:h-5"
        >
          <div className="h-px w-full bg-[rgba(232,228,220,.16)]">
            <div ref={barRef} className="h-px w-0" style={{ background: ink }} />
          </div>
        </div>

        <div className="flex items-center gap-5 max-md:gap-4.5">
          <button
            type="button"
            onClick={() => engine?.skip(-1)}
            className="flex-none cursor-pointer whitespace-nowrap hover:text-ink-text max-md:py-3.25"
          >
            ◂◂ Anterior
          </button>
          <button
            type="button"
            aria-pressed={snap.mode === "toca"}
            onClick={() => engine?.transport()}
            className="flex-none cursor-pointer whitespace-nowrap tracking-[.22em] text-ink-text hover:text-white max-md:py-3.25"
          >
            {snap.mode === "toca"
              ? "❙❙ Pausar"
              : snap.playAlb >= 0 && snap.scale === "faixa"
                ? "▸ Retomar"
                : "▸ Tocar"}
          </button>
          <button
            type="button"
            onClick={() => engine?.skip(1)}
            className="flex-none cursor-pointer whitespace-nowrap hover:text-ink-text max-md:py-3.25"
          >
            Próxima ▸▸
          </button>
          <span ref={tcRef} className="ml-auto flex-none whitespace-nowrap text-ink-faint">
            00:00 / 00:00
          </span>
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-6.5 right-8.5 flex items-center gap-3.5 max-md:bottom-auto max-md:right-4 max-md:top-4.5">
        <button
          type="button"
          onClick={() => engine?.back()}
          tabIndex={snap.scale === "campo" ? -1 : 0}
          aria-hidden={snap.scale === "campo"}
          className={[
            "cursor-pointer whitespace-nowrap transition-opacity duration-250 hover:text-ink-text",
            "max-md:py-3.25",
            snap.scale === "campo" ? "pointer-events-none opacity-0" : "opacity-100",
          ].join(" ")}
        >
          ◂ Voltar
        </button>
        <span className="whitespace-nowrap text-ink-faint max-md:hidden">
          {snap.scale === "campo"
            ? `Coleção · ${snap.navAlb + 1}/${ALBUMS.length}`
            : `${album.cat} · ${album.tracks.length} faixas`}
        </span>
        <a
          href={album.license.source}
          target="_blank"
          rel="noreferrer"
          title={album.license.attribution}
          className="cursor-pointer whitespace-nowrap text-ink-faint hover:text-ink-text max-md:py-3.25"
        >
          {album.license.name}
        </a>
      </div>

      <p aria-live="polite" className="sr-only">
        {snap.announce}
      </p>
    </div>
  );
}
