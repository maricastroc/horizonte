export interface InputActions {
  markIntent(): void;
  resize(): void;
  setReducedMotion(reduced: boolean): void;
  pointTo(nx: number, ny: number): void;
  teleportTo(nx: number, ny: number): void;
  beginPan(): void;
  panBy(stepPx: number, totalPx: number, viewportW: number): void;
  endPan(tap: boolean): void;
  wheelBy(deltaY: number, deltaX: number): void;
  primary(): void;
  back(): void;
  stepFocus(dir: number): void;
}

export interface InputOptions {
  isUiTarget: (e: Event) => boolean;
}

const TAP_PX = 7;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export const prefersReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;

export const hasCoarsePointer = () => window.matchMedia("(pointer: coarse)").matches;

export function bindInput(actions: InputActions, { isUiTarget }: InputOptions): () => void {
  let down = false;
  let moved = 0;
  let lastX = 0;
  let startX = 0;

  const onResize = () => actions.resize();

  const onMotion = (e: MediaQueryListEvent) => actions.setReducedMotion(e.matches);

  const onMove = (e: PointerEvent) => {
    actions.markIntent();
    const w = window.innerWidth;
    actions.pointTo(e.clientX / w, e.clientY / window.innerHeight);
    if (down) {
      const step = e.clientX - lastX;
      moved += Math.abs(step);
      actions.panBy(step, e.clientX - startX, w);
    }
    lastX = e.clientX;
  };

  const onDown = (e: PointerEvent) => {
    actions.markIntent();
    if (isUiTarget(e)) return;
    down = true;
    moved = 0;
    lastX = e.clientX;
    startX = e.clientX;
    actions.beginPan();
    if (e.pointerType !== "mouse") {
      actions.teleportTo(e.clientX / window.innerWidth, e.clientY / window.innerHeight);
    }
  };

  const onUp = (e: PointerEvent) => {
    const estavaPressionado = down;
    down = false;
    if (!estavaPressionado || isUiTarget(e)) return;
    actions.endPan(moved < TAP_PX);
  };

  const onWheel = (e: WheelEvent) => {
    if (isUiTarget(e)) return;
    e.preventDefault();
    actions.markIntent();
    actions.wheelBy(e.deltaY, e.deltaX);
  };

  const onKey = (e: KeyboardEvent) => {
    actions.markIntent();
    const naUi = isUiTarget(e);

    if (e.code === "Space" || e.key === "Enter") {
      if (naUi) return;
      e.preventDefault();
      actions.primary();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      actions.back();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      if (naUi) return;
      e.preventDefault();
      actions.stepFocus(1);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      if (naUi) return;
      e.preventDefault();
      actions.stepFocus(-1);
    }
  };

  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);
  const motion = window.matchMedia(REDUCED_MOTION);
  motion.addEventListener("change", onMotion);

  return () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("keydown", onKey);
    motion.removeEventListener("change", onMotion);
  };
}
