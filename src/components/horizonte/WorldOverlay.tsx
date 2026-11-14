"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AXIS_OF, readingOf, questionsOf, type Question, type QuestionPart } from "./anatomy";
import { ALBUMS, CURATED_COUNT } from "./content";
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

const SCALE = (axis: string, v: number) => (axis === "brightness" || axis === "duration" ? Math.log2(Math.max(v, 1e-6)) : v);

function Evidence({ alb, question, altered }: { alb: number; question: Question; altered: boolean }) {
  const t = useCopy();
  const w = t.anatomy.write;
  const axis = AXIS_OF[question.part];
  const all = useMemo(
    () => (axis ? ALBUMS.slice(0, CURATED_COUNT).map((_, i) => readingOf(i, axis).value) : []),
    [axis],
  );
  if (!axis) return null;
  const r = question.reading;
  const lo = Math.min(...all.map((v) => SCALE(axis, v)));
  const hi = Math.max(...all.map((v) => SCALE(axis, v)));
  const at = (v: number) => 6 + ((SCALE(axis, v) - lo) / Math.max(1e-6, hi - lo)) * 250;
  const f = question.finding;
  const onsets = f.part === "satellites" ? f.onsets.map((m) => m * 60) : [];
  const here = at(r.value);
  const usual = at(r.median);
  return (
    <aside
      data-instruments
      aria-label={t.world.evidence}
      className="world-rise pointer-events-auto absolute right-8.5 top-[176px] flex w-[262px] flex-col gap-3 [text-shadow:0_0_18px_rgba(7,7,10,0.95)]"
      key={`${alb}:${question.part}`}
    >
      <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">{w.measure[axis]}</span>
      <span className="font-bodoni text-[30px] italic leading-none text-ink-text">
        {w.shown(axis, altered ? r.median : r.value)}
      </span>
      <svg viewBox="0 0 262 58" className="evidence w-full overflow-visible" aria-hidden="true">
        <line x1="6" y1="30" x2="256" y2="30" stroke="currentColor" strokeOpacity="0.28" />
        {all.map((v, i) => (
          <line key={i} x1={at(v)} y1="25" x2={at(v)} y2="35" stroke="currentColor" strokeOpacity="0.4" />
        ))}
        {onsets.map((v, i) =>
          SCALE(axis, v) >= lo && SCALE(axis, v) <= hi ? (
            <g key={`o${i}`} transform={`translate(${at(v)} 30)`}>
              <path d="M0 -6 5 0 0 6 -5 0Z" fill="none" stroke="var(--ink)" strokeOpacity={v <= r.value ? 1 : 0.4} />
              <text y="-11" textAnchor="middle" className="evidence-n">
                {i + 1}
              </text>
            </g>
          ) : null,
        )}
        <line x1={usual} y1="18" x2={usual} y2="42" stroke="currentColor" strokeOpacity="0.8" strokeDasharray="2 3" />
        <text x={usual} y="56" textAnchor="middle" className="evidence-n">
          {t.world.usual}
        </text>
        <g className="evidence-here" style={{ transform: `translateX(${altered ? usual : here}px)` }}>
          <line x1="0" y1="14" x2="0" y2="46" stroke="var(--ink)" strokeWidth="1.5" />
          <circle cx="0" cy="30" r="4" fill="var(--ink)" />
        </g>
      </svg>
      <dl className="flex flex-col gap-1.5 font-archivo text-[12.5px] leading-[1.35] text-ink-text-2">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-mute">{t.anatomy.rows.usual}</dt>
          <dd className="text-right">{t.anatomy.usual(w.shown(axis, r.median), CURATED_COUNT)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-mute">{t.anatomy.rows.standing}</dt>
          <dd className="text-right">{w.standing(r)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-mute">{t.anatomy.rows.drawn}</dt>
          <dd className="text-right">{w.drawn[question.part]}</dd>
        </div>
      </dl>
    </aside>
  );
}

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
  const stemRefs = useRef<Partial<Record<QuestionPart, SVGLineElement | null>>>({});
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

      const spots = PARTS.map((part) => {
        const at = asking ? world.partAnchor(part) : null;
        const edge = window.innerWidth - 330;
        return { part, at, x: at ? Math.min(at.x + at.ox * 46, edge) : 0, y: at ? Math.max(96, at.y + at.oy * 46) : 0 };
      });
      const live = spots.filter((p) => p.at).sort((a, b) => a.y - b.y);
      for (let i = 1; i < live.length; i++) {
        const gap = live[i].y - live[i - 1].y;
        if (gap < 22 && Math.abs(live[i].x - live[i - 1].x) < 130) live[i].y = live[i - 1].y + 22;
      }
      for (const p of spots) {
        const el = markRefs.current[p.part] ?? null;
        const stem = stemRefs.current[p.part] ?? null;
        place(el, p.at ? { x: p.x, y: p.y } : null, p.at?.hidden ? 0.45 : 1);
        if (el) el.dataset.hidden = p.at?.hidden ? "1" : "0";
        if (stem) {
          stem.style.opacity = p.at ? (p.at.hidden ? "0.2" : "0.55") : "0";
          if (p.at) {
            stem.setAttribute("x1", p.at.x.toFixed(1));
            stem.setAttribute("y1", p.at.y.toFixed(1));
            stem.setAttribute("x2", (p.x - p.at.ox * 10).toFixed(1));
            stem.setAttribute("y2", (p.y - p.at.oy * 10).toFixed(1));
          }
        }
      }

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
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ ["--ink" as string]: `rgb(${album.inkA.map((v) => Math.round(Math.min(1, v * 1.5 + 0.12) * 255)).join(" ")})` }}
    >
      {!compact && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 w-[min(30vw,380px)] backdrop-blur-md backdrop-brightness-[0.55] backdrop-saturate-[0.85] [mask-image:linear-gradient(to_left,black_55%,transparent)]"
        />
      )}

      <svg aria-hidden="true" className="absolute inset-0 h-full w-full">
        <line ref={leadRef} stroke="currentColor" strokeWidth="1" strokeDasharray="2 5" style={{ opacity: 0 }} />
        {PARTS.map((part) => (
          <line
            key={part}
            ref={(el) => {
              stemRefs.current[part] = el;
            }}
            stroke="currentColor"
            strokeWidth="1"
            style={{ opacity: 0 }}
          />
        ))}
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

      {asking && open && <Evidence alb={snap.alb} question={open} altered={altered} />}

      {asking && open && phrasing ? (
        <section
          data-instruments
          aria-live="polite"
          key={`${snap.alb}:${open.part}`}
          className="world-rise pointer-events-auto absolute bottom-[15vh] left-[2.4vw] flex w-[min(34rem,40vw)] flex-col gap-4 [text-shadow:0_0_22px_rgba(7,7,10,0.92)]"
        >
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">
            {altered ? (
              <span className="sim-tag">
                {t.world.simulation} · {phrasing.label}
              </span>
            ) : (
              `${t.world.parts[open.part]} · ${album.title}`
            )}
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
                {t.anatomy.nextQuestion}
              </button>
            )}
          </div>
        </section>
      ) : (
        <section
          aria-hidden="true"
          hidden={compact && inside}
          className={`absolute flex flex-col gap-2 [text-shadow:0_0_22px_rgba(7,7,10,0.9)] ${
            compact ? "inset-x-5 bottom-[24vh] items-center text-center" : "bottom-[14.5vh] left-[2.4vw] max-w-[46vw]"
          }`}
        >
          {compact && (
            <span className="font-archivo text-[26px] font-bold leading-none text-ink-text">{album.artist}</span>
          )}
          <span
            key={`${album.id}:${track ? track.id : "album"}`}
            className="world-rise font-bodoni text-[clamp(26px,3.2vw,48px)] italic leading-[1.02] text-ink-text"
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
