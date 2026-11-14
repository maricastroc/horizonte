"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FONT_FAMILY } from "@/app/fonts";
import { AudioBus } from "@/components/horizonte/audio/bus";
import { ALBUMS, OPENING, boundsOf } from "@/components/horizonte/content";
import { motionQualitiesOf, motionResponseOf } from "@/components/horizonte/motion";
import { Stage, type BenchRow, type Quality, type SceneId, type StageStats, type View } from "./stage";

const VIEWS: View[] = ["collection", "album", "track"];
const SCENES: { id: SceneId; label: string }[] = [
  { id: "tide", label: "Tide" },
  { id: "glass", label: "Glass" },
];
const QUALITIES: Quality[] = ["auto", "full", "half"];

const clock = (s: number) => {
  const v = Math.max(0, Math.floor(s));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};

const tab = (on: boolean) =>
  `cursor-pointer px-1 py-1 transition-colors ${on ? "text-ink-text" : "text-ink-dim hover:text-ink-soft"}`;

interface Live {
  album: number;
  track: number;
  playing: number;
  view: View;
  hover: number;
}

declare global {
  interface Window {
    __lab?: {
      stage: Stage;
      bench: (scales?: number[]) => Promise<BenchRow[]>;
      advance: (seconds: number) => void;
      bus: AudioBus;
    };
  }
}

