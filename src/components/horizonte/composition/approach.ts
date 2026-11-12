import { APPROACH } from "../tokens";
import type { FieldState } from "../types";

const band = (v: number, [a, b]: readonly [number, number]) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface Stages {
  light: number;
  open: number;
  satellites: number;
  labels: number;
  push: number;
}

export function stagesOf(s: Pick<FieldState, "fadeSel" | "scale">): Stages {
  const f = s.fadeSel;
  return {
    light: band(f, APPROACH.light),
    open: band(f, APPROACH.open),
    satellites: band(f, APPROACH.satellites),
    labels: band(f, APPROACH.labels),
    push: s.scale === "collection" ? 0 : Math.sin(Math.PI * Math.min(1, Math.max(0, f))),
  };
}

export interface NamePlate {
  alb: number;
  alpha: number;
  shift: number;
}

export function namePlates(s: Pick<FieldState, "nav" | "alb" | "scale">, count: number): NamePlate[] {
  const single = [{ alb: s.alb, alpha: 1, shift: 0 }];
  if (s.scale !== "collection" || count < 2 || Math.abs(s.nav - s.alb) > 0.5 + 1e-6) return single;
  const lo = Math.max(0, Math.min(count - 1, Math.floor(s.nav)));
  const hi = Math.min(count - 1, lo + 1);
  const out: NamePlate[] = [];
  for (const k of lo === hi ? [lo] : [lo, hi]) {
    const d = k - s.nav;
    const t = Math.min(1, Math.abs(d) / 0.75);
    const alpha = 1 - t * t * (3 - 2 * t);
    if (alpha > 0.01) out.push({ alb: k, alpha, shift: d });
  }
  return out.length ? out : single;
}
