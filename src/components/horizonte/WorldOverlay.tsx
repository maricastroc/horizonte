"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { ALBUMS } from "./content";
import type { FieldEngine } from "./engine/FieldEngine";
import { useCopy } from "./i18n";
import type { World } from "./world/World";

const pad = (n: number) => String(n + 1).padStart(2, "0");

const place = (el: HTMLElement | null, at: { x: number; y: number } | null, alpha = 1) => {
  if (!el) return;
  el.style.opacity = at ? String(alpha) : "0";
  if (at) el.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) translate(-50%, -50%)`;
};

export default function WorldOverlay({ engine, world }: { engine: FieldEngine; world: World }) {
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const t = useCopy();
  const sectorRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);

  const inside = snap.scale !== "collection";
  const album = ALBUMS[inside ? snap.alb : snap.navAlb] ?? ALBUMS[0];
  const pointed = snap.hoverTrk >= 0 ? snap.hoverTrk : snap.scale === "track" ? snap.trk : snap.sel;
  const shown = inside ? pointed : -1;
  const track = inside ? album.tracks[snap.scale === "track" ? snap.trk : snap.sel] : null;
  const prev = !inside ? ALBUMS[snap.navAlb - 1] : null;
  const next = !inside ? ALBUMS[snap.navAlb + 1] : null;
  const compact = snap.variant === "mobile";

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      place(sectorRef.current, shown >= 0 ? world.sectorLabel(shown) : null);
      const a = prev ? world.caption(snap.navAlb - 1) : null;
      const b = next ? world.caption(snap.navAlb + 1) : null;
      place(prevRef.current, a, a ? a.k * 0.8 : 0);
      place(nextRef.current, b, b ? b.k * 0.8 : 0);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [world, shown, prev, next, snap.navAlb]);

  const caption = "pointer-events-none absolute left-0 top-0 flex flex-col items-center gap-1 whitespace-nowrap opacity-0";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {!compact && (
        <div className="absolute inset-y-0 right-0 w-[min(30vw,380px)] backdrop-blur-md [mask-image:linear-gradient(to_left,black_55%,transparent)]" />
      )}

      <div
        ref={sectorRef}
        className="absolute left-0 top-0 whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-text opacity-0 transition-opacity duration-200 [text-shadow:0_0_10px_rgba(7,7,10,0.95)]"
      >
        {shown >= 0 && album.tracks[shown] ? `${pad(shown)}  ${album.tracks[shown].title}` : ""}
      </div>

      <div ref={prevRef} className={caption}>
        <span className="font-archivo text-[13px] font-semibold text-ink-text-2">{prev?.artist}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">{prev?.cat}</span>
      </div>
      <div ref={nextRef} className={caption}>
        <span className="font-archivo text-[13px] font-semibold text-ink-text-2">{next?.artist}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">{next?.cat}</span>
      </div>

      <section
        hidden={compact && inside}
        className={`absolute flex flex-col gap-2 [text-shadow:0_0_22px_rgba(7,7,10,0.9)] ${
          compact ? "inset-x-5 bottom-[24vh] items-center text-center" : "bottom-[17vh] left-[2.4vw] max-w-[46vw]"
        }`}
      >
        {compact && (
          <span className="font-archivo text-[26px] font-bold leading-none text-ink-text">{album.artist}</span>
        )}
        <span
          key={`${album.id}:${track ? track.id : "album"}`}
          className="world-rise font-bodoni text-[clamp(26px,3.6vw,54px)] italic leading-[1.02] text-ink-text"
        >
          {track ? track.title : album.title}
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">
          {inside
            ? `${album.artist} · ${album.title} · ${album.year}`
            : `${album.year} · ${t.canvas.tracks(album.tracks.length)} · ${album.cat}`}
        </span>
      </section>
    </div>
  );
}