export default function Lab({ initial }: { initial: SceneId }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const busRef = useRef<AudioBus | null>(null);
  const live = useRef<Live>({ album: OPENING, track: 0, playing: -1, view: "collection", hover: -1 });

  const [scene, setScene] = useState<SceneId>(initial);
  const [view, setView] = useState<View>("collection");
  const [quality, setQuality] = useState<Quality>("auto");
  const [albumIx, setAlbumIx] = useState(OPENING);
  const [trackIx, setTrackIx] = useState(0);
  const [playingIx, setPlayingIx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [time, setTime] = useState({ pos: 0, dur: 0 });
  const [stats, setStats] = useState<StageStats | null>(null);
  const [label, setLabel] = useState(-1);

  const album = ALBUMS[albumIx];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stage = new Stage(canvas, FONT_FAMILY.archivo);
    const bus = new AudioBus();
    stageRef.current = stage;
    busRef.current = bus;
    bus.setVolume(0.8);
    stage.setAlbum(ALBUMS[live.current.album]);
    stage.setTracks(live.current.track, -1);
    stage.setScene(initial);
    let at = 0;
    window.__lab = {
      stage,
      bench: (scales = [0.35, 0.5, 0.75, 1]) => stage.bench(scales),
      advance: (seconds) => stage.advance(seconds, bus.update(1 / 60), at),
      bus,
    };

    let raf = 0;
    let last = 0;
    let shown = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - (last || now)) / 1000);
      last = now;
      const audio = bus.update(dt);
      const l = live.current;
      const a = ALBUMS[l.album];
      const bounds = boundsOf(a.signature, a.tracks.length);
      const k = l.playing >= 0 ? l.playing : l.track;
      const part = l.playing >= 0 && audio.duration > 0 ? audio.position / audio.duration : 0;
      const pos = bounds[k] + (bounds[k + 1] - bounds[k]) * part;
      at = pos;
      stage.frame(now, audio, pos);

      const el = labelRef.current;
      if (el) {
        const which = l.hover >= 0 ? l.hover : l.view === "collection" ? -1 : k;
        const at = which >= 0 ? stage.labelAt(which) : null;
        el.style.opacity = at ? "1" : "0";
        if (at) el.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) translate(-50%, -50%)`;
      }
      if (now - shown > 250) {
        shown = now;
        setStats(stage.stats);
        setTime({ pos: audio.position, dur: audio.duration });
        setIsPlaying(audio.playing);
        setLabel(l.hover >= 0 ? l.hover : l.view === "collection" ? -1 : k);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => stage.resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      bus.dispose();
      stage.dispose();
      stageRef.current = null;
      busRef.current = null;
      delete window.__lab;
    };
  }, [initial]);

  const play = useCallback(async (a: number, k: number) => {
    const bus = busRef.current;
    const stage = stageRef.current;
    if (!bus || !stage) return;
    const target = ALBUMS[a];
    const response = motionResponseOf(motionQualitiesOf(target, k));
    live.current.album = a;
    live.current.track = k;
    live.current.playing = k;
    setAlbumIx(a);
    setTrackIx(k);
    setPlayingIx(k);
    stage.setAlbum(target);
    stage.setTracks(k, k);
    stage.setRouting(response);
    bus.setSignature(target.signature);
    bus.setResponse(response);
    bus.load(target.tracks[k]);
    await bus.play();
  }, []);

  useEffect(() => {
    const bus = busRef.current;
    if (!bus) return;
    bus.onEnded = () => {
      const l = live.current;
      const n = ALBUMS[l.album].tracks.length;
      void play(l.album, (l.playing + 1) % n);
    };
  }, [play]);

  const toggle = () => {
    const bus = busRef.current;
    if (!bus) return;
    if (bus.playing) {
      bus.pause();
      return;
    }
    if (live.current.playing >= 0) void bus.play();
    else void play(live.current.album, live.current.track);
  };

  const skip = (step: number) => {
    const l = live.current;
    const n = ALBUMS[l.album].tracks.length;
    const k = ((l.playing >= 0 ? l.playing : l.track) + step + n) % n;
    if (busRef.current?.playing) void play(l.album, k);
    else selectTrack(k);
  };

  const selectTrack = (k: number) => {
    live.current.track = k;
    setTrackIx(k);
    stageRef.current?.setTracks(k, live.current.playing);
  };

  const selectAlbum = (a: number) => {
    if (a === live.current.album) return;
    busRef.current?.pause();
    live.current = { ...live.current, album: a, track: 0, playing: -1 };
    setAlbumIx(a);
    setTrackIx(0);
    setPlayingIx(-1);
    stageRef.current?.setAlbum(ALBUMS[a]);
    stageRef.current?.setTracks(0, -1);
  };

  const changeView = (v: View) => {
    live.current.view = v;
    setView(v);
    stageRef.current?.setView(v);
  };

  const changeScene = (id: SceneId) => {
    setScene(id);
    stageRef.current?.setScene(id);
  };

  const changeQuality = (q: Quality) => {
    setQuality(q);
    stageRef.current?.setQuality(q);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    stage.setPointer((x / r.width) * 2 - 1, 1 - (y / r.height) * 2);
    const k = live.current.view === "collection" ? -1 : stage.pick(x, y);
    live.current.hover = k;
    stage.setHover(k);
    e.currentTarget.style.cursor = k >= 0 ? "pointer" : "default";
  };

  const onClick = () => {
    const l = live.current;
    if (l.hover >= 0) {
      void play(l.album, l.hover);
      return;
    }
    if (l.view === "collection") changeView("album");
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (Math.abs(e.deltaY) < 12) return;
    const i = VIEWS.indexOf(live.current.view) + (e.deltaY > 0 ? 1 : -1);
    if (i >= 0 && i < VIEWS.length) changeView(VIEWS[i]);
  };

  const labelTrack = label >= 0 ? album.tracks[label] : null;

  return (
    <main className="fixed inset-0 select-none bg-void font-mono text-[11px] uppercase tracking-[0.12em] text-ink-mute">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        onPointerMove={onMove}
        onPointerLeave={() => {
          live.current.hover = -1;
          stageRef.current?.setHover(-1);
        }}
        onClick={onClick}
        onWheel={onWheel}
      />

      <div
        ref={labelRef}
        className="pointer-events-none absolute left-0 top-0 whitespace-nowrap text-[10.5px] text-ink-text opacity-0 transition-opacity duration-200"
      >
        {labelTrack ? `${String(label + 1).padStart(2, "0")}  ${labelTrack.title}` : ""}
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-8">
        <div className="pointer-events-auto flex flex-col gap-4">
          <span className="text-ink-dim">Horizonte · Lab</span>
          <nav aria-label="Scale" className="flex gap-3">
            {VIEWS.map((v) => (
              <button key={v} type="button" aria-pressed={view === v} className={tab(view === v)} onClick={() => changeView(v)}>
                {v}
              </button>
            ))}
          </nav>
        </div>
        <div className="pointer-events-auto flex items-center gap-1" role="group" aria-label="Direction">
          {SCENES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={scene === s.id}
              onClick={() => changeScene(s.id)}
              className={`cursor-pointer border px-4 py-2 text-[12px] font-medium transition-colors ${
                scene === s.id
                  ? "border-ink-text text-ink-text"
                  : "border-rule text-ink-dim hover:border-ink-mute hover:text-ink-soft"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="w-[228px]" />
      </header>

      <div className="pointer-events-none absolute inset-y-0 right-0 w-[340px] bg-gradient-to-l from-void/80 to-transparent" />
      <aside className="pointer-events-auto absolute bottom-24 right-8 top-8 flex w-[228px] flex-col gap-4 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col">
          <span className="border-b border-rule pb-2 text-ink-dim">{ALBUMS.length} albums</span>
          <ul className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none]">
            {ALBUMS.map((a, i) => (
              <li key={a.id}>
                <button
                  type="button"
                  aria-current={i === albumIx}
                  onClick={() => selectAlbum(i)}
                  className={`flex w-full cursor-pointer justify-between gap-3 py-[5px] text-left normal-case tracking-[0.03em] ${
                    i === albumIx ? "text-ink-text" : "text-ink-dim hover:text-ink-soft"
                  }`}
                >
                  <span className="truncate text-[12px]">{a.artist}</span>
                  <span className="shrink-0 text-[10.5px]">{a.cat}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <span className="border-b border-rule pb-2 text-ink-dim">Tracks</span>
          <ul className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none]">
            {album.tracks.map((t, k) => (
              <li key={t.id}>
                <button
                  type="button"
                  aria-current={k === playingIx}
                  onClick={() => void play(albumIx, k)}
                  onPointerEnter={() => {
                    live.current.hover = k;
                    stageRef.current?.setHover(k);
                  }}
                  onPointerLeave={() => {
                    live.current.hover = -1;
                    stageRef.current?.setHover(-1);
                  }}
                  className={`flex w-full cursor-pointer justify-between gap-3 py-[5px] text-left normal-case tracking-[0.03em] ${
                    k === playingIx ? "text-ink-text" : k === trackIx ? "text-ink-soft" : "text-ink-dim hover:text-ink-soft"
                  }`}
                >
                  <span className="truncate text-[12px]">
                    <span className="mr-3 text-[10.5px]">{String(k + 1).padStart(2, "0")}</span>
                    {t.title}
                  </span>
                  <span className="shrink-0 text-[10.5px]">{clock(t.dur)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="pointer-events-none absolute bottom-24 left-8 flex flex-col gap-2 [text-shadow:0_0_18px_rgba(7,7,10,0.9)]">
        <h1 className="font-bodoni text-[44px] normal-case italic leading-none tracking-normal text-ink-text">
          {album.title}
        </h1>
        <p className="text-ink-soft">
          {album.artist} · {album.year} · {album.tracks.length} tracks · {album.cat}
        </p>
      </section>

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-8">
        <div className="pointer-events-auto flex items-center gap-5 text-[12px] font-medium tracking-[0.1em] text-ink-text">
          <button type="button" className="cursor-pointer" onClick={() => skip(-1)}>
            ◂◂ Previous
          </button>
          <button type="button" className="cursor-pointer" aria-pressed={isPlaying} onClick={toggle}>
            {isPlaying ? "❙❙ Pause" : "▸ Play"}
          </button>
          <button type="button" className="cursor-pointer" onClick={() => skip(1)}>
            Next ▸▸
          </button>
          <label className="flex items-center gap-3">
            Sound
            <input
              id="lab-volume"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                busRef.current?.setVolume(v);
              }}
              className="rail-range w-28"
              style={{ ["--fill" as string]: `${volume * 100}%` }}
            />
          </label>
          <span className="text-[10.5px] font-normal text-ink-soft">
            {clock(time.pos)} / {clock(time.dur)}
          </span>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2 text-[10.5px]">
          <div className="flex gap-3" role="group" aria-label="Render scale">
            {QUALITIES.map((q) => (
              <button key={q} type="button" aria-pressed={quality === q} className={tab(quality === q)} onClick={() => changeQuality(q)}>
                {q}
              </button>
            ))}
          </div>
          <span className="tabular-nums text-ink-soft">
            {stats
              ? `${stats.width}×${stats.height} · ${Math.round(stats.scale * 100)}% · ${
                  stats.gpu === null ? "—" : stats.gpu.toFixed(1)
                } ms · ${Math.round(stats.fps)} fps`
              : "…"}
          </span>
        </div>
      </footer>
    </main>
  );
}
