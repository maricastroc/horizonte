"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { questionsOf, type Question, type QuestionPart } from "./anatomy";
import { ALBUMS } from "./content";
import type { FieldEngine } from "./engine/FieldEngine";
import { useCopy } from "./i18n";
import type { World } from "./world/World";

const ORBIT_KEY = "horizonte:orbit";
const PARTS: QuestionPart[] = ["core", "contour", "strata", "gaps", "posture", "satellites"];

const pad = (n: number) => String(n + 1).padStart(2, "0");

const place = (el: HTMLElement | null, at: { x: number; y: number } | null, alpha = 1) => {
  if (!el) return;
  el.style.opacity = at ? String(alpha) : "0";
  el.style.visibility = at ? "visible" : "hidden";
  if (at) el.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) translate(-50%, -50%)`;
};

const remembered = () => {
  try {
    return window.localStorage.getItem(ORBIT_KEY) === "1";
  } catch {
    return false;
  }
};

export default function WorldOverlay({
  engine,
  world,
  inquiry,
}: {
  engine: FieldEngine;
  world: World;
  inquiry: boolean;
}) {
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const t = useCopy();
  const rootRef = useRef<HTMLDivElement>(null);
  const sectorRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);
  const leadRef = useRef<SVGLineElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const markRefs = useRef<Partial<Record<QuestionPart, HTMLButtonElement | null>>>({});
  const [hinted, setHinted] = useState(remembered);

  const inside = snap.scale !== "collection";
  const album = ALBUMS[inside ? snap.alb : snap.navAlb] ?? ALBUMS[0];
  const pointed = snap.hoverTrk >= 0 ? snap.hoverTrk : snap.scale === "track" ? snap.trk : snap.sel;
  const shown = inside ? pointed : -1;
  const track = inside ? album.tracks[snap.scale === "track" ? snap.trk : snap.sel] : null;
  const prev = !inside ? ALBUMS[snap.navAlb - 1] : null;
  const next = !inside ? ALBUMS[snap.navAlb + 1] : null;
  const compact = snap.variant === "mobile";
  const asking = inquiry && inside && !compact;

  const questions = useMemo(() => questionsOf(snap.alb), [snap.alb]);
  const open: Question | undefined = questions.find((q) => q.part === snap.focus) ?? questions[0];
  const phrasing = open ? t.anatomy.write.phrase(open) : null;
  const trying = snap.compare;
  const altered = trying && !snap.peek;

  useEffect(() => {
    if (asking && !snap.focus && questions[0]) engine.setAnatomyFocus(questions[0].part);
  }, [asking, snap.focus, questions, engine]);

  useEffect(() => {
    let raf = 0;
    let dismissed = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const label = shown >= 0 && !asking ? world.sectorLabel(shown) : null;
      place(sectorRef.current, label);
      const a = prev ? world.caption(snap.navAlb - 1) : null;
      const b = next ? world.caption(snap.navAlb + 1) : null;
      place(prevRef.current, a, a ? a.k * 0.8 : 0);
      place(nextRef.current, b, b ? b.k * 0.8 : 0);

      const line = leadRef.current;
      const row = snap.hoverTrk >= 0 ? document.querySelector<HTMLElement>(`[data-trk="${snap.hoverTrk}"]`) : null;
      if (line) {
        if (label && row) {
          const r = row.getBoundingClientRect();
          line.setAttribute("x1", String(r.left - 10));
          line.setAttribute("y1", String(r.top + r.height / 2));
          line.setAttribute("x2", String(label.x + 60));
          line.setAttribute("y2", String(label.y));
          line.style.opacity = "0.4";
        } else line.style.opacity = "0";
      }

      for (const part of PARTS) place(markRefs.current[part] ?? null, asking ? world.partAnchor(part) : null);

      const ex = world.exploring;
      const root = rootRef.current?.parentElement;
      if (root) root.dataset.orbit = ex.held ? "held" : ex.away ? "away" : "";
      if (backRef.current) backRef.current.dataset.on = ex.away && !ex.held ? "1" : "0";
      if (world.orbit.used && !dismissed) {
        dismissed = true;
        try {
          window.localStorage.setItem(ORBIT_KEY, "1");
        } catch {
          dismissed = true;
        }
        setHinted(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [world, shown, prev, next, snap.navAlb, snap.hoverTrk, asking]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.shiftKey || snap.scale === "collection") return;
      const step: Record<string, [number, number]> = {
        ArrowLeft: [0.05, 0],
        ArrowRight: [-0.05, 0],
        ArrowUp: [0, 0.05],
        ArrowDown: [0, -0.05],
      };
      const d = step[e.key];
      if (!d) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      world.grab();
      world.orbitBy(d[0], d[1]);
      world.release();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [world, snap.scale]);

  const caption =
    "pointer-events-none absolute left-0 top-0 flex flex-col items-center gap-1 whitespace-nowrap opacity-0";
  const nextQ = open ? questions[(questions.indexOf(open) + 1) % questions.length] : undefined;

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {!compact && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 w-[min(30vw,380px)] backdrop-blur-md [mask-image:linear-gradient(to_left,black_55%,transparent)]"
        />
      )}

      <svg aria-hidden="true" className="absolute inset-0 h-full w-full">
        <line ref={leadRef} stroke="currentColor" strokeWidth="1" strokeDasharray="2 5" style={{ opacity: 0 }} />
      </svg>

      <div
        ref={sectorRef}
        aria-hidden="true"
        className="absolute left-0 top-0 whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-text opacity-0 transition-opacity duration-200 [text-shadow:0_0_10px_rgba(7,7,10,0.95)]"
      >
        {shown >= 0 && album.tracks[shown] ? `${pad(shown)}  ${album.tracks[shown].title}` : ""}
      </div>

      <div ref={prevRef} aria-hidden="true" className={caption}>
        <span className="font-archivo text-[13px] font-semibold text-ink-text-2">{prev?.artist}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">{prev?.cat}</span>
      </div>
      <div ref={nextRef} aria-hidden="true" className={caption}>
        <span className="font-archivo text-[13px] font-semibold text-ink-text-2">{next?.artist}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">{next?.cat}</span>
      </div>

      {inside && !hinted && !asking && (
        <p className="orbit-hint absolute bottom-[12vh] left-1/2 flex -translate-x-1/2 items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">
          <svg aria-hidden="true" width="34" height="14" viewBox="0 0 34 14" fill="none" stroke="currentColor">
            <path d="M2 10C8 2 26 2 32 10" strokeWidth="1" />
            <path d="M28 6.5 32 10 27 11" strokeWidth="1" />
          </svg>
          {compact ? t.world.orbitTouch : t.world.orbit}
        </p>
      )}

      <button
        ref={backRef}
        type="button"
        data-instruments
        data-on="0"
        onClick={() => world.recenter()}
        className="orbit-back pointer-events-auto absolute bottom-[12vh] left-1/2 -translate-x-1/2 cursor-pointer font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-text"
      >
        ◦ {t.world.recenter}
      </button>

      {asking && (
        <nav data-instruments aria-label={t.world.inquiry} className="pointer-events-none absolute inset-0">
          {PARTS.map((part) => (
            <button
              key={part}
              ref={(el) => {
                markRefs.current[part] = el;
              }}
              type="button"
              aria-pressed={snap.focus === part}
              data-on={snap.focus === part ? "1" : "0"}
              onClick={() => engine.setAnatomyFocus(part)}
              onPointerEnter={() => engine.previewAnatomy(part)}
              onPointerLeave={() => engine.previewAnatomy(null)}
              onFocus={() => engine.previewAnatomy(part)}
              onBlur={() => engine.previewAnatomy(null)}
              className="part-mark pointer-events-auto absolute left-0 top-0 cursor-pointer"
            >
              <i aria-hidden="true" />
              <span>{t.world.parts[part]}</span>
            </button>
          ))}
        </nav>
      )}

      {asking && open && phrasing ? (
        <section
          data-instruments
          aria-live="polite"
          key={`${snap.alb}:${open.part}`}
          className="world-rise pointer-events-auto absolute bottom-[15vh] left-[2.4vw] flex w-[min(34rem,40vw)] flex-col gap-4 [text-shadow:0_0_22px_rgba(7,7,10,0.92)]"
        >
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">
            {t.world.parts[open.part]} · {album.title}
          </span>
          <h2 className="font-bodoni text-[clamp(24px,2.7vw,40px)] italic leading-[1.08] text-ink-text">
            {trying && phrasing.what ? phrasing.what : phrasing.ask}
          </h2>
          <p className="font-archivo text-[14px] leading-[1.55] text-ink-text-2">
            {altered ? phrasing.result : phrasing.answer}
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.14em]">
            {phrasing.what && !trying && (
              <button
                type="button"
                className="cursor-pointer text-ink-text hover:text-white"
                onClick={() => engine.setCompare(true)}
              >
                {phrasing.what} ▸
              </button>
            )}
            {trying && (
              <button
                type="button"
                className="cursor-pointer text-ink-text hover:text-white"
                onClick={() => engine.setCompare(false)}
              >
                ◂ {t.anatomy.asItIs}
              </button>
            )}
            {nextQ && nextQ !== open && (
              <button
                type="button"
                className="cursor-pointer text-ink-soft hover:text-ink-text"
                onClick={() => engine.setAnatomyFocus(nextQ.part)}
              >
                {t.anatomy.nextQuestion} ›
              </button>
            )}
          </div>
        </section>
      ) : (
        <section
          aria-hidden="true"
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
      )}
    </div>
  );
}
